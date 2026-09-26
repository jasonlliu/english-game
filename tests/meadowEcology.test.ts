import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import {
  createWildlifeSimulation,
  createMeadowWildlife,
  MEADOW_BIRD_PERCHES,
} from '../src/rendering/scenery/meadow/wildlife';
import { FIELD_SPECIES } from '../src/game/fieldActivities';
import { createObservationRun, stepObservation } from '../src/game/fieldActivityRules';
import { isWalkable } from '../src/game/world';
import { createAmbientLife } from '../src/rendering/world/createAmbientLife';
import { createWorldRenderContext } from '../src/rendering/world/context';

const distance = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.hypot(a.x - b.x, a.z - b.z);

test('continuous pursuit cannot displace any animal beyond its habitat, and quiet lets it return', () => {
  for (const kind of FIELD_SPECIES) {
    const simulation = createWildlifeSimulation();
    const subject = simulation.animals.find((animal) => animal.kind === kind)!;
    for (let frame = 0; frame < 2400; frame++) {
      simulation.update(frame * 0.05, {
        position: { x: subject.x + 2, z: subject.z },
        running: true,
        delta: 0.05,
      });
      for (const animal of simulation.animals) {
        assert(distance(animal, animal.home) <= animal.homeRadius + 1e-8, animal.id);
        assert(isWalkable(animal.x, animal.z), animal.id);
      }
    }
    assert(subject.startled);
    for (let frame = 0; frame < 1600; frame++)
      simulation.update(120 + frame * 0.05, {
        position: { x: 1000, z: 1000 },
        running: false,
        delta: 0.05,
      });
    assert.equal(subject.startled, false);
    assert.equal(subject.returning, false, `${kind} reaches its home after being chased`);
    assert(distance(subject, subject.home) <= subject.homeRadius * 0.85, kind);
  }
});

test('all five relocated species still support the actual three-second observation rule', () => {
  for (const kind of FIELD_SPECIES) {
    const simulation = createWildlifeSimulation();
    const subject = simulation.animals.find((animal) => animal.kind === kind)!;
    let visitor = { x: subject.x + 6, z: subject.z };
    for (let attempt = 0; !isWalkable(visitor.x, visitor.z) && attempt < 16; attempt++)
      visitor = {
        x: subject.x + Math.sin(attempt * 0.5) * 6,
        z: subject.z + Math.cos(attempt * 0.5) * 6,
      };
    assert(isWalkable(visitor.x, visitor.z), `${kind} has an accessible observation spot`);
    let observation = createObservationRun();
    let completed = false;
    for (let frame = 0; frame < 240; frame++) {
      simulation.update(frame / 60, {
        position: visitor,
        running: false,
        delta: 1 / 60,
        observingId: subject.id,
      });
      const result = stepObservation(observation, {
        candidateId: distance(subject, visitor) <= 9 ? subject.id : null,
        speed: 0,
        delta: 1 / 60,
        paused: false,
        startled: subject.startled,
        requested: true,
      });
      observation = result.state;
      completed ||= result.completedId === subject.id;
    }
    assert(completed, `${kind} can be recorded without chasing it`);
  }
});

test('deer alternate grazing and drinking, then lift their heads for a quiet nearby traveller', () => {
  const simulation = createWildlifeSimulation();
  const deer = simulation.animals[0];
  const behaviors = new Set<string>();
  for (let frame = 0; frame < 1600; frame++) {
    simulation.update(frame * 0.05, {
      position: { x: 1000, z: 1000 },
      running: false,
      delta: 0.05,
    });
    behaviors.add(deer.behavior);
  }
  assert(behaviors.has('graze'));
  assert(behaviors.has('drink'));
  assert(behaviors.has('wander'));
  const visitor = { x: deer.x + 6, z: deer.z };
  for (let frame = 0; frame < 60; frame++)
    simulation.update(80 + frame * 0.05, { position: visitor, running: false, delta: 0.05 });
  assert.equal(deer.behavior, 'alert');
  assert(deer.alert > 0.99);
  assert.equal(deer.startled, false);
});

test('the guide bird waits on low branches, makes a short intentional flight, and rests for observation', () => {
  const simulation = createWildlifeSimulation();
  const bird = simulation.animals.find((animal) => animal.kind === 'bird')!;
  const visitor = { x: bird.x + 6, z: bird.z };
  const states = new Set<string>();
  for (let frame = 0; frame < 220; frame++) {
    simulation.update(frame * 0.05, { position: visitor, running: false, delta: 0.05 });
    states.add(bird.behavior);
  }
  assert(states.has('guide'));
  assert(states.has('perch'));
  assert(MEADOW_BIRD_PERCHES.some((perch) => distance(bird, perch) < 0.4));
  assert.equal(bird.behavior, 'perch');
  const perch = { x: bird.x, z: bird.z };
  for (let frame = 0; frame < 200; frame++)
    simulation.update(11 + frame * 0.05, {
      position: { x: perch.x + 6, z: perch.z },
      running: false,
      delta: 0.05,
      observingId: bird.id,
    });
  assert(distance(bird, perch) < 0.05, 'Holding an observation does not launch a new guide flight');
  assert.equal(bird.startled, false);
});

test('the sparse encounter still batches all anatomy and perch details into three draw calls', () => {
  const wildlife = createMeadowWildlife();
  try {
    const batches: THREE.InstancedMesh[] = [];
    wildlife.group.traverse((object) => {
      if (object instanceof THREE.InstancedMesh) batches.push(object);
    });
    assert.equal(batches.length, 3);
    assert(batches.reduce((sum, batch) => sum + batch.count, 0) <= 180);
    for (const index of MEADOW_BIRD_PERCHES.keys())
      assert(wildlife.group.getObjectByName(`meadow-bird-perch-${index}`));
    assert.equal(wildlife.observe().length, 7);
  } finally {
    wildlife.dispose();
  }
});

test('authored meadow ecology is not duplicated by generic ambient birds and butterflies', () => {
  const context = createWorldRenderContext('meadow');
  const resourcesBefore = context.geometryResources.length;
  const ambient = createAmbientLife(context);
  try {
    const meshes: THREE.Mesh[] = [];
    context.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) meshes.push(object);
    });
    assert.equal(
      meshes.length,
      0,
      'The ambient layer must not inject another flock or butterfly swarm',
    );
    assert.equal(
      context.geometryResources.length,
      resourcesBefore + 1,
      'Only the dust geometry is allocated',
    );
    const dust = context.scene.getObjectByName('ambient-dust') as THREE.Points;
    assert.equal(dust.geometry.attributes.position.count, 16);
    assert((dust.material as THREE.PointsMaterial).opacity <= 0.25);
    ambient.update(10, { x: 5, z: 6 }, 3);
    assert.deepEqual(dust.position.toArray(), [5, 3, 6]);
    let disposed = 0;
    dust.geometry.addEventListener('dispose', () => disposed++);
    context.dispose();
    context.dispose();
    assert.equal(disposed, 1);
  } finally {
    context.dispose();
  }
});
