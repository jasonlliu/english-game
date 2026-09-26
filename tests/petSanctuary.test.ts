import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { REGION_IDS } from '../src/game/adventure';
import { createPetSanctuary } from '../src/rendering/scenery/petSanctuary';

test('encounter habitats remain bounded and release every visible resource across visits', () => {
  for (const region of REGION_IDS) {
    const sanctuary = createPetSanctuary(region, -10.8, -21.7);
    const resources = new Set<THREE.BufferGeometry | THREE.Material>();
    let meshes = 0;
    sanctuary.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      meshes++;
      resources.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        resources.add(material);
    });
    assert.ok(meshes <= 18, `${region}: static habitat details should be batched`);
    const released = new Map([...resources].map((resource) => [resource, 0]));
    for (const resource of resources)
      resource.addEventListener('dispose', () =>
        released.set(resource, released.get(resource)! + 1),
      );
    const count = sanctuary.group.children.length;
    for (const time of [0, 1, 30, 1000]) {
      sanctuary.update(time, time > 1);
      const bounds = new THREE.Box3().setFromObject(sanctuary.group);
      assert.ok([...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite));
      assert.ok(bounds.max.x - bounds.min.x < 9 && bounds.max.z - bounds.min.z < 9);
      assert.equal(sanctuary.group.children.length, count, 'animation must not append particles');
    }
    sanctuary.dispose();
    sanctuary.dispose();
    assert.ok(
      [...released.values()].every((count) => count === 1),
      `${region}: release GPU resources once`,
    );
    assert.equal(sanctuary.group.children.length, 0);
  }
});
