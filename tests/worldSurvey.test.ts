import assert from 'node:assert/strict';
import { test } from 'node:test';
import { REGION_IDS, type RegionId } from '../src/game/adventure';
import { REGION_PLACES } from '../src/game/landmarks';
import { getWorldBounds } from '../src/game/worldLayout';
import {
  createWorldSurvey,
  getRegionSurvey,
  getWorldSurvey,
  sanitizeWorldSurvey,
  surveyPosition,
} from '../src/game/worldSurvey';

test('old and malformed saves begin uncharted, with a stable world denominator including locked regions', () => {
  const initial = createWorldSurvey('real');
  for (const invalid of [null, 8, [], { version: 2, mode: 'real' }, createWorldSurvey('demo')])
    assert.deepEqual(sanitizeWorldSurvey(invalid, 'real'), initial);
  assert.deepEqual(getWorldSurvey(initial), { found: 0, total: 27, percent: 0 });
  for (const id of REGION_IDS) {
    assert.deepEqual(initial.regions[id], { places: [], cells: [] });
    assert.equal(getRegionSurvey(id, initial).total, REGION_PLACES[id].length);
  }
  assert.notStrictEqual(initial.regions.meadow.cells, initial.regions.water.cells);
});

test('sanitization removes duplicates, unknown landmarks, out-of-range cells and mixed field types', () => {
  const state = sanitizeWorldSurvey(
    {
      version: 1,
      mode: 'demo',
      regions: {
        meadow: {
          places: ['farm', 'farm', 'temple', 'missing', 7],
          cells: [143, 0, 0, -1, 144, 1.5, '1', null, Infinity],
        },
        water: { places: null, cells: { 0: 8 } },
        fairy: null,
        imaginary: { places: ['temple'], cells: [1] },
      },
    },
    'demo',
  );
  assert.deepEqual(state.regions.meadow, { places: ['temple', 'farm'], cells: [0, 143] });
  assert.deepEqual(state.regions.water, { places: [], cells: [] });
  assert.deepEqual(state.regions.fairy, { places: [], cells: [] });
  assert.deepEqual(sanitizeWorldSurvey(state, 'demo'), state);
});

test('only actual nearby landmarks are discovered; fog alone never counts as a landmark', () => {
  const initial = createWorldSurvey('real');
  const spawn = surveyPosition(initial, 'meadow', { x: 0, z: 24 });
  assert.equal(spawn.changed, true);
  assert.equal(spawn.state.regions.meadow.cells.length, 9);
  assert.deepEqual(spawn.newPlaces, []);
  assert.equal(getRegionSurvey('meadow', spawn.state).percent, 0);
  const farm = REGION_PLACES.meadow.find((place) => place.id === 'farm')!;
  const result = surveyPosition(spawn.state, 'meadow', { x: farm.x + 10, z: farm.z });
  assert.deepEqual(result.newPlaces, ['farm']);
  assert.deepEqual(getRegionSurvey('meadow', result.state), { found: 1, total: 7, percent: 14 });
  assert.deepEqual(getWorldSurvey(result.state), { found: 1, total: 27, percent: 4 });
  assert.strictEqual(result.state.regions.water, initial.regions.water);
  const repeat = surveyPosition(result.state, 'meadow', { x: farm.x + 10, z: farm.z });
  assert.equal(repeat.changed, false);
  assert.strictEqual(repeat.state, result.state);
  assert.deepEqual(repeat.newPlaces, []);
  assert.deepEqual(initial.regions.meadow.cells, []);
});

test('non-finite and out-of-world positions leave state untouched in every region', () => {
  const state = createWorldSurvey('real');
  for (const region of REGION_IDS) {
    const { minX, maxX, minZ, maxZ } = getWorldBounds(region);
    for (const position of [
      { x: NaN, z: 0 },
      { x: 0, z: Infinity },
      { x: minX - 0.01, z: 0 },
      { x: maxX + 0.01, z: 0 },
      { x: 0, z: minZ - 0.01 },
      { x: 0, z: maxZ + 0.01 },
    ])
      assert.strictEqual(surveyPosition(state, region, position).state, state);
  }
  assert.strictEqual(surveyPosition(state, 'unknown' as RegionId, { x: 0, z: 0 }).state, state);
});

test('corner samples clamp fog cells and teleporting does not reveal intervening ground', () => {
  const initial = createWorldSurvey('real');
  const first = surveyPosition(initial, 'meadow', { x: -108, z: -108 }).state;
  assert.deepEqual(first.regions.meadow.cells, [0, 1, 12, 13]);
  const second = surveyPosition(first, 'meadow', { x: 108, z: 108 }).state;
  assert.deepEqual(second.regions.meadow.cells, [0, 1, 12, 13, 130, 131, 142, 143]);
  assert.equal(getWorldSurvey(second).found, 0);
  const compact = surveyPosition(initial, 'water', { x: 72, z: 72 }).state;
  assert.deepEqual(compact.regions.water.cells, [130, 131, 142, 143]);
});

test('visiting all landmarks reaches 100 percent and stays stable after sanitation', () => {
  let state = createWorldSurvey('demo');
  for (const region of REGION_IDS)
    for (const place of [...REGION_PLACES[region]].reverse())
      state = surveyPosition(state, region, place).state;
  assert.deepEqual(getWorldSurvey(state), { found: 27, total: 27, percent: 100 });
  for (const region of REGION_IDS) assert.equal(getRegionSurvey(region, state).percent, 100);
  assert.deepEqual(sanitizeWorldSurvey(state, 'demo'), state);
});
