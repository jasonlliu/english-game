import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CHIME_ORDER,
  DAILY_DISCOVERY_POSITIONS,
  DISCOVERY_ORDER,
  DISCOVERY_SITES,
  DISCOVERY_STORAGE_KEYS,
  MAX_DAILY_DISCOVERY_FINDS,
  createDiscoveryProgress,
  getAvailableDiscoverySites,
  getDailyDiscoverySite,
  getDiscoveryObjective,
  investigateDiscovery,
  loadDiscoveryProgress,
  sanitizeDiscoveryProgress,
  saveDiscoveryProgress,
  type BellId,
  type DiscoveryId,
  type DiscoveryProgress,
} from '../src/game/discovery';
import { SPAWN_POSITION, getNavigationPath, isWalkable } from '../src/game/world';

const today = '2026-09-26';
function visit(state: DiscoveryProgress, id: DiscoveryId | BellId, date = today) {
  return investigateDiscovery(state, id, DISCOVERY_SITES[id].position, date, 'meadow');
}
function throughCache() {
  let state = createDiscoveryProgress('real');
  for (const id of DISCOVERY_ORDER.slice(0, 6)) state = visit(state, id).state;
  return state;
}

test('every discovery and daily cache sits on walkable ground and has a real navigation path', () => {
  let from = SPAWN_POSITION;
  for (const site of Object.values(DISCOVERY_SITES)) {
    assert.equal(isWalkable(site.position.x, site.position.z, 0.6, 'meadow'), true, site.id);
    assert.ok(getNavigationPath(SPAWN_POSITION, site.position, 'meadow').length, site.id);
    assert.ok(getNavigationPath(from, site.position, 'meadow').length, `Route to ${site.id}`);
    from = site.position;
  }
  for (const position of DAILY_DISCOVERY_POSITIONS) {
    assert.equal(isWalkable(position.x, position.z, 0.6, 'meadow'), true);
    assert.ok(getNavigationPath(SPAWN_POSITION, position, 'meadow').length);
  }
});

test('clues reveal one next investigation at a time and keep the sealed vault inspectable', () => {
  let state = createDiscoveryProgress('real');
  assert.deepEqual(
    getAvailableDiscoverySites(state, today).map((site) => site.id),
    ['letter', 'vault'],
  );
  assert.equal(getDiscoveryObjective(state).stage, 0);
  assert.equal(getDiscoveryObjective(state).total, 10);
  for (let i = 0; i < 6; i++) {
    assert.doesNotMatch(getDiscoveryObjective(state).hint, /泉.*风.*星/);
    state = visit(state, DISCOVERY_ORDER[i]).state;
    const visible = getAvailableDiscoverySites(state, today).map((site) => site.id);
    assert.ok(visible.includes('daily-cache'));
    assert.ok(visible.includes(DISCOVERY_ORDER[i]), 'Found clues remain available for rereading');
    if (i < 5) {
      assert.ok(visible.includes(DISCOVERY_ORDER[i + 1]));
      assert.ok(!visible.includes('bell-0'));
      for (let future = i + 2; future < 6; future++)
        assert.ok(!visible.includes(DISCOVERY_ORDER[future]));
    }
  }
  assert.match(getDiscoveryObjective(state).hint, /泉.*风.*星/);
  assert.equal(getDiscoveryObjective(state).stage, 6);
  assert.ok(getAvailableDiscoverySites(state, today).some((site) => site.id === 'bell-1'));
});

test('region, finite position, exact proximity, known IDs and prerequisites are enforced in pure rules', () => {
  const initial = createDiscoveryProgress('real'),
    position = DISCOVERY_SITES.letter.position;
  for (const id of ['', 'unknown', '__proto__', 'constructor', 'bell-3'])
    assert.equal(investigateDiscovery(initial, id, position, today, 'meadow').changed, false);
  for (const point of [
    { x: NaN, z: 19 },
    { x: -5, z: Infinity },
    { x: -1.499, z: 19 },
  ])
    assert.equal(investigateDiscovery(initial, 'letter', point, today, 'meadow').changed, false);
  assert.equal(
    investigateDiscovery(initial, 'letter', { x: -1.5, z: 19 }, today, 'meadow').changed,
    true,
  );
  assert.equal(investigateDiscovery(initial, 'letter', position, today, 'water').changed, false);
  assert.equal(
    investigateDiscovery(initial, 'letter', position, '2026-02-30', 'meadow').changed,
    false,
  );
  for (const id of DISCOVERY_ORDER.slice(1)) assert.equal(visit(initial, id).changed, false);
  assert.equal(visit(initial, 'bell-1').changed, false);
});

test('ordered investigation persists a legal prefix and rereading cannot advance or grant rewards', () => {
  let state = createDiscoveryProgress('demo');
  for (const [index, id] of DISCOVERY_ORDER.slice(0, 6).entries()) {
    const result = visit(state, id);
    assert.equal(result.changed, true);
    assert.equal(result.reward, undefined);
    assert.deepEqual(result.state.found, DISCOVERY_ORDER.slice(0, index + 1));
    state = result.state;
    const reread = visit(state, id);
    assert.equal(reread.changed, false);
    assert.equal(reread.message, DISCOVERY_SITES[id].clue);
    assert.deepEqual(reread.state, state);
  }
});

test('incorrect bells reset only the current melody, including repeated out-of-order notes', () => {
  let state = throughCache();
  const daily = getDailyDiscoverySite(today);
  state = investigateDiscovery(state, 'daily-cache', daily.position, today, 'meadow').state;
  const wrongFirst = visit(state, 'bell-0');
  assert.equal(wrongFirst.changed, false);
  assert.equal(wrongFirst.feedback, 'bell-wrong');
  const correctFirst = visit(state, 'bell-1');
  assert.equal(correctFirst.feedback, 'bell-correct');
  state = correctFirst.state;
  assert.deepEqual(state.chimes, [1]);
  const wrong = visit(state, 'bell-2');
  assert.equal(wrong.changed, true);
  assert.equal(wrong.feedback, 'bell-wrong');
  assert.deepEqual(wrong.state.chimes, []);
  assert.deepEqual(wrong.state.found, state.found);
  assert.deepEqual(wrong.state.dailyFinds, [today]);
  assert.equal(wrong.reward, undefined);
  assert.deepEqual(visit(state, 'bell-1').state.chimes, []);
  for (const id of CHIME_ORDER) wrong.state = visit(wrong.state, `bell-${id}` as BellId).state;
  assert.deepEqual(wrong.state.chimes, CHIME_ORDER);
  for (const id of ['bell-0', 'bell-1', 'bell-2'] as BellId[]) {
    const repeated = visit(wrong.state, id);
    assert.equal(repeated.changed, false);
    assert.equal(repeated.feedback, undefined);
    assert.deepEqual(repeated.state.chimes, CHIME_ORDER);
  }
});

test('rejected bell interactions do not emit musical feedback', () => {
  const state = throughCache(),
    position = DISCOVERY_SITES['bell-1'].position;
  const rejected = [
    investigateDiscovery(state, 'bell-1', { x: 0, z: 0 }, today, 'meadow'),
    investigateDiscovery(state, 'bell-1', { x: NaN, z: -85 }, today, 'meadow'),
    investigateDiscovery(state, 'bell-1', position, today, 'water'),
    investigateDiscovery(state, 'bell-1', position, 'invalid-date', 'meadow'),
    investigateDiscovery(state, 'bell-3', position, today, 'meadow'),
    investigateDiscovery(createDiscoveryProgress('real'), 'bell-1', position, today, 'meadow'),
  ];
  for (const result of rejected) {
    assert.equal(result.changed, false);
    assert.equal(result.feedback, undefined);
    assert.equal(result.reward, undefined);
  }
});

test('the garden vault grants the permanent artifact only once after the full melody', () => {
  let state = throughCache();
  assert.equal(visit(state, 'vault').changed, false);
  for (const id of CHIME_ORDER) {
    const result = visit(state, `bell-${id}` as BellId);
    assert.equal(result.reward, undefined);
    assert.equal(result.feedback, 'bell-correct');
    state = result.state;
  }
  assert.equal(getDiscoveryObjective(state).stage, 9);
  const result = visit(state, 'vault');
  assert.equal(result.changed, true);
  assert.equal(result.reward, 'artifact');
  assert.equal(result.state.completed, true);
  assert.deepEqual(result.state.found, DISCOVERY_ORDER);
  assert.equal(getDiscoveryObjective(result.state).stage, 10);
  assert.equal(visit(result.state, 'vault').reward, undefined);
  assert.equal(visit(result.state, 'vault').changed, false);
});

test('daily caches rotate by local date and reward one stamp independently of main quest completion', () => {
  let state = createDiscoveryProgress('real');
  const positions = new Set<string>();
  const locked = getDailyDiscoverySite(today);
  assert.equal(
    investigateDiscovery(state, 'daily-cache', locked.position, today, 'meadow').changed,
    false,
  );
  state = visit(state, 'letter').state;
  for (const date of ['2026-09-26', '2026-09-27', '2026-09-28']) {
    const site = getDailyDiscoverySite(date);
    positions.add(JSON.stringify(site.position));
    const result = investigateDiscovery(state, 'daily-cache', site.position, date, 'meadow');
    assert.equal(result.reward, 'stamp');
    assert.equal(result.changed, true);
    assert.equal(result.state.completed, false);
    assert.deepEqual(result.state.found, ['letter']);
    state = result.state;
    const repeat = investigateDiscovery(state, 'daily-cache', site.position, date, 'meadow');
    assert.equal(repeat.changed, false);
    assert.equal(repeat.reward, undefined);
    assert.ok(getAvailableDiscoverySites(state, date).some((entry) => entry.id === 'daily-cache'));
  }
  assert.equal(positions.size, 3);
  assert.deepEqual(
    getDailyDiscoverySite('2026-09-29').position,
    getDailyDiscoverySite(today).position,
  );
  const otherDay = getDailyDiscoverySite('2026-09-27');
  assert.equal(
    investigateDiscovery(state, 'daily-cache', otherDay.position, today, 'meadow').changed,
    false,
  );
});

test('damaged saves recover to a legal prefix, never unlock bells or the artifact without prerequisites', () => {
  const initial = createDiscoveryProgress('real');
  for (const bad of [null, [], 'bad', {}, { ...initial, mode: 'demo' }, { ...initial, version: 2 }])
    assert.deepEqual(sanitizeDiscoveryProgress(bad, 'real'), initial);
  const skipped = sanitizeDiscoveryProgress(
    {
      ...initial,
      found: ['letter', 'letter', 'camp', 'track-2', 'cache', 'vault'],
      chimes: [1, 0, 2],
      completed: true,
      dailyFinds: [today],
    },
    'real',
  );
  assert.deepEqual(skipped.found, ['letter', 'camp']);
  assert.deepEqual(skipped.chimes, []);
  assert.equal(skipped.completed, false);
  const partial = sanitizeDiscoveryProgress(
    { ...initial, found: [...DISCOVERY_ORDER], chimes: [1, 2, 0], completed: true },
    'real',
  );
  assert.deepEqual(partial.found, DISCOVERY_ORDER.slice(0, 6));
  assert.deepEqual(partial.chimes, [1]);
  assert.equal(partial.completed, false);
  const overlong = sanitizeDiscoveryProgress(
    { ...initial, found: [...DISCOVERY_ORDER, undefined], chimes: [1, 0, 2, undefined] },
    'real',
  );
  assert.equal(overlong.found.length, 7);
  assert.equal(overlong.chimes.length, 3);
  assert.equal(overlong.completed, true);
});

test('daily dates are validated, deduplicated and bounded; dates older than retained history cannot be rewarded again', () => {
  const dates = Array.from({ length: 450 }, (_, i) =>
    new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10),
  );
  const state = sanitizeDiscoveryProgress(
    {
      ...createDiscoveryProgress('real'),
      found: ['letter'],
      dailyFinds: [...dates, dates[3], '2026-02-30', '2026-13-01', null, 42],
    },
    'real',
  );
  assert.equal(state.dailyFinds.length, MAX_DAILY_DISCOVERY_FINDS);
  assert.deepEqual(state.dailyFinds, dates.slice(-MAX_DAILY_DISCOVERY_FINDS));
  const old = getDailyDiscoverySite(dates[0]);
  assert.equal(
    investigateDiscovery(state, 'daily-cache', old.position, dates[0], 'meadow').changed,
    false,
  );
  assert.deepEqual(sanitizeDiscoveryProgress({ ...state, found: [] }, 'real').dailyFinds, []);
});

test('standalone persistence segregates modes and handles missing storage, invalid JSON and write errors', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map<string, string>();
  let fail = false;
  try {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem(key: string, value: string) {
          if (fail) throw new Error('Quota');
          values.set(key, value);
        },
      },
    });
    const real = throughCache();
    assert.equal(saveDiscoveryProgress('real', real), true);
    assert.equal(saveDiscoveryProgress('demo', real), false);
    assert.deepEqual(loadDiscoveryProgress('real'), real);
    assert.deepEqual(loadDiscoveryProgress('demo'), createDiscoveryProgress('demo'));
    values.set(DISCOVERY_STORAGE_KEYS.demo, '{invalid');
    assert.deepEqual(loadDiscoveryProgress('demo'), createDiscoveryProgress('demo'));
    fail = true;
    assert.equal(saveDiscoveryProgress('real', real), false);
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('Blocked');
      },
    });
    assert.deepEqual(loadDiscoveryProgress('real'), createDiscoveryProgress('real'));
    assert.equal(saveDiscoveryProgress('real', real), false);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
