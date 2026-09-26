import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  WALK_SPEED,
  RUN_SPEED,
  FOLLOWER_MAX_SPEED,
  FOLLOWER_STOP_DISTANCE,
  HERO_PROFILE,
  advanceGait,
  advanceVelocity,
  createLocomotionState,
  getFollowerTarget,
  stepFollower,
  stepLocomotion,
  type PlanarPoint,
} from '../src/game/locomotion';

test('gait profiles give short-legged pets a continuous faster cadence without changing travel dynamics', () => {
  const profile = { walkSpeed: 1.5, runSpeed: 4.2, walkStride: 0.8, runStride: 1.4 };
  const hero = createLocomotionState(),
    pet = createLocomotionState(profile);
  assert.deepEqual(hero.profile, HERO_PROFILE);
  assert.deepEqual(pet.profile, profile);
  assert.notStrictEqual(pet.profile, profile);
  let heroPosition = { x: 0, z: 0 },
    petPosition = { x: 0, z: 0 },
    previousPhase = 0;
  for (let frame = 0; frame < 120; frame++) {
    heroPosition = stepLocomotion(hero, heroPosition, { x: 1, z: 0 }, false, 1 / 60);
    petPosition = stepLocomotion(pet, petPosition, { x: 1, z: 0 }, false, 1 / 60);
    assert.deepEqual(
      heroPosition,
      petPosition,
      'Profiles affect gait only, not world travel speed',
    );
    assert.ok(pet.phase >= previousPhase && pet.phase - previousPhase < 0.4);
    previousPhase = pet.phase;
  }
  assert.ok(pet.phase > hero.phase * 1.5);
  assert.ok(pet.run > 0.99 && hero.run < 0.1);
  const phaseBeforeSwitch = pet.phase;
  pet.profile = { ...profile, walkStride: 1.1, runStride: 1.8 };
  assert.equal(pet.phase, phaseBeforeSwitch);
  for (let frame = 0; frame < 180; frame++)
    petPosition = stepLocomotion(pet, petPosition, { x: 0, z: 0 }, false, 1 / 60);
  const stoppedPhase = pet.phase;
  advanceGait(pet, 0, 1 / 60);
  assert.equal(pet.phase, stoppedPhase);
  assert.equal(pet.blend, 0);
  assert.equal(pet.run, 0);
});

function travel(fps: number, running = false) {
  const state = createLocomotionState();
  let position = { x: 0, z: 0 };
  for (let frame = 0; frame < fps * 2; frame++)
    position = stepLocomotion(state, position, { x: 1, z: 0 }, running, 1 / fps);
  const beforeStop = { ...position };
  for (let frame = 0; frame < fps; frame++)
    position = stepLocomotion(state, position, { x: 0, z: 0 }, running, 1 / fps);
  return { state, position, drift: position.x - beforeStop.x, distance: beforeStop.x };
}

test('analytical acceleration and braking travel the same distance at different frame rates', () => {
  for (const running of [false, true]) {
    const reference = travel(120, running);
    for (const fps of [30, 60, 144]) {
      const result = travel(fps, running);
      assert.ok(Math.abs(result.distance - reference.distance) < 1e-10);
      assert.ok(Math.abs(result.position.x - reference.position.x) < 0.0003);
      assert.equal(result.state.velocity.x, 0);
      assert.equal(result.state.speed, 0);
      assert.ok(result.state.blend < 0.001);
      assert.ok(
        result.drift < (running ? 0.39 : 0.2),
        'Releasing movement must brake within a short step',
      );
    }
  }
});

test('walking and running accelerate smoothly, and diagonal input cannot exceed the selected speed', () => {
  const walk = createLocomotionState(),
    run = createLocomotionState();
  advanceVelocity(walk, { x: 1, z: 0 }, false, 1 / 60);
  assert.ok(walk.velocity.x > 0 && walk.velocity.x < WALK_SPEED * 0.3);
  const firstSpeed = walk.velocity.x;
  advanceVelocity(walk, { x: 1, z: 0 }, false, 1 / 60);
  assert.ok(walk.velocity.x > firstSpeed);
  for (let frame = 0; frame < 120; frame++) {
    advanceVelocity(walk, { x: 1, z: 1 }, false, 1 / 60);
    advanceVelocity(run, { x: 1, z: 1 }, true, 1 / 60);
  }
  assert.ok(Math.abs(Math.hypot(walk.velocity.x, walk.velocity.z) - WALK_SPEED) < 0.0001);
  assert.ok(Math.abs(Math.hypot(run.velocity.x, run.velocity.z) - RUN_SPEED) < 0.0001);
  assert.ok(travel(60, true).distance > travel(60).distance * 1.99);
});

test('turning and stopping preserve continuous gait phase and blend run gradually', () => {
  const state = createLocomotionState();
  let position = { x: 0, z: 0 },
    previousPhase = 0;
  for (let frame = 0; frame < 180; frame++) {
    position = stepLocomotion(
      state,
      position,
      frame < 90 ? { x: 1, z: 0 } : { x: 0, z: -1 },
      frame >= 60,
      1 / 60,
    );
    assert.ok(state.phase >= previousPhase);
    assert.ok(state.phase - previousPhase < 0.4);
    previousPhase = state.phase;
    if (frame === 60) assert.ok(state.run < 0.1);
  }
  assert.ok(state.run > 0.9);
  for (let frame = 0; frame < 120; frame++)
    position = stepLocomotion(state, position, { x: 0, z: 0 }, false, 1 / 60);
  const stoppedPhase = state.phase;
  for (let frame = 0; frame < 60; frame++)
    position = stepLocomotion(state, position, { x: 0, z: 0 }, false, 1 / 60);
  assert.equal(state.phase, stoppedPhase);
  assert.equal(state.blend, 0);
  assert.equal(state.run, 0);
});

test('collision resolution prevents false gait progress while preserving tangential sliding', () => {
  const state = createLocomotionState(),
    origin = { x: 0, z: 0 };
  for (let frame = 0; frame < 90; frame++) {
    const next = stepLocomotion(state, origin, { x: 1, z: 0 }, true, 1 / 60, (from) => from);
    assert.deepEqual(next, origin);
  }
  assert.deepEqual(state, createLocomotionState());
  let position = origin;
  for (let frame = 0; frame < 60; frame++)
    position = stepLocomotion(state, position, { x: 1, z: 1 }, false, 1 / 60, (from, to) => ({
      x: from.x,
      z: to.z,
    }));
  assert.equal(position.x, 0);
  assert.ok(position.z > 2);
  assert.equal(state.velocity.x, 0);
  assert.ok(state.phase > 0);
});

test('separate velocity and gait APIs measure only actual travel; invalid time cannot advance motion', () => {
  const state = createLocomotionState();
  const planned = advanceVelocity(state, { x: 1, z: 0 }, false, 1 / 60);
  assert.ok(planned.x > 0);
  assert.equal(state.phase, 0);
  advanceGait(state, 0, 1 / 60);
  assert.equal(state.speed, 0);
  assert.equal(state.phase, 0);
  const before = structuredClone(state);
  for (const dt of [0, -1, Infinity, NaN]) {
    assert.deepEqual(advanceVelocity(state, { x: 1, z: 0 }, true, dt), { x: 0, z: 0 });
    advanceGait(state, 10, dt);
  }
  assert.deepEqual(state, before);
  const fast = createLocomotionState();
  assert.ok(advanceVelocity(fast, { x: 1, z: 0 }, true, 10).x < RUN_SPEED * 0.1);
});

function follow(fps: number) {
  const state = createLocomotionState();
  let position = { x: -15, z: 4 },
    peak = 0;
  const target = { x: 0, z: 0 };
  let settled: PlanarPoint | undefined;
  for (let frame = 0; frame < fps * 8; frame++) {
    position = stepFollower(state, position, target, 0, 1 / fps);
    peak = Math.max(peak, state.speed);
    if (Math.hypot(position.x, position.z) <= FOLLOWER_STOP_DISTANCE) {
      if (settled)
        assert.deepEqual(position, settled, 'A settled follower must not overshoot or oscillate');
      settled = { ...position };
    }
  }
  return { state, position, peak, settled };
}

test('followers catch up smoothly, stay within the speed cap and settle without oscillation at any frame rate', () => {
  const reference = follow(120);
  for (const fps of [30, 60, 120, 144]) {
    const result = follow(fps);
    assert.ok(result.settled);
    assert.ok(result.peak > RUN_SPEED && result.peak <= FOLLOWER_MAX_SPEED + 1e-9);
    assert.ok(
      Math.hypot(
        result.position.x - reference.position.x,
        result.position.z - reference.position.z,
      ) < 0.005,
    );
    assert.equal(result.state.speed, 0);
    assert.deepEqual(result.state.velocity, { x: 0, z: 0 });
    assert.equal(result.state.blend, 0);
  }
});

test('followers use rear-side anchors, track a moving leader, then stop with no stale gait', () => {
  assert.deepEqual(getFollowerTarget({ x: 0, z: 0 }, { x: 0, z: -2 }), { x: 1.2, z: 2.2 });
  const state = createLocomotionState();
  let position = { x: 0, z: 0 },
    target = { x: 0, z: 0 };
  for (let frame = 0; frame < 300; frame++) {
    target = { x: target.x + WALK_SPEED / 60, z: 0 };
    position = stepFollower(state, position, target, WALK_SPEED, 1 / 60);
  }
  assert.ok(target.x - position.x < 1.2);
  assert.ok(state.speed > WALK_SPEED * 0.95);
  for (let frame = 0; frame < 360; frame++)
    position = stepFollower(state, position, target, 0, 1 / 60);
  assert.ok(Math.hypot(position.x - target.x, position.z - target.z) <= FOLLOWER_STOP_DISTANCE);
  assert.equal(state.speed, 0);
  assert.equal(state.blend, 0);
});

test('blocked followers never animate false steps and can resume when the scene provides a reachable target', () => {
  const state = createLocomotionState(),
    origin = { x: 0, z: 0 };
  for (let frame = 0; frame < 60; frame++)
    assert.deepEqual(
      stepFollower(state, origin, { x: 10, z: 0 }, RUN_SPEED, 1 / 60, (from) => from),
      origin,
    );
  assert.deepEqual(state, createLocomotionState());
  const next = stepFollower(state, origin, { x: 0, z: 5 }, WALK_SPEED, 1 / 60);
  assert.ok(next.z > 0);
  assert.ok(state.phase > 0);
});
