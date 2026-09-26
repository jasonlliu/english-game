import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { createHero } from '../src/rendering/models/hero';
import { createCompanion } from '../src/rendering/models/ember';
import { createPet } from '../src/rendering/models/pets';
import {
  quadrupedPhase,
  readLocomotion,
  sampleFootstep,
  sampleSuspension,
} from '../src/rendering/models/locomotion';
import type { ModelRig } from '../src/rendering/models/types';

const TAU = Math.PI * 2;
const petIds = ['ember', 'ripple', 'cinder', 'moss', 'bolt', 'lumi'] as const;

function jointPose(model: ModelRig) {
  const values: number[] = [];
  model.group.traverse((part) => {
    if (/^(hero-(hip|knee|ankle|shoulder|elbow)|pet-(hip|knee|ankle|foot))-/.test(part.name)) {
      values.push(...part.position.toArray(), part.rotation.x, part.rotation.y, part.rotation.z);
    }
  });
  assert.ok(values.length > 0);
  return values;
}

test('explicit distance phase is independent of elapsed time, speed, and legacy cadence changes', () => {
  assert.equal(readLocomotion(10, 0.1).phase, readLocomotion(10, 1).phase);
  assert.equal(readLocomotion(10, 0.1, 0, { phase: 2, run: 0 }).phase, 2);
  assert.equal(readLocomotion(1000, 1, 0, { phase: 2, run: 1 }).phase, 2);
  for (const make of [createHero, ...petIds.map((id) => () => createPet(id, 3))]) {
    const model = make();
    try {
      model.animate(10, 1, 0, { phase: 0.9, run: 0.6 });
      const first = jointPose(model);
      model.animate(500, 1, 0, { phase: 0.9, run: 0.6 });
      assert.deepEqual(jointPose(model), first);
      model.animate(500, 1, 0, { phase: 0.9 + TAU, run: 0.6 });
      assert.ok(jointPose(model).every((value, i) => Math.abs(value - first[i]) < 1e-10));
    } finally {
      model.dispose();
    }
  }
});

test('support moves at constant speed and return arcs keep position and velocity continuous', () => {
  for (const duty of [0.12, 0.25, 0.38, 0.52, 0.64]) {
    const sample = (phase: number) => sampleFootstep(phase, 0.6, 0.25, duty);
    const a = sample(TAU * duty * 0.25),
      b = sample(TAU * duty * 0.75);
    assert.equal(a.lift, 0);
    assert.equal(b.lift, 0);
    assert.ok(Math.abs(b.z - a.z - 0.6) < 1e-12);
    for (const at of [0, duty * TAU, TAU]) {
      const epsilon = 1e-6;
      const left = sample(at - epsilon),
        middle = sample(at),
        right = sample(at + epsilon);
      for (const key of ['z', 'lift', 'pitch'] as const) {
        assert.ok(Math.abs(left[key] - right[key]) < 1e-5, `${key}: no pose snap at ${at}`);
        assert.ok(
          Math.abs((middle[key] - left[key]) / epsilon - (right[key] - middle[key]) / epsilon) <
            0.002,
          `${key}: no velocity snap at ${at}`,
        );
      }
    }
    for (let i = 0; i <= 200; i++) {
      const step = sample((i * TAU) / 200);
      assert.ok(step.lift >= 0 && step.lift <= 0.25);
      assert.ok(
        Math.abs(step.z) < 0.63,
        'Brief support must not fling the paw beyond its return arc',
      );
    }
  }
});

test('walking feet use four beats and running diagonal pairs share support and suspension', () => {
  const walk = [0, 1, 2, 3].map((index) => quadrupedPhase(0, index, 0));
  assert.equal(new Set(walk).size, 4);
  const run = [0, 1, 2, 3].map((index) => quadrupedPhase(0, index, 1));
  assert.equal(run[0], run[3]);
  assert.equal(run[1], run[2]);
  for (const duty of [0.12, 0.25]) {
    assert.equal(sampleSuspension((TAU * duty) / 2, duty), 0);
    assert.equal(sampleSuspension(TAU * (0.5 + duty / 2), duty), 0);
    assert.ok(sampleSuspension((TAU * (duty + 0.5)) / 2, duty) > 0.99);
  }
});

test('human planted soles stay near the ground and counter actual travel through walk/run blends', () => {
  const hero = createHero();
  try {
    const ankle = hero.group.getObjectByName('hero-ankle--1')!;
    for (const run of [0, 0.5, 1]) {
      const phase = TAU * 0.04;
      hero.animate(0, 1, 0, { phase, run });
      const first = ankle.localToWorld(new THREE.Vector3(0, -0.17, 0));
      hero.animate(0, 1, 0, { phase: phase + TAU * 0.01, run });
      const second = ankle.localToWorld(new THREE.Vector3(0, -0.17, 0));
      assert.ok(Math.abs(first.y) < 0.012 && Math.abs(second.y) < 0.012);
      assert.ok(Math.abs(second.z - first.z - (2.4 + run * 1.3) * 0.01) < 0.001);
      assert.ok(hero.group.getObjectByName('hero-knee--1')!.rotation.x < 0);
    }
  } finally {
    hero.dispose();
  }
});

test('pet profiles include growth and wrapper scale, with a running cadence suitable for following', () => {
  const raw = createCompanion(3),
    wrapped = createPet('ember', 3);
  try {
    for (const key of ['walkSpeed', 'runSpeed', 'walkStride', 'runStride'] as const) {
      assert.ok(Math.abs(wrapped.locomotion![key] - raw.locomotion![key] * 0.68) < 1e-12);
    }
  } finally {
    raw.dispose();
    wrapped.dispose();
  }
  for (const id of petIds) {
    const small = createPet(id, 0),
      grown = createPet(id, 3);
    try {
      for (const model of [small, grown]) {
        const profile = model.locomotion!;
        assert.ok(profile.walkStride > 0 && profile.runStride > profile.walkStride);
        assert.ok(profile.runSpeed > profile.walkSpeed);
        assert.ok(
          4.2 / profile.runStride < 3,
          `${id}: follow should not require frantic leg cycles`,
        );
      }
      assert.ok(grown.locomotion!.runStride > small.locomotion!.runStride);
    } finally {
      small.dispose();
      grown.dispose();
    }
  }
});

test('all gait blends remain finite and continuous, and flight/riding restores the same ground pose', () => {
  const models = [createHero(), ...petIds.map((id) => createPet(id, 3))];
  try {
    for (const model of models) {
      for (let i = 0; i <= 40; i++) {
        const phase = (i * TAU) / 40,
          run = i / 40;
        model.animate(20, 0.9, 0, { phase, run });
        const before = jointPose(model);
        model.animate(20, 0.900001, 0, { phase: phase + 1e-6, run: run + 1e-6 });
        assert.ok(
          jointPose(model).every(
            (value, index) => Number.isFinite(value) && Math.abs(value - before[index]) < 0.02,
          ),
        );
      }
      const motion = { phase: 1.7, run: 0.8 };
      model.animate(3, 1, 0, motion);
      const ground = jointPose(model);
      model.setRiding?.(true);
      model.setFlying?.(true);
      model.animate(3, 1, 0);
      assert.ok(model.riderHip?.toArray().every(Number.isFinite) ?? true);
      assert.ok(model.rideSeat?.toArray().every(Number.isFinite) ?? true);
      model.setRiding?.(false);
      model.setFlying?.(false);
      model.animate(3, 1, 0, motion);
      assert.deepEqual(jointPose(model), ground);
      model.animate(Number.MAX_VALUE, Infinity, NaN, { phase: Infinity, run: NaN });
      model.group.updateMatrixWorld(true);
      model.group.traverse((part) => assert.ok(part.matrixWorld.elements.every(Number.isFinite)));
    }
  } finally {
    models.forEach((model) => model.dispose());
  }
});
