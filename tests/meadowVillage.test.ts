import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { REGION_VOLUMES } from '../src/game/landmarks';
import { getTerrainHeight } from '../src/game/world';
import { createSceneryKit } from '../src/rendering/scenery/kit';
import { buildMeadowVillage } from '../src/rendering/scenery/meadow/village';

const createVillage = () => {
  const kit = createSceneryKit('village-test', ['#ddd', '#999', '#579', '#643', '#eed', '#795']);
  buildMeadowVillage(kit);
  return kit;
};

test('differentiated village buildings retain their terrain anchors and navigation footprints', () => {
  const kit = createVillage();
  try {
    for (const building of kit.staticRoot.children) {
      const volume = REGION_VOLUMES.meadow.find(
        (candidate) => candidate.x === building.position.x && candidate.z === building.position.z,
      );
      assert(volume);
      assert.equal(building.position.y, getTerrainHeight(volume.x, volume.z));
      // Smoke can drift above the roof; only the solid structure blocks movement.
      building.getObjectByName('meadow-chimney-smoke')?.removeFromParent();
      building.position.set(0, 0, 0);
      const bounds = new THREE.Box3().setFromObject(building);
      assert(bounds.min.x >= -volume.halfX - 1e-6, `${volume.id}: west edge`);
      assert(bounds.max.x <= volume.halfX + 1e-6, `${volume.id}: east edge`);
      assert(bounds.min.z >= -volume.halfZ - 1e-6, `${volume.id}: north edge`);
      assert(bounds.max.z <= volume.halfZ + 1e-6, `${volume.id}: south edge`);
      assert(bounds.max.y <= volume.height, `${volume.id}: flight clearance`);
    }
  } finally {
    kit.dispose();
  }
});

test('village animation survives static batching and disposes its shared geometry once', () => {
  const scene = createVillage().finish();
  const banner = scene.group.getObjectByName('meadow-inn-banner');
  const smoke = scene.group.getObjectByName('meadow-chimney-smoke');
  assert(banner && smoke);
  scene.update(0);
  const first = smoke.children[0].position.clone();
  scene.update(1);
  assert.notEqual(banner.rotation.x, 0);
  assert(!smoke.children[0].position.equals(first));
  const resources = new Set<THREE.BufferGeometry | THREE.Material>();
  let draws = 0;
  scene.group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    draws++;
    resources.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material])
      resources.add(material);
  });
  assert(draws < 20, `decorative parts should remain batched; got ${draws}`);
  const disposed = new Map([...resources].map((resource) => [resource, 0]));
  for (const resource of resources)
    resource.addEventListener('dispose', () => disposed.set(resource, disposed.get(resource)! + 1));
  scene.dispose();
  scene.dispose();
  assert([...disposed.values()].every((count) => count === 1));
});
