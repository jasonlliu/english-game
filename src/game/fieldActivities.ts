import type { Mode } from './progress';
import type { RegionId } from './adventure';

export const FIELD_SPECIES = ['deer', 'rabbit', 'bird', 'fox', 'butterfly'] as const;
export type FieldSpecies = (typeof FIELD_SPECIES)[number];
export interface FieldProgress {
  version: 1;
  mode: Mode;
  observed: FieldSpecies[];
  raceBest: number | null;
}
export interface FieldResult {
  state: FieldProgress;
  changed: boolean;
}
export interface WildlifeResult extends FieldResult {
  /** True only for the observation that first earns the full field guide badge. */
  completed: boolean;
}
export const FIELD_STORAGE_KEYS: Record<Mode, string> = {
  real: 'rune-island.field.real.v1',
  demo: 'rune-island.field.demo.v1',
};
export const RACE_DURATION = 60;
export const MIN_RACE_SECONDS = 5;
export const GOLD_RACE_TIME = 15;
export const SILVER_RACE_TIME = 24;
const validRaceTime = (seconds: unknown): seconds is number =>
  typeof seconds === 'number' &&
  Number.isFinite(seconds) &&
  seconds >= MIN_RACE_SECONDS &&
  seconds <= RACE_DURATION;
export function createFieldProgress(mode: Mode): FieldProgress {
  return { version: 1, mode, observed: [], raceBest: null };
}

export function sanitizeFieldProgress(value: unknown, mode: Mode): FieldProgress {
  const initial = createFieldProgress(mode);
  if (!value || typeof value !== 'object') return initial;
  const record = value as Record<string, unknown>;
  if (record.version !== 1 || record.mode !== mode || !Array.isArray(record.observed))
    return initial;
  return {
    ...initial,
    observed: FIELD_SPECIES.filter((species) => (record.observed as unknown[]).includes(species)),
    raceBest: validRaceTime(record.raceBest) ? Math.round(record.raceBest * 100) / 100 : null,
  };
}

export function recordWildlife(
  state: FieldProgress,
  species: string,
  region: RegionId,
): WildlifeResult {
  if (
    region !== 'meadow' ||
    !FIELD_SPECIES.includes(species as FieldSpecies) ||
    state.observed.includes(species as FieldSpecies)
  )
    return { state, changed: false, completed: false };
  const observed = FIELD_SPECIES.filter(
    (entry) => entry === species || state.observed.includes(entry),
  );
  return {
    state: { ...state, observed },
    changed: true,
    completed: observed.length === FIELD_SPECIES.length,
  };
}

export function recordMeadowRace(
  state: FieldProgress,
  seconds: number,
  region: RegionId,
): FieldResult {
  if (region !== 'meadow' || !validRaceTime(seconds)) return { state, changed: false };
  const rounded = Math.round(seconds * 100) / 100;
  if (state.raceBest !== null && rounded >= state.raceBest) return { state, changed: false };
  return { state: { ...state, raceBest: rounded }, changed: true };
}

export type RaceRating = 'gold' | 'silver' | 'bronze';
export const getRaceRating = (seconds: number): RaceRating =>
  seconds <= GOLD_RACE_TIME ? 'gold' : seconds <= SILVER_RACE_TIME ? 'silver' : 'bronze';
