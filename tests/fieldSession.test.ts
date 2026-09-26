import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGameSession, GAME_STORAGE_KEYS, type GameStorage } from '../src/game/session';
import { ADVENTURE_STORAGE_KEYS } from '../src/game/adventure';
import {
  FIELD_SPECIES,
  FIELD_STORAGE_KEYS,
  createFieldProgress,
} from '../src/game/fieldActivities';

class Storage implements GameStorage {
  values = new Map<string, string>();
  writes: string[] = [];
  fail = false;
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.fail) throw new Error('Quota');
    this.values.set(key, value);
    this.writes.push(key);
  }
}
const today = () => '2026-09-26';

test('the field save is independent and old-save startup, refresh, and rejected actions do not write it', () => {
  const storage = new Storage();
  const session = createGameSession({ storage, today });
  assert.ok(GAME_STORAGE_KEYS.includes(FIELD_STORAGE_KEYS.real));
  assert.ok(GAME_STORAGE_KEYS.includes(FIELD_STORAGE_KEYS.demo));
  const before = session.getSnapshot();
  assert.deepEqual(before.field, createFieldProgress('real'));
  const writes = storage.writes.length;
  assert.strictEqual(session.refresh(), before);
  assert.equal(session.recordWildlife('dragon', 'meadow').changed, false);
  assert.equal(session.recordMeadowRace(NaN, 'meadow').changed, false);
  assert.strictEqual(session.getSnapshot(), before);
  assert.equal(storage.writes.length, writes);
  assert.equal(session.recordWildlife('deer', 'meadow').changed, true);
  assert.equal(storage.writes.at(-1), FIELD_STORAGE_KEYS.real);
  const after = session.getSnapshot();
  assert.strictEqual(after.progress, before.progress);
  assert.strictEqual(after.expedition, before.expedition);
  assert.strictEqual(after.adventure, before.adventure);
  assert.strictEqual(after.discovery, before.discovery);
  assert.strictEqual(after.templeProgress, before.templeProgress);
  assert.deepEqual(createGameSession({ storage, today }).getSnapshot(), after);
});

test('fresh saves prevent duplicate guide awards and slower race records across tabs', () => {
  const storage = new Storage();
  const first = createGameSession({ storage, today });
  const second = createGameSession({ storage, today });
  for (const species of FIELD_SPECIES.slice(0, -1)) first.recordWildlife(species, 'meadow');
  assert.equal(second.recordWildlife('butterfly', 'meadow').completed, true);
  const writes = storage.writes.length;
  assert.equal(first.recordWildlife('butterfly', 'meadow').completed, false);
  assert.equal(storage.writes.length, writes);
  assert.equal(first.recordMeadowRace(18, 'meadow').changed, true);
  assert.equal(second.recordMeadowRace(22, 'meadow').changed, false);
  assert.equal(second.recordMeadowRace(16, 'meadow').changed, true);
  assert.equal(first.recordMeadowRace(17, 'meadow').changed, false);
  assert.equal(first.getSnapshot().field.raceBest, 16);
});

test('current region and captured scene region must both be meadow', () => {
  const storage = new Storage();
  const session = createGameSession({ storage, mode: 'demo', today });
  session.simulateTomorrow();
  storage.values.set(
    ADVENTURE_STORAGE_KEYS.demo,
    JSON.stringify({
      ...session.getSnapshot().adventure,
      currentRegion: 'water',
    }),
  );
  const writes = storage.writes.length;
  for (const expectedRegion of ['meadow', 'water'] as const) {
    assert.equal(session.recordWildlife('deer', expectedRegion).changed, false);
    assert.equal(session.recordMeadowRace(18, expectedRegion).changed, false);
  }
  assert.equal(storage.writes.length, writes);
  session.enterRegion('meadow');
  assert.equal(session.recordWildlife('deer', 'water').changed, false);
  assert.equal(session.recordMeadowRace(18, 'water').changed, false);
  assert.equal(session.recordWildlife('deer', 'meadow').changed, true);
  assert.equal(session.recordMeadowRace(18, 'meadow').changed, true);
});

test('failed field saves survive mode switches, recover under separate keys, and preserve stable snapshots', () => {
  const storage = new Storage();
  const session = createGameSession({ storage, today });
  storage.fail = true;
  session.recordWildlife('fox', 'meadow');
  session.recordMeadowRace(18, 'meadow');
  const real = session.getSnapshot().field;
  session.switchMode('demo');
  session.recordWildlife('rabbit', 'meadow');
  session.recordMeadowRace(22, 'meadow');
  const demo = session.getSnapshot().field;
  assert.equal(session.getSnapshot().storageWarning, true);
  assert.strictEqual(session.switchMode('real').field, real);
  assert.strictEqual(session.switchMode('demo').field, demo);
  storage.fail = false;
  const recovered = session.refresh();
  assert.equal(recovered.storageWarning, false);
  assert.deepEqual(JSON.parse(storage.values.get(FIELD_STORAGE_KEYS.real)!), real);
  assert.deepEqual(JSON.parse(storage.values.get(FIELD_STORAGE_KEYS.demo)!), demo);
  const writes = storage.writes.length;
  assert.strictEqual(session.refresh(), recovered);
  assert.equal(storage.writes.length, writes);
});

test('field storage events import active-mode changes and clear resets them', () => {
  const storage = new Storage();
  const session = createGameSession({ storage, today });
  const before = session.getSnapshot();
  storage.values.set(
    FIELD_STORAGE_KEYS.real,
    JSON.stringify({
      ...before.field,
      observed: ['fox'],
      raceBest: 20,
    }),
  );
  assert.strictEqual(session.refreshFromStorage(FIELD_STORAGE_KEYS.demo), before);
  const next = session.refreshFromStorage(FIELD_STORAGE_KEYS.real);
  assert.deepEqual(next.field.observed, ['fox']);
  assert.equal(next.field.raceBest, 20);
  assert.strictEqual(session.refreshFromStorage(FIELD_STORAGE_KEYS.real), next);
  storage.values.delete(FIELD_STORAGE_KEYS.real);
  assert.deepEqual(session.refreshFromStorage(null).field, createFieldProgress('real'));
});

test('new expeditions keep permanent records; demo reset is isolated and cannot reset real progress', () => {
  const storage = new Storage();
  const session = createGameSession({ storage, today });
  session.recordWildlife('bird', 'meadow');
  session.recordMeadowRace(19, 'meadow');
  const real = session.getSnapshot().field;
  assert.equal(session.resetDemo(), false);
  session.newExpedition();
  assert.strictEqual(session.getSnapshot().field, real);
  session.switchMode('demo');
  session.recordWildlife('fox', 'meadow');
  session.recordMeadowRace(12, 'meadow');
  const demo = session.getSnapshot().field;
  session.newExpedition();
  assert.strictEqual(session.getSnapshot().field, demo);
  assert.equal(session.resetDemo(), true);
  assert.deepEqual(session.getSnapshot().field, createFieldProgress('demo'));
  assert.deepEqual(session.switchMode('real').field, real);
});
