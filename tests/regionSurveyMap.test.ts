import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import RegionSurveyMap, {
  type RegionSurveyMapProps,
} from '../src/features/dialogs/RegionSurveyMap';
import { REGION_PLACES } from '../src/game/landmarks';
import { createWorldSurvey, surveyPosition, SURVEY_GRID_SIZE } from '../src/game/worldSurvey';

function renderMap(overrides: Partial<RegionSurveyMapProps> = {}) {
  return renderToStaticMarkup(
    createElement(RegionSurveyMap, {
      regionId: 'meadow',
      survey: createWorldSurvey('real'),
      selectedPlace: null,
      onSelectPlace() {},
      ...overrides,
    }),
  );
}

test('unvisited landmarks remain selectable rumors without revealing names or a false player position', () => {
  const html = renderMap();
  assert.equal((html.match(/role="button"/g) ?? []).length, REGION_PLACES.meadow.length);
  assert.equal((html.match(/tabindex="0"/g) ?? []).length, REGION_PLACES.meadow.length);
  assert.equal((html.match(/data-unexplored-cell=/g) ?? []).length, SURVEY_GRID_SIZE ** 2);
  assert.ok(html.includes('待探索地点 1'));
  assert.ok(!html.includes('aria-label="你的位置"'));
  for (const place of REGION_PLACES.meadow) assert.ok(!html.includes(place.name));
});

test('survey reveals exactly the saved map cells and names only visited landmarks', () => {
  const village = REGION_PLACES.meadow.find((place) => place.id === 'village')!;
  const survey = surveyPosition(createWorldSurvey('real'), 'meadow', village).state;
  const html = renderMap({ survey, selectedPlace: 'village' });
  assert.ok(html.includes('aria-label="风车谷村" aria-pressed="true"'));
  assert.ok(!html.includes('鹿溪营地'));
  assert.equal(
    (html.match(/data-unexplored-cell=/g) ?? []).length,
    SURVEY_GRID_SIZE ** 2 - survey.regions.meadow.cells.length,
  );
  for (const cell of survey.regions.meadow.cells)
    assert.ok(!html.includes(`data-unexplored-cell="${cell}"`));
  const remote = renderMap({ regionId: 'water', survey });
  assert.equal((remote.match(/data-unexplored-cell=/g) ?? []).length, SURVEY_GRID_SIZE ** 2);
  assert.ok(!remote.includes('aria-label="你的位置"'));
});

test('live map position respects the real bounds and heading instead of inventing a marker', () => {
  const html = renderMap({ position: { x: 0, z: 0, heading: -Math.PI / 2 } });
  assert.ok(html.includes('class="survey-player" transform="translate(240 240)" role="img"'));
  assert.ok(html.includes('transform="rotate(90)"'));
  for (const position of [
    { x: 109, z: 0, heading: 0 },
    { x: 0, z: NaN, heading: 0 },
    { x: 0, z: 0, heading: Infinity },
  ])
    assert.ok(!renderMap({ position }).includes('aria-label="你的位置"'));
});

test('multiple map instances own distinct SVG definitions and accessible descriptions', () => {
  const props: RegionSurveyMapProps = {
    regionId: 'meadow',
    survey: createWorldSurvey('real'),
    selectedPlace: null,
    onSelectPlace() {},
  };
  const html = renderToStaticMarkup(
    createElement(
      'div',
      null,
      createElement(RegionSurveyMap, props),
      createElement(RegionSurveyMap, props),
    ),
  );
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const description of html.matchAll(/aria-describedby="([^"]+)"/g))
    assert.ok(ids.includes(description[1]));
});
