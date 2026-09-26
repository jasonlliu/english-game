export type Mode = 'real' | 'demo';
export type PetStage = 0 | 1 | 2 | 3;

export interface Progress {
  version: 1;
  mode: Mode;
  xp: number;
  completedMissionIds: string[];
  completedDates: string[];
  totalMissions: number;
}

export interface MissionResult {
  progress: Progress;
  rewarded: boolean;
  reason?: 'already-claimed' | 'already-completed-today' | 'invalid-mission';
}

export const MISSION_XP = 40;
export const STORAGE_KEYS: Record<Mode, string> = {
  real: 'rune-island.progress.real.v1',
  demo: 'rune-island.progress.demo.v1',
};

/** Uses the child's local calendar date, rather than a UTC day boundary. */
export function getTodayKey(): string {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${today.getFullYear()}-${month}-${day}`;
}

export function createInitialProgress(mode: Mode = 'real'): Progress {
  return {
    version: 1,
    mode,
    xp: 0,
    completedMissionIds: [],
    completedDates: [],
    totalMissions: 0,
  };
}

function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(`${value}T12:00:00Z`);
  return (
    Number.isFinite(date.getTime()) &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}

function validMissionId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 200;
}

/** XP and check-in count are derived from receipts, never trusted from storage. */
export function sanitizeProgress(value: unknown, mode: Mode): Progress {
  if (!value || typeof value !== 'object') return createInitialProgress(mode);
  const record = value as Record<string, unknown>;
  if (
    record.version !== 1 ||
    record.mode !== mode ||
    !Array.isArray(record.completedMissionIds) ||
    !Array.isArray(record.completedDates)
  ) {
    return createInitialProgress(mode);
  }

  let ids = [...new Set(record.completedMissionIds.filter(validMissionId).map((id) => id.trim()))];
  let dates = [...new Set(record.completedDates.filter(isDateKey))];
  // A real check-in reward requires both a claim receipt and a distinct day receipt.
  if (mode === 'real') {
    const count = Math.min(ids.length, dates.length);
    ids = ids.slice(0, count);
    dates = dates.slice(0, count);
  } else if (ids.length === 0) {
    dates = [];
  }

  return {
    version: 1,
    mode,
    xp: ids.length * MISSION_XP,
    completedMissionIds: ids,
    completedDates: dates,
    totalMissions: ids.length,
  };
}

export function loadProgress(mode: Mode): Progress {
  try {
    if (typeof localStorage === 'undefined') return createInitialProgress(mode);
    const raw = localStorage.getItem(STORAGE_KEYS[mode]);
    return raw ? sanitizeProgress(JSON.parse(raw), mode) : createInitialProgress(mode);
  } catch {
    return createInitialProgress(mode);
  }
}

/** Returns false if the browser blocks storage or modes do not match. */
export function saveProgress(mode: Mode, progress: Progress): boolean {
  if (progress.mode !== mode) return false;
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(STORAGE_KEYS[mode], JSON.stringify(sanitizeProgress(progress, mode)));
    return true;
  } catch {
    return false;
  }
}

export function completeMission(
  progress: Progress,
  missionId: string,
  dateKey: string = getTodayKey(),
): MissionResult {
  const current = sanitizeProgress(progress, progress.mode);
  if (!validMissionId(missionId) || !isDateKey(dateKey)) {
    return { progress: current, rewarded: false, reason: 'invalid-mission' };
  }
  const id = missionId.trim();
  if (current.completedMissionIds.includes(id)) {
    return { progress: current, rewarded: false, reason: 'already-claimed' };
  }
  if (current.mode === 'real' && current.completedDates.includes(dateKey)) {
    return { progress: current, rewarded: false, reason: 'already-completed-today' };
  }

  const ids = [...current.completedMissionIds, id];
  return {
    rewarded: true,
    progress: {
      ...current,
      xp: ids.length * MISSION_XP,
      completedMissionIds: ids,
      completedDates: [...new Set([...current.completedDates, dateKey])],
      totalMissions: ids.length,
    },
  };
}

export function getPetStage(progress: Progress): PetStage {
  if (progress.totalMissions === 0 || progress.xp < MISSION_XP) return 0;
  if (progress.xp >= 240) return 3;
  if (progress.xp >= 120) return 2;
  return 1;
}

export function getPetLevel(progress: Progress): number {
  return getPetStage(progress) === 0 ? 0 : Math.max(1, Math.floor(progress.xp / MISSION_XP));
}

/** Total XP threshold for the next form; null means the final form is unlocked. */
export function getNextEvolutionXp(progress: Progress): number | null {
  return [40, 120, 240, null][getPetStage(progress)];
}
