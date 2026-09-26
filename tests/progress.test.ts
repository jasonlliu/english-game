import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  completeMission,
  createInitialProgress,
  getNextEvolutionXp,
  getPetLevel,
  getPetStage,
  getTodayKey,
  loadProgress,
  saveProgress,
  STORAGE_KEYS,
  collectCrystal,
  createExploration,
  EXPLORATION_STORAGE_KEYS,
  loadExploration,
  openTreasure,
  resetExpedition,
  saveExploration,
} from '../src/game/index';

const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

function installStorage() {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    },
  });
  return values;
}

afterEach(() => {
  if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});

test('a first mission hatches the pet without mutating its previous state', () => {
  const initial = createInitialProgress();
  const result = completeMission(initial, 'mission-1', '2026-09-26');
  assert.equal(result.rewarded, true);
  assert.equal(result.progress.xp, 40);
  assert.equal(getPetStage(result.progress), 1);
  assert.equal(getPetLevel(result.progress), 1);
  assert.equal(getNextEvolutionXp(result.progress), 120);
  assert.equal(initial.xp, 0);
  assert.deepEqual(initial.completedMissionIds, []);
});

test('the same mission can never award twice, even on another day', () => {
  const first = completeMission(createInitialProgress(), 'mission-1', '2026-09-26').progress;
  const repeat = completeMission(first, 'mission-1', '2026-09-27');
  assert.equal(repeat.rewarded, false);
  assert.equal(repeat.reason, 'already-claimed');
  assert.equal(repeat.progress.xp, 40);
});

test('real mode allows one reward per local day and a new reward the next day', () => {
  const first = completeMission(createInitialProgress(), 'mission-1', '2026-09-26').progress;
  const sameDay = completeMission(first, 'mission-2', '2026-09-26');
  assert.equal(sameDay.rewarded, false);
  assert.equal(sameDay.reason, 'already-completed-today');
  const nextDay = completeMission(sameDay.progress, 'mission-2', '2026-09-27');
  assert.equal(nextDay.rewarded, true);
  assert.equal(nextDay.progress.xp, 80);
  assert.equal(nextDay.progress.totalMissions, 2);
});

test('demo supports six unique same-day missions and both evolutions', () => {
  let progress = createInitialProgress('demo');
  assert.equal(getPetStage(progress), 0);
  assert.equal(getPetLevel(progress), 0);
  assert.equal(getNextEvolutionXp(progress), 40);
  for (let i = 1; i <= 6; i += 1) {
    const result = completeMission(progress, `demo-${i}`, '2026-09-26');
    assert.equal(result.rewarded, true);
    progress = result.progress;
    assert.equal(getPetStage(progress), i < 3 ? 1 : i < 6 ? 2 : 3);
    assert.equal(getPetLevel(progress), i);
    if (i === 3) assert.equal(getNextEvolutionXp(progress), 240);
  }
  assert.equal(progress.xp, 240);
  assert.equal(getNextEvolutionXp(progress), null);
  assert.deepEqual(progress.completedDates, ['2026-09-26']);
  assert.equal(completeMission(progress, 'demo-6', '2026-09-26').rewarded, false);
});

test('real and demo saves are separate, durable and cannot be cross-written', () => {
  installStorage();
  const real = completeMission(createInitialProgress('real'), 'real-1', '2026-09-26').progress;
  let demo = createInitialProgress('demo');
  for (let i = 0; i < 3; i += 1) demo = completeMission(demo, `demo-${i}`, '2026-09-26').progress;
  assert.equal(saveProgress('real', real), true);
  assert.equal(saveProgress('demo', demo), true);
  assert.equal(saveProgress('real', demo), false);
  assert.deepEqual(loadProgress('real'), real);
  assert.deepEqual(loadProgress('demo'), demo);
  assert.equal(completeMission(loadProgress('real'), 'real-2', '2026-09-26').rewarded, false);
});

test('invalid JSON, unknown versions and stored mode mismatches recover safely', () => {
  const values = installStorage();
  for (const raw of [
    '{oops',
    'null',
    '[]',
    '{"version":9}',
    JSON.stringify(createInitialProgress('demo')),
  ]) {
    values.set(STORAGE_KEYS.real, raw);
    assert.deepEqual(loadProgress('real'), createInitialProgress('real'));
  }
});

test('XP and counts are repaired from unique valid reward receipts', () => {
  const values = installStorage();
  values.set(
    STORAGE_KEYS.real,
    JSON.stringify({
      version: 1,
      mode: 'real',
      xp: 90000000,
      totalMissions: -123,
      completedMissionIds: ['a', 'a', '', null, 'b', 'c'],
      completedDates: ['2026-09-26', '2026-09-26', '2026-09-27', '2026-02-31', 'nope'],
    }),
  );
  const repaired = loadProgress('real');
  assert.equal(repaired.xp, 80);
  assert.equal(repaired.totalMissions, 2);
  assert.deepEqual(repaired.completedMissionIds, ['a', 'b']);
  assert.deepEqual(repaired.completedDates, ['2026-09-26', '2026-09-27']);
});

test('blocked storage and an SSR environment do not throw', () => {
  Reflect.deleteProperty(globalThis, 'localStorage');
  assert.deepEqual(loadProgress('real'), createInitialProgress('real'));
  assert.equal(saveProgress('real', createInitialProgress('real')), false);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get: () => {
      throw new Error('Storage blocked');
    },
  });
  assert.deepEqual(loadProgress('demo'), createInitialProgress('demo'));
  assert.equal(saveProgress('demo', createInitialProgress('demo')), false);
});

test('empty missions and invalid dates cannot generate rewards', () => {
  for (const [id, day] of [
    ['', '2026-09-26'],
    ['   ', '2026-09-26'],
    ['valid', '2026-02-31'],
  ]) {
    const result = completeMission(createInitialProgress(), id, day);
    assert.equal(result.rewarded, false);
    assert.equal(result.progress.xp, 0);
  }
});

test('today uses local year, month and day', () => {
  const date = new Date();
  assert.equal(
    getTodayKey(),
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
  );
});

test('exploration requires three distinct crystals before opening a treasure', () => {
  const initial = createExploration('real');
  assert.equal(openTreasure(initial).opened, false);
  const first = collectCrystal(initial, 0);
  assert.equal(first.collected, true);
  assert.deepEqual(initial.crystals, []);
  assert.equal(collectCrystal(first.state, 0).collected, false);
  let state = collectCrystal(first.state, 1).state;
  assert.equal(openTreasure(state).opened, false);
  state = collectCrystal(state, 2).state;
  const result = openTreasure(state);
  assert.equal(result.opened, true);
  assert.equal(result.state.stars, 3);
  assert.equal(result.state.totalTreasures, 1);
  assert.equal(result.state.treasureOpened, true);
  const repeat = openTreasure(result.state);
  assert.equal(repeat.opened, false);
  assert.equal(repeat.state.stars, 3);
  assert.equal(collectCrystal(result.state, 0).collected, false);
});

test('replaying an expedition retains stars and treasures without changing check-in XP', () => {
  const progress = createInitialProgress();
  let state = createExploration('real');
  for (let expedition = 1; expedition <= 2; expedition += 1) {
    for (const id of [0, 1, 2] as const) state = collectCrystal(state, id).state;
    state = openTreasure(state).state;
    assert.equal(state.totalTreasures, expedition);
    assert.equal(state.stars, expedition * 3);
    state = resetExpedition(state);
    assert.deepEqual(state.crystals, []);
    assert.equal(state.treasureOpened, false);
    assert.equal(state.totalTreasures, expedition);
    assert.equal(state.stars, expedition * 3);
  }
  assert.equal(progress.xp, 0);
});

test('exploration persists independently for real and demo modes', () => {
  installStorage();
  const real = collectCrystal(createExploration('real'), 0).state;
  let demo = createExploration('demo');
  for (const id of [0, 1, 2] as const) demo = collectCrystal(demo, id).state;
  demo = openTreasure(demo).state;
  assert.equal(saveExploration('real', real), true);
  assert.equal(saveExploration('demo', demo), true);
  assert.equal(saveExploration('real', demo), false);
  assert.deepEqual(loadExploration('real'), real);
  assert.deepEqual(loadExploration('demo'), demo);
  assert.equal(openTreasure(loadExploration('demo')).opened, false);
  assert.deepEqual(loadProgress('real'), createInitialProgress('real'));
});

test('invalid exploration saves recover and malformed crystals cannot unlock a treasure', () => {
  const values = installStorage();
  values.set(EXPLORATION_STORAGE_KEYS.real, 'broken JSON');
  assert.deepEqual(loadExploration('real'), createExploration('real'));
  values.set(
    EXPLORATION_STORAGE_KEYS.real,
    JSON.stringify({
      version: 1,
      mode: 'real',
      crystals: [0, 0, 0, 3, '1'],
      totalTreasures: -4,
      stars: 999,
      treasureOpened: true,
    }),
  );
  const recovered = loadExploration('real');
  assert.deepEqual(recovered.crystals, [0]);
  assert.equal(recovered.stars, 0);
  assert.equal(recovered.totalTreasures, 0);
  assert.equal(recovered.treasureOpened, false);
  assert.equal(openTreasure(recovered).opened, false);
  values.set(EXPLORATION_STORAGE_KEYS.real, JSON.stringify(createExploration('demo')));
  assert.deepEqual(loadExploration('real'), createExploration('real'));
});
