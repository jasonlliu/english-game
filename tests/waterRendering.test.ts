import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { getCrystalPositions, getTerrainHeight, isWalkable } from '../src/game/world';
import { createWorldRenderContext } from '../src/rendering/world/context';
import { createTerrain } from '../src/rendering/world/createTerrain';
import { createWater } from '../src/rendering/world/createWater';
import { createWorldInteractions } from '../src/rendering/world/createWorldInteractions';

test('water terrain mesh follows its coastal physics rather than the meadow height field', () => {
  const context = createWorldRenderContext('water');
  try {
    const terrain = createTerrain(context);
    const points = terrain.geometry.getAttribute('position');
    let different = 0;
    for (let i = 0; i < points.count; i += 137) {
      const x = points.getX(i),
        z = points.getZ(i),
        height = points.getY(i);
      assert.ok(Math.abs(height - getTerrainHeight(x, z, 'water')) < 0.00001);
      if (Math.abs(height - getTerrainHeight(x, z, 'meadow')) > 1) different++;
    }
    assert.ok(different > 200, 'coastline, basin and flat coast must differ across the map');
  } finally {
    context.dispose();
  }
});

test('water surface spans the regional bay, and collectible visuals match reachable regional coordinates', () => {
  const context = createWorldRenderContext('water');
  createWater(context, []);
  const water = context.scene.children[0] as THREE.Mesh;
  water.geometry.computeBoundingBox();
  const size = water.geometry.boundingBox!.getSize(new THREE.Vector3());
  assert.ok(size.x > 80 && size.z > 85, 'the second scene must display the full expanded bay');
  const interactions = createWorldInteractions(context, false);
  assert.equal(context.scene.getObjectByName('inland-ruin-decor'), undefined);
  for (const [index, point] of getCrystalPositions('water').entries()) {
    const actual = interactions.crystals[index].position;
    assert.equal(actual.x, point.x);
    assert.equal(actual.z, point.z);
    assert.equal(actual.y, getTerrainHeight(point.x, point.z, 'water') + 1.9);
    assert.ok(isWalkable(point.x, point.z, 0.6, 'water'));
  }
  const resources = new Set([...context.geometryResources, ...context.materialResources]);
  const releases = new Map([...resources].map((resource) => [resource, 0]));
  for (const resource of resources)
    resource.addEventListener('dispose', () => releases.set(resource, releases.get(resource)! + 1));
  interactions.update(12, 0.016, new Set(), false);
  context.dispose();
  context.dispose();
  assert.ok([...releases.values()].every((count) => count === 1));
});
