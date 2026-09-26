import { REGION_IDS, type RegionId } from './adventure';
import type { Mode } from './progress';

export interface TempleProgress {
  version: 1;
  mode: Mode;
  completed: RegionId[];
}

export interface TempleTheme {
  name: string;
  subtitle: string;
  clue: string;
  order: [number, number, number];
  sealNames: [string, string, string];
  artifact: string;
  story: string;
  color: string;
}

export const TEMPLE_THEMES: Record<RegionId, TempleTheme> = {
  meadow: {
    name: '晨辉神庙',
    subtitle: '追寻一天里流转的光',
    clue: '按顺序点亮：晨光 → 正午 → 暮色',
    order: [0, 1, 2],
    sealNames: ['晨光', '正午', '暮色'],
    artifact: '晨辉日晷',
    story: '日晷上留着一束暖光，记得每一位带着好奇心走进神庙的旅人。',
    color: '#e8cd84',
  },
  water: {
    name: '潮声圣殿',
    subtitle: '听见水滴和远海的回声',
    clue: '按顺序点亮：水滴 → 潮汐 → 涟漪',
    order: [0, 2, 1],
    sealNames: ['水滴', '涟漪', '潮汐'],
    artifact: '潮声螺冠',
    story: '把螺冠贴近耳边，仿佛能听见湖水和远方海浪轻轻说话。',
    color: '#8bd4e8',
  },
  fire: {
    name: '焰心秘殿',
    subtitle: '在温暖的火光里寻找记忆',
    clue: '按顺序点亮：烈焰 → 火种 → 余烬',
    order: [1, 0, 2],
    sealNames: ['火种', '烈焰', '余烬'],
    artifact: '焰心琥珀',
    story: '琥珀里藏着一颗永不烫手的小火星，像篝火旁讲不完的冒险故事。',
    color: '#f1a77d',
  },
  earth: {
    name: '古根神庙',
    subtitle: '翻开岩石和古树的年轮',
    clue: '按顺序点亮：岩层 → 古树 → 种子',
    order: [1, 2, 0],
    sealNames: ['种子', '岩层', '古树'],
    artifact: '古林种匣',
    story: '石匣里躺着一粒金色种子，旁边刻着一棵很久以后才会长大的树。',
    color: '#bdd290',
  },
  steel: {
    name: '星核工殿',
    subtitle: '让沉睡的齿轮再次回应',
    clue: '按顺序点亮：星核 → 铁砧 → 齿轮',
    order: [2, 0, 1],
    sealNames: ['铁砧', '齿轮', '星核'],
    artifact: '星核齿轮',
    story: '银色齿轮转动时，细小的刻纹会拼成一张属于古代工匠的星图。',
    color: '#bacfe3',
  },
  fairy: {
    name: '月梦花殿',
    subtitle: '循着星梦走进花开的地方',
    clue: '按顺序点亮：星梦 → 月光 → 花苞',
    order: [2, 1, 0],
    sealNames: ['花苞', '月光', '星梦'],
    artifact: '月梦花灯',
    story: '花灯的柔光里漂着小小花瓣，像一场醒来以后仍然记得的美梦。',
    color: '#e3b9ec',
  },
};

export const TEMPLE_STORAGE_KEYS: Record<Mode, string> = {
  real: 'rune-island.temple.real.v1',
  demo: 'rune-island.temple.demo.v1',
};

const isRegion = (value: unknown): value is RegionId =>
  typeof value === 'string' && REGION_IDS.includes(value as RegionId);

export function createTempleProgress(mode: Mode): TempleProgress {
  return { version: 1, mode, completed: [] };
}

export function sanitizeTempleProgress(value: unknown, mode: Mode): TempleProgress {
  if (!value || typeof value !== 'object') return createTempleProgress(mode);
  const record = value as Record<string, unknown>;
  if (record.version !== 1 || record.mode !== mode || !Array.isArray(record.completed))
    return createTempleProgress(mode);
  return { version: 1, mode, completed: [...new Set(record.completed.filter(isRegion))] };
}

export function loadTempleProgress(mode: Mode): TempleProgress {
  try {
    if (typeof localStorage === 'undefined') return createTempleProgress(mode);
    const raw = localStorage.getItem(TEMPLE_STORAGE_KEYS[mode]);
    return raw ? sanitizeTempleProgress(JSON.parse(raw), mode) : createTempleProgress(mode);
  } catch {
    return createTempleProgress(mode);
  }
}

export function saveTempleProgress(mode: Mode, state: TempleProgress): boolean {
  if (state.mode !== mode) return false;
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(
      TEMPLE_STORAGE_KEYS[mode],
      JSON.stringify(sanitizeTempleProgress(state, mode)),
    );
    return true;
  } catch {
    return false;
  }
}

/** Each regional artifact can be claimed once, independently of learning XP. */
export function completeTemple(
  state: TempleProgress,
  region: RegionId,
): { state: TempleProgress; completed: boolean } {
  const current = sanitizeTempleProgress(state, state.mode === 'demo' ? 'demo' : 'real');
  if (!isRegion(region) || current.completed.includes(region))
    return { state: current, completed: false };
  return { state: { ...current, completed: [...current.completed, region] }, completed: true };
}

const isSeal = (value: unknown): value is number => value === 0 || value === 1 || value === 2;

/** Repeated lit lamps are harmless; a wrong new lamp restarts the sequence. */
export function activateTempleSeal(
  sequence: number[],
  id: number,
  order: readonly number[],
): { sequence: number[]; correct: boolean; solved: boolean } {
  if (
    !Array.isArray(order) ||
    order.length !== 3 ||
    !Array.from(order).every(isSeal) ||
    new Set(order).size !== 3
  ) {
    return { sequence: [], correct: false, solved: false };
  }
  const validPrefix =
    Array.isArray(sequence) &&
    sequence.length <= 3 &&
    Array.from(sequence).every((value, index) => value === order[index]);
  const current = validPrefix ? [...sequence] : [];
  if (current.length === 3) return { sequence: current, correct: true, solved: true };
  if (!isSeal(id)) return { sequence: current, correct: false, solved: false };
  if (current.includes(id)) return { sequence: current, correct: true, solved: false };
  if (id !== order[current.length]) return { sequence: [], correct: false, solved: false };
  const next = [...current, id];
  return { sequence: next, correct: true, solved: next.length === 3 };
}
