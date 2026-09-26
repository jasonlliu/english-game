import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createAdventure } from '../src/game/adventure';
import { createFieldProgress } from '../src/game/fieldActivities';
import {
  createDiscoveryProgress,
  DISCOVERY_ORDER,
  getDailyDiscoverySite,
  type DiscoveryProgress,
} from '../src/game/discovery';
import ExpeditionJournal from '../src/features/dialogs/ExpeditionJournal';

const today = '2026-09-26';
function renderJournal(discovery: DiscoveryProgress) {
  return renderToStaticMarkup(
    createElement(ExpeditionJournal, {
      discovery,
      field: createFieldProgress('real'),
      today,
      adventure: createAdventure('real'),
      closeModal() {},
      setPanel() {},
    }),
  );
}

test('journal reveals remembered pages progressively and keeps the bell answer behind the old cache', () => {
  for (let count = 0; count < 6; count++) {
    const state = { ...createDiscoveryProgress('real'), found: DISCOVERY_ORDER.slice(0, count) };
    const html = renderJournal(state);
    assert.equal((html.match(/class="discovery-page-number"/g) ?? []).length, count);
    assert.ok(!html.includes('泉水先醒'));
    assert.ok(!html.includes('按泉、风、星的顺序敲铃'));
    assert.ok(!html.includes('花房深处的匣子缓缓开启'));
  }
  const afterCache = renderJournal({
    ...createDiscoveryProgress('real'),
    found: DISCOVERY_ORDER.slice(0, 6),
    chimes: [1],
  });
  assert.ok(afterCache.includes('泉水先醒'));
  assert.ok(afterCache.includes('按泉、风、星的顺序敲铃'));
  assert.equal((afterCache.match(/class="is-rung"/g) ?? []).length, 1);
});

test('daily rumor stays undisclosed before reading the letter and becomes a receipt after finding it', () => {
  const initial = createDiscoveryProgress('real');
  const clue = getDailyDiscoverySite(today).clue;
  assert.ok(!renderJournal(initial).includes(clue));
  const known: DiscoveryProgress = { ...initial, found: ['letter'] };
  assert.ok(renderJournal(known).includes(clue));
  const found = renderJournal({ ...known, dailyFinds: [today] });
  assert.ok(found.includes('今天的旅途邮票已收好'));
  assert.ok(!found.includes(clue));
});

test('completed journeys retain all stories, puzzle notes, and the permanent keepsake', () => {
  const html = renderJournal({
    ...createDiscoveryProgress('real'),
    found: [...DISCOVERY_ORDER],
    chimes: [1, 0, 2],
    completed: true,
    dailyFinds: [today],
  });
  assert.equal((html.match(/class="discovery-page-number"/g) ?? []).length, 7);
  assert.ok(html.includes('回响风铃'));
  assert.ok(html.includes('永久收藏'));
  assert.ok(html.includes('花房深处的匣子缓缓开启'));
  assert.ok(html.includes('三声已连成回响'));
});

test('long expedition narrative loads only through the dialog boundary and exposes no secret coordinates', () => {
  const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
  assert.match(
    read('features/dialogs/DialogHost.tsx'),
    /expedition:\s*\(\)\s*=>\s*import\('\.\/ExpeditionJournal'\)/,
  );
  for (const file of [
    'app/useAdventureController.ts',
    'features/hud/QuestPanel.tsx',
    'features/hud/GameShell.tsx',
  ]) {
    assert.ok(
      !read(file).includes('ExpeditionJournal'),
      `${file} must not eagerly import the narrative`,
    );
  }
  const journal = read('features/dialogs/ExpeditionJournal.tsx');
  assert.ok(!journal.includes('DISCOVERY_SITES'));
  assert.ok(!journal.includes('travelToPlace('));
});
