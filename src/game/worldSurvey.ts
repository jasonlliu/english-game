import { REGION_IDS, type RegionId } from './adventure';
import { REGION_PLACES } from './landmarks';
import type { Mode } from './progress';
import { getWorldBounds, type WorldPoint } from './worldLayout';

export interface WorldSurvey {
  version: 1;
  mode: Mode;
  regions: Record<RegionId, { places: string[]; cells: number[] }>;
}
export interface SurveyResult {
  state: WorldSurvey;
  changed: boolean;
  newPlaces: string[];
}
export const SURVEY_STORAGE_KEYS: Record<Mode, string> = {
  real: 'rune-island.survey.real.v1',
  demo: 'rune-island.survey.demo.v1',
};
export const SURVEY_GRID_SIZE = 12;
export const SURVEY_DISCOVERY_RADIUS = 10;

export function createWorldSurvey(mode: Mode): WorldSurvey {
  return {
    version: 1,
    mode,
    regions: Object.fromEntries(
      REGION_IDS.map((id) => [id, { places: [] as string[], cells: [] as number[] }]),
    ) as WorldSurvey['regions'],
  };
}

export function sanitizeWorldSurvey(value: unknown, mode: Mode): WorldSurvey {
  const state = createWorldSurvey(mode);
  if (!value || typeof value !== 'object') return state;
  const raw = value as Partial<WorldSurvey>;
  if (raw.version !== 1 || raw.mode !== mode || !raw.regions || typeof raw.regions !== 'object')
    return state;
  for (const id of REGION_IDS) {
    const region = raw.regions[id];
    if (!region || typeof region !== 'object') continue;
    state.regions[id].places = REGION_PLACES[id]
      .filter((place) => Array.isArray(region.places) && region.places.includes(place.id))
      .map((place) => place.id);
    if (Array.isArray(region.cells))
      state.regions[id].cells = [
        ...new Set(
          region.cells.filter(
            (cell) => Number.isInteger(cell) && cell >= 0 && cell < SURVEY_GRID_SIZE ** 2,
          ),
        ),
      ].sort((a, b) => a - b);
  }
  return state;
}

/** Sample only this position: a portal must never chart the ground between its endpoints. */
export function surveyPosition(
  state: WorldSurvey,
  region: RegionId,
  position: WorldPoint,
): SurveyResult {
  const unchanged = { state, changed: false, newPlaces: [] };
  if (!REGION_IDS.includes(region) || !Number.isFinite(position.x) || !Number.isFinite(position.z))
    return unchanged;
  const bounds = getWorldBounds(region);
  if (
    position.x < bounds.minX ||
    position.x > bounds.maxX ||
    position.z < bounds.minZ ||
    position.z > bounds.maxZ
  )
    return unchanged;
  const saved = state.regions[region];
  const newPlaces = REGION_PLACES[region]
    .filter(
      (place) =>
        !saved.places.includes(place.id) &&
        Math.hypot(place.x - position.x, place.z - position.z) <= SURVEY_DISCOVERY_RADIUS,
    )
    .map((place) => place.id);
  const column = Math.min(
    SURVEY_GRID_SIZE - 1,
    Math.floor(((position.x - bounds.minX) / (bounds.maxX - bounds.minX)) * SURVEY_GRID_SIZE),
  );
  const row = Math.min(
    SURVEY_GRID_SIZE - 1,
    Math.floor(((position.z - bounds.minZ) / (bounds.maxZ - bounds.minZ)) * SURVEY_GRID_SIZE),
  );
  const cells = [...saved.cells];
  for (let z = Math.max(0, row - 1); z <= Math.min(SURVEY_GRID_SIZE - 1, row + 1); z += 1)
    for (let x = Math.max(0, column - 1); x <= Math.min(SURVEY_GRID_SIZE - 1, column + 1); x += 1) {
      const cell = z * SURVEY_GRID_SIZE + x;
      if (!cells.includes(cell)) cells.push(cell);
    }
  if (!newPlaces.length && cells.length === saved.cells.length) return unchanged;
  return {
    state: {
      ...state,
      regions: {
        ...state.regions,
        [region]: {
          places: REGION_PLACES[region]
            .filter((place) => saved.places.includes(place.id) || newPlaces.includes(place.id))
            .map((place) => place.id),
          cells: cells.sort((a, b) => a - b),
        },
      },
    },
    changed: true,
    newPlaces,
  };
}

const summary = (found: number, total: number) => ({
  found,
  total,
  percent: total ? Math.round((found / total) * 100) : 0,
});

/** Percentages count discovered landmarks; charted grid cells only control map fog. */
export function getRegionSurvey(region: RegionId, survey: WorldSurvey) {
  return summary(survey.regions[region].places.length, REGION_PLACES[region].length);
}

export function getWorldSurvey(survey: WorldSurvey) {
  return summary(
    REGION_IDS.reduce((count, region) => count + survey.regions[region].places.length, 0),
    REGION_IDS.reduce((count, region) => count + REGION_PLACES[region].length, 0),
  );
}
