import type { RegionId } from '../game/adventure';
import type { AudioScene, SoundCue } from './types';

export interface MusicProfile {
  root: number;
  scale: readonly number[];
  motif: readonly (number | null)[];
  chords: readonly number[];
  step: number;
  melody: OscillatorType;
  pad: OscillatorType;
  brightness: number;
  release: number;
}

// Short, original pentatonic phrases leave room for footsteps and interaction cues.
// Degrees rather than absolute pitches let melody and harmony share one key.
const PROFILES: Record<RegionId, MusicProfile> = {
  meadow: {
    root: 62,
    scale: [0, 2, 4, 7, 9],
    motif: [0, null, 2, 4, null, 3, 1, null, 2, null, 5, 4, null, 2, 1, null],
    chords: [0, 3, 1, 4],
    step: 0.84,
    melody: 'triangle',
    pad: 'sine',
    brightness: 1900,
    release: 1.65,
  },
  water: {
    root: 60,
    scale: [0, 2, 5, 7, 9],
    motif: [4, 2, null, 1, null, 0, 2, null, 5, null, 4, 2, null, 1, 0, null],
    chords: [0, 2, 4, 1],
    step: 0.96,
    melody: 'sine',
    pad: 'triangle',
    brightness: 2600,
    release: 2.15,
  },
  fire: {
    root: 57,
    scale: [0, 3, 5, 7, 10],
    motif: [0, null, null, 2, 3, null, 1, null, 4, null, 3, null, 2, 1, null, null],
    chords: [0, 2, 3, 1],
    step: 1.08,
    melody: 'triangle',
    pad: 'sine',
    brightness: 1250,
    release: 1.75,
  },
  earth: {
    root: 55,
    scale: [0, 2, 4, 7, 9],
    motif: [0, null, 1, null, 3, 2, null, 0, null, 4, null, 3, 1, null, 0, null],
    chords: [0, 1, 3, 2],
    step: 1.02,
    melody: 'triangle',
    pad: 'triangle',
    brightness: 1450,
    release: 1.35,
  },
  steel: {
    root: 64,
    scale: [0, 2, 3, 7, 9],
    motif: [0, null, 3, null, 1, null, 4, 3, null, 2, null, 5, null, 3, 1, null],
    chords: [0, 3, 2, 4],
    step: 0.9,
    melody: 'sine',
    pad: 'triangle',
    brightness: 3100,
    release: 1.45,
  },
  fairy: {
    root: 65,
    scale: [0, 2, 4, 6, 9],
    motif: [2, null, 4, 5, null, 3, null, 1, 4, null, 6, null, 5, 2, null, null],
    chords: [0, 2, 4, 1],
    step: 0.92,
    melody: 'sine',
    pad: 'sine',
    brightness: 3300,
    release: 2.4,
  },
};

export function musicProfile(scene: AudioScene): MusicProfile {
  const base = PROFILES[scene.region];
  if (scene.temple)
    return {
      ...base,
      step: base.step * 1.4,
      melody: 'sine',
      pad: 'sine',
      brightness: 2200,
      release: 3.2,
    };
  if (scene.flying)
    return {
      ...base,
      root: base.root + 12,
      step: base.step * 0.84,
      melody: 'sine',
      brightness: 2900,
      release: 2.05,
    };
  return base;
}

export function scalePitch(profile: MusicProfile, degree: number): number {
  const octave = Math.floor(degree / profile.scale.length);
  const index = ((degree % profile.scale.length) + profile.scale.length) % profile.scale.length;
  return profile.root + profile.scale[index] + octave * 12;
}

export interface CueNote {
  pitch: number;
  at: number;
  duration: number;
  gain: number;
  type?: OscillatorType;
  endPitch?: number;
}
export interface CueScore {
  cooldown: number;
  notes: readonly CueNote[];
  breath?: { at: number; duration: number; gain: number; frequency: number };
}

const notes = (pitches: number[], spacing: number, duration: number, gain: number): CueNote[] =>
  pitches.map((pitch, index) => ({ pitch, at: index * spacing, duration, gain }));

export const CUE_SCORES: Record<SoundCue, CueScore> = {
  collect: { cooldown: 0.18, notes: notes([79, 86, 91], 0.075, 0.38, 0.1) },
  reward: { cooldown: 0.75, notes: notes([60, 67, 72, 76, 79], 0.13, 0.85, 0.09) },
  capture: { cooldown: 0.75, notes: notes([67, 74, 79, 83, 86], 0.12, 1.05, 0.08) },
  pet: {
    cooldown: 0.22,
    notes: [
      { pitch: 67, endPitch: 74, at: 0, duration: 0.18, gain: 0.07 },
      { pitch: 71, endPitch: 76, at: 0.17, duration: 0.24, gain: 0.065 },
    ],
  },
  takeoff: {
    cooldown: 0.6,
    notes: notes([62, 69, 74], 0.13, 0.58, 0.06),
    breath: { at: 0, duration: 1.2, gain: 0.09, frequency: 1200 },
  },
  land: {
    cooldown: 0.4,
    notes: [
      { pitch: 48, endPitch: 43, at: 0, duration: 0.26, gain: 0.11 },
      { pitch: 67, at: 0.07, duration: 0.36, gain: 0.035 },
    ],
  },
  travel: {
    cooldown: 0.7,
    notes: notes([72, 79, 84], 0.12, 0.55, 0.06),
    breath: { at: 0, duration: 0.75, gain: 0.06, frequency: 1800 },
  },
  seal: { cooldown: 0.3, notes: notes([74, 81, 86], 0.1, 0.8, 0.09) },
  mistake: {
    cooldown: 0.22,
    notes: [
      { pitch: 62, at: 0, duration: 0.14, gain: 0.065, type: 'triangle' },
      { pitch: 60, at: 0.11, duration: 0.22, gain: 0.05, type: 'triangle' },
    ],
  },
  'temple-open': { cooldown: 0.8, notes: notes([50, 57, 62, 69, 74], 0.11, 1.15, 0.07) },
  ui: { cooldown: 0.075, notes: [{ pitch: 79, at: 0, duration: 0.09, gain: 0.04 }] },
};
