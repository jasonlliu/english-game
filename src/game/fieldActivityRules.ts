import type { WorldPoint } from './worldLayout';
import { RACE_DURATION, MIN_RACE_SECONDS, getRaceRating, type RaceRating } from './fieldActivities';

// Scene-only rules stay outside the persisted field model so the app shell can load first.
export const RACE_GATE_RADIUS = 2.8;
export const RACE_START_RADIUS = 10;
export const RACE_START: Readonly<WorldPoint> = { x: 7, z: 22 };
export const RACE_GATES: readonly Readonly<WorldPoint>[] = [
  { x: 11, z: 14 },
  { x: 19, z: 8 },
  { x: 17, z: -3 },
  { x: 9, z: -7 },
  { x: -4, z: 3 },
  { x: 1, z: 16 },
];
export const OBSERVATION_DURATION = 3;
export const OBSERVATION_MAX_SPEED = 0.45;

const finitePoint = (point: WorldPoint): boolean =>
  !!point && Number.isFinite(point.x) && Number.isFinite(point.z);
const frameDelta = (delta: number): number =>
  Number.isFinite(delta) && delta > 0 ? Math.min(delta, 0.1) : 0;

export interface RaceRun {
  status: 'running' | 'finished' | 'cancelled' | 'timed-out';
  elapsed: number;
  nextGate: number;
  previousPosition: WorldPoint;
}
export interface RaceFrame {
  position: WorldPoint;
  delta: number;
  paused: boolean;
  flying: boolean;
}
export interface RaceStep {
  state: RaceRun;
  event?: 'gate' | 'finished' | 'cancelled' | 'timed-out';
  completed?: { seconds: number; rating: RaceRating };
}

export function createRaceRun(position: WorldPoint = RACE_START): RaceRun {
  const valid = finitePoint(position);
  return {
    status:
      valid && Math.hypot(position.x - RACE_START.x, position.z - RACE_START.z) <= RACE_START_RADIUS
        ? 'running'
        : 'cancelled',
    elapsed: 0,
    nextGate: 0,
    previousPosition: valid ? { ...position } : { ...RACE_START },
  };
}

/** A segment crossing counts even if neither rendered endpoint is inside the ring. */
function crossesGate(from: WorldPoint, to: WorldPoint, gate: WorldPoint): boolean {
  const dx = to.x - from.x,
    dz = to.z - from.z,
    lengthSquared = dx * dx + dz * dz;
  if (!lengthSquared || Math.hypot(from.x - gate.x, from.z - gate.z) <= RACE_GATE_RADIUS)
    return false;
  const t = Math.max(
    0,
    Math.min(1, ((gate.x - from.x) * dx + (gate.z - from.z) * dz) / lengthSquared),
  );
  return Math.hypot(from.x + dx * t - gate.x, from.z + dz * t - gate.z) <= RACE_GATE_RADIUS;
}

export function stepRaceRun(state: RaceRun, frame: RaceFrame): RaceStep {
  if (state.status !== 'running') return { state };
  if (frame.flying || !finitePoint(frame.position))
    return { state: { ...state, status: 'cancelled' }, event: 'cancelled' };
  if (frame.paused) return { state: { ...state, previousPosition: { ...frame.position } } };
  const delta = frameDelta(frame.delta);
  if (!delta) return { state };
  // This generous allowance exceeds normal running, but rejects teleporting across checkpoints.
  if (
    Math.hypot(
      frame.position.x - state.previousPosition.x,
      frame.position.z - state.previousPosition.z,
    ) >
    1.5 + 14 * delta
  )
    return { state: { ...state, status: 'cancelled' }, event: 'cancelled' };
  const elapsed = Math.min(RACE_DURATION, state.elapsed + delta);
  const next: RaceRun = { ...state, elapsed, previousPosition: { ...frame.position } };
  if (state.elapsed + delta > RACE_DURATION + 1e-9)
    return { state: { ...next, status: 'timed-out' }, event: 'timed-out' };
  if (crossesGate(state.previousPosition, frame.position, RACE_GATES[state.nextGate])) {
    next.nextGate += 1;
    if (next.nextGate === RACE_GATES.length) {
      if (elapsed < MIN_RACE_SECONDS)
        return { state: { ...next, status: 'cancelled' }, event: 'cancelled' };
      const seconds = Math.round(elapsed * 100) / 100;
      return {
        state: { ...next, status: 'finished' },
        event: 'finished',
        completed: { seconds, rating: getRaceRating(seconds) },
      };
    }
    if (elapsed < RACE_DURATION) return { state: next, event: 'gate' };
  }
  if (elapsed >= RACE_DURATION)
    return { state: { ...next, status: 'timed-out' }, event: 'timed-out' };
  return { state: next };
}

export interface ObservationRun {
  targetId: string | null;
  elapsed: number;
}
export interface ObservationFrame {
  candidateId: string | null;
  speed: number;
  delta: number;
  paused: boolean;
  startled: boolean;
  requested: boolean;
}
export function createObservationRun(): ObservationRun {
  return { targetId: null, elapsed: 0 };
}

export function stepObservation(
  state: ObservationRun,
  frame: ObservationFrame,
): { state: ObservationRun; completedId?: string } {
  if (
    !frame.requested ||
    frame.paused ||
    frame.startled ||
    !frame.candidateId ||
    !Number.isFinite(frame.speed) ||
    frame.speed < 0 ||
    frame.speed > OBSERVATION_MAX_SPEED ||
    !frameDelta(frame.delta)
  )
    return { state: createObservationRun() };
  const prior = state.targetId === frame.candidateId ? state.elapsed : 0;
  const elapsed = Math.min(OBSERVATION_DURATION, prior + frameDelta(frame.delta));
  return {
    state: { targetId: frame.candidateId, elapsed },
    ...(elapsed >= OBSERVATION_DURATION && prior < OBSERVATION_DURATION
      ? { completedId: frame.candidateId }
      : {}),
  };
}
