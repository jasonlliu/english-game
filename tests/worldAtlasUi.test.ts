import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TravelAtlas from '../src/features/dialogs/TravelAtlas';
import WorldAtlasChart from '../src/features/dialogs/WorldAtlasChart';
import type { DialogProps } from '../src/features/dialogs/types';
import { createAdventure, REGION_IDS, REGIONS } from '../src/game/adventure';
import { createDiscoveryProgress } from '../src/game/discovery';
import { createExploration } from '../src/game/exploration';
import { createFieldProgress } from '../src/game/fieldActivities';
import { REGION_PLACES } from '../src/game/landmarks';
import { createInitialProgress } from '../src/game/progress';
import { createTempleProgress } from '../src/game/temple';
import { createWorldSurvey, surveyPosition } from '../src/game/worldSurvey';

function fixture(overrides: Partial<DialogProps> = {}): DialogProps {
  const idle = () => {};
  return {
    panel: 'map',
    reward: null,
    mode: 'real',
    progress: createInitialProgress('real'),
    expedition: createExploration('real'),
    adventure: createAdventure('real'),
    templeProgress: createTempleProgress('real'),
    discovery: createDiscoveryProgress('real'),
    field: createFieldProgress('real'),
    survey: createWorldSurvey('real'),
    position: { x: 0, z: 24, heading: 0 },
    today: '2026-09-26',
    flight: { flying: false, landing: false, altitude: 0 },
    closeModal: idle,
    setPanel: idle,
    checkin: idle,
    choosePet: idle,
    newExpedition: idle,
    enterRegion: idle,
    simulateTomorrow: idle,
    travelTo: idle,
    travelToPlace: idle,
    finishCapture: idle,
    playSound: idle,
    ...overrides,
  };
}

function renderAtlas(overrides: Partial<DialogProps> = {}) {
  return renderToStaticMarkup(createElement(TravelAtlas, fixture(overrides)));
}

const allVisitDates = Array.from({ length: 6 }, (_, i) => `2026-09-${21 + i}`);

test('world exploration keeps the full destination denominator when regions unlock', () => {
  const locked = renderAtlas();
  const unlocked = renderAtlas({
    adventure: { ...createAdventure('real'), visitedDates: allVisitDates },
  });
  for (const html of [locked, unlocked]) {
    assert.ok(html.includes('aria-label="世界探索度 0%，已到访 0 / 27 个地标"'));
    assert.ok(html.includes('探索度按已到访地标计算'));
  }
  assert.ok(locked.includes('未解锁，第 2 个到访日开启'));
  assert.ok(!unlocked.includes('未解锁，第 2 个到访日开启'));
  const camp = REGION_PLACES.meadow.find((place) => place.id === 'deer-camp')!;
  const survey = surveyPosition(createWorldSurvey('real'), 'meadow', camp).state;
  const afterWalk = renderAtlas({ survey });
  assert.ok(afterWalk.includes('aria-label="世界探索度 4%，已到访 1 / 27 个地标"'));
  assert.ok(afterWalk.includes('value="1" max="7" aria-label="风语原野地标探索进度"'));
});

test('atlas opens the actual current region and includes the live player map location', () => {
  const html = renderAtlas({
    adventure: {
      ...createAdventure('real'),
      visitedDates: allVisitDates,
      currentRegion: 'fire',
    },
    position: { x: 0, z: 0, heading: Math.PI / 2 },
  });
  assert.ok(html.includes('aria-label="赤霞峡谷探索详情"'));
  assert.ok(html.includes('data-region="fire"'));
  assert.ok(html.includes('火之境 · 你在这里'));
  assert.ok(html.includes('class="survey-player" transform="translate(240 240)"'));
  assert.ok(html.includes('transform="rotate(-90)"'));
  assert.ok(html.includes('带我前往'));
  assert.ok(html.includes('继续自由探索'));
  assert.ok(html.includes('符印寻踪'));
  assert.ok(!html.includes('翻开原野探险手记'));
});

test('locked world islands remain accessible previews and never look like explored destinations', () => {
  let selected = false;
  const html = renderToStaticMarkup(
    createElement(WorldAtlasChart, {
      survey: createWorldSurvey('real'),
      unlocked: ['meadow'],
      current: 'meadow',
      selected: 'water',
      onSelect() {
        selected = true;
      },
    }),
  );
  for (const id of REGION_IDS) {
    assert.ok(html.includes(`aria-label="${REGIONS[id].name}，`));
    if (id !== 'meadow') assert.ok(html.includes(`未解锁，第 ${REGIONS[id].day} 个到访日开启`));
  }
  assert.ok(html.includes('aria-label="澄波湖境，未解锁，第 2 个到访日开启" aria-pressed="true"'));
  assert.equal((html.match(/role="button" tabindex="0"/g) ?? []).length, REGION_IDS.length);
  assert.ok(!html.includes('aria-disabled="true"'));
  assert.equal(selected, false);
});

test('a stale locked-region selection shows its unlock rule without a travel action', () => {
  let travelCalls = 0;
  const html = renderAtlas({
    // Cross-tab saves can change while a dialog is open; availability still guards travel UI.
    adventure: { ...createAdventure('real'), currentRegion: 'water' },
    enterRegion() {
      travelCalls += 1;
    },
    travelToPlace() {
      travelCalls += 1;
    },
  });
  assert.ok(html.includes('风景还在远方等你'));
  assert.match(html, /第 2 个到访日开启，不需要连续登录/);
  assert.ok(!html.includes('class="region-survey-map"'));
  assert.ok(!html.includes('带我前往'));
  assert.ok(!html.includes('前往澄波湖境'));
  assert.ok(!html.includes('符印寻踪'));
  assert.equal(travelCalls, 0);
});

test('meadow atlas retains the expedition journal and seal navigation alongside exploration', () => {
  const html = renderAtlas({
    expedition: { ...createExploration('real'), crystals: [0] },
  });
  assert.ok(html.includes('翻开原野探险手记'));
  assert.ok(html.includes('继续自由探索'));
  assert.ok(html.includes('aria-label="区域地标清单"'));
  assert.ok(html.includes('鹿溪营地'));
  assert.ok(html.includes('晴风花海'));
  assert.ok(html.includes('风铃山丘'));
  assert.ok(html.includes('符印已收集'));
  assert.ok(html.includes('抵达入口后，还可以进入神庙探索。'));
  assert.ok(!html.includes('模拟明天'));
});
