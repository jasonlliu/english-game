import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createLocomotionState,
  stepFollower,
  stepLocomotion,
  type MovementResolver,
  type PlanarPoint,
} from '../src/game/locomotion';
import {
  SPAWN_POSITION,
  WORLD_ZONES,
  getNavigationPath,
  isWalkable,
  resolveMovement,
} from '../src/game/world';
import {
  TEMPLE_SPAWN,
  TEMPLE_TARGETS,
  getTemplePath,
  isTempleWalkable,
  resolveTempleMovement,
} from '../src/game/templeWorld';
import { TEMPLE_THEMES } from '../src/game/temple';
import { REGION_PLACES } from '../src/game/landmarks';

const distance = (a: PlanarPoint, b: PlanarPoint) => Math.hypot(a.x - b.x, a.z - b.z);
interface SceneMovement {
  route(from: PlanarPoint, to: PlanarPoint): PlanarPoint[];
  resolve: MovementResolver;
  walkable(point: PlanarPoint): boolean;
  arrival: number;
  followerWaypoint: number;
  followerNearLeader: number;
  followerBlockedDistance: number;
}
const meadow: SceneMovement = {
  route: (from, to) => getNavigationPath(from, to, 'meadow'),
  resolve: (from, to) => resolveMovement(from, to, 'meadow'),
  walkable: (p) => isWalkable(p.x, p.z, 0.6, 'meadow'),
  arrival: 0.48,
  followerWaypoint: 0.5,
  followerNearLeader: 3,
  followerBlockedDistance: 1,
};
const temple: SceneMovement = {
  route: getTemplePath,
  resolve: resolveTempleMovement,
  walkable: isTempleWalkable,
  arrival: 0.25,
  followerWaypoint: 0.45,
  followerNearLeader: 2.6,
  followerBlockedDistance: 0.8,
};

/** Match scene waypoint consumption and final-segment easing, using the production dynamics. */
function navigate(
  scene: SceneMovement,
  from: PlanarPoint,
  target: PlanarPoint,
  fps: number,
  running: boolean,
) {
  const path = scene.route(from, target),
    motion = createLocomotionState();
  assert.ok(path.length, `Missing route ${JSON.stringify({ from, target })}`);
  let position = { ...from },
    stoppedAt = -1,
    travelled = 0;
  const maxFrames = fps * 70;
  for (let frame = 0; frame < maxFrames; frame++) {
    let input = { x: 0, z: 0 };
    if (path.length) {
      const d = distance(position, path[0]);
      if (d < scene.arrival)
        path.shift(); // Scenes consume only one waypoint per frame.
      else {
        const arrival = path.length === 1 ? Math.min(1, d / 1.8) : 1;
        input = {
          x: ((path[0].x - position.x) / d) * arrival,
          z: ((path[0].z - position.z) / d) * arrival,
        };
      }
    } else if (stoppedAt < 0) stoppedAt = frame;
    const next = stepLocomotion(motion, position, input, running, 1 / fps, scene.resolve);
    assert.ok(scene.walkable(next), `Collision crossed at ${JSON.stringify(next)}`);
    travelled += distance(position, next);
    position = next;
    if (stoppedAt >= 0 && frame - stoppedAt > fps * 2) break;
  }
  assert.equal(
    path.length,
    0,
    `Navigation stuck ${JSON.stringify({ from, target, position, next: path[0], running, fps })}`,
  );
  assert.ok(
    distance(position, target) < scene.arrival,
    `Stopped outside arrival radius at ${JSON.stringify(position)}`,
  );
  assert.equal(motion.speed, 0);
  assert.deepEqual(motion.velocity, { x: 0, z: 0 });
  assert.equal(motion.blend, 0);
  const settled = { ...position },
    phase = motion.phase;
  for (let frame = 0; frame < fps; frame++)
    position = stepLocomotion(motion, position, { x: 0, z: 0 }, running, 1 / fps, scene.resolve);
  assert.deepEqual(position, settled);
  assert.equal(motion.phase, phase, 'A finished route must not keep walking in place');
  return { position, travelled };
}

test('walking and running complete every temple seal order, the relic, and the exit with real collision', () => {
  for (const fps of [30, 60, 144])
    for (const running of [false, true]) {
      for (const theme of Object.values(TEMPLE_THEMES)) {
        let position = { ...TEMPLE_SPAWN };
        for (const index of [...theme.order, 3, 4])
          position = navigate(temple, position, TEMPLE_TARGETS[index], fps, running).position;
      }
    }
});

test('core meadow destinations remain reachable with acceleration, final arrival easing, and stable stopping', () => {
  const destinations = [
    ...Object.values(WORLD_ZONES),
    ...REGION_PLACES.meadow.filter((place) => ['village', 'farm', 'falls'].includes(place.id)),
  ];
  for (const fps of [30, 144])
    for (const running of [false, true]) {
      let position = { ...SPAWN_POSITION };
      for (const target of [...destinations, SPAWN_POSITION])
        position = navigate(meadow, position, target, fps, running).position;
    }
});

test('auto routes steer around the barn, cottage, windmill, and old temple pillar without cutting into geometry', () => {
  const detours = [
    [
      { x: 11, z: 25 },
      { x: 25, z: 25 },
    ],
    [
      { x: -25, z: 6 },
      { x: -25, z: 18 },
    ],
    [
      { x: -31, z: 0 },
      { x: -31, z: 12 },
    ],
    [
      { x: -15.7, z: -27 },
      { x: -7.7, z: -27 },
    ],
  ];
  for (const [from, target] of detours) {
    assert.ok(
      meadow.route(from, target).length > 1,
      'This case must actually detour around a solid obstacle',
    );
    for (const fps of [30, 60, 144])
      for (const running of [false, true]) {
        const result = navigate(meadow, from, target, fps, running);
        assert.ok(result.travelled > distance(from, target));
      }
  }
});

/** Match scene sustained-blocking repath and waypoint thresholds without teleport recovery. */
function catchUp(scene: SceneMovement, from: PlanarPoint, goal: PlanarPoint, fps: number) {
  const motion = createLocomotionState();
  let position = { ...from },
    path: PlanarPoint[] = [],
    blocked = 0,
    repathAt = 0,
    repaths = 0;
  for (let frame = 0; frame < fps * 35; frame++) {
    const time = frame / fps;
    while (path.length && distance(position, path[0]) < scene.followerWaypoint) path.shift();
    if (distance(position, goal) < scene.followerNearLeader) path = [];
    const target = path[0] ?? goal;
    const next = stepFollower(motion, position, target, 0, 1 / fps, scene.resolve);
    assert.ok(scene.walkable(next));
    position = next;
    if (distance(position, target) > scene.followerBlockedDistance && motion.speed < 0.25)
      blocked += 1 / fps;
    else blocked = 0;
    if (blocked > 0.35 && time >= repathAt) {
      path = scene.route(position, goal);
      repathAt = time + 1.2;
      blocked = 0;
      repaths++;
    }
  }
  assert.ok(repaths > 0, 'The follower should meet an obstacle and request a scene-owned route');
  assert.ok(
    distance(position, goal) <= 0.15,
    `Follower stuck ${JSON.stringify({ from, goal, position, path, repaths, fps })}`,
  );
  assert.equal(motion.speed, 0);
  assert.equal(motion.blend, 0);
  return repaths;
}

for (const [name, scene, from, goal] of [
  ['meadow barn', meadow, { x: 11, z: 25 }, { x: 25, z: 25 }],
  ['meadow cottage', meadow, { x: -25, z: 6 }, { x: -25, z: 18 }],
  ['temple west seal', temple, { x: -7, z: 1 }, { x: -7, z: -5 }],
  ['temple center seal', temple, { x: 0, z: -4.6 }, { x: 0, z: -10 }],
] as const) {
  test(`followers repath around the ${name} and catch up without teleporting`, () => {
    for (const fps of [30, 60, 144]) catchUp(scene, from, goal, fps);
  });
}

test('a temple follower stays with a running player through every seal order and remains safe at the exit', () => {
  for (const theme of Object.values(TEMPLE_THEMES)) {
    const heroMotion = createLocomotionState(),
      followerMotion = createLocomotionState();
    let player = { ...TEMPLE_SPAWN },
      follower = { x: -2, z: 12 },
      heading = 0;
    const trail = [{ ...player }];
    let followerPath: PlanarPoint[] = [],
      blocked = 0,
      repathAt = 0,
      time = 0;
    const dt = 1 / 60;
    for (const index of [...theme.order, 3, 4]) {
      const destination = TEMPLE_TARGETS[index],
        path = getTemplePath(player, destination);
      assert.ok(path.length);
      let arrivedAt = Infinity;
      for (let frame = 0; frame < 60 * 30 && time < arrivedAt + 5; frame++) {
        time += dt;
        let input = { x: 0, z: 0 };
        if (path.length) {
          const d = distance(player, path[0]);
          if (d < 0.25) path.shift();
          else {
            const arrival = path.length === 1 ? Math.min(1, d / 1.8) : 1;
            input = {
              x: ((path[0].x - player.x) / d) * arrival,
              z: ((path[0].z - player.z) / d) * arrival,
            };
          }
        } else if (!Number.isFinite(arrivedAt)) arrivedAt = time;
        const next = stepLocomotion(heroMotion, player, input, true, dt, resolveTempleMovement);
        if (heroMotion.speed > 0.06) {
          const angle = Math.atan2(player.x - next.x, player.z - next.z);
          heading +=
            Math.atan2(Math.sin(angle - heading), Math.cos(angle - heading)) *
            (1 - Math.exp(-dt * 10));
        }
        player = next;
        if (distance(player, trail.at(-1)!) > 0.3) {
          trail.push({ ...player });
          if (trail.length > 80) trail.shift();
        }
        let goal = { x: player.x + Math.sin(heading) * 2.1, z: player.z + Math.cos(heading) * 2.1 };
        let remaining = 2.1,
          previous = player;
        for (let i = trail.length - 1; i >= 0; i--) {
          const d = distance(trail[i], previous);
          if (d >= remaining && d > 0.001) {
            goal = {
              x: previous.x + ((trail[i].x - previous.x) * remaining) / d,
              z: previous.z + ((trail[i].z - previous.z) * remaining) / d,
            };
            break;
          }
          remaining -= d;
          previous = trail[i];
        }
        assert.ok(
          isTempleWalkable(goal),
          `Trail goal cuts an obstacle ${JSON.stringify({ goal, player, index, order: theme.order })}`,
        );
        while (followerPath.length && distance(follower, followerPath[0]) < 0.45)
          followerPath.shift();
        if (distance(player, follower) < 2.6) followerPath = [];
        const target = followerPath[0] ?? goal;
        follower = stepFollower(
          followerMotion,
          follower,
          target,
          heroMotion.speed,
          dt,
          resolveTempleMovement,
        );
        assert.ok(isTempleWalkable(follower));
        if (distance(target, follower) > 0.8 && followerMotion.speed < 0.25) blocked += dt;
        else blocked = 0;
        if (blocked > 0.35 && time >= repathAt) {
          followerPath = getTemplePath(follower, goal);
          repathAt = time + 1.2;
          blocked = 0;
        }
      }
      assert.equal(path.length, 0);
      assert.ok(
        distance(player, follower) < 3.2,
        `Follower lost at temple target ${JSON.stringify({ index, player, follower, order: theme.order })}`,
      );
      assert.equal(followerMotion.speed, 0, 'A waiting companion should finish its approach');
    }
  }
});
