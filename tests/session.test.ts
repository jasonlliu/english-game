import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGameSession, GAME_STORAGE_KEYS, type GameStorage } from '../src/game/session';
import { completeMission, createInitialProgress, STORAGE_KEYS } from '../src/game/progress';
import { EXPLORATION_STORAGE_KEYS } from '../src/game/exploration';
import { ADVENTURE_STORAGE_KEYS, createAdventure, getUnlockedRegions } from '../src/game/adventure';
import { TEMPLE_STORAGE_KEYS } from '../src/game/temple';

class MemoryStorage implements GameStorage {
  values = new Map<string, string>();
  writes: Array<{ key: string; value: string }> = [];
  reads = 0;
  attempts = 0;
  failWrites = false;
  failReads = false;
  getItem(key: string) {
    this.reads += 1;
    if (this.failReads) throw new Error('Storage access denied');
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.attempts += 1;
    if (this.failWrites) throw new Error('Quota exceeded');
    this.writes.push({ key, value });
    this.values.set(key, value);
  }
}

const date = () => '2026-09-26';

test('same-day focus/interval refreshes and reloads retain snapshots without writing', () => {
  const storage = new MemoryStorage();
  const session = createGameSession({ storage, today: date });
  assert.equal(storage.writes.length, 1); // First arrival is the only initial change.
  assert.equal(storage.writes[0].key, ADVENTURE_STORAGE_KEYS.real);
  const original = session.getSnapshot();
  let notifications = 0;
  const unsubscribe = session.subscribe(() => {
    notifications += 1;
  });
  for (let i = 0; i < 20; i += 1) {
    assert.strictEqual(session.refresh(), original);
    assert.strictEqual(session.load(), original);
  }
  assert.strictEqual(session.switchMode('real'), original);
  assert.equal(storage.writes.length, 1);
  assert.equal(notifications, 0);
  const reopened = createGameSession({ storage, today: date });
  assert.deepEqual(reopened.getSnapshot(), original);
  assert.equal(storage.writes.length, 1);
  unsubscribe();
  session.collect(0);
  assert.equal(notifications, 0);
});

test('storage events filter unrelated/inactive keys and import external changes once', () => {
  const storage = new MemoryStorage();
  const session = createGameSession({ storage, today: date });
  const before = session.getSnapshot();
  const reads = storage.reads;
  assert.strictEqual(session.refreshFromStorage('some-other-application'), before);
  assert.strictEqual(session.refreshFromStorage(STORAGE_KEYS.demo), before);
  assert.equal(storage.reads, reads);
  const remote = completeMission(createInitialProgress(), 'remote-daily', date()).progress;
  storage.values.set(STORAGE_KEYS.real, JSON.stringify(remote));
  let notifications = 0;
  session.subscribe(() => {
    notifications += 1;
  });
  const after = session.refreshFromStorage(STORAGE_KEYS.real);
  assert.equal(after.progress.xp, 40);
  assert.strictEqual(after.adventure, before.adventure);
  assert.strictEqual(after.expedition, before.expedition);
  assert.strictEqual(after.templeProgress, before.templeProgress);
  assert.equal(storage.writes.length, 1);
  assert.equal(notifications, 1);
  assert.strictEqual(session.refreshFromStorage(STORAGE_KEYS.real), after);
  assert.equal(notifications, 1);
  // A command also reads before acting, so it cannot double-reward an external check-in.
  assert.equal(session.checkin('another-button').rewarded, false);
  assert.equal(storage.writes.length, 1);
});

test('external saves cannot enter a locked region or grant its companion', () => {
  const storage = new MemoryStorage();
  const session = createGameSession({ storage, today: date });
  const before = session.getSnapshot();
  storage.values.set(
    ADVENTURE_STORAGE_KEYS.real,
    JSON.stringify({
      ...before.adventure,
      currentRegion: 'fairy',
      capturedPets: ['ember', 'lumi'],
      activePet: 'lumi',
      demoDays: 6,
      seals: { ...before.adventure.seals, fairy: [0, 1, 2] },
    }),
  );
  const writes = storage.writes.length;
  const after = session.refreshFromStorage(ADVENTURE_STORAGE_KEYS.real);
  assert.strictEqual(after, before);
  assert.equal(after.adventure.currentRegion, 'meadow');
  assert.deepEqual(after.adventure.capturedPets, ['ember']);
  assert.deepEqual(after.adventure.seals.fairy, []);
  assert.equal(session.enterRegion('fairy').entered, false);
  assert.equal(session.choosePet('lumi').chosen, false);
  assert.equal(storage.writes.length, writes);
});

test('sequential commands read current saves even before another session receives a storage event', () => {
  const storage = new MemoryStorage();
  const first = createGameSession({ storage, today: date });
  const second = createGameSession({ storage, today: date });
  assert.equal(first.collect(0).collected, true);
  assert.equal(second.collect(1).collected, true);
  assert.equal(first.collect(2).collected, true);
  assert.equal(second.openTreasure().opened, true);
  assert.equal(first.openTreasure().opened, false);
  assert.equal(first.getSnapshot().expedition.stars, 3);
  assert.equal(first.getSnapshot().expedition.totalTreasures, 1);
  assert.equal(first.checkin('first-click').rewarded, true);
  assert.equal(second.checkin('second-click').rewarded, false);
  assert.equal(first.claimTemple('meadow').completed, true);
  assert.equal(second.claimTemple('meadow').completed, false);
});

test('storage.clear events reload all four saves and record only the new arrival', () => {
  const storage = new MemoryStorage();
  const session = createGameSession({ storage, today: date });
  session.checkin('daily');
  session.collect(0);
  session.claimTemple('meadow');
  storage.values.clear();
  const writes = storage.writes.length;
  const next = session.refreshFromStorage(null);
  assert.equal(next.progress.xp, 0);
  assert.deepEqual(next.expedition.crystals, []);
  assert.deepEqual(next.templeProgress.completed, []);
  assert.deepEqual(next.adventure.visitedDates, [date()]);
  assert.equal(storage.writes.length, writes + 1);
});

test('quota failures retain all four saves independently across mode switches and recover', () => {
  const storage = new MemoryStorage();
  const session = createGameSession({ storage, today: date });
  storage.failWrites = true;
  session.checkin('real-daily');
  session.collect(0);
  session.choosePet(null);
  session.claimTemple('meadow');
  const real = session.getSnapshot();
  assert.equal(real.storageWarning, true);
  session.switchMode('demo');
  session.checkin('demo-daily');
  session.collect(1);
  session.simulateTomorrow();
  session.enterRegion('water');
  session.claimTemple('water');
  const demo = session.getSnapshot();
  assert.equal(demo.storageWarning, true);
  assert.deepEqual(session.switchMode('real'), real);
  assert.deepEqual(session.switchMode('demo'), demo);
  assert.equal(session.getSnapshot().adventure.demoDays, 2);
  assert.deepEqual(session.getSnapshot().expedition.crystals, [1]);

  storage.failWrites = false;
  const writesBefore = storage.writes.length;
  const recovered = session.refresh();
  assert.equal(recovered.storageWarning, false);
  assert.equal(storage.writes.length, writesBefore + 8);
  assert.equal(new Set(storage.writes.slice(writesBefore).map(({ key }) => key)).size, 8);
  assert.strictEqual(recovered.progress, demo.progress);
  const writesAfter = storage.writes.length;
  assert.strictEqual(session.refresh(), recovered);
  assert.equal(storage.writes.length, writesAfter);
  const reloadedReal = createGameSession({ storage, today: date });
  const reloadedDemo = createGameSession({ storage, today: date, mode: 'demo' });
  assert.equal(reloadedReal.getSnapshot().progress.xp, 40);
  assert.deepEqual(reloadedReal.getSnapshot().expedition.crystals, [0]);
  assert.equal(reloadedReal.getSnapshot().adventure.activePet, null);
  assert.deepEqual(reloadedReal.getSnapshot().templeProgress.completed, ['meadow']);
  assert.equal(reloadedDemo.getSnapshot().adventure.demoDays, 2);
  assert.deepEqual(reloadedDemo.getSnapshot().templeProgress.completed, ['water']);
  for (const key of GAME_STORAGE_KEYS)
    assert.equal(
      JSON.parse(storage.values.get(key)!).mode,
      key.includes('.demo.') ? 'demo' : 'real',
    );
});

test('unavailable storage can appear later without losing the in-memory session', () => {
  const storage = new MemoryStorage();
  let available = false;
  const session = createGameSession({ storage: () => (available ? storage : null), today: date });
  assert.equal(session.getSnapshot().storageWarning, true);
  session.checkin('offline-daily');
  session.collect(2);
  available = true;
  const recovered = session.refresh();
  assert.equal(recovered.progress.xp, 40);
  assert.deepEqual(recovered.expedition.crystals, [2]);
  assert.equal(recovered.storageWarning, false);
  assert.equal(storage.writes.length, 3);
  assert.equal(createGameSession({ storage, today: date }).getSnapshot().progress.xp, 40);
});

test('read failures preserve the last good values and a successful retry clears the warning', () => {
  const storage = new MemoryStorage();
  const session = createGameSession({ storage, today: date });
  session.checkin('daily');
  const before = session.getSnapshot();
  storage.failReads = true;
  const unavailable = session.refresh();
  assert.strictEqual(unavailable.progress, before.progress);
  assert.equal(unavailable.storageWarning, true);
  const writes = storage.writes.length;
  storage.failReads = false;
  const restored = session.refresh();
  assert.equal(restored.storageWarning, false);
  assert.strictEqual(restored.progress, before.progress);
  assert.equal(storage.writes.length, writes);
});

test('new local days and progress-date migration persist once; re-entry stays idempotent', () => {
  const storage = new MemoryStorage();
  const oldProgress = completeMission(createInitialProgress(), 'older', '2026-09-24').progress;
  storage.values.set(STORAGE_KEYS.real, JSON.stringify(oldProgress));
  let today = '2026-09-26';
  const session = createGameSession({ storage, today: () => today });
  assert.deepEqual(session.getSnapshot().adventure.visitedDates, ['2026-09-24', '2026-09-26']);
  assert.equal(getUnlockedRegions(session.getSnapshot().adventure).length, 2);
  assert.equal(storage.writes.length, 1);
  const unchanged = session.getSnapshot();
  assert.strictEqual(session.refresh(), unchanged);
  today = '2026-09-27';
  const next = session.refresh();
  assert.equal(next.today, today);
  assert.equal(next.adventure.visitedDates.length, 3);
  assert.equal(storage.writes.length, 2);
  assert.strictEqual(session.refresh(), next);
  assert.equal(session.checkin('new-day').rewarded, true);
  assert.equal(session.checkin('second-same-day').rewarded, false);
  const count = storage.writes.length;
  const reopened = createGameSession({ storage, today: () => today });
  assert.equal(reopened.checkin('new-day').rewarded, false);
  assert.equal(storage.writes.length, count);
});

test('legacy check-in dates unlock regions before migration validates existing pets and seals', () => {
  for (const today of ['2026-09-26', '2026-09-27']) {
    const storage = new MemoryStorage();
    let progress = completeMission(createInitialProgress(), 'older-day', '2026-09-24').progress;
    progress = completeMission(progress, 'recent-day', '2026-09-26').progress;
    const legacy = {
      ...createAdventure('real'),
      currentRegion: 'water',
      capturedPets: ['ember', 'ripple'],
      activePet: 'ripple',
      seals: { ...createAdventure('real').seals, water: [0, 1, 2] },
    };
    storage.values.set(STORAGE_KEYS.real, JSON.stringify(progress));
    storage.values.set(ADVENTURE_STORAGE_KEYS.real, JSON.stringify(legacy));
    const session = createGameSession({ storage, today: () => today });
    const snapshot = session.getSnapshot();
    assert.equal(snapshot.adventure.currentRegion, 'water');
    assert.equal(snapshot.adventure.activePet, 'ripple');
    assert.deepEqual(snapshot.adventure.capturedPets, ['ember', 'ripple']);
    assert.deepEqual(snapshot.adventure.seals.water, [0, 1, 2]);
    assert.equal(snapshot.adventure.visitedDates.length, today === '2026-09-26' ? 2 : 3);
    assert.equal(storage.writes.length, 1);
    assert.deepEqual(
      JSON.parse(storage.values.get(ADVENTURE_STORAGE_KEYS.real)!),
      snapshot.adventure,
    );
    assert.strictEqual(session.refresh(), snapshot);
    assert.deepEqual(createGameSession({ storage, today: () => today }).getSnapshot(), snapshot);
    assert.equal(storage.writes.length, 1);
  }
});

test('business commands retain rules, make no-op commands silent and route regional collection', () => {
  const storage = new MemoryStorage();
  const session = createGameSession({ mode: 'demo', storage, today: date });
  let notifications = 0;
  session.subscribe(() => {
    notifications += 1;
  });
  const baseline = storage.writes.length;
  assert.equal(session.enterRegion('water').entered, false);
  assert.equal(session.choosePet('ripple').chosen, false);
  assert.equal(session.capturePet('ripple').captured, false);
  assert.equal(session.openTreasure().opened, false);
  assert.equal(session.collect(9).collected, false);
  assert.equal(session.choosePet('ember').chosen, true);
  session.newExpedition();
  assert.equal(storage.writes.length, baseline);
  assert.equal(notifications, 0);
  for (const id of [0, 1, 2]) assert.equal(session.collect(id).collected, true);
  assert.equal(session.collect(2).collected, false);
  assert.equal(session.openTreasure().opened, true);
  assert.equal(session.openTreasure().opened, false);
  assert.equal(session.getSnapshot().expedition.stars, 3);
  session.newExpedition();
  assert.deepEqual(session.getSnapshot().expedition.crystals, []);
  assert.equal(session.getSnapshot().expedition.stars, 3);
  session.simulateTomorrow();
  assert.equal(session.enterRegion('water').entered, true);
  for (const id of [0, 1, 2]) {
    const result = session.collect(id);
    assert.equal(result.region, 'water');
    assert.equal(result.collected, true);
  }
  assert.deepEqual(session.getSnapshot().expedition.crystals, []);
  assert.equal(session.capturePet('ripple').captured, true);
  assert.equal(session.capturePet('ripple').captured, false);
  assert.equal(session.choosePet('ripple').chosen, true);
  assert.equal(session.claimTemple('water').completed, true);
  assert.equal(session.claimTemple('water').completed, false);
  const before = session.getSnapshot();
  const writes = storage.writes.length;
  assert.equal(session.enterRegion('water').entered, true);
  assert.strictEqual(session.getSnapshot(), before);
  assert.equal(storage.writes.length, writes);
});

test('demo reset and day simulation cannot mutate real state and capped days do not write', () => {
  const storage = new MemoryStorage();
  const session = createGameSession({ storage, today: date });
  session.checkin('real-daily');
  session.collect(0);
  const real = session.getSnapshot();
  assert.equal(session.resetDemo(), false);
  assert.strictEqual(session.simulateTomorrow(), real.adventure);
  assert.strictEqual(session.getSnapshot(), real);
  session.switchMode('demo');
  for (let i = 0; i < 5; i += 1) session.simulateTomorrow();
  const capped = session.getSnapshot();
  const writes = storage.writes.length;
  session.simulateTomorrow();
  session.simulateTomorrow();
  assert.strictEqual(session.getSnapshot(), capped);
  assert.equal(storage.writes.length, writes);
  session.checkin('demo');
  session.collect(1);
  session.claimTemple('meadow');
  assert.equal(session.resetDemo(), true);
  const reset = session.getSnapshot();
  assert.equal(reset.progress.xp, 0);
  assert.deepEqual(reset.expedition.crystals, []);
  assert.deepEqual(reset.templeProgress.completed, []);
  assert.equal(reset.adventure.demoDays, 1);
  const afterResetWrites = storage.writes.length;
  assert.equal(session.resetDemo(), true);
  assert.strictEqual(session.getSnapshot(), reset);
  assert.equal(storage.writes.length, afterResetWrites);
  assert.deepEqual(session.switchMode('real'), real);
});

test('the session preserves existing save keys and recovers malformed/mismatched data', () => {
  const storage = new MemoryStorage();
  storage.values.set(STORAGE_KEYS.real, '{broken');
  storage.values.set(
    EXPLORATION_STORAGE_KEYS.real,
    JSON.stringify({ version: 1, mode: 'demo', crystals: [0, 1, 2], totalTreasures: 8 }),
  );
  storage.values.set(ADVENTURE_STORAGE_KEYS.real, 'null');
  storage.values.set(
    TEMPLE_STORAGE_KEYS.real,
    JSON.stringify({ version: 20, mode: 'real', completed: ['water'] }),
  );
  const session = createGameSession({ storage, today: date });
  const state = session.getSnapshot();
  assert.equal(state.progress.xp, 0);
  assert.deepEqual(state.expedition.crystals, []);
  assert.deepEqual(state.templeProgress.completed, []);
  assert.deepEqual(state.adventure.capturedPets, ['ember']);
  assert.equal(state.storageWarning, false);
  const writes = storage.writes.length;
  assert.strictEqual(session.refresh(), state);
  assert.equal(storage.writes.length, writes);
});

test('a command publishes one coherent snapshot even when it also records a new day', () => {
  const storage = new MemoryStorage();
  let today = '2026-09-26';
  const session = createGameSession({ storage, today: () => today });
  const observed: ReturnType<typeof session.getSnapshot>[] = [];
  session.subscribe(() => {
    observed.push(session.getSnapshot());
  });
  today = '2026-09-27';
  session.checkin('new-day');
  assert.equal(observed.length, 1);
  assert.equal(observed[0].today, today);
  assert.equal(observed[0].progress.xp, 40);
  assert.equal(observed[0].adventure.visitedDates.length, 2);
});

test('collection rejects an old scene event after a fresh save changes the current region', () => {
  const storage = new MemoryStorage();
  const session = createGameSession({ mode: 'demo', storage, today: date });
  session.simulateTomorrow();
  const external = { ...session.getSnapshot().adventure, currentRegion: 'water' };
  storage.values.set(ADVENTURE_STORAGE_KEYS.demo, JSON.stringify(external));
  const writes = storage.writes.length;
  const stale = session.collect(0, 'meadow');
  assert.deepEqual(stale, { collected: false, region: 'water', count: 0 });
  assert.deepEqual(session.getSnapshot().adventure.seals.water, []);
  assert.deepEqual(session.getSnapshot().expedition.crystals, []);
  assert.equal(storage.writes.length, writes);
  assert.deepEqual(session.collect(0, 'water'), { collected: true, region: 'water', count: 1 });
});

test('temple claims require the currently visited unlocked region', () => {
  const storage = new MemoryStorage();
  const session = createGameSession({ mode: 'demo', storage, today: date });
  const firstWrites = storage.writes.length;
  assert.equal(session.claimTemple('fairy').completed, false);
  assert.equal(storage.writes.length, firstWrites);
  session.simulateTomorrow();
  const writes = storage.writes.length;
  assert.equal(session.claimTemple('water').completed, false); // Unlocked, but not current.
  assert.equal(storage.writes.length, writes);
  session.enterRegion('water');
  assert.equal(session.claimTemple('meadow').completed, false); // A stale previous-scene callback.
  assert.equal(session.claimTemple('water').completed, true);
  assert.equal(session.claimTemple('water').completed, false);
  assert.deepEqual(session.getSnapshot().templeProgress.completed, ['water']);
});
