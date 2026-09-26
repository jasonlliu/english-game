import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  CHIME_ORDER,
  DISCOVERY_ORDER,
  DISCOVERY_SITES,
  createDiscoveryProgress,
  getAvailableDiscoverySites,
  getDailyDiscoverySite,
  investigateDiscovery,
  type DiscoveryProgress,
} from '../src/game/discovery';
import { getTerrainHeight } from '../src/game/world';
import { createMeadowSecrets } from '../src/rendering/scenery/meadow/secrets';
import type { SceneryFrame } from '../src/rendering/scenery/types';

const today = '2026-09-26';
function throughCache() {
  let state = createDiscoveryProgress('demo');
  for (const id of DISCOVERY_ORDER.slice(0, -1))
    state = investigateDiscovery(state, id, DISCOVERY_SITES[id].position, today, 'meadow').state;
  return state;
}
function frame(discovery: DiscoveryProgress, delta = 1 / 60): SceneryFrame {
  return {
    discovery,
    today,
    delta,
    running: false,
    companion: true,
    position: { ...DISCOVERY_SITES.letter.position },
  };
}
function visibleSites(group: THREE.Group) {
  return group.children
    .filter((object) => object.visible && object.userData.discoveryId)
    .map((object) => object.userData.discoveryId)
    .sort();
}
function object(group: THREE.Group, name: string) {
  const found = group.getObjectByName(name);
  assert(found, `Missing visual ${name}`);
  return found;
}

test('clue visibility and raycast IDs follow domain eligibility without leaking future sites', () => {
  const secrets = createMeadowSecrets();
  let state = createDiscoveryProgress('demo');
  for (const id of [...DISCOVERY_ORDER.slice(0, -1), null]) {
    secrets.update(1, frame(state));
    assert.deepEqual(
      visibleSites(secrets.group),
      getAvailableDiscoverySites(state, today)
        .map((site) => site.id)
        .sort(),
    );
    for (const [siteId, site] of Object.entries(DISCOVERY_SITES)) {
      const mesh = object(secrets.group, `discovery-${siteId}`);
      assert.equal(mesh.userData.discoveryId, siteId);
      assert.equal(mesh.position.x, site.position.x);
      assert.equal(mesh.position.z, site.position.z);
      assert.equal(mesh.position.y, getTerrainHeight(site.position.x, site.position.z) + 0.035);
    }
    if (id === null) break;
    state = investigateDiscovery(state, id, DISCOVERY_SITES[id].position, today, 'meadow').state;
  }
  assert.equal(
    object(secrets.group, 'letter-glimmer').visible,
    false,
    'Found props remain readable without a permanent beacon',
  );
  secrets.dispose();
});

test('nearby guidance is local, companion aided, and never exposes future tracks', () => {
  const secrets = createMeadowSecrets();
  const initial = createDiscoveryProgress('demo');
  const request = {
    ...frame(initial),
    position: { x: DISCOVERY_SITES.letter.position.x + 16, z: DISCOVERY_SITES.letter.position.z },
    companion: false,
  };
  secrets.update(1, request);
  assert.equal(object(secrets.group, 'discovery-nearby-trail').visible, false);
  secrets.update(2, { ...request, companion: true });
  assert.equal(object(secrets.group, 'discovery-nearby-trail').visible, true);
  assert.equal(object(secrets.group, 'discovery-track-1').visible, false);
  assert.equal(object(secrets.group, 'discovery-track-2').visible, false);
  assert.equal(object(secrets.group, 'discovery-track-3').visible, false);
  secrets.update(3, { ...request, position: { x: 100, z: 100 }, companion: true });
  assert.equal(object(secrets.group, 'discovery-nearby-trail').visible, false);
  assert(
    object(secrets.group, 'letter-glimmer').scale.y < 0.1,
    'The clue signal stays a small glimmer',
  );
  secrets.dispose();
});

test('correct and mistaken bell interactions animate, while only saved correct bells remain lit', () => {
  const secrets = createMeadowSecrets();
  const state = throughCache();
  secrets.update(0, frame(state));
  const first = { ...state, chimes: [CHIME_ORDER[0]] };
  secrets.update(1, { ...frame(first, 0.05), discoveryInteraction: { id: 'bell-1', serial: 1 } });
  secrets.update(2, { ...frame(first, 0.05), discoveryInteraction: { id: 'bell-1', serial: 1 } });
  assert(Math.abs(object(secrets.group, 'bell-1-swing').rotation.z) > 0.05);
  const correctLight = object(secrets.group, 'bell-1-light') as THREE.Mesh<
    THREE.BufferGeometry,
    THREE.MeshStandardMaterial
  >;
  assert.equal(correctLight.material.emissiveIntensity, 0.75);
  secrets.update(3, { ...frame(state, 0.05), discoveryInteraction: { id: 'bell-2', serial: 2 } });
  secrets.update(4, { ...frame(state, 0.05), discoveryInteraction: { id: 'bell-2', serial: 2 } });
  assert(Math.abs(object(secrets.group, 'bell-2-swing').rotation.z) > 0.05);
  assert.equal(correctLight.material.emissiveIntensity, 0.035);
  assert.equal(object(secrets.group, 'vault-seal').visible, true);
  secrets.dispose();
});

test('revisiting restores unlocked seals, open chests and the permanent follower without replaying them', () => {
  const secrets = createMeadowSecrets();
  const state: DiscoveryProgress = {
    ...throughCache(),
    found: [...DISCOVERY_ORDER],
    chimes: [...CHIME_ORDER],
    completed: true,
    dailyFinds: [today],
  };
  const request = { ...frame(state, 0), position: { ...DISCOVERY_SITES.vault.position } };
  secrets.update(100, request);
  assert.equal(object(secrets.group, 'vault-seal').visible, false);
  for (const id of ['cache', 'vault', 'daily-cache'])
    assert(object(secrets.group, `${id}-lid`).rotation.x < -1.2);
  const follower = object(secrets.group, 'discovery-reward-firefly');
  assert.equal(follower.visible, true);
  assert(
    Math.hypot(follower.position.x - request.position.x, follower.position.z - request.position.z) <
      1.1,
  );
  assert.equal(object(secrets.group, 'bell-0-swing').rotation.z, 0);
  const before = follower.position.clone();
  secrets.update(1000, {
    ...request,
    position: { x: request.position.x + 10, z: request.position.z },
  });
  assert.deepEqual(follower.position, before, 'A paused frame must freeze the reward follower');
  secrets.dispose();
});

test('the daily cache uses the rotating shared site and opens only for the saved day', () => {
  const secrets = createMeadowSecrets();
  let state = createDiscoveryProgress('demo');
  secrets.update(0, frame(state));
  const daily = object(secrets.group, 'discovery-daily-cache');
  assert.equal(daily.visible, false);
  state = { ...state, found: ['letter'], dailyFinds: [today] };
  secrets.update(1, frame(state));
  for (let i = 0; i < 120; i++) secrets.update(i / 60 + 1, frame(state));
  assert.equal(daily.visible, true);
  assert(object(secrets.group, 'daily-cache-lid').rotation.x < -1.2);
  const nextDay = '2026-09-27';
  secrets.update(4, { ...frame(state), today: nextDay });
  assert.equal(daily.position.x, getDailyDiscoverySite(nextDay).position.x);
  assert.equal(daily.position.z, getDailyDiscoverySite(nextDay).position.z);
  assert.equal(Math.abs(object(secrets.group, 'daily-cache-lid').rotation.x), 0);
  assert.equal(daily.userData.discoveryId, 'daily-cache');
  secrets.dispose();
});

test('opening fades the seal, keeps finite shared geometry and disposes every owned resource once', () => {
  const secrets = createMeadowSecrets();
  const state = throughCache();
  secrets.update(0, frame(state));
  const solved = { ...state, chimes: [...CHIME_ORDER] };
  for (let i = 0; i < 180; i++) secrets.update(i / 60, frame(solved));
  assert.equal(object(secrets.group, 'vault-seal').visible, false);
  const resources = new Set<THREE.BufferGeometry | THREE.Material>();
  let meshes = 0;
  secrets.group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    meshes++;
    resources.add(child.geometry);
    for (const mat of Array.isArray(child.material) ? child.material : [child.material])
      resources.add(mat);
    assert(Array.from(child.geometry.attributes.position.array).every(Number.isFinite));
  });
  assert(meshes < 85, 'Shared and merged props keep the entire quest graph small');
  const counts = new Map([...resources].map((resource) => [resource, 0]));
  for (const resource of resources)
    resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource)! + 1));
  secrets.dispose();
  secrets.dispose();
  secrets.update(10, frame(solved));
  assert([...counts.values()].every((count) => count === 1));
  assert.equal(secrets.group.children.length, 0);
});
