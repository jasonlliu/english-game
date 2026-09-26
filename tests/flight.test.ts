import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FLIGHT_CEILING, FLIGHT_SPEED, canPetFly, findLandingSpot, getFlightFloor, moveFlight,
  type FlightPosition,
} from '../src/game/flight';
import {
  LAKE, SPAWN_POSITION, WORLD_BOUNDS, WORLD_OBSTACLES, WORLD_TREES,
  getTerrainHeight, isWalkable, lakeDistance, type WorldPoint,
} from '../src/game/world';
import type { PetId } from '../src/game/adventure';

const distance = (a: WorldPoint, b: WorldPoint) => Math.hypot(a.x - b.x, a.z - b.z);

function assertSafeFlight(position: FlightPosition) {
  assert.ok([position.x, position.y, position.z].every(Number.isFinite));
  assert.ok(position.x >= WORLD_BOUNDS.minX && position.x <= WORLD_BOUNDS.maxX);
  assert.ok(position.z >= WORLD_BOUNDS.minZ && position.z <= WORLD_BOUNDS.maxZ);
  assert.ok(position.y >= getFlightFloor(position.x, position.z) - 1e-8);
  assert.ok(position.y <= FLIGHT_CEILING);
}

function assertSafeLanding(point: WorldPoint) {
  assert.ok(Number.isFinite(point.x) && Number.isFinite(point.z));
  assert.ok(point.x > WORLD_BOUNDS.minX && point.x < WORLD_BOUNDS.maxX);
  assert.ok(point.z > WORLD_BOUNDS.minZ && point.z < WORLD_BOUNDS.maxZ);
  assert.equal(isWalkable(point.x, point.z, 1.1), true);
  assert.ok(lakeDistance(point.x, point.z) > 1.1, 'Landing must clear the shoreline');
  for (const tree of WORLD_TREES) {
    assert.ok(distance(point, tree) > tree.size * 2.7, 'Landing must clear tree crowns, not only trunks');
  }
  for (const obstacle of WORLD_OBSTACLES) {
    assert.ok(distance(point, obstacle) > obstacle.radius + 1.1, 'Landing must clear the rider width around structures');
  }
}

test('only the winged ember form and lumi qualify as flying mounts', () => {
  for (const stage of [0, 1, 2, 3]) {
    assert.equal(canPetFly('lumi', stage), true);
    assert.equal(canPetFly('ember', stage), stage === 3);
    for (const pet of ['ripple', 'cinder', 'moss', 'bolt'] as PetId[]) assert.equal(canPetFly(pet, stage), false);
  }
  for (const id of [null, undefined, 'unknown' as PetId]) assert.equal(canPetFly(id, 3), false);
  for (const stage of [-1, 2.9, 4, NaN, Infinity]) assert.equal(canPetFly('ember', stage), false);
});

test('flight crosses the lake continuously while remaining above all scenery', () => {
  let position: FlightPosition = { x: 15, y: 60, z: LAKE.z };
  let crossedWater = false;
  for (let frame = 0; frame < 180; frame++) {
    const previous = position;
    position = moveFlight(position, { x: 1, z: 0 }, 0, 1 / 60);
    assertSafeFlight(position);
    assert.ok(position.x > previous.x);
    if (lakeDistance(position.x, position.z) < 1) crossedWater = true;
  }
  assert.equal(crossedWater, true);
  assert.ok(position.x > LAKE.x + LAKE.radiusX + 4);
});

test('horizontal flight is equally fast diagonally and cannot be accelerated by oversized input', () => {
  const from = { ...SPAWN_POSITION, y: 60 };
  const straight = moveFlight(from, { x: 1, z: 0 }, 0, 1 / 60);
  const diagonal = moveFlight(from, { x: 1, z: 1 }, 0, 1 / 60);
  const oversized = moveFlight(from, { x: 500, z: 500 }, 0, 1 / 60);
  assert.ok(Math.abs(distance(from, straight) - FLIGHT_SPEED / 60) < 1e-8);
  assert.ok(Math.abs(distance(from, diagonal) - distance(from, straight)) < 1e-8);
  assert.ok(distance(diagonal, oversized) < 1e-8);
  const gentleJoystick = moveFlight(from, { x: .25, z: 0 }, 0, 1 / 60);
  assert.ok(distance(from, gentleJoystick) < distance(from, straight));
  assert.deepEqual(from, { ...SPAWN_POSITION, y: 60 });
});

test('flight respects all four map edges and recovers out-of-bounds positions', () => {
  const cases = [
    { point: { x: WORLD_BOUNDS.minX + .1, z: 0 }, direction: { x: -1, z: 0 } },
    { point: { x: WORLD_BOUNDS.maxX - .1, z: 0 }, direction: { x: 1, z: 0 } },
    { point: { x: 0, z: WORLD_BOUNDS.minZ + .1 }, direction: { x: 0, z: -1 } },
    { point: { x: 0, z: WORLD_BOUNDS.maxZ - .1 }, direction: { x: 0, z: 1 } },
    { point: { x: 10000, z: -10000 }, direction: { x: 1, z: -1 } },
  ];
  for (const { point, direction } of cases) {
    assertSafeFlight(moveFlight({ ...point, y: 60 }, direction, 0, .1));
  }
});

test('minimum altitude clears the actual rendered terrain, tallest tree crowns and structures', () => {
  for (let x = -64; x <= 64; x += 8) for (let z = -64; z <= 64; z += 8) {
    assert.ok(getFlightFloor(x, z) >= getTerrainHeight(x, z) + 1);
  }
  for (const tree of WORLD_TREES.filter(tree => tree.variant === 0 && Math.abs(tree.x) < 70 && Math.abs(tree.z) < 70)) {
    // Pine geometry reaches 7.35 model units before scaling, plus rider clearance.
    assert.ok(getFlightFloor(tree.x, tree.z) > getTerrainHeight(tree.x, tree.z) + tree.size * 7.35 + .5);
  }
  for (const obstacle of WORLD_OBSTACLES.filter(obstacle => obstacle.radius > 5)) {
    // Cliff body center is at .65 * size and extends another 1.7 * size upwards.
    assert.ok(getFlightFloor(obstacle.x, obstacle.z) > getTerrainHeight(obstacle.x, obstacle.z) + obstacle.radius * 2.35 + .5);
  }
  assert.ok(getFlightFloor(LAKE.x, LAKE.z) > LAKE.waterLevel + 15, 'Clear the tallest lake landmark');
  assert.ok(getFlightFloor(-8, -27) > getTerrainHeight(-8, -27) + 7.6, 'Clear the temple arch');
});

test('descending never crosses the safe floor and ascending stops at the ceiling', () => {
  for (const point of [SPAWN_POSITION, { x: LAKE.x, z: LAKE.z }, WORLD_TREES[0], WORLD_OBSTACLES[0]]) {
    const low = moveFlight({ ...point, y: -100 }, { x: 0, z: 0 }, -1, .1);
    assertSafeFlight(low);
    assert.equal(low.y, getFlightFloor(low.x, low.z));
  }
  let high = { ...SPAWN_POSITION, y: FLIGHT_CEILING - .01 };
  for (let frame = 0; frame < 10; frame++) high = moveFlight(high, { x: 0, z: 0 }, 1, 1 / 60);
  assert.equal(high.y, FLIGHT_CEILING);
  assertSafeFlight(moveFlight({ ...high, y: 10000 }, { x: 0, z: 0 }, 0, 1 / 60));
});

test('invalid or negative time does not move a valid rider; long frames have a bounded movement step', () => {
  const from = { ...SPAWN_POSITION, y: 50 };
  for (const dt of [0, -.1, NaN, Infinity, -Infinity]) {
    assert.deepEqual(moveFlight(from, { x: 1, z: 1 }, 1, dt), from);
  }
  const longFrame = moveFlight(from, { x: 1, z: 1 }, 1, 9000);
  assertSafeFlight(longFrame);
  assert.ok(distance(from, longFrame) <= FLIGHT_SPEED * .1 + 1e-8);
});

test('invalid coordinates and controls never create nonfinite or unsafe flight state', () => {
  for (const bad of [NaN, Infinity, -Infinity]) {
    assertSafeFlight(moveFlight({ x: bad, y: bad, z: bad }, { x: 0, z: 0 }, 0, 1 / 60));
    const from = { ...SPAWN_POSITION, y: 50 };
    assert.deepEqual(moveFlight(from, { x: bad, z: bad }, bad, 1 / 60), from);
    assert.ok(Number.isFinite(getFlightFloor(bad, bad)));
  }
});

test('landing keeps a clear camp position and finds nearby land from the middle of the lake', () => {
  assert.deepEqual(findLandingSpot(SPAWN_POSITION), SPAWN_POSITION);
  const lakeCenter = { x: LAKE.x, z: LAKE.z };
  const landing = findLandingSpot(lakeCenter);
  assertSafeLanding(landing);
  assert.ok(distance(landing, lakeCenter) < 30, 'Find local shore instead of teleporting back to camp');
  assert.deepEqual(lakeCenter, { x: LAKE.x, z: LAKE.z });
});

test('landing avoids every structure and representative tree crowns', () => {
  const trees = WORLD_TREES.filter((_, index) => index % 19 === 0);
  for (const point of [...WORLD_OBSTACLES, ...trees]) {
    const landing = findLandingSpot(point);
    assertSafeLanding(landing);
    assert.ok(distance(landing, point) > .5);
  }
});

test('landing at corners, outside the map or with corrupt coordinates always returns safe land', () => {
  const points = [
    { x: WORLD_BOUNDS.minX, z: WORLD_BOUNDS.minZ },
    { x: WORLD_BOUNDS.maxX, z: WORLD_BOUNDS.minZ },
    { x: WORLD_BOUNDS.minX, z: WORLD_BOUNDS.maxZ },
    { x: WORLD_BOUNDS.maxX, z: WORLD_BOUNDS.maxZ },
    { x: -10000, z: 10000 }, { x: NaN, z: Infinity },
  ];
  for (const point of points) assertSafeLanding(findLandingSpot(point));
});

test('automatic landing targets near map edges are reachable within the flight movement boundary', () => {
  for (const from of [{ x: 70.5, z: -66.5 }, { x: 70.5, z: -64.5 }, { x: 70.5, z: -62.5 }]) {
    const target = findLandingSpot(from);
    assertSafeLanding(target);
    let position: FlightPosition = { ...from, y: 60 };
    for (let frame = 0; frame < 600 && distance(position, target) > .025; frame++) {
      const remaining = distance(position, target);
      const speed = Math.min(8, remaining * 60);
      position = moveFlight(position, {
        x: (target.x - position.x) / remaining * speed / FLIGHT_SPEED,
        z: (target.z - position.z) / remaining * speed / FLIGHT_SPEED,
      }, 0, 1 / 60);
    }
    assert.ok(distance(position, target) <= .025, 'Landing must not remain stuck outside the flight boundary');
  }
});
