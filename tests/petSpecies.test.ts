import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { createPet } from '../src/rendering/models/pets';

const species = ['ripple', 'cinder', 'moss', 'bolt', 'lumi'] as const;

test('distinct companion anatomy stays within the mobile model budget without growing resources during animation', () => {
  for (const id of species) {
    const model = createPet(id, 3);
    try {
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      let meshes = 0;
      let triangles = 0;
      model.group.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        meshes++;
        triangles +=
          (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material])
          materials.add(material);
      });
      assert.ok(meshes <= 64, `${id} mesh budget`);
      assert.ok(triangles <= 26000, `${id} triangle budget`);
      for (let i = 0; i < 240; i++) {
        model.setFlying?.(i >= 120);
        model.animate(i / 30, 0.8, 0, { phase: i * 0.08, run: 0.6 });
      }
      model.group.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        assert.ok(geometries.has(object.geometry), `${id} must reuse authored geometry`);
        for (const material of Array.isArray(object.material) ? object.material : [object.material])
          assert.ok(materials.has(material), `${id} must reuse authored materials`);
      });
    } finally {
      model.dispose();
    }
  }
});

test('both biped and quadruped planted feet counter travel through walk and run blends', () => {
  for (const id of species) {
    const model = createPet(id, 3);
    try {
      const ankle = model.group.getObjectByName('pet-ankle-0')!;
      const profile = model.locomotion!;
      for (const run of [0, 0.5, 1]) {
        model.animate(0, 1, 0, { phase: Math.PI * 2 * 0.025, run });
        const first = ankle.getWorldPosition(new THREE.Vector3());
        model.animate(0, 1, 0, { phase: Math.PI * 2 * 0.03, run });
        const second = ankle.getWorldPosition(new THREE.Vector3());
        const stride = profile.walkStride + (profile.runStride - profile.walkStride) * run;
        assert.ok(Math.abs(second.y - first.y) < 1e-10, `${id}: planted foot height`);
        assert.ok(
          Math.abs(second.z - first.z - stride * 0.005) < 1e-10,
          `${id}: planted foot travel`,
        );
      }
    } finally {
      model.dispose();
    }
  }
});

test('the new sky deer saddle anchor follows the animated flight rig and restores ground presentation', () => {
  const model = createPet('lumi', 3);
  try {
    assert.ok(model.rideSeat);
    model.animate(2, 0);
    const ground = model.rideSeat.clone();
    model.setFlying!(true);
    model.animate(2, 0);
    assert.ok(model.rideSeat.distanceTo(ground) > 0.01);
    assert.ok(model.rideSeat.y > 1, 'The rider sits above the deer body');
    model.setFlying!(false);
    model.animate(2, 0);
    assert.deepEqual(model.rideSeat.toArray(), ground.toArray());
  } finally {
    model.dispose();
  }
});
