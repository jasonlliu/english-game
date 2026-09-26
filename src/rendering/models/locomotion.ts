import type { LocomotionPose } from './types';

const TAU = Math.PI * 2;
const unit = (value: number) => (Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0);

/** Legacy callers retain a fixed cadence; changing speed never rewinds a stride. */
export function readLocomotion(time: number, speed: number, jump = 0, motion?: LocomotionPose) {
  const clock = Number.isFinite(time) ? time % 1e9 : 0;
  const phase =
    motion && Number.isFinite(motion.phase) ? motion.phase : (clock % (TAU / 7.5)) * 7.5;
  return {
    time: clock,
    phase: ((phase % TAU) + TAU) % TAU,
    run: unit(motion?.run ?? 0),
    weight: unit(speed),
    jump: unit(jump),
  };
}

/** Flat, constant-speed support followed by a smooth raised return. Forward is -Z. */
export function sampleFootstep(phase: number, reach: number, height: number, duty: number) {
  const cycle = (((phase % TAU) + TAU) % TAU) / TAU;
  if (cycle <= duty) return { z: reach * ((2 * cycle) / duty - 1), lift: 0, pitch: 0 };
  const swing = (cycle - duty) / (1 - duty);
  const smooth = swing * swing * (3 - 2 * swing);
  // Hermite tangents match the support speed at lift-off and touchdown.
  const tangent = (2 * reach * (1 - duty)) / duty;
  const edgeWidth = Math.min(0.18, reach / (tangent * 3));
  const edge = (value: number) => (value < edgeWidth ? value * (1 - value / edgeWidth) ** 2 : 0);
  const arc = Math.sin(Math.PI * swing) ** 2;
  return {
    z: reach * (1 - 2 * smooth) + tangent * (edge(swing) - edge(1 - swing)),
    lift: height * arc,
    pitch: Math.sin(TAU * swing) * arc * 0.18,
  };
}

/** A trot/biped bounce is zero while either pair is in its support interval. */
export function sampleSuspension(phase: number, duty: number) {
  const halfCycle = ((((phase % TAU) + TAU) % TAU) / TAU) % 0.5;
  return halfCycle <= duty ? 0 : Math.sin((Math.PI * (halfCycle - duty)) / (0.5 - duty)) ** 2;
}

/** Two-link leg in the Y/Z plane. A negative knee folds the shin backwards. */
export function solveLeg(z: number, down: number, upper: number, lower: number) {
  const distance = Math.min(
    upper + lower,
    Math.max(Math.abs(upper - lower) + 1e-6, Math.hypot(z, down)),
  );
  const cosine = Math.max(
    -1,
    Math.min(1, (distance * distance - upper * upper - lower * lower) / (2 * upper * lower)),
  );
  const knee = -Math.acos(cosine);
  const hip =
    Math.atan2(-z, down) - Math.atan2(lower * Math.sin(knee), upper + lower * Math.cos(knee));
  return { hip, knee };
}

/** Left fore/hind, right fore/hind: four-beat walk blends into a diagonal trot. */
export function quadrupedPhase(phase: number, index: number, run: number) {
  return phase + ([0, 1.5, 1, 0.5][index] - (index % 2 ? run * 0.5 : 0)) * Math.PI;
}
