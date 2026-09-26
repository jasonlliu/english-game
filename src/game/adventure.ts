import { getTodayKey, type Mode, type Progress } from './progress';

export type RegionId = 'meadow' | 'water' | 'fire' | 'earth' | 'steel' | 'fairy';
export type PetId = 'ember' | 'ripple' | 'cinder' | 'moss' | 'bolt' | 'lumi';

export const REGION_IDS: RegionId[] = ['meadow', 'water', 'fire', 'earth', 'steel', 'fairy'];

export const PETS: Record<PetId, {
  id: PetId; name: string; element: string; description: string; ability: string; color: string; region: RegionId;
}> = {
  ember: { id: 'ember', name: '烁牙', element: '光焰', description: '来自曙光遗迹的第一位伙伴，小小的身影藏着大大的冒险心。', ability: '喜欢追逐晨光，尾尖像一盏温暖的小灯。', color: '#f1be75', region: 'meadow' },
  ripple: { id: 'ripple', name: '澜尾', element: '水', description: '住在清澈湖畔的水灵伙伴，耳边挂着晶莹的水滴。', ability: '喜欢听水声，也喜欢收集圆圆的鹅卵石。', color: '#7ccbe8', region: 'water' },
  cinder: { id: 'cinder', name: '绯烬', element: '火', description: '从暖红色峡谷走来的火灵伙伴，额前亮着一簇微小火光。', ability: '每次开心时，尾巴都会像篝火一样轻轻摇摆。', color: '#f58c69', region: 'fire' },
  moss: { id: 'moss', name: '岩芽', element: '土', description: '背着苔石甲的小小守护者，总会停下来观察新长出的嫩芽。', ability: '最喜欢泥土的气味和雨后的第一片新叶。', color: '#a5be78', region: 'earth' },
  bolt: { id: 'bolt', name: '铠曜', element: '钢', description: '来自银辉工坊的晶钢伙伴，身上的金属纹路会映出星光。', ability: '喜欢把闪亮的小石头整整齐齐排成一行。', color: '#abbddd', region: 'steel' },
  lumi: { id: 'lumi', name: '绮露', element: '妖精', description: '在花雾里漫步的星翼伙伴，轻轻一动就像花瓣乘上了风。', ability: '喜欢给路过的蝴蝶和花朵起新的名字。', color: '#d7a7e9', region: 'fairy' },
};

export const REGIONS: Record<RegionId, {
  id: RegionId; name: string; element: string; description: string; color: string; day: number; petId: PetId; challenge: string; sealName: string;
}> = {
  meadow: { id: 'meadow', name: '风语原野', element: '光焰', description: '风车转过金色麦田，石屋、山泉和晨辉神庙等你发现。', color: '#adca88', day: 1, petId: 'ember', challenge: '沿着小路寻找三枚曙光符印。', sealName: '曙光符印' },
  water: { id: 'water', name: '澄波湖境', element: '水', description: '沿白石拱廊走向灯塔港湾，阶瀑与湖光之间藏着新伙伴。', color: '#78c9e2', day: 2, petId: 'ripple', challenge: '探索湖境，找到三枚潮汐符印，再靠近澜尾。', sealName: '潮汐符印' },
  fire: { id: 'fire', name: '赤霞峡谷', element: '火', description: '冰川雪山与火山相望，温泉的暖雾藏着峡谷的秘密。', color: '#ee9977', day: 3, petId: 'cinder', challenge: '穿过峡谷，找到三枚焰心符印，再靠近绯烬。', sealName: '焰心符印' },
  earth: { id: 'earth', name: '琥珀石谷', element: '土', description: '古桥横跨层叠峡谷，岩窟村落与绿洲遗迹等待重访。', color: '#cfab73', day: 4, petId: 'moss', challenge: '穿过石谷，找到三枚琥珀符印，再靠近岩芽。', sealName: '琥珀符印' },
  steel: { id: 'steel', name: '银辉遗庭', element: '钢', description: '穹顶望向群星，古老水渠穿过沉睡的齿轮工坊。', color: '#afc1da', day: 5, petId: 'bolt', challenge: '探索遗庭，找到三枚银辉符印，再靠近铠曜。', sealName: '银辉符印' },
  fairy: { id: 'fairy', name: '星花梦境', element: '妖精', description: '巨树托起月光小屋，蘑菇村与浮石花园在星雾中闪光。', color: '#d7a8e5', day: 6, petId: 'lumi', challenge: '漫步花海，找到三枚星花符印，再靠近绮露。', sealName: '星花符印' },
};

export interface Adventure {
  version: 1;
  mode: Mode;
  visitedDates: string[];
  demoDays: number;
  currentRegion: RegionId;
  capturedPets: PetId[];
  activePet: PetId | null;
  seals: Record<RegionId, number[]>;
}

export const ADVENTURE_STORAGE_KEYS: Record<Mode, string> = {
  real: 'rune-island.adventure.real.v1',
  demo: 'rune-island.adventure.demo.v1',
};

function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month && parsed.getUTCDate() === day;
}

function dates(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter(isDateKey))].sort() : [];
}

function migratedDates(mode: Mode, progress?: Progress): string[] {
  return progress?.mode === mode && progress.version === 1 ? dates(progress.completedDates) : [];
}

function emptySeals(): Record<RegionId, number[]> {
  return { meadow: [], water: [], fire: [], earth: [], steel: [], fairy: [] };
}

function isRegion(value: unknown): value is RegionId {
  return typeof value === 'string' && REGION_IDS.includes(value as RegionId);
}

function isPet(value: unknown): value is PetId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PETS, value);
}

function unlockCount(state: Pick<Adventure, 'mode' | 'visitedDates' | 'demoDays'>): number {
  return Math.min(REGION_IDS.length, Math.max(1, state.visitedDates.length, state.mode === 'demo' ? state.demoDays : 0));
}

export function createAdventure(mode: Mode, progress?: Progress): Adventure {
  return {
    version: 1, mode, visitedDates: migratedDates(mode, progress), demoDays: mode === 'demo' ? 1 : 0,
    currentRegion: 'meadow', capturedPets: ['ember'], activePet: 'ember', seals: emptySeals(),
  };
}

/** Local saves are untrusted: known IDs, distinct dates and unlocked regions only. */
function sanitizeAdventure(value: unknown, mode: Mode, progress?: Progress): Adventure {
  if (!value || typeof value !== 'object') return createAdventure(mode, progress);
  const record = value as Record<string, unknown>;
  if (record.version !== 1 || record.mode !== mode) return createAdventure(mode, progress);
  const visitedDates = dates([...dates(record.visitedDates), ...migratedDates(mode, progress)]);
  const demoDays = mode === 'demo' && typeof record.demoDays === 'number' && Number.isFinite(record.demoDays)
    ? Math.max(1, Math.min(6, Math.floor(record.demoDays))) : mode === 'demo' ? 1 : 0;
  const unlocked = REGION_IDS.slice(0, unlockCount({ mode, visitedDates, demoDays }));
  const currentRegion = isRegion(record.currentRegion) && unlocked.includes(record.currentRegion) ? record.currentRegion : 'meadow';
  const capturedPets: PetId[] = ['ember'];
  if (Array.isArray(record.capturedPets)) {
    for (const pet of record.capturedPets) {
      if (isPet(pet) && unlocked.includes(PETS[pet].region) && !capturedPets.includes(pet)) capturedPets.push(pet);
    }
  }
  const activePet = record.activePet === null ? null
    : isPet(record.activePet) && capturedPets.includes(record.activePet) ? record.activePet : 'ember';
  const seals = emptySeals();
  if (record.seals && typeof record.seals === 'object') {
    const storedSeals = record.seals as Record<string, unknown>;
    for (const region of unlocked) {
      const values = storedSeals[region];
      if (Array.isArray(values)) seals[region] = [...new Set(values.filter(id => id === 0 || id === 1 || id === 2))];
    }
  }
  return { version: 1, mode, visitedDates, demoDays, currentRegion, capturedPets, activePet, seals };
}

function normalize(state: Adventure): Adventure {
  return sanitizeAdventure(state, state.mode === 'demo' ? 'demo' : 'real');
}

/** Arrival counts once per local date; learning check-in XP remains independent. */
export function visitAdventure(state: Adventure, progress?: Progress, dateKey = getTodayKey()): Adventure {
  const current = sanitizeAdventure(state, state.mode === 'demo' ? 'demo' : 'real', progress);
  if (!isDateKey(dateKey) || current.visitedDates.includes(dateKey)) return current;
  return { ...current, visitedDates: [...current.visitedDates, dateKey].sort() };
}

export function getUnlockedRegions(state: Adventure): RegionId[] {
  return REGION_IDS.slice(0, unlockCount(normalize(state)));
}

export function advanceDemoDay(state: Adventure): Adventure {
  const current = normalize(state);
  if (current.mode !== 'demo') return current;
  return { ...current, demoDays: Math.min(6, unlockCount(current) + 1) };
}

/** Opening the game records today's visit even when no other action is taken. */
export function loadAdventure(mode: Mode, progress?: Progress): Adventure {
  let current = createAdventure(mode, progress);
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(ADVENTURE_STORAGE_KEYS[mode]);
      if (raw) current = sanitizeAdventure(JSON.parse(raw), mode, progress);
    }
  } catch { /* A damaged or unavailable save starts a usable local session. */ }
  const visited = visitAdventure(current, progress);
  saveAdventure(mode, visited);
  return visited;
}

export function saveAdventure(mode: Mode, state: Adventure): boolean {
  if (state.mode !== mode) return false;
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(ADVENTURE_STORAGE_KEYS[mode], JSON.stringify(sanitizeAdventure(state, mode)));
    return true;
  } catch { return false; }
}

export function changeRegion(state: Adventure, region: RegionId): Adventure {
  const current = normalize(state);
  return getUnlockedRegions(current).includes(region) ? { ...current, currentRegion: region } : current;
}

export function collectSeal(state: Adventure, id: 0 | 1 | 2): { state: Adventure; collected: boolean } {
  const current = normalize(state);
  const regionSeals = current.seals[current.currentRegion];
  if (![0, 1, 2].includes(id) || regionSeals.includes(id)) return { state: current, collected: false };
  return {
    state: { ...current, seals: { ...current.seals, [current.currentRegion]: [...regionSeals, id] } },
    collected: true,
  };
}

export function capturePet(state: Adventure, petId: PetId): { state: Adventure; captured: boolean } {
  const current = normalize(state);
  const region = current.currentRegion;
  if (!isPet(petId) || REGIONS[region].petId !== petId || !getUnlockedRegions(current).includes(region) ||
    current.capturedPets.includes(petId) || current.seals[region].length !== 3) {
    return { state: current, captured: false };
  }
  return { state: { ...current, capturedPets: [...current.capturedPets, petId] }, captured: true };
}

export function selectCompanion(state: Adventure, id: PetId | null): Adventure {
  const current = normalize(state);
  return id === null || current.capturedPets.includes(id) ? { ...current, activePet: id } : current;
}

export function resetRegionSeals(state: Adventure): Adventure {
  const current = normalize(state);
  return { ...current, seals: { ...current.seals, [current.currentRegion]: [] } };
}

/** Three calm timing windows; misses have no resource penalty. */
export function isCaptureHit(phase: number, attempt: number): boolean {
  if (!Number.isFinite(phase) || phase < 0 || phase > 1 || !Number.isInteger(attempt) || attempt < 0 || attempt > 2) return false;
  const centers = [0.3, 0.65, 0.45];
  const halfWidths = [0.14, 0.12, 0.10];
  return Math.abs(phase - centers[attempt]) <= halfWidths[attempt] + 1e-10;
}
