import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ADVENTURE_STORAGE_KEYS } from '../src/game/adventure';
import { REGION_PLACES } from '../src/game/landmarks';
import { createGameSession, GAME_STORAGE_KEYS, type GameStorage } from '../src/game/session';
import { createWorldSurvey, SURVEY_STORAGE_KEYS, surveyPosition } from '../src/game/worldSurvey';

class Storage implements GameStorage {
  values = new Map<string, string>();
  reads = 0;
  writes: string[] = [];
  fail = false;
  getItem(key: string) {
    this.reads += 1;
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.fail) throw new Error('Quota');
    this.values.set(key, value);
    this.writes.push(key);
  }
}
const today = () => '2026-09-26';
const farm = REGION_PLACES.meadow.find((place) => place.id === 'farm')!;
const camp = REGION_PLACES.meadow.find((place) => place.id === 'deer-camp')!;

test('survey saves start empty, persist separately and repeated telemetry avoids reads, writes and notifications', () => {
  const storage = new Storage();
  const session = createGameSession({ storage, today });
  assert.ok(GAME_STORAGE_KEYS.includes(SURVEY_STORAGE_KEYS.real));
  assert.ok(GAME_STORAGE_KEYS.includes(SURVEY_STORAGE_KEYS.demo));
  const original = session.getSnapshot();
  assert.deepEqual(original.survey, createWorldSurvey('real'));
  assert.equal(storage.writes.includes(SURVEY_STORAGE_KEYS.real), false);
  let notifications = 0;
  session.subscribe(() => {
    notifications += 1;
  });
  assert.deepEqual(session.recordSurvey(farm, 'meadow', 'real').newPlaces, ['farm']);
  assert.equal(storage.writes.at(-1), SURVEY_STORAGE_KEYS.real);
  const saved = session.getSnapshot();
  assert.strictEqual(saved.adventure, original.adventure);
  assert.strictEqual(saved.progress, original.progress);
  assert.strictEqual(saved.expedition, original.expedition);
  assert.strictEqual(saved.field, original.field);
  const reads = storage.reads,
    writes = storage.writes.length;
  for (let i = 0; i < 100; i += 1)
    assert.equal(session.recordSurvey(farm, 'meadow', 'real').changed, false);
  assert.equal(storage.reads, reads);
  assert.equal(storage.writes.length, writes);
  assert.equal(notifications, 1);
  assert.strictEqual(session.getSnapshot(), saved);
  assert.strictEqual(session.refresh(), saved);
  assert.deepEqual(createGameSession({ storage, today }).getSnapshot(), saved);
});

test('changed attempts refresh before applying, preserving discoveries from other tabs', () => {
  const storage = new Storage();
  const first = createGameSession({ storage, today });
  const second = createGameSession({ storage, today });
  first.recordSurvey(farm, 'meadow', 'real');
  const writes = storage.writes.length;
  assert.equal(second.recordSurvey(farm, 'meadow', 'real').changed, false);
  assert.equal(storage.writes.length, writes);
  second.recordSurvey(camp, 'meadow', 'real');
  first.recordSurvey(REGION_PLACES.meadow[0], 'meadow', 'real');
  assert.deepEqual(first.getSnapshot().survey.regions.meadow.places, [
    'temple',
    'farm',
    'deer-camp',
  ]);
  assert.strictEqual(first.refresh(), first.getSnapshot());
});

test('stale region and mode callbacks cannot chart a different scene after refreshing storage', () => {
  const storage = new Storage();
  const session = createGameSession({ storage, mode: 'demo', today });
  assert.equal(session.recordSurvey(farm, 'water', 'demo').changed, false);
  assert.equal(session.recordSurvey(farm, 'meadow', 'real').changed, false);
  session.simulateTomorrow();
  storage.values.set(
    ADVENTURE_STORAGE_KEYS.demo,
    JSON.stringify({
      ...session.getSnapshot().adventure,
      currentRegion: 'water',
    }),
  );
  assert.equal(session.recordSurvey(farm, 'meadow', 'demo').changed, false);
  assert.equal(session.getSnapshot().adventure.currentRegion, 'water');
  assert.deepEqual(session.getSnapshot().survey, createWorldSurvey('demo'));
  assert.equal(session.recordSurvey(REGION_PLACES.water[1], 'water', 'demo').changed, true);
  session.switchMode('real');
  assert.equal(session.recordSurvey(farm, 'meadow', 'demo').changed, false);
  assert.deepEqual(session.getSnapshot().survey, createWorldSurvey('real'));
});

test('failed survey saves retry on unchanged telemetry and recover across mode switches', () => {
  const storage = new Storage();
  const session = createGameSession({ storage, today });
  storage.fail = true;
  session.recordSurvey(farm, 'meadow', 'real');
  const real = session.getSnapshot().survey;
  session.switchMode('demo');
  session.recordSurvey(camp, 'meadow', 'demo');
  const demo = session.getSnapshot().survey;
  assert.equal(session.getSnapshot().storageWarning, true);
  assert.strictEqual(session.switchMode('real').survey, real);
  storage.fail = false;
  assert.equal(session.recordSurvey(farm, 'meadow', 'real').changed, false);
  assert.equal(session.getSnapshot().storageWarning, false);
  assert.deepEqual(JSON.parse(storage.values.get(SURVEY_STORAGE_KEYS.real)!), real);
  assert.deepEqual(JSON.parse(storage.values.get(SURVEY_STORAGE_KEYS.demo)!), demo);
  assert.strictEqual(session.getSnapshot().survey, real);
});

test('storage events update only the active survey and storage clear removes discoveries', () => {
  const storage = new Storage();
  const session = createGameSession({ storage, today });
  const before = session.getSnapshot();
  const remote = surveyPosition(before.survey, 'meadow', camp).state;
  storage.values.set(SURVEY_STORAGE_KEYS.real, JSON.stringify(remote));
  assert.strictEqual(session.refreshFromStorage(SURVEY_STORAGE_KEYS.demo), before);
  assert.deepEqual(session.refreshFromStorage(SURVEY_STORAGE_KEYS.real).survey, remote);
  storage.values.delete(SURVEY_STORAGE_KEYS.real);
  assert.deepEqual(session.refreshFromStorage(null).survey, createWorldSurvey('real'));
});

test('new expeditions preserve surveys while demo reset affects only demonstration progress', () => {
  const storage = new Storage();
  const session = createGameSession({ storage, today });
  session.recordSurvey(farm, 'meadow', 'real');
  const real = session.getSnapshot().survey;
  session.newExpedition();
  assert.strictEqual(session.getSnapshot().survey, real);
  assert.equal(session.resetDemo(), false);
  session.switchMode('demo');
  session.recordSurvey(camp, 'meadow', 'demo');
  const demo = session.getSnapshot().survey;
  session.newExpedition();
  assert.strictEqual(session.getSnapshot().survey, demo);
  assert.equal(session.resetDemo(), true);
  assert.deepEqual(session.getSnapshot().survey, createWorldSurvey('demo'));
  assert.deepEqual(session.switchMode('real').survey, real);
});
