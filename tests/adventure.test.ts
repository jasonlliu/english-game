import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createInitialProgress, getTodayKey } from '../src/game/progress';
import {
  ADVENTURE_STORAGE_KEYS, PETS, REGION_IDS, REGIONS, advanceDemoDay, capturePet,
  changeRegion, collectSeal, createAdventure, getUnlockedRegions, isCaptureHit,
  loadAdventure, resetRegionSeals, saveAdventure, selectCompanion, visitAdventure,
  type Adventure,
} from '../src/game/adventure';

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

function installStorage() {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  return values;
}

afterEach(() => {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});

function collectAll(state: Adventure): Adventure {
  for (const id of [0, 1, 2] as const) state = collectSeal(state, id).state;
  return state;
}

test('a new adventure owns the original companion and has one accessible region', () => {
  const state = createAdventure('real');
  assert.deepEqual(state.capturedPets, ['ember']);
  assert.equal(state.activePet, 'ember');
  assert.equal(state.currentRegion, 'meadow');
  assert.deepEqual(state.visitedDates, []);
  assert.deepEqual(getUnlockedRegions(state), ['meadow']);
  assert.deepEqual(REGION_IDS.map(id => REGIONS[id].day), [1, 2, 3, 4, 5, 6]);
  assert.equal(new Set(REGION_IDS.map(id => REGIONS[id].petId)).size, 6);
  for (const id of REGION_IDS) assert.equal(PETS[REGIONS[id].petId].region, id);
});

test('visiting counts each distinct local day once without awarding learning XP', () => {
  const progress = createInitialProgress('real');
  const initial = createAdventure('real', progress);
  const first = visitAdventure(initial, progress, '2026-09-26');
  assert.deepEqual(first.visitedDates, ['2026-09-26']);
  assert.deepEqual(visitAdventure(first, progress, '2026-09-26'), first);
  const second = visitAdventure(first, progress, '2026-09-28');
  assert.deepEqual(getUnlockedRegions(second), ['meadow', 'water']);
  assert.deepEqual(visitAdventure(second, progress, '2026-09-26'), second);
  assert.equal(progress.xp, 0);
  assert.deepEqual(progress.completedDates, []);
  assert.deepEqual(initial.visitedDates, []);
});

test('six visits unlock all regions, gaps do not reset progress and invalid dates do not count', () => {
  let state = createAdventure('real');
  for (const date of ['2026-01-01', '2026-01-04', '2026-02-12', '2026-04-02', '2026-05-03', '2026-09-26', '2026-10-04']) {
    state = visitAdventure(state, undefined, date);
  }
  assert.deepEqual(getUnlockedRegions(state), REGION_IDS);
  assert.equal(state.visitedDates.length, 7);
  for (const badDate of ['', 'tomorrow', '2026-02-30', '2026-13-01']) {
    assert.deepEqual(visitAdventure(state, undefined, badDate), state);
  }
});

test('existing check-in dates migrate once, only within the matching real or demo mode', () => {
  const progress = { ...createInitialProgress('real'), completedDates: ['2025-04-03', '2025-04-03', '2025-04-06', 'invalid'] };
  const state = createAdventure('real', progress);
  assert.deepEqual(state.visitedDates, ['2025-04-03', '2025-04-06']);
  assert.deepEqual(getUnlockedRegions(state), ['meadow', 'water']);
  const visited = visitAdventure(state, progress, '2025-04-06');
  assert.deepEqual(visited, state);
  assert.deepEqual(createAdventure('demo', progress).visitedDates, []);
  assert.deepEqual(progress.completedDates, ['2025-04-03', '2025-04-03', '2025-04-06', 'invalid']);
});

test('demo advance unlocks exactly the next day up to six and cannot advance real mode', () => {
  const real = visitAdventure(createAdventure('real'), undefined, '2026-09-26');
  assert.deepEqual(advanceDemoDay(real), real);
  let demo = createAdventure('demo');
  for (let day = 2; day <= 6; day++) {
    demo = advanceDemoDay(demo);
    assert.equal(getUnlockedRegions(demo).length, day);
  }
  assert.deepEqual(advanceDemoDay(demo), demo);
  assert.deepEqual(demo.visitedDates, []);
  const migrated = createAdventure('demo', {
    ...createInitialProgress('demo'), completedDates: ['2025-03-01', '2025-03-02', '2025-03-03'],
  });
  assert.equal(getUnlockedRegions(advanceDemoDay(migrated)).length, 4);
});

test('locked regions and their pets cannot be entered, collected or selected', () => {
  const initial = createAdventure('real');
  assert.deepEqual(changeRegion(initial, 'water'), initial);
  assert.deepEqual(selectCompanion(initial, 'ripple'), initial);
  for (const id of REGION_IDS.slice(1)) {
    assert.equal(capturePet(collectAll(initial), REGIONS[id].petId).captured, false);
  }
  assert.deepEqual(initial.seals.meadow, []);
  assert.deepEqual(initial.seals.water, []);
});

test('capturing needs three distinct local seals and the matching current-region pet', () => {
  let state = changeRegion(advanceDemoDay(createAdventure('demo')), 'water');
  assert.equal(capturePet(state, 'ripple').captured, false);
  state = collectSeal(state, 0).state;
  assert.equal(collectSeal(state, 0).collected, false);
  assert.equal(collectSeal(state, 9 as 0).collected, false);
  state = collectSeal(state, 1).state;
  assert.equal(capturePet(state, 'ripple').captured, false);
  state = collectSeal(state, 2).state;
  assert.equal(capturePet(state, 'cinder').captured, false);
  const captured = capturePet(state, 'ripple');
  assert.equal(captured.captured, true);
  assert.deepEqual(captured.state.capturedPets, ['ember', 'ripple']);
  assert.equal(captured.state.activePet, 'ember');
  assert.deepEqual(state.capturedPets, ['ember']);
  assert.equal(capturePet(captured.state, 'ripple').captured, false);
  assert.deepEqual(capturePet(captured.state, 'ripple').state.capturedPets, ['ember', 'ripple']);
});

test('owned pets can follow or rest, and clearing region seals preserves captures and other regions', () => {
  let state = collectAll(createAdventure('demo'));
  state = changeRegion(advanceDemoDay(state), 'water');
  state = capturePet(collectAll(state), 'ripple').state;
  state = selectCompanion(state, 'ripple');
  assert.equal(state.activePet, 'ripple');
  assert.equal(selectCompanion(state, 'lumi').activePet, 'ripple');
  assert.equal(selectCompanion(state, null).activePet, null);
  const reset = resetRegionSeals(state);
  assert.deepEqual(reset.seals.water, []);
  assert.deepEqual(reset.seals.meadow, [0, 1, 2]);
  assert.deepEqual(state.seals.water, [0, 1, 2]);
  assert.equal(reset.activePet, 'ripple');
  assert.deepEqual(reset.capturedPets, ['ember', 'ripple']);
  installStorage();
  assert.equal(saveAdventure('demo', reset), true);
  assert.equal(loadAdventure('demo').capturedPets.includes('ripple'), true);
});

test('region switching and reloading keep each seal collection independent', () => {
  installStorage();
  let state = advanceDemoDay(advanceDemoDay(createAdventure('demo')));
  state = changeRegion(state, 'water');
  state = collectSeal(state, 0).state;
  state = collectSeal(state, 2).state;
  state = changeRegion(state, 'fire');
  assert.deepEqual(state.seals.fire, []);
  assert.equal(capturePet(state, 'cinder').captured, false);
  state = capturePet(collectAll(state), 'cinder').state;
  assert.deepEqual(state.seals.water, [0, 2]);
  assert.equal(saveAdventure('demo', state), true);
  state = changeRegion(loadAdventure('demo'), 'water');
  assert.deepEqual(state.seals.water, [0, 2]);
  assert.deepEqual(state.seals.fire, [0, 1, 2]);
  assert.equal(capturePet(state, 'ripple').captured, false);
  state = capturePet(collectSeal(state, 1).state, 'ripple').state;
  assert.deepEqual(state.capturedPets, ['ember', 'cinder', 'ripple']);
});

test('opening records today durably; real and demo adventure saves remain separate', () => {
  const storage = installStorage();
  const real = loadAdventure('real', createInitialProgress('real'));
  assert.deepEqual(real.visitedDates, [getTodayKey()]);
  assert.deepEqual(JSON.parse(storage.get(ADVENTURE_STORAGE_KEYS.real)!).visitedDates, [getTodayKey()]);
  assert.deepEqual(loadAdventure('real'), real);
  let demo = loadAdventure('demo');
  for (let i = 0; i < 5; i++) demo = advanceDemoDay(demo);
  assert.equal(saveAdventure('demo', demo), true);
  assert.equal(saveAdventure('real', demo), false);
  assert.equal(getUnlockedRegions(loadAdventure('demo')).length, 6);
  assert.deepEqual(loadAdventure('real'), real);
});

test('malformed saves cannot grant locked regions or unknown pets and repairs seal duplicates', () => {
  const storage = installStorage();
  storage.set(ADVENTURE_STORAGE_KEYS.real, JSON.stringify({
    version: 1, mode: 'real', visitedDates: [getTodayKey(), getTodayKey(), '2026-02-31', 4], demoDays: 999,
    currentRegion: 'fairy', capturedPets: ['ember', 'ember', 'lumi', '__proto__', 'unicorn'], activePet: 'lumi',
    seals: { meadow: [0, 0, 1, 7, '2', null], fairy: [0, 1, 2] },
  }));
  const repaired = loadAdventure('real');
  assert.equal(repaired.demoDays, 0);
  assert.equal(repaired.currentRegion, 'meadow');
  assert.deepEqual(repaired.capturedPets, ['ember']);
  assert.equal(repaired.activePet, 'ember');
  assert.deepEqual(repaired.seals.meadow, [0, 1]);
  assert.deepEqual(repaired.seals.fairy, []);
  assert.deepEqual(getUnlockedRegions(repaired), ['meadow']);
  for (const raw of ['bad json', 'null', '[]', '{"version":9}', JSON.stringify(createAdventure('demo'))]) {
    storage.set(ADVENTURE_STORAGE_KEYS.real, raw);
    const recovered = loadAdventure('real');
    assert.deepEqual(recovered.capturedPets, ['ember']);
    assert.deepEqual(recovered.visitedDates, [getTodayKey()]);
    assert.equal(recovered.mode, 'real');
  }
});

test('blocked storage still supports an in-memory adventure without throwing', () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('blocked'); } });
  const state = loadAdventure('demo');
  assert.deepEqual(state.visitedDates, [getTodayKey()]);
  assert.equal(saveAdventure('demo', state), false);
  assert.equal(getUnlockedRegions(advanceDemoDay(state)).length, 2);
});

test('capture timing uses three inclusive windows and rejects invalid phases or attempts', () => {
  for (const [attempt, center, width] of [[0, .3, .14], [1, .65, .12], [2, .45, .10]]) {
    assert.equal(isCaptureHit(center, attempt), true);
    assert.equal(isCaptureHit(center - width, attempt), true);
    assert.equal(isCaptureHit(center + width, attempt), true);
    assert.equal(isCaptureHit(center - width - .001, attempt), false);
    assert.equal(isCaptureHit(center + width + .001, attempt), false);
  }
  for (const phase of [-.01, 1.01, NaN, Infinity]) assert.equal(isCaptureHit(phase, 0), false);
  for (const attempt of [-1, 3, 1.5, NaN]) assert.equal(isCaptureHit(.3, attempt), false);
});
