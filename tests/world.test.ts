import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CRYSTAL_POSITIONS,
  LAKE,
  SPAWN_POSITION,
  WORLD_BOUNDS,
  WORLD_OBSTACLES,
  clampToWorld,
  getNavigationPath,
  getTerrainHeight,
  isWalkable,
  resolveMovement,
  type WorldPoint,
} from '../src/game/world';

const distance = (a: WorldPoint, b: WorldPoint) => Math.hypot(a.x - b.x, a.z - b.z);

function assertSafeRoute(from: WorldPoint, destination: WorldPoint) {
  const route = getNavigationPath(from, destination);
  assert.ok(
    route.length > 0,
    `No route from ${JSON.stringify(from)} to ${JSON.stringify(destination)}`,
  );
  assert.deepEqual(route.at(-1), destination);
  let current = from;
  for (const waypoint of route) {
    // Check between waypoints, where shortcutting might otherwise clip a tree or shore.
    const samples = Math.max(1, Math.ceil(distance(current, waypoint) / 0.1));
    for (let i = 0; i <= samples; i++) {
      const x = current.x + ((waypoint.x - current.x) * i) / samples;
      const z = current.z + ((waypoint.z - current.z) * i) / samples;
      assert.equal(isWalkable(x, z), true, `Route crosses a blocked point at ${x}, ${z}`);
    }
    const arrived = resolveMovement(current, waypoint);
    assert.ok(
      distance(arrived, waypoint) < 0.001,
      `Movement cannot follow route to ${JSON.stringify(waypoint)}`,
    );
    current = waypoint;
  }
  return route;
}

test('the player can spawn safely and all three collectible locations are distinct and accessible', () => {
  assert.equal(isWalkable(SPAWN_POSITION.x, SPAWN_POSITION.z), true);
  assert.equal(CRYSTAL_POSITIONS.length, 3);
  assert.equal(new Set(CRYSTAL_POSITIONS.map(({ x, z }) => `${x},${z}`)).size, 3);
  for (const point of CRYSTAL_POSITIONS) {
    assert.equal(isWalkable(point.x, point.z), true);
    assert.ok(getTerrainHeight(point.x, point.z) > LAKE.waterLevel);
  }
});

test('every collectible can be reached from spawn and from every other collectible', () => {
  const stops = [SPAWN_POSITION, ...CRYSTAL_POSITIONS];
  for (const from of stops)
    for (const destination of stops) {
      if (from !== destination) assertSafeRoute(from, destination);
    }
});

test('click navigation takes a traversable route around the lake instead of crossing water', () => {
  const from = { x: LAKE.x, z: -25 };
  const destination = { x: LAKE.x, z: 14 };
  const route = assertSafeRoute(from, destination);
  assert.ok(route.some((point) => Math.abs(point.x - LAKE.x) > 5));
  const directDistance = distance(from, destination);
  const stops = [from, ...route];
  const routeLength = route.reduce(
    (length, point, index) => length + distance(stops[index], point),
    0,
  );
  assert.ok(routeLength > directDistance);
});

test('a large movement step cannot tunnel across water or a solid ruin pillar', () => {
  const waterStop = resolveMovement({ x: 15, z: LAKE.z }, { x: 50, z: LAKE.z });
  assert.equal(isWalkable(waterStop.x, waterStop.z), true);
  assert.ok(waterStop.x < LAKE.x - LAKE.radiusX + 1);

  const pillar = WORLD_OBSTACLES[0];
  const from = { x: pillar.x, z: pillar.z + 3 };
  const destination = { x: pillar.x, z: pillar.z - 3 };
  assert.equal(isWalkable(from.x, from.z), true);
  const stopped = resolveMovement(from, destination);
  assert.equal(isWalkable(stopped.x, stopped.z), true);
  assert.ok(stopped.z > pillar.z);
});

test('movement stops inside every map edge, including when the destination lies far outside', () => {
  const edges = [
    {
      start: (n: number) => ({ x: WORLD_BOUNDS.minX + 2, z: n }),
      end: (n: number) => ({ x: WORLD_BOUNDS.minX - 100, z: n }),
    },
    {
      start: (n: number) => ({ x: WORLD_BOUNDS.maxX - 2, z: n }),
      end: (n: number) => ({ x: WORLD_BOUNDS.maxX + 100, z: n }),
    },
    {
      start: (n: number) => ({ x: n, z: WORLD_BOUNDS.minZ + 2 }),
      end: (n: number) => ({ x: n, z: WORLD_BOUNDS.minZ - 100 }),
    },
    {
      start: (n: number) => ({ x: n, z: WORLD_BOUNDS.maxZ - 2 }),
      end: (n: number) => ({ x: n, z: WORLD_BOUNDS.maxZ + 100 }),
    },
  ];
  for (const edge of edges) {
    const coordinate = Array.from({ length: 21 }, (_, i) => i - 10).find((n) =>
      isWalkable(edge.start(n).x, edge.start(n).z),
    );
    assert.notEqual(
      coordinate,
      undefined,
      'Each edge should have an accessible boundary test point',
    );
    const start = edge.start(coordinate!);
    const result = resolveMovement(start, edge.end(coordinate!));
    assert.equal(isWalkable(result.x, result.z), true);
    assert.ok(result.x > WORLD_BOUNDS.minX && result.x < WORLD_BOUNDS.maxX);
    assert.ok(result.z > WORLD_BOUNDS.minZ && result.z < WORLD_BOUNDS.maxZ);
  }
});

test('water, structures, out-of-bounds coordinates and invalid input are rejected by navigation', () => {
  const blocked = [
    { x: LAKE.x, z: LAKE.z },
    ...WORLD_OBSTACLES,
    { x: WORLD_BOUNDS.maxX + 1, z: 0 },
    { x: NaN, z: 0 },
    { x: 0, z: Infinity },
  ];
  for (const point of blocked) {
    assert.equal(isWalkable(point.x, point.z), false);
    assert.deepEqual(getNavigationPath(SPAWN_POSITION, point), []);
    assert.deepEqual(getNavigationPath(point, SPAWN_POSITION), []);
  }
});

test('invalid movement input recovers safely and movement does not mutate caller coordinates', () => {
  const from = { ...SPAWN_POSITION };
  const target = { x: 1, z: 20 };
  const before = { ...target };
  resolveMovement(from, target);
  assert.deepEqual(from, SPAWN_POSITION);
  assert.deepEqual(target, before);
  assert.deepEqual(resolveMovement(from, { x: NaN, z: 0 }), from);
  assert.deepEqual(resolveMovement({ x: Infinity, z: 0 }, target), SPAWN_POSITION);
  const clamped = clampToWorld({ x: WORLD_BOUNDS.maxX + 100, z: WORLD_BOUNDS.minZ - 100 });
  assert.deepEqual(clamped, { x: WORLD_BOUNDS.maxX, z: WORLD_BOUNDS.minZ });
  const recovered = clampToWorld({ x: NaN, z: Infinity });
  assert.equal(Number.isFinite(recovered.x) && Number.isFinite(recovered.z), true);
  assert.equal(isWalkable(recovered.x, recovered.z), true);
});

test('terrain remains finite across the world and the lake bed lies below its visible water', () => {
  for (let x = WORLD_BOUNDS.minX; x <= WORLD_BOUNDS.maxX; x += 8) {
    for (let z = WORLD_BOUNDS.minZ; z <= WORLD_BOUNDS.maxZ; z += 8) {
      assert.equal(Number.isFinite(getTerrainHeight(x, z)), true);
    }
  }
  assert.ok(getTerrainHeight(LAKE.x, LAKE.z) < LAKE.waterLevel);
  assert.equal(Number.isFinite(getTerrainHeight(NaN, Infinity)), true);
});
