import type { RegionId } from '../game/adventure';

export type SoundCue =
  | 'collect'
  | 'reward'
  | 'capture'
  | 'pet'
  | 'takeoff'
  | 'land'
  | 'travel'
  | 'seal'
  | 'mistake'
  | 'temple-open'
  | 'ui';

export interface AudioPreferences {
  muted: boolean;
  musicVolume: number;
  effectsVolume: number;
}
export interface AudioScene {
  region: RegionId;
  temple: boolean;
  flying: boolean;
  ducked: boolean;
}
export interface GameAudioEngine {
  setScene(scene: AudioScene): void;
  setPreferences(preferences: AudioPreferences): void;
  setActive(active: boolean): void;
  play(cue: SoundCue): void;
  dispose(): void;
}
export type AudioStatus = 'locked' | 'loading' | 'playing' | 'muted' | 'paused' | 'unavailable';
export interface AudioSnapshot {
  preferences: AudioPreferences;
  status: AudioStatus;
}
export interface GameAudioController {
  getSnapshot(): AudioSnapshot;
  subscribe(listener: () => void): () => void;
  start(): () => void;
  unlock(): Promise<void>;
  setPreferences(patch: Partial<AudioPreferences>): void;
  setScene(scene: AudioScene): void;
  play(cue: SoundCue): void;
}
