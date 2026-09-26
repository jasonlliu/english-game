export const WALK_SPEED = 4.2;
export const RUN_SPEED = 8.4;
export const FOLLOWER_MAX_SPEED = 11;
export const FOLLOWER_STOP_DISTANCE = 0.15;

export interface LocomotionProfile {
  walkSpeed: number;
  runSpeed: number;
  walkStride: number;
  runStride: number;
}
export const HERO_PROFILE: Readonly<LocomotionProfile> = Object.freeze({
  walkSpeed: WALK_SPEED,
  runSpeed: RUN_SPEED,
  walkStride: 2.4,
  runStride: 3.7,
});

export interface PlanarPoint {
  x: number;
  z: number;
}
export interface LocomotionState {
  profile: Readonly<LocomotionProfile>;
  velocity: PlanarPoint;
  /** Actual distance travelled per second after collision resolution. */
  speed: number;
  /** Continuous gait phase in radians; stopping never resets it. */
  phase: number;
  run: number;
  blend: number;
}
export type MovementResolver = (from: PlanarPoint, to: PlanarPoint) => PlanarPoint;

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const duration = (delta: number) => (Number.isFinite(delta) ? clamp(delta, 0, 0.1) : 0);
const valid = (point: PlanarPoint) => Number.isFinite(point.x) && Number.isFinite(point.z);
const smoothstep = (value: number) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

export function createLocomotionState(
  profile: Readonly<LocomotionProfile> = HERO_PROFILE,
): LocomotionState {
  return {
    profile: { ...profile },
    velocity: { x: 0, z: 0 },
    speed: 0,
    phase: 0,
    run: 0,
    blend: 0,
  };
}

/** Integrates exponential velocity analytically, including the displacement during acceleration. */
function integrate(
  state: LocomotionState,
  target: PlanarPoint,
  rate: number,
  dt: number,
): PlanarPoint {
  const decay = Math.exp(-rate * dt),
    integral = -Math.expm1(-rate * dt) / rate;
  const displacement = {
    x: target.x * dt + (state.velocity.x - target.x) * integral,
    z: target.z * dt + (state.velocity.z - target.z) * integral,
  };
  state.velocity.x = target.x + (state.velocity.x - target.x) * decay;
  state.velocity.z = target.z + (state.velocity.z - target.z) * decay;
  if (!target.x && !target.z && Math.hypot(state.velocity.x, state.velocity.z) < 0.01) {
    state.velocity.x = 0;
    state.velocity.z = 0;
  }
  return displacement;
}

/** Returns planned displacement, mutating only velocity. Pass the resolved travel to advanceGait. */
export function advanceVelocity(
  state: LocomotionState,
  input: PlanarPoint,
  running: boolean,
  delta: number,
): PlanarPoint {
  const dt = duration(delta);
  if (!dt) return { x: 0, z: 0 };
  const magnitude = valid(input) ? Math.hypot(input.x, input.z) : 0;
  const speed = running ? RUN_SPEED : WALK_SPEED;
  const scale = magnitude > 0.001 ? speed / Math.max(1, magnitude) : 0;
  const target = scale ? { x: input.x * scale, z: input.z * scale } : { x: 0, z: 0 };
  return integrate(state, target, scale ? 12 : 22, dt);
}

/** Motion and gait use the same capped delta; phase only advances for real, resolved travel. */
export function advanceGait(state: LocomotionState, actualDistance: number, delta: number): void {
  const dt = duration(delta);
  if (!dt) return;
  const distance = Number.isFinite(actualDistance) ? Math.max(0, actualDistance) : 0;
  state.speed = distance / dt;
  const profile = state.profile;
  const oldRun = state.run;
  const targetRun = smoothstep(
    (state.speed - profile.walkSpeed * 0.9) / (profile.runSpeed - profile.walkSpeed * 0.9),
  );
  state.run += (targetRun - state.run) * -Math.expm1(-8 * dt);
  const targetBlend = clamp(state.speed / (profile.walkSpeed * 0.55));
  state.blend += (targetBlend - state.blend) * -Math.expm1(-14 * dt);
  if (state.blend < 0.0001) state.blend = 0;
  if (state.run < 0.0001) state.run = 0;
  // Longer running strides keep a faster run from turning into frantic foot motion.
  const stride =
    profile.walkStride + ((oldRun + state.run) / 2) * (profile.runStride - profile.walkStride);
  state.phase += (distance * Math.PI * 2) / stride;
}

function resolveStep(
  state: LocomotionState,
  from: PlanarPoint,
  displacement: PlanarPoint,
  resolve?: MovementResolver,
): PlanarPoint {
  const origin = valid(from) ? from : { x: 0, z: 0 };
  const destination = { x: origin.x + displacement.x, z: origin.z + displacement.z };
  const resolved = resolve ? resolve(origin, destination) : destination;
  const next = valid(resolved) ? resolved : origin;
  if (resolve) {
    // A blocked component loses its momentum; tangential sliding remains available.
    for (const axis of ['x', 'z'] as const) {
      const requested = displacement[axis];
      if (Math.abs(requested) > 1e-8)
        state.velocity[axis] *= clamp((next[axis] - origin[axis]) / requested);
    }
  }
  return { x: next.x, z: next.z };
}

/** Updates velocity and gait together. Collision/path selection stays owned by the scene. */
export function stepLocomotion(
  state: LocomotionState,
  from: PlanarPoint,
  input: PlanarPoint,
  running: boolean,
  delta: number,
  resolve?: MovementResolver,
): PlanarPoint {
  const next = resolveStep(state, from, advanceVelocity(state, input, running, delta), resolve);
  advanceGait(state, valid(from) ? Math.hypot(next.x - from.x, next.z - from.z) : 0, delta);
  return next;
}

/** Place a follower behind and to the right of the leader's normalized forward direction. */
export function getFollowerTarget(
  leader: PlanarPoint,
  forward: PlanarPoint,
  behind = 2.2,
  side = 1.2,
): PlanarPoint {
  const magnitude = valid(forward) ? Math.hypot(forward.x, forward.z) : 0;
  const x = magnitude > 0.001 ? forward.x / magnitude : 0;
  const z = magnitude > 0.001 ? forward.z / magnitude : -1;
  return { x: leader.x - x * behind - z * side, z: leader.z - z * behind + x * side };
}

/** Follow a scene-selected waypoint/anchor; scenes still own obstacle repathing. */
export function stepFollower(
  state: LocomotionState,
  from: PlanarPoint,
  target: PlanarPoint,
  leaderSpeed: number,
  delta: number,
  resolve?: MovementResolver,
): PlanarPoint {
  const dt = duration(delta);
  if (!dt || !valid(from) || !valid(target)) return { ...from };
  const steps = Math.max(1, Math.ceil(dt * 120)),
    h = dt / steps;
  const leader = Number.isFinite(leaderSpeed) ? clamp(leaderSpeed, 0, FOLLOWER_MAX_SPEED) : 0;
  let position = { ...from },
    travelled = 0;
  // Small dynamics steps make pursuit stable at both 30 and 144 fps.
  for (let i = 0; i < steps; i++) {
    const dx = target.x - position.x,
      dz = target.z - position.z,
      distance = Math.hypot(dx, dz);
    if (distance <= FOLLOWER_STOP_DISTANCE) {
      state.velocity.x = 0;
      state.velocity.z = 0;
      break;
    }
    const speed = Math.min(
      FOLLOWER_MAX_SPEED,
      (distance - 0.1) * 2.8 + leader * smoothstep((distance - FOLLOWER_STOP_DISTANCE) / 1.2),
    );
    const displacement = integrate(
      state,
      { x: (dx / distance) * speed, z: (dz / distance) * speed },
      14,
      h,
    );
    const length = Math.hypot(displacement.x, displacement.z);
    const limit = distance - FOLLOWER_STOP_DISTANCE * 0.5;
    if (length > limit) {
      displacement.x *= limit / length;
      displacement.z *= limit / length;
    }
    const next = resolveStep(state, position, displacement, resolve);
    travelled += Math.hypot(next.x - position.x, next.z - position.z);
    position = next;
  }
  advanceGait(state, travelled, dt);
  return position;
}
