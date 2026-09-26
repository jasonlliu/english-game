import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { REGION_IDS, type RegionId } from '../src/game/adventure';
import {
  TEMPLE_STORAGE_KEYS,
  TEMPLE_THEMES,
  activateTempleSeal,
  completeTemple,
  createTempleProgress,
  loadTempleProgress,
  saveTempleProgress,
} from '../src/game/temple';

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

test('each temple has a different valid lamp order and a clue that spells out that order', () => {
  assert.equal(new Set(REGION_IDS.map((region) => TEMPLE_THEMES[region].order.join(','))).size, 6);
  assert.equal(new Set(REGION_IDS.map((region) => TEMPLE_THEMES[region].artifact)).size, 6);
  for (const region of REGION_IDS) {
    const theme = TEMPLE_THEMES[region];
    assert.deepEqual([...theme.order].sort(), [0, 1, 2]);
    assert.equal(new Set(theme.sealNames).size, 3);
    const namedOrder = theme.order.map((id) => theme.sealNames[id]);
    let previous = -1;
    for (const name of namedOrder) {
      const position = theme.clue.indexOf(name);
      assert.ok(
        position > previous,
        `The clue for ${region} must name the lamps in their required order`,
      );
      previous = position;
    }
    assert.ok(theme.name && theme.subtitle && theme.story && theme.color);
  }
});

test('all six puzzles solve only after their third correctly ordered lamp', () => {
  for (const region of REGION_IDS) {
    const order = TEMPLE_THEMES[region].order;
    let sequence: number[] = [];
    order.forEach((id, index) => {
      const before = [...sequence];
      const result = activateTempleSeal(sequence, id, order);
      assert.equal(result.correct, true);
      assert.equal(result.solved, index === 2);
      assert.deepEqual(result.sequence, order.slice(0, index + 1));
      assert.deepEqual(sequence, before, 'Lighting a lamp must not mutate the caller state');
      sequence = result.sequence;
    });
  }
});

test('pressing an already lit lamp keeps progress and cannot count the same lamp twice', () => {
  const order = TEMPLE_THEMES.steel.order;
  const one = activateTempleSeal([], order[0], order).sequence;
  const repeat = activateTempleSeal(one, order[0], order);
  assert.deepEqual(repeat, { sequence: one, correct: true, solved: false });
  const two = activateTempleSeal(one, order[1], order).sequence;
  assert.deepEqual(activateTempleSeal(two, order[0], order), {
    sequence: two,
    correct: true,
    solved: false,
  });
});

test('a wrong new lamp resets the lights and unlimited retries can still solve the puzzle', () => {
  const order = TEMPLE_THEMES.water.order;
  for (let attempt = 0; attempt < 10; attempt++) {
    const first = activateTempleSeal([], order[0], order).sequence;
    assert.deepEqual(activateTempleSeal(first, order[2], order), {
      sequence: [],
      correct: false,
      solved: false,
    });
  }
  let sequence: number[] = [];
  for (const id of order) sequence = activateTempleSeal(sequence, id, order).sequence;
  assert.deepEqual(sequence, order);
});

test('a solved puzzle remains solved and unchanged after further presses', () => {
  for (const region of REGION_IDS) {
    const order = TEMPLE_THEMES[region].order;
    for (const id of [0, 1, 2, 9, NaN]) {
      assert.deepEqual(activateTempleSeal([...order], id, order), {
        sequence: order,
        correct: true,
        solved: true,
      });
    }
  }
});

test('invalid IDs, damaged sequences and invalid orders cannot create a solved puzzle', () => {
  const order = TEMPLE_THEMES.meadow.order;
  for (const id of [-1, 3, 0.5, NaN, Infinity]) {
    assert.deepEqual(activateTempleSeal([0], id, order), {
      sequence: [0],
      correct: false,
      solved: false,
    });
  }
  for (const sequence of [[0, 0, 0], [0, 2, 1], [0, 1, 2, 2], [NaN], new Array<number>(3)]) {
    const result = activateTempleSeal(sequence, 0, order);
    assert.equal(result.solved, false);
    assert.deepEqual(result.sequence, [0]);
  }
  for (const badOrder of [
    [],
    [0],
    [0, 0, 1],
    [0, 1, 3],
    [0, 1, NaN],
    [0, 1, 2, 3],
    new Array<number>(3),
  ]) {
    assert.deepEqual(activateTempleSeal([0, 1], 2, badOrder), {
      sequence: [],
      correct: false,
      solved: false,
    });
  }
});

test('regional artifacts are granted once without mutating previous progress', () => {
  const initial = createTempleProgress('real');
  let state = initial;
  for (const region of REGION_IDS) {
    const result = completeTemple(state, region);
    assert.equal(result.completed, true);
    assert.equal(result.state.completed.length, state.completed.length + 1);
    state = result.state;
    assert.deepEqual(completeTemple(state, region), { state, completed: false });
  }
  assert.deepEqual(state.completed, REGION_IDS);
  assert.deepEqual(initial.completed, []);
  assert.deepEqual(completeTemple(state, 'unknown' as RegionId), { state, completed: false });
});

test('real and demo temple collections persist separately and cannot cross-write', () => {
  const values = installStorage();
  values.set('rune-island.progress.real.v1', 'existing-learning-progress');
  values.set('rune-island.adventure.real.v1', 'existing-companions');
  const real = completeTemple(createTempleProgress('real'), 'water').state;
  let demo = completeTemple(createTempleProgress('demo'), 'fire').state;
  demo = completeTemple(demo, 'fairy').state;
  assert.equal(saveTempleProgress('real', real), true);
  assert.equal(saveTempleProgress('demo', demo), true);
  assert.equal(saveTempleProgress('real', demo), false);
  assert.deepEqual(loadTempleProgress('real'), real);
  assert.deepEqual(loadTempleProgress('demo'), demo);
  assert.equal(completeTemple(loadTempleProgress('real'), 'water').completed, false);
  assert.equal(values.get('rune-island.progress.real.v1'), 'existing-learning-progress');
  assert.equal(values.get('rune-island.adventure.real.v1'), 'existing-companions');
});

test('corrupt saves recover and invalid or duplicated completion IDs are discarded', () => {
  const values = installStorage();
  for (const raw of [
    'broken JSON',
    'null',
    '[]',
    '{"version":9}',
    JSON.stringify(createTempleProgress('demo')),
  ]) {
    values.set(TEMPLE_STORAGE_KEYS.real, raw);
    assert.deepEqual(loadTempleProgress('real'), createTempleProgress('real'));
  }
  values.set(
    TEMPLE_STORAGE_KEYS.real,
    JSON.stringify({
      version: 1,
      mode: 'real',
      completed: ['meadow', 'meadow', 'steel', 'unknown', 2, null, '__proto__'],
    }),
  );
  assert.deepEqual(loadTempleProgress('real').completed, ['meadow', 'steel']);
});

test('missing or blocked browser storage does not break a temple session', () => {
  Reflect.deleteProperty(globalThis, 'localStorage');
  assert.deepEqual(loadTempleProgress('real'), createTempleProgress('real'));
  assert.equal(saveTempleProgress('real', createTempleProgress('real')), false);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get: () => {
      throw new Error('blocked');
    },
  });
  const state = completeTemple(loadTempleProgress('demo'), 'earth').state;
  assert.deepEqual(state.completed, ['earth']);
  assert.equal(saveTempleProgress('demo', state), false);
});
