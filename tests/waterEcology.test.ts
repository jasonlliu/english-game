import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { getTerrainHeight, getWorldTrees, lakeDistance } from '../src/game/world';
import { createSceneryKit } from '../src/rendering/scenery/kit';
import { buildWaterEcology } from '../src/rendering/scenery/water/ecology';

const createEcology = () => {
  const kit = createSceneryKit('water-ecology-test', [
    '#ddd',
    '#999',
    '#579',
    '#643',
    '#eed',
    '#795',
  ]);
  buildWaterEcology(kit);
  return kit;
};

test('coastal vegetation shares collision anchors and shore details stay on the water coastline', () => {
  const kit = createEcology();
  try {
    const trees = getWorldTrees('water');
    assert(trees.length >= 20 && trees.length <= 45, 'the bay has sparse coastal groves');
    for (const [index, tree] of trees.entries()) {
      const palm = kit.staticRoot.getObjectByName(`water-coastal-tree-${index}`);
      assert(palm);
      assert.deepEqual(palm.position.toArray(), [
        tree.x,
        getTerrainHeight(tree.x, tree.z, 'water'),
        tree.z,
      ]);
    }
    const shoreline = kit.staticRoot.children.filter((child) =>
      child.name.startsWith('water-shore-cluster'),
    );
    assert.equal(shoreline.length, 31);
    for (const cluster of shoreline) {
      const distance = lakeDistance(cluster.position.x, cluster.position.z, 'water');
      assert(distance >= 1.075 && distance < 1.1, `${cluster.name} follows the beach`);
    }
  } finally {
    kit.dispose();
  }
});

test('coastal wildlife moves after batching, stays in its habitat and owns all GPU resources', () => {
  const scenery = createEcology().finish();
  const gull = scenery.group.getObjectByName('water-gull-0');
  const bodies = scenery.group.getObjectByName('water-fish-school-bodies');
  const tails = scenery.group.getObjectByName('water-fish-school-tails');
  assert(gull && bodies instanceof THREE.InstancedMesh && tails instanceof THREE.InstancedMesh);
  assert.equal(bodies.count, 24);
  scenery.update(0);
  const before = gull.position.clone();
  const matrix = new THREE.Matrix4();
  for (let time = 0; time < 75; time += 0.75) {
    scenery.update(time);
    assert(Math.abs(gull.position.x) < 40 && Math.abs(gull.position.z) < 40);
    for (let i = 0; i < bodies.count; i++) {
      bodies.getMatrixAt(i, matrix);
      const position = new THREE.Vector3().setFromMatrixPosition(matrix);
      assert(lakeDistance(position.x, position.z, 'water') < 0.95, 'fish remain inside the bay');
      assert(position.y >= 0 && position.y < 2, 'fish swim at the surface and make short leaps');
    }
  }
  assert(!gull.position.equals(before));
  const resources = new Set<THREE.BufferGeometry | THREE.Material>();
  let draws = 0;
  scenery.group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    draws++;
    resources.add(object.geometry);
    for (const mat of Array.isArray(object.material) ? object.material : [object.material])
      resources.add(mat);
  });
  assert(draws < 55, `static details stay batched and fish stay instanced; got ${draws}`);
  const disposals = new Map([...resources].map((resource) => [resource, 0]));
  for (const resource of resources)
    resource.addEventListener('dispose', () =>
      disposals.set(resource, disposals.get(resource)! + 1),
    );
  scenery.dispose();
  scenery.dispose();
  scenery.update(200);
  assert([...disposals.values()].every((count) => count === 1));
});
