import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { getFlightFloor } from '../src/game/flight';
import { REGION_VOLUMES } from '../src/game/landmarks';
import { getTerrainHeight, lakeDistance } from '../src/game/world';
import { createSceneryKit } from '../src/rendering/scenery/kit';
import { buildWaterArchitecture } from '../src/rendering/scenery/water/architecture';

function createArchitecture() {
  const original = globalThis.document;
  globalThis.document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({ fillStyle: '', fillRect() {} }),
    }),
  } as unknown as Document;
  const kit = createSceneryKit('water', ['#eee', '#abc', '#5ab', '#975', '#edc', '#897']);
  try {
    buildWaterArchitecture(kit);
    return kit;
  } catch (error) {
    kit.dispose();
    throw error;
  } finally {
    globalThis.document = original;
  }
}

test('coastal buildings use water terrain and stay inside their walking and flight colliders', () => {
  const kit = createArchitecture();
  try {
    const buildingNames = [
      'water-pearl-sanctuary',
      'water-sanctuary-pavilion--1',
      'water-sanctuary-pavilion-1',
      'water-striped-lighthouse',
      'water-flat-roof-house',
      'water-harbor-market',
    ];
    for (const name of buildingNames) {
      const building = kit.staticRoot.getObjectByName(name);
      assert(building, name);
      const { x, y, z } = building.position;
      assert.equal(y, getTerrainHeight(x, z, 'water'), name);
      assert(lakeDistance(x, z, 'water') > 1, `${name} stays on dry coastal land`);
      const volume = REGION_VOLUMES.water.find(
        (candidate) => candidate.x === x && candidate.z === z,
      );
      assert(volume, `${name} has a collision footprint`);
      building.position.set(0, 0, 0);
      const bounds = new THREE.Box3().setFromObject(building);
      assert(bounds.min.x >= -volume.halfX - 0.001, `${name}: west edge`);
      assert(bounds.max.x <= volume.halfX + 0.001, `${name}: east edge`);
      assert(bounds.min.z >= -volume.halfZ - 0.001, `${name}: north edge`);
      assert(bounds.max.z <= volume.halfZ + 0.001, `${name}: south edge`);
      assert(bounds.max.y <= volume.height, `${name}: flight clearance`);
    }
  } finally {
    kit.dispose();
  }
});

test('sailboats remain on the bay surface after batching and coastal resources dispose exactly once', () => {
  const scene = createArchitecture().finish();
  try {
    const boats = [17, 33, 61].map((x) => scene.group.getObjectByName(`water-sailboat-${x}`));
    assert(boats.every((boat) => boat));
    const first = boats[0]!.position.clone();
    for (let time = 0; time < 30; time += 0.5) {
      scene.update(time, true);
      for (const boat of boats) {
        assert(boat);
        assert(lakeDistance(boat.position.x, boat.position.z, 'water') < 1);
        assert(boat.position.y >= 0.43 && boat.position.y <= 0.67, 'boats bob at water level');
      }
    }
    assert(!boats[0]!.position.equals(first));
    const resources = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture>();
    let draws = 0;
    scene.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      draws++;
      resources.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        resources.add(material);
        if ('map' in material && material.map instanceof THREE.Texture) resources.add(material.map);
      }
    });
    assert(draws <= 40, `coastal ornament should remain batched; got ${draws}`);
    const counts = new Map([...resources].map((resource) => [resource, 0]));
    for (const resource of resources)
      resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource)! + 1));
    scene.dispose();
    scene.dispose();
    scene.update(100);
    assert([...counts.values()].every((count) => count === 1));
    assert.equal(scene.group.children.length, 0);
  } finally {
    scene.dispose();
  }
});

test('sailboat collision envelopes clear the complete animated hull, sails and mast', () => {
  const scene = createArchitecture().finish();
  try {
    const boats = [17, 33, 61].map((x) => {
      const boat = scene.group.getObjectByName(`water-sailboat-${x}`)!;
      const volume = REGION_VOLUMES.water.find(
        (entry) => entry.x === x && entry.z === boat.position.z,
      )!;
      assert.ok(volume, `${boat.name} has a flight collider`);
      return { boat, volume };
    });
    for (let time = 0; time < 120; time += 0.25) {
      scene.update(time, true);
      for (const { boat, volume } of boats) {
        const bounds = new THREE.Box3().setFromObject(boat);
        const top = getTerrainHeight(volume.x, volume.z, 'water') + volume.height;
        assert.ok(bounds.min.x >= volume.x - volume.halfX, `${boat.name}: west rocking extent`);
        assert.ok(bounds.max.x <= volume.x + volume.halfX, `${boat.name}: east rocking extent`);
        assert.ok(bounds.min.z >= volume.z - volume.halfZ, `${boat.name}: north rocking extent`);
        assert.ok(bounds.max.z <= volume.z + volume.halfZ, `${boat.name}: south rocking extent`);
        assert.ok(bounds.max.y <= top, `${boat.name}: bobbing mast height`);
        for (const x of [bounds.min.x, bounds.max.x])
          for (const z of [bounds.min.z, bounds.max.z])
            assert.ok(
              getFlightFloor(x, z, 'water') >= bounds.max.y + 3,
              `${boat.name}: rider clearance`,
            );
      }
    }
  } finally {
    scene.dispose();
  }
});
