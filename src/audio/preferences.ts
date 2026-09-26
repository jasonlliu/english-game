import type { AudioPreferences } from './types';

export const AUDIO_PREFERENCES_KEY = 'lumen-isle.audio.preferences.v1';
export const DEFAULT_AUDIO_PREFERENCES: Readonly<AudioPreferences> = {
  muted: false,
  musicVolume: 0.35,
  effectsVolume: 0.6,
};
export interface AudioPreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function defaultAudioStorage(): AudioPreferenceStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function sanitizeAudioPreferences(
  value: unknown,
  fallback: Readonly<AudioPreferences> = DEFAULT_AUDIO_PREFERENCES,
): AudioPreferences {
  const input = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const volume = (key: 'musicVolume' | 'effectsVolume') =>
    typeof input[key] === 'number' && Number.isFinite(input[key])
      ? Math.max(0, Math.min(1, input[key]))
      : fallback[key];
  return {
    muted: typeof input.muted === 'boolean' ? input.muted : fallback.muted,
    musicVolume: volume('musicVolume'),
    effectsVolume: volume('effectsVolume'),
  };
}

export function loadAudioPreferences(
  storage: AudioPreferenceStorage | null = defaultAudioStorage(),
): AudioPreferences {
  try {
    return sanitizeAudioPreferences(JSON.parse(storage?.getItem(AUDIO_PREFERENCES_KEY) ?? 'null'));
  } catch {
    return { ...DEFAULT_AUDIO_PREFERENCES };
  }
}

export function saveAudioPreferences(
  preferences: AudioPreferences,
  storage: AudioPreferenceStorage | null = defaultAudioStorage(),
): boolean {
  try {
    if (!storage) return false;
    storage.setItem(AUDIO_PREFERENCES_KEY, JSON.stringify(sanitizeAudioPreferences(preferences)));
    return true;
  } catch {
    return false;
  }
}
