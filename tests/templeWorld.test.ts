import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  TEMPLE_BOUNDS, TEMPLE_COLUMNS, TEMPLE_OBSTACLES, TEMPLE_SPAWN, TEMPLE_TARGETS,
  getTemplePath, isTempleWalkable, resolveTempleMovement,
} from '../src/game/templeWorld';
import type { WorldPoint } from '../src/game/world';

const distance = (a: WorldPoint, b: WorldPoint) => Math.hypot(a.x - b.x, a.z - b.z);

function assertSafeRoute(from: WorldPoint, to: WorldPoint) {
  const route = getTemplePath(from, to);
  assert.ok(route.length > 0, `No temple route from ${JSON.stringify(from)} to ${JSON.stringify(to)}`);
  assert.deepEqual(route.at(-1), to);
  let current = from;
  for (const next of route) {
    const count = Math.max(1, Math.ceil(distance(current, next) / .01));
    for (let i = 0; i <= count; i++) {
      const point = { x: current.x + (next.x - current.x) * i / count, z: current.z + (next.z - current.z) * i / count };
      assert.equal(isTempleWalkable(point), true, `Temple route clips an obstacle at ${JSON.stringify(point)}`);
    }
    assert.ok(distance(resolveTempleMovement(current, next), next) < .001, 'The player must be able to follow the planned route');
    current = next;
  }
}

test('the spawn and all five temple interaction targets are mutually reachable', () => {
  assert.equal(TEMPLE_TARGETS.length, 5);
  const stops = [TEMPLE_SPAWN, ...TEMPLE_TARGETS];
  for (const from of stops) for (const to of stops) {
    assert.equal(isTempleWalkable(from), true);
    assertSafeRoute(from, to);
  }
});

test('large moves cannot cross a column, seal pedestal, or the altar', () => {
  for (const obstacle of TEMPLE_OBSTACLES) {
    const gap = obstacle.radius + .5;
    const from = { x: obstacle.x, z: obstacle.z - gap };
    const to = { x: obstacle.x, z: obstacle.z + gap };
    assert.equal(isTempleWalkable(from), true);
    assert.equal(isTempleWalkable(to), true);
    const result = resolveTempleMovement(from, to);
    assert.equal(isTempleWalkable(result), true);
    assert.ok(result.z < obstacle.z, `The player crossed the obstacle at ${JSON.stringify(obstacle)}`);
    assertSafeRoute(from, to);
  }
});

test('diagonal movement along room corners stays inside both bounds', () => {
  for (const x of [TEMPLE_BOUNDS.minX, TEMPLE_BOUNDS.maxX]) {
    for (const z of [TEMPLE_BOUNDS.minZ, TEMPLE_BOUNDS.maxZ]) {
      const from = { x: x * .98, z: z * .98 };
      assert.equal(isTempleWalkable(from), true);
      const moved = resolveTempleMovement(from, { x: x * 100, z: z * 100 });
      assert.equal(isTempleWalkable(moved), true);
      assert.ok(moved.x >= TEMPLE_BOUNDS.minX && moved.x <= TEMPLE_BOUNDS.maxX);
      assert.ok(moved.z >= TEMPLE_BOUNDS.minZ && moved.z <= TEMPLE_BOUNDS.maxZ);
    }
  }
});

test('invalid coordinates and blocked starts cannot produce unsafe navigation or movement', () => {
  const blocked = [
    { x: NaN, z: 0 }, { x: 0, z: Infinity }, { x: -Infinity, z: NaN },
    { x: TEMPLE_BOUNDS.maxX + 1, z: 0 }, ...TEMPLE_COLUMNS,
  ];
  for (const point of blocked) {
    assert.equal(isTempleWalkable(point), false);
    assert.deepEqual(getTemplePath(TEMPLE_SPAWN, point), []);
    assert.deepEqual(getTemplePath(point, TEMPLE_SPAWN), []);
    assert.deepEqual(resolveTempleMovement(point, TEMPLE_SPAWN), TEMPLE_SPAWN);
  }
  for (const point of blocked.slice(0, 3)) {
    assert.deepEqual(resolveTempleMovement(TEMPLE_SPAWN, point), TEMPLE_SPAWN);
  }
});

test('temple movement and path planning preserve caller coordinates', () => {
  const from = Object.freeze({ ...TEMPLE_SPAWN });
  const to = Object.freeze({ ...TEMPLE_TARGETS[3] });
  resolveTempleMovement(from, to);
  assertSafeRoute(from, to);
  assert.deepEqual(from, TEMPLE_SPAWN);
  assert.deepEqual(to, TEMPLE_TARGETS[3]);
});
