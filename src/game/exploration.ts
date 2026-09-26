import type { Mode } from './progress';

export interface Exploration {
  version: 1;
  mode: Mode;
  crystals: number[];
  totalTreasures: number;
  stars: number;
  treasureOpened: boolean;
}

export const EXPLORATION_STORAGE_KEYS: Record<Mode, string> = {
  real: 'rune-island.exploration.real.v1',
  demo: 'rune-island.exploration.demo.v1',
};

export function createExploration(mode: Mode): Exploration {
  return { version: 1, mode, crystals: [], totalTreasures: 0, stars: 0, treasureOpened: false };
}

export function sanitizeExploration(value: unknown, mode: Mode): Exploration {
  if (!value || typeof value !== 'object') return createExploration(mode);
  const record = value as Record<string, unknown>;
  if (record.version !== 1 || record.mode !== mode || !Array.isArray(record.crystals)) {
    return createExploration(mode);
  }
  const crystals = [
    ...new Set(record.crystals.filter((id): id is number => id === 0 || id === 1 || id === 2)),
  ];
  const treasureOpened = record.treasureOpened === true && crystals.length === 3;
  const count =
    typeof record.totalTreasures === 'number' && Number.isSafeInteger(record.totalTreasures)
      ? Math.min(Math.max(0, record.totalTreasures), Math.floor(Number.MAX_SAFE_INTEGER / 3) - 1)
      : 0;
  const totalTreasures = Math.max(treasureOpened ? 1 : 0, count);
  return { version: 1, mode, crystals, totalTreasures, stars: totalTreasures * 3, treasureOpened };
}

export function loadExploration(mode: Mode): Exploration {
  try {
    if (typeof localStorage === 'undefined') return createExploration(mode);
    const raw = localStorage.getItem(EXPLORATION_STORAGE_KEYS[mode]);
    return raw ? sanitizeExploration(JSON.parse(raw), mode) : createExploration(mode);
  } catch {
    return createExploration(mode);
  }
}

export function saveExploration(mode: Mode, state: Exploration): boolean {
  if (state.mode !== mode) return false;
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(
      EXPLORATION_STORAGE_KEYS[mode],
      JSON.stringify(sanitizeExploration(state, mode)),
    );
    return true;
  } catch {
    return false;
  }
}

/** Exploration rewards are independent of the daily check-in XP. */
export function collectCrystal(
  state: Exploration,
  id: 0 | 1 | 2,
): { state: Exploration; collected: boolean } {
  const current = sanitizeExploration(state, state.mode);
  if (![0, 1, 2].includes(id) || current.treasureOpened || current.crystals.includes(id)) {
    return { state: current, collected: false };
  }
  return { state: { ...current, crystals: [...current.crystals, id] }, collected: true };
}

export function openTreasure(state: Exploration): { state: Exploration; opened: boolean } {
  const current = sanitizeExploration(state, state.mode);
  if (current.treasureOpened || current.crystals.length !== 3)
    return { state: current, opened: false };
  return {
    state: {
      ...current,
      treasureOpened: true,
      totalTreasures: current.totalTreasures + 1,
      stars: current.stars + 3,
    },
    opened: true,
  };
}

export function resetExpedition(state: Exploration): Exploration {
  return { ...sanitizeExploration(state, state.mode), crystals: [], treasureOpened: false };
}
