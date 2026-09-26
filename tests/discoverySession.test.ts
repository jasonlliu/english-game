import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createGameSession,
  GAME_STORAGE_KEYS,
  type GameSession,
  type GameStorage,
} from '../src/game/session';
import {
  CHIME_ORDER,
  DISCOVERY_ORDER,
  DISCOVERY_SITES,
  DISCOVERY_STORAGE_KEYS,
  createDiscoveryProgress,
  getDailyDiscoverySite,
  type BellId,
  type DiscoveryId,
} from '../src/game/discovery';
import { ADVENTURE_STORAGE_KEYS } from '../src/game/adventure';

class Storage implements GameStorage {
  values = new Map<string, string>();
  writes: string[] = [];
  fail = false;
  readFail = false;
  getItem(key: string) {
    if (this.readFail) throw new Error('Denied');
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.fail) throw new Error('Quota');
    this.values.set(key, value);
    this.writes.push(key);
  }
}
const today = '2026-09-26';
const visit = (session: GameSession, id: DiscoveryId | BellId) =>
  session.investigateDiscovery(id, DISCOVERY_SITES[id].position, 'meadow');
function complete(session: GameSession) {
  for (const id of DISCOVERY_ORDER.slice(0, 6)) assert.equal(visit(session, id).changed, true);
  for (const bell of CHIME_ORDER)
    assert.equal(visit(session, `bell-${bell}` as BellId).changed, true);
  assert.equal(visit(session, 'vault').reward, 'artifact');
}

test('discovery adds independent save keys without writing on old-save startup, same-day focus or rejected actions', () => {
  const storage = new Storage(),
    session = createGameSession({ storage, today: () => today });
  assert.ok(GAME_STORAGE_KEYS.includes(DISCOVERY_STORAGE_KEYS.real));
  assert.ok(GAME_STORAGE_KEYS.includes(DISCOVERY_STORAGE_KEYS.demo));
  assert.equal(storage.writes.length, 1);
  assert.deepEqual(session.getSnapshot().discovery, createDiscoveryProgress('real'));
  const initial = session.getSnapshot();
  for (let i = 0; i < 5; i++) assert.strictEqual(session.refresh(), initial);
  assert.equal(visit(session, 'cache').changed, false);
  assert.strictEqual(session.getSnapshot(), initial);
  assert.equal(visit(session, 'letter').changed, true);
  assert.equal(storage.writes.at(-1), DISCOVERY_STORAGE_KEYS.real);
  const changed = session.getSnapshot(),
    writes = storage.writes.length;
  assert.equal(visit(session, 'letter').changed, false);
  assert.strictEqual(session.refresh(), changed);
  assert.equal(storage.writes.length, writes);
  assert.deepEqual(createGameSession({ storage, today: () => today }).getSnapshot(), changed);
});

test('the quest and daily stamps never change XP, crystals or old treasure totals; new expeditions keep discovery', () => {
  const storage = new Storage(),
    session = createGameSession({ storage, today: () => today });
  session.checkin('daily');
  for (const id of [0, 1, 2]) session.collect(id);
  session.openTreasure();
  const before = session.getSnapshot();
  const writes = storage.writes.length;
  complete(session);
  const result = session.investigateDiscovery(
    'daily-cache',
    getDailyDiscoverySite(today).position,
    'meadow',
  );
  assert.equal(result.reward, 'stamp');
  const after = session.getSnapshot();
  assert.strictEqual(after.progress, before.progress);
  assert.strictEqual(after.expedition, before.expedition);
  assert.strictEqual(after.adventure, before.adventure);
  assert.strictEqual(after.templeProgress, before.templeProgress);
  assert.ok(storage.writes.slice(writes).every((key) => key === DISCOVERY_STORAGE_KEYS.real));
  session.newExpedition();
  assert.strictEqual(session.getSnapshot().discovery, after.discovery);
  assert.equal(session.getSnapshot().progress.xp, 40);
  assert.equal(session.getSnapshot().expedition.totalTreasures, 1);
});

test('sessions read fresh discovery saves before rewarding the same artifact or daily cache', () => {
  const storage = new Storage(),
    first = createGameSession({ storage, today: () => today }),
    second = createGameSession({ storage, today: () => today });
  assert.equal(visit(first, 'letter').changed, true);
  assert.equal(visit(second, 'camp').changed, true);
  for (const id of DISCOVERY_ORDER.slice(2, 6)) visit(first, id);
  visit(first, 'bell-1');
  visit(second, 'bell-0');
  visit(first, 'bell-2');
  assert.equal(visit(second, 'vault').reward, 'artifact');
  const writes = storage.writes.length;
  assert.equal(visit(first, 'vault').reward, undefined);
  assert.equal(storage.writes.length, writes);
  const position = getDailyDiscoverySite(today).position;
  assert.equal(first.investigateDiscovery('daily-cache', position, 'meadow').reward, 'stamp');
  assert.equal(second.investigateDiscovery('daily-cache', position, 'meadow').reward, undefined);
  assert.deepEqual(second.getSnapshot().discovery.dailyFinds, [today]);
});

test('bell feedback remains correct for an empty melody and after another tab changes a stale snapshot', () => {
  const storage = new Storage(),
    first = createGameSession({ storage, today: () => today });
  for (const id of DISCOVERY_ORDER.slice(0, 6)) visit(first, id);
  const before = first.getSnapshot(),
    writes = storage.writes.length;
  const emptyWrong = visit(first, 'bell-0');
  assert.equal(emptyWrong.changed, false);
  assert.equal(emptyWrong.feedback, 'bell-wrong');
  assert.strictEqual(first.getSnapshot(), before);
  assert.equal(storage.writes.length, writes);

  const second = createGameSession({ storage, today: () => today });
  assert.equal(visit(first, 'bell-1').feedback, 'bell-correct');
  assert.equal(visit(first, 'bell-0').feedback, 'bell-correct');
  assert.deepEqual(
    second.getSnapshot().discovery.chimes,
    [],
    'No storage event has refreshed the other tab yet',
  );
  const staleWrong = visit(second, 'bell-1');
  assert.equal(staleWrong.changed, true);
  assert.equal(staleWrong.feedback, 'bell-wrong');
  assert.deepEqual(staleWrong.state.chimes, []);
  assert.deepEqual(first.refresh().discovery.chimes, []);
  assert.equal(visit(second, 'bell-1').feedback, 'bell-correct');
  assert.equal(second.investigateDiscovery('bell-0', { x: 0, z: 0 }, 'meadow').feedback, undefined);
});

test('stale scene events and current non-meadow regions cannot investigate meadow clues', () => {
  const storage = new Storage(),
    session = createGameSession({ storage, mode: 'demo', today: () => today });
  session.simulateTomorrow();
  storage.values.set(
    ADVENTURE_STORAGE_KEYS.demo,
    JSON.stringify({ ...session.getSnapshot().adventure, currentRegion: 'water' }),
  );
  const writes = storage.writes.length;
  assert.equal(visit(session, 'letter').changed, false);
  assert.equal(
    session.investigateDiscovery('letter', DISCOVERY_SITES.letter.position, 'water').changed,
    false,
  );
  assert.deepEqual(session.getSnapshot().discovery.found, []);
  assert.equal(storage.writes.length, writes);
  session.enterRegion('meadow');
  assert.equal(visit(session, 'letter').changed, true);
});

test('quota failure preserves discovery independently across modes and flushes both saved versions on recovery', () => {
  const storage = new Storage(),
    session = createGameSession({ storage, today: () => today });
  storage.fail = true;
  visit(session, 'letter');
  visit(session, 'camp');
  const real = session.getSnapshot().discovery;
  session.switchMode('demo');
  visit(session, 'letter');
  session.investigateDiscovery('daily-cache', getDailyDiscoverySite(today).position, 'meadow');
  const demo = session.getSnapshot().discovery;
  assert.equal(session.getSnapshot().storageWarning, true);
  assert.strictEqual(session.switchMode('real').discovery, real);
  assert.strictEqual(session.switchMode('demo').discovery, demo);
  storage.fail = false;
  const recovered = session.refresh();
  assert.equal(recovered.storageWarning, false);
  assert.strictEqual(recovered.discovery, demo);
  assert.deepEqual(JSON.parse(storage.values.get(DISCOVERY_STORAGE_KEYS.real)!), real);
  assert.deepEqual(JSON.parse(storage.values.get(DISCOVERY_STORAGE_KEYS.demo)!), demo);
  const writes = storage.writes.length;
  assert.strictEqual(session.refresh(), recovered);
  assert.equal(storage.writes.length, writes);
});

test('external discovery changes and clear events update stable snapshots while other-mode keys are ignored', () => {
  const storage = new Storage(),
    session = createGameSession({ storage, today: () => today });
  const initial = session.getSnapshot();
  storage.values.set(
    DISCOVERY_STORAGE_KEYS.real,
    JSON.stringify({ ...initial.discovery, found: ['letter'] }),
  );
  assert.strictEqual(session.refreshFromStorage(DISCOVERY_STORAGE_KEYS.demo), initial);
  let notifications = 0;
  session.subscribe(() => notifications++);
  const external = session.refreshFromStorage(DISCOVERY_STORAGE_KEYS.real);
  assert.deepEqual(external.discovery.found, ['letter']);
  assert.equal(notifications, 1);
  assert.strictEqual(session.refreshFromStorage(DISCOVERY_STORAGE_KEYS.real), external);
  storage.values.clear();
  assert.deepEqual(session.refreshFromStorage(null).discovery, createDiscoveryProgress('real'));
  assert.equal(notifications, 2);
});

test('demo resets discovery and stamps without touching real discovery or letting day simulation repeat today', () => {
  const storage = new Storage(),
    session = createGameSession({ storage, today: () => today });
  visit(session, 'letter');
  visit(session, 'camp');
  const real = session.getSnapshot().discovery;
  assert.equal(session.resetDemo(), false);
  session.switchMode('demo');
  complete(session);
  const daily = getDailyDiscoverySite(today);
  session.investigateDiscovery('daily-cache', daily.position, 'meadow');
  session.simulateTomorrow();
  assert.equal(
    session.investigateDiscovery('daily-cache', daily.position, 'meadow').reward,
    undefined,
  );
  session.resetDemo();
  assert.deepEqual(session.getSnapshot().discovery, createDiscoveryProgress('demo'));
  assert.strictEqual(session.switchMode('real').discovery, real);
});

test('date rollover rotates caches and publishes one coherent reward; corrupt saves and blocked reads recover safely', () => {
  const storage = new Storage();
  let date = today;
  storage.values.set(DISCOVERY_STORAGE_KEYS.real, '{broken');
  const session = createGameSession({ storage, today: () => date });
  assert.deepEqual(session.getSnapshot().discovery, createDiscoveryProgress('real'));
  visit(session, 'letter');
  session.investigateDiscovery('daily-cache', getDailyDiscoverySite(date).position, 'meadow');
  const saved = session.getSnapshot().discovery;
  storage.readFail = true;
  assert.strictEqual(session.refresh().discovery, saved);
  assert.equal(session.getSnapshot().storageWarning, true);
  storage.readFail = false;
  session.refresh();
  let notifications = 0;
  session.subscribe(() => notifications++);
  date = '2026-09-27';
  assert.equal(
    session.investigateDiscovery('daily-cache', getDailyDiscoverySite(date).position, 'meadow')
      .reward,
    'stamp',
  );
  assert.equal(notifications, 1);
  assert.deepEqual(session.getSnapshot().discovery.dailyFinds, [today, date]);
  assert.equal(session.getSnapshot().today, date);
  assert.equal(session.getSnapshot().progress.xp, 0);
});
