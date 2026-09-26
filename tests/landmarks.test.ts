import assert from 'node:assert/strict';
import { test } from 'node:test';
import { REGION_IDS, type RegionId } from '../src/game/adventure';
import { FLIGHT_CEILING, findLandingSpot, getFlightFloor, moveFlight } from '../src/game/flight';
import { REGION_PLACES, REGION_VOLUMES, distanceToVolume } from '../src/game/landmarks';
import { CRYSTAL_POSITIONS, SPAWN_POSITION, WORLD_BOUNDS, getNavigationPath, getTerrainHeight, isWalkable, resolveMovement, type WorldPoint } from '../src/game/world';

const distance = (a: WorldPoint, b: WorldPoint) => Math.hypot(a.x - b.x, a.z - b.z);

function assertRoute(region: RegionId, from: WorldPoint, to: WorldPoint) {
  const path = getNavigationPath(from, to, region);
  assert.ok(path.length > 0, `${region}: no route to ${JSON.stringify(to)}`);
  assert.deepEqual(path.at(-1), to);
  let current = from;
  for (const next of path) {
    const count = Math.max(1, Math.ceil(distance(current, next) / .08));
    for (let i = 0; i <= count; i++) {
      const x = current.x + (next.x - current.x) * i / count;
      const z = current.z + (next.z - current.z) * i / count;
      assert.equal(isWalkable(x, z, .6, region), true, `${region}: path crosses a wall at ${x}, ${z}`);
    }
    assert.ok(distance(resolveMovement(current, next, region), next) < .001, `${region}: movement cannot follow navigation`);
    current = next;
  }
}

test('all six regions retain reachable seals, wild pets, temple entrances and named viewpoints', () => {
  for (const region of REGION_IDS) {
    const destinations = [...CRYSTAL_POSITIONS, ...REGION_PLACES[region], { x: -10.8, z: -21.7 }];
    for (const destination of destinations) {
      assertRoute(region, SPAWN_POSITION, destination);
      assertRoute(region, destination, SPAWN_POSITION);
    }
  }
});

test('solid regional buildings block their footprints while high bridges remain passable underneath', () => {
  for (const region of REGION_IDS) {
    for (const volume of REGION_VOLUMES[region].filter(volume => (volume.minY ?? 0) < 2.6)) {
      assert.equal(isWalkable(volume.x, volume.z, .6, region), false, `${region}: ${volume.id} is not solid`);
      assert.deepEqual(getNavigationPath(SPAWN_POSITION, volume, region), []);
    }
  }
  for (const [region, point] of [
    ['steel', { x: 12, z: -17 }], ['earth', { x: -36, z: -36 }], ['fairy', { x: -23, z: 8 }],
  ] as const) {
    assert.equal(isWalkable(point.x, point.z, .6, region), true, `${region}: an elevated structure blocks the ground`);
    assertRoute(region, SPAWN_POSITION, point);
  }
});

test('flight clears the entire roof footprint of every region landmark', () => {
  for (const region of REGION_IDS) for (const volume of REGION_VOLUMES[region]) {
    const safeRoof = getTerrainHeight(volume.x, volume.z) + volume.height + 3;
    assert.ok(safeRoof < FLIGHT_CEILING - 6, `${region}: ${volume.id} is too tall for the available flight clearance`);
    for (const dx of [-volume.halfX, 0, volume.halfX]) for (const dz of [-volume.halfZ, 0, volume.halfZ]) {
      const x = volume.x + dx, z = volume.z + dz;
      assert.ok(getFlightFloor(x, z, region) >= safeRoof - 1e-8, `${region}: flight clips ${volume.id}`);
      const moved = moveFlight({ x, y: 0, z }, { x: 0, z: 0 }, -1, .1, region);
      assert.ok(moved.y >= safeRoof - 1e-8);
      assert.ok(moved.y <= FLIGHT_CEILING);
    }
  }
});

test('landing from each landmark finds clear reachable ground outside roofs and within flight boundaries', () => {
  for (const region of REGION_IDS) for (const volume of REGION_VOLUMES[region]) {
    const spot = findLandingSpot(volume, region);
    assert.equal(isWalkable(spot.x, spot.z, 1.1, region), true, `${region}: landing from ${volume.id} is blocked`);
    assert.ok(spot.x >= WORLD_BOUNDS.minX + 1.5 && spot.x <= WORLD_BOUNDS.maxX - 1.5);
    assert.ok(spot.z >= WORLD_BOUNDS.minZ + 1.5 && spot.z <= WORLD_BOUNDS.maxZ - 1.5);
    for (const other of REGION_VOLUMES[region]) {
      assert.ok(distanceToVolume(spot.x, spot.z, other) >= 2.1, `${region}: landing would descend through ${other.id}`);
    }
    assert.deepEqual(findLandingSpot(spot, region), spot, `${region}: an accepted landing point must also be a safe takeoff point`);
    const arrived = moveFlight({ ...spot, y: FLIGHT_CEILING }, { x: 0, z: 0 }, 0, 0, region);
    assert.ok(distance(arrived, spot) < 1e-8, `${region}: flight would clamp the landing point`);
  }
});
