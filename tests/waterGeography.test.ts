import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findLandingSpot, getFlightFloor, moveFlight } from '../src/game/flight';
import { REGION_PLACES, REGION_VOLUMES } from '../src/game/landmarks';
import {
  LAKE,
  SPAWN_POSITION,
  getCrystalPositions,
  getNavigationPath,
  getRegionLake,
  getRegionTrails,
  getRegionZones,
  getTerrainHeight,
  getWorldObstacles,
  getWorldTrees,
  isWalkable,
  lakeDistance,
  resolveMovement,
  type WorldPoint,
} from '../src/game/world';

const distance = (a: WorldPoint, b: WorldPoint) => Math.hypot(a.x - b.x, a.z - b.z);
function assertWalkableSegment(from: WorldPoint, to: WorldPoint) {
  const count = Math.max(1, Math.ceil(distance(from, to) / 0.1));
  for (let i = 0; i <= count; i++) {
    const x = from.x + ((to.x - from.x) * i) / count;
    const z = from.z + ((to.z - from.z) * i) / count;
    assert.ok(isWalkable(x, z, 0.6, 'water'), `coastal path blocked at ${x}, ${z}`);
    assert.ok(getTerrainHeight(x, z, 'water') > getRegionLake('water').waterLevel);
  }
  assert.ok(distance(resolveMovement(from, to, 'water'), to) < 0.001);
}

test('the coast has a broad inlet and low limestone shore rather than meadow hills', () => {
  const coast = getRegionLake('water');
  assert.ok(coast.radiusX * coast.radiusZ > LAKE.radiusX * LAKE.radiusZ * 8);
  assert.ok(coast.x + coast.radiusX > 72, 'inlet opens beyond the eastern map edge');
  assert.ok(getTerrainHeight(coast.x, coast.z, 'water') < coast.waterLevel);
  assert.ok(lakeDistance(23, 3, 'water') < 1, 'the old meadow shore is now open water');
  for (const point of [SPAWN_POSITION, ...REGION_PLACES.water]) {
    assert.ok(getTerrainHeight(point.x, point.z, 'water') > coast.waterLevel);
    assert.ok(getTerrainHeight(point.x, point.z, 'water') < 2.1);
  }
  assert.ok(getTerrainHeight(-54, -27) - getTerrainHeight(-54, -27, 'water') > 5);
  for (let x = -72; x <= 72; x += 8)
    for (let z = -72; z <= 72; z += 8) {
      assert.ok(Number.isFinite(getTerrainHeight(x, z, 'water')));
      assert.equal(getTerrainHeight(x, z), getTerrainHeight(x, z, 'meadow'));
      assert.equal(getTerrainHeight(x, z, 'fire'), getTerrainHeight(x, z));
    }
});

test('water has sparse independent coastal stands and no invisible meadow obstacles', () => {
  const trees = getWorldTrees('water');
  assert.equal(getWorldTrees('water'), trees, 'tree positions must stay cached');
  assert.ok(trees.length >= 25 && trees.length <= 45);
  assert.deepEqual(new Set(trees.map((tree) => tree.variant)), new Set([0, 1]));
  const meadow = new Set(getWorldTrees().map((tree) => `${tree.x},${tree.z}`));
  for (const tree of trees) {
    assert.ok(!meadow.has(`${tree.x},${tree.z}`));
    assert.ok(lakeDistance(tree.x, tree.z, 'water') > 1.2);
    assert.ok(tree.x < 0 || tree.z < -50, 'coastal trees leave the inlet and harbor open');
  }
  assert.deepEqual(getWorldObstacles('water'), []);
  assert.ok(getWorldObstacles().length > 0);
});

test('every water seal and landmark remains reachable on foot in both directions', () => {
  assert.deepEqual(getRegionZones('water').shore, { x: 12, z: 36 });
  assert.notDeepEqual(getRegionZones().shore, getRegionZones('water').shore);
  for (const destination of [...getCrystalPositions('water'), ...REGION_PLACES.water]) {
    for (const [from, to] of [
      [SPAWN_POSITION, destination],
      [destination, SPAWN_POSITION],
    ]) {
      const route = getNavigationPath(from, to, 'water');
      assert.ok(route.length, `no coastal route to ${JSON.stringify(to)}`);
      assert.deepEqual(route.at(-1), to);
      let previous = from;
      for (const point of route) {
        assertWalkableSegment(previous, point);
        previous = point;
      }
    }
  }
});

test('the coastal trail network follows dry land without crossing old meadow lake paths', () => {
  assert.notDeepEqual(getRegionTrails('water'), getRegionTrails());
  for (const trail of getRegionTrails('water'))
    for (let i = 1; i < trail.length; i++) assertWalkableSegment(trail[i - 1], trail[i]);
  const stopped = resolveMovement(SPAWN_POSITION, { x: 65, z: 24 }, 'water');
  assert.ok(stopped.x < 15, 'walking must stop at the expanded shoreline');
  assert.ok(isWalkable(stopped.x, stopped.z, 0.6, 'water'));
  assert.deepEqual(getNavigationPath(SPAWN_POSITION, { x: 23, z: 3 }, 'water'), []);
});

test('coastal flight and landing agree with the expanded shoreline and building heights', () => {
  for (const from of [getRegionLake('water'), { x: 68, z: 10 }, { x: 20, z: -50 }]) {
    const landed = findLandingSpot(from, 'water');
    assert.ok(isWalkable(landed.x, landed.z, 1.1, 'water'));
    assert.ok(lakeDistance(landed.x, landed.z, 'water') >= 1.18);
    assert.ok(getTerrainHeight(landed.x, landed.z, 'water') > getRegionLake('water').waterLevel);
    assert.ok(getNavigationPath(landed, SPAWN_POSITION, 'water').length);
    assert.deepEqual(findLandingSpot(landed, 'water'), landed);
  }
  for (const volume of REGION_VOLUMES.water) {
    const floor = getFlightFloor(volume.x, volume.z, 'water');
    assert.ok(floor >= getTerrainHeight(volume.x, volume.z, 'water') + volume.height + 3 - 1e-8);
    const flight = moveFlight({ ...volume, y: -10 }, { x: 0, z: 0 }, -1, 0.1, 'water');
    assert.ok(flight.y >= floor);
  }
});

test('marine landmark clearance includes its height above the seabed and both palm silhouettes', () => {
  for (const [id, worldTop] of [
    ['sea-arch-west', 15.8],
    ['sea-arch-east', 15.8],
    ['sea-arch-span', 18.3],
    ['sea-stack-east', 17.55],
    ['sea-stack-north', 11.95],
    ['sea-stack-west', 10.85],
  ] as const) {
    const volume = REGION_VOLUMES.water.find((entry) => entry.id === id)!;
    assert.ok(volume, `${id} must reserve flight clearance`);
    assert.ok(getFlightFloor(volume.x, volume.z, 'water') >= worldTop + 3 - 1e-8);
  }
  for (const tree of getWorldTrees('water')) {
    const crownTop = getTerrainHeight(tree.x, tree.z, 'water') + tree.size * 7.4;
    assert.ok(getFlightFloor(tree.x, tree.z, 'water') >= crownTop + 3 - 1e-8);
  }
});
