import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDiscoveryProgress,
  DISCOVERY_SITES,
  getDailyDiscoverySite,
} from '../src/game/discovery';
import { getDiscoveryProximity } from '../src/game/discoveryProximity';

const today = '2026-09-26';
test('proximity separates distant hints from nearby interaction and suppresses inactive inputs', () => {
  const state = createDiscoveryProgress('demo');
  assert.equal(getDiscoveryProximity(state, today, { x: 0, z: 24 }, true).sense?.id, 'letter');
  assert.equal(getDiscoveryProximity(state, today, { x: 0, z: 24 }, true).near, null);
  for (const active of [false, true]) {
    const position = active ? { x: NaN, z: 19 } : DISCOVERY_SITES.letter.position;
    assert.deepEqual(getDiscoveryProximity(state, today, position, active), {
      near: null,
      sense: null,
    });
  }
  assert.equal(getDiscoveryProximity(state, today, { x: -1.5, z: 19 }, true).near?.id, 'letter');
  assert.equal(getDiscoveryProximity(state, today, { x: -1.49, z: 19 }, true).near, null);
});

test('companion senses unfinished clues without disclosing locked tracks or completed finds', () => {
  const state = createDiscoveryProgress('demo');
  assert.equal(
    getDiscoveryProximity(state, today, DISCOVERY_SITES['track-1'].position, true).sense,
    null,
  );
  state.found.push('letter');
  assert.equal(
    getDiscoveryProximity(state, today, DISCOVERY_SITES.letter.position, true).sense,
    null,
  );
  assert.equal(
    getDiscoveryProximity(state, today, DISCOVERY_SITES.letter.position, true).near?.id,
    'letter',
  );
  const daily = getDailyDiscoverySite(today);
  assert.equal(getDiscoveryProximity(state, today, daily.position, true).sense?.id, 'daily-cache');
  state.dailyFinds.push(today);
  assert.equal(getDiscoveryProximity(state, today, daily.position, true).sense, null);
});

test('closely spaced bells choose the nearest visible interaction, and hints stop after solving', () => {
  const state = createDiscoveryProgress('demo');
  state.found = ['letter', 'camp', 'track-1', 'track-2', 'track-3', 'cache'];
  assert.equal(getDiscoveryProximity(state, today, { x: -7, z: -84 }, true).near?.id, 'bell-0');
  assert.equal(getDiscoveryProximity(state, today, { x: -6, z: -84 }, true).near?.id, 'bell-1');
  state.chimes = [1, 0, 2];
  assert.equal(
    getDiscoveryProximity(state, today, DISCOVERY_SITES['bell-1'].position, true).sense,
    null,
  );
  assert.equal(
    getDiscoveryProximity(state, today, DISCOVERY_SITES.vault.position, true).sense?.id,
    'vault',
  );
  state.completed = true;
  assert.equal(
    getDiscoveryProximity(state, today, DISCOVERY_SITES.vault.position, true).sense,
    null,
  );
});
