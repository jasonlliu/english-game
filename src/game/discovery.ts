import type { RegionId } from './adventure';
import type { Mode } from './progress';
import type { WorldPoint } from './world';

export type DiscoveryId = 'letter' | 'camp' | 'track-1' | 'track-2' | 'track-3' | 'cache' | 'vault';
export type BellId = 'bell-0' | 'bell-1' | 'bell-2';
export type DiscoverySiteId = DiscoveryId | BellId | 'daily-cache';
export interface DiscoveryProgress {
  version: 1;
  mode: Mode;
  found: DiscoveryId[];
  chimes: number[];
  completed: boolean;
  dailyFinds: string[];
}
export interface DiscoverySite {
  id: DiscoverySiteId;
  name: string;
  position: WorldPoint;
  kind: 'note' | 'camp' | 'track' | 'cache' | 'bell' | 'vault' | 'daily';
  clue: string;
  prompt: string;
}
export interface DiscoveryResult {
  state: DiscoveryProgress;
  changed: boolean;
  reward?: 'artifact' | 'stamp';
  feedback?: 'bell-correct' | 'bell-wrong';
  message: string;
}

export const DISCOVERY_STORAGE_KEYS: Record<Mode, string> = {
  real: 'rune-island.discovery.real.v1',
  demo: 'rune-island.discovery.demo.v1',
};
export const DISCOVERY_ORDER: readonly DiscoveryId[] = [
  'letter',
  'camp',
  'track-1',
  'track-2',
  'track-3',
  'cache',
  'vault',
];
export const CHIME_ORDER = [1, 0, 2] as const;
export const MAX_DAILY_DISCOVERY_FINDS = 366;
export const DISCOVERY_INTERACTION_DISTANCE = 3.5;

export const DISCOVERY_SITES: Readonly<Record<DiscoveryId | BellId, DiscoverySite>> = {
  letter: {
    id: 'letter',
    name: '旧路牌上的信',
    position: { x: -5, z: 19 },
    kind: 'note',
    prompt: '读一读旧信',
    clue: '风铃不见了。信的末尾画着一头小鹿，旁边写着：去西边的鹿溪营地，问问留下手札的旅人。',
  },
  camp: {
    id: 'camp',
    name: '鹿溪营地手札',
    position: { x: -79, z: 40 },
    kind: 'camp',
    prompt: '翻开营地手札',
    clue: '旅人把风铃藏在了花海。营地东北边，一串新鲜蹄印绕过帐篷，朝溪边延伸。',
  },
  'track-1': {
    id: 'track-1',
    name: '溪畔蹄印',
    position: { x: -68.5, z: 31 },
    kind: 'track',
    prompt: '辨认蹄印',
    clue: '湿泥里夹着一片浅色花瓣。蹄印继续向东北，通往一根折断的树枝。',
  },
  'track-2': {
    id: 'track-2',
    name: '折枝旁的蹄印',
    position: { x: -64, z: 22 },
    kind: 'track',
    prompt: '追踪折枝旁的脚印',
    clue: '树枝上挂着一缕旧绳。沿着东北方向的石坡，还能看见下一串蹄印。',
  },
  'track-3': {
    id: 'track-3',
    name: '石坡上的蹄印',
    position: { x: -58, z: 13 },
    kind: 'track',
    prompt: '查看石坡痕迹',
    clue: '蹄印停在石坡边，旁边有拖动木匣的浅痕。往东北再走几步，草丛里露出旧木角。',
  },
  cache: {
    id: 'cache',
    name: '旅人的旧木匣',
    position: { x: -55, z: 9 },
    kind: 'cache',
    prompt: '打开旧木匣',
    clue: '匣中纸条写着：去东北方的风铃山丘，依次敲响「泉 → 风 → 星」。当最后的回声落下，山丘东南方花海的密藏就会打开。',
  },
  'bell-0': {
    id: 'bell-0',
    name: '风铃',
    position: { x: -9, z: -84 },
    kind: 'bell',
    prompt: '敲响风铃',
    clue: '铃身刻着一道旋风，声音轻柔悠长。',
  },
  'bell-1': {
    id: 'bell-1',
    name: '泉铃',
    position: { x: -4, z: -85 },
    kind: 'bell',
    prompt: '敲响泉铃',
    clue: '铃身刻着一滴泉水，声音清澈明亮。',
  },
  'bell-2': {
    id: 'bell-2',
    name: '星铃',
    position: { x: 1, z: -84 },
    kind: 'bell',
    prompt: '敲响星铃',
    clue: '铃身刻着一颗星，尾音像微光一样闪烁。',
  },
  vault: {
    id: 'vault',
    name: '花房密藏',
    position: { x: 69, z: 60 },
    kind: 'vault',
    prompt: '查看花房密藏',
    clue: '石盖上嵌着三枚铃纹。它静静等待山丘上传来完整的回声。',
  },
};
export const DAILY_DISCOVERY_POSITIONS: readonly WorldPoint[] = [
  { x: -36, z: 36 },
  { x: 58, z: 40 },
  { x: 9, z: -72 },
];
const dailyClues = [
  '今日的小宝匣藏在西边村落与鹿溪营地之间，沿花草小径寻找一小簇金光。',
  '今日的小宝匣藏在东边花海的西北坡，留意草地上的一小簇金光。',
  '今日的小宝匣藏在北方风铃山丘的东南坡，山脊小径旁有一小簇金光。',
];

function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function createDiscoveryProgress(mode: Mode): DiscoveryProgress {
  return { version: 1, mode, found: [], chimes: [], completed: false, dailyFinds: [] };
}

export function sanitizeDiscoveryProgress(value: unknown, mode: Mode): DiscoveryProgress {
  const initial = createDiscoveryProgress(mode);
  if (!value || typeof value !== 'object') return initial;
  const record = value as Record<string, unknown>;
  if (record.version !== 1 || record.mode !== mode || !Array.isArray(record.found)) return initial;
  const found: DiscoveryId[] = [];
  for (const id of [...new Set(record.found)]) {
    if (found.length === DISCOVERY_ORDER.length) break;
    if (id !== DISCOVERY_ORDER[found.length]) break;
    found.push(id as DiscoveryId);
  }
  const chimes: number[] = [];
  if (found.includes('cache') && Array.isArray(record.chimes)) {
    for (const id of record.chimes) {
      if (chimes.length === CHIME_ORDER.length) break;
      if (id !== CHIME_ORDER[chimes.length]) break;
      chimes.push(id as number);
    }
  }
  if (found.includes('vault') && chimes.length !== 3) found.pop();
  const dailyFinds =
    found.includes('letter') && Array.isArray(record.dailyFinds)
      ? [...new Set(record.dailyFinds.filter(isDate))].sort().slice(-MAX_DAILY_DISCOVERY_FINDS)
      : [];
  return { version: 1, mode, found, chimes, completed: found.includes('vault'), dailyFinds };
}

export function loadDiscoveryProgress(mode: Mode): DiscoveryProgress {
  try {
    if (typeof localStorage === 'undefined') return createDiscoveryProgress(mode);
    return sanitizeDiscoveryProgress(
      JSON.parse(localStorage.getItem(DISCOVERY_STORAGE_KEYS[mode]) ?? 'null'),
      mode,
    );
  } catch {
    return createDiscoveryProgress(mode);
  }
}

export function saveDiscoveryProgress(mode: Mode, state: DiscoveryProgress): boolean {
  if (state.mode !== mode) return false;
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(
      DISCOVERY_STORAGE_KEYS[mode],
      JSON.stringify(sanitizeDiscoveryProgress(state, mode)),
    );
    return true;
  } catch {
    return false;
  }
}

export function getDailyDiscoverySite(today: string): DiscoverySite {
  const day = isDate(today) ? Math.floor(Date.parse(`${today}T12:00:00Z`) / 86400000) : 0;
  const index = ((day % 3) + 3) % 3;
  return {
    id: 'daily-cache',
    name: '今日的隐藏小宝匣',
    position: { ...DAILY_DISCOVERY_POSITIONS[index] },
    kind: 'daily',
    prompt: '打开隐藏小宝匣',
    clue: dailyClues[index],
  };
}

export function getAvailableDiscoverySites(
  state: DiscoveryProgress,
  today: string,
): DiscoverySite[] {
  const sites: DiscoverySite[] = [DISCOVERY_SITES.letter];
  for (let i = 1; i < DISCOVERY_ORDER.length - 1; i++)
    if (state.found.includes(DISCOVERY_ORDER[i - 1]))
      sites.push(DISCOVERY_SITES[DISCOVERY_ORDER[i]]);
  if (state.found.includes('cache'))
    sites.push(DISCOVERY_SITES['bell-0'], DISCOVERY_SITES['bell-1'], DISCOVERY_SITES['bell-2']);
  sites.push(DISCOVERY_SITES.vault);
  if (state.found.includes('letter') && isDate(today)) sites.push(getDailyDiscoverySite(today));
  return sites;
}

export function getDiscoveryObjective(state: DiscoveryProgress): {
  title: string;
  hint: string;
  stage: number;
  total: number;
} {
  const stage = state.found.length + state.chimes.length;
  if (state.completed)
    return {
      title: '风铃再次回响',
      hint: '回响风铃已收入收藏。每天还可以寻找一只隐藏小宝匣，收集旅途邮票。',
      stage: 10,
      total: 10,
    };
  if (state.found.includes('cache'))
    return state.chimes.length === 3
      ? {
          title: '开启花房密藏',
          hint: '三座风铃已经回应。去山丘东南方的晴风花海，寻找花房旁的密藏。',
          stage,
          total: 10,
        }
      : { title: '唤醒风铃山丘', hint: '到北方山丘，依次敲响泉铃、风铃、星铃。', stage, total: 10 };
  const next = DISCOVERY_SITES[DISCOVERY_ORDER[state.found.length]];
  return {
    title: next.name,
    hint: state.found.length
      ? DISCOVERY_SITES[state.found[state.found.length - 1]].clue
      : '先去出生地西北边的旧路牌，看看是谁留下了一封信。',
    stage,
    total: 10,
  };
}

/** Proximity and prerequisites are enforced here, independently of visible markers and UI. */
export function investigateDiscovery(
  state: DiscoveryProgress,
  id: string,
  position: WorldPoint,
  today: string,
  region: RegionId,
): DiscoveryResult {
  const current = sanitizeDiscoveryProgress(state, state.mode === 'demo' ? 'demo' : 'real');
  const unchanged = (message: string): DiscoveryResult => ({
    state: current,
    changed: false,
    message,
  });
  if (region !== 'meadow') return unchanged('这些线索留在晴风原野，回到原野后再调查吧。');
  if (!isDate(today)) return unchanged('今天的日期暂不可用，请稍后再试。');
  const site =
    id === 'daily-cache'
      ? getDailyDiscoverySite(today)
      : Object.hasOwn(DISCOVERY_SITES, id)
        ? DISCOVERY_SITES[id as DiscoveryId | BellId]
        : undefined;
  if (!site) return unchanged('这里没有可以调查的线索。');
  if (
    !position ||
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.z) ||
    Math.hypot(position.x - site.position.x, position.z - site.position.z) >
      DISCOVERY_INTERACTION_DISTANCE
  )
    return unchanged(`再靠近${site.name}一些，就能仔细查看。`);
  if (id === 'daily-cache') {
    if (!current.found.includes('letter'))
      return unchanged('先读一读旧路牌上的信，也许能学会辨认旅人留下的小宝匣。');
    if (
      current.dailyFinds.includes(today) ||
      (current.dailyFinds.length === MAX_DAILY_DISCOVERY_FINDS && today < current.dailyFinds[0])
    )
      return unchanged('今天的小宝匣已经找过了，明天再来寻找新的旅途邮票。');
    return {
      state: {
        ...current,
        dailyFinds: [...current.dailyFinds, today].sort().slice(-MAX_DAILY_DISCOVERY_FINDS),
      },
      changed: true,
      reward: 'stamp',
      message: '找到一枚旅途邮票！今天的小小发现已收入手记。',
    };
  }
  if (id.startsWith('bell-')) {
    if (!current.found.includes('cache'))
      return unchanged('三座铃似乎在等待一段旋律。先沿蹄印找找旅人的旧木匣。');
    if (current.chimes.length === 3) return unchanged('完整的回声仍在山间回荡，花房密藏已经解开。');
    const bell = Number(id.slice(-1));
    if (bell !== CHIME_ORDER[current.chimes.length])
      return {
        state: { ...current, chimes: [] },
        changed: current.chimes.length > 0,
        feedback: 'bell-wrong',
        message: '回声轻轻散去了。其他发现都还在，再从泉铃开始：泉 → 风 → 星。',
      };
    const chimes = [...current.chimes, bell];
    return {
      state: { ...current, chimes },
      changed: true,
      feedback: 'bell-correct',
      message:
        chimes.length === 3
          ? '泉、风与星的回声连成一线！晴风花海的密藏解开了。'
          : `${site.name}回应了你。旋律还差${3 - chimes.length}声。`,
    };
  }
  if (current.found.includes(id as DiscoveryId))
    return unchanged(
      id === 'vault' ? '回响风铃已经收入收藏，这段旅程会一直留在手记里。' : site.clue,
    );
  if (id === 'vault' && current.chimes.length !== 3)
    return unchanged('三枚铃纹仍在沉睡。密藏需要山丘上传来完整的回声。');
  if (id !== DISCOVERY_ORDER[current.found.length])
    return unchanged('还缺少前一条线索。' + getDiscoveryObjective(current).hint);
  const found = [...current.found, id as DiscoveryId];
  if (id === 'vault')
    return {
      state: { ...current, found, completed: true },
      changed: true,
      reward: 'artifact',
      message: '获得永久藏品「回响风铃」！旅人的回声终于找到了新的同行者。',
    };
  return { state: { ...current, found }, changed: true, message: site.clue };
}
