import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createDiscoveryProgress } from '../src/game/discovery';
import { getTerrainHeight } from '../src/game/world';
import { createRegionScenery } from '../src/rendering/scenery/regions/meadow';
import { pickDiscoveryId } from '../src/rendering/world/discoveryPicking';

function fixture() {
  const scene = new THREE.Scene();
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshBasicMaterial();
  const clue = new THREE.Group();
  clue.userData.discoveryId = 'letter';
  clue.add(new THREE.Mesh(geometry, material));
  scene.add(clue);
  const blocker = new THREE.Mesh(geometry, material.clone());
  blocker.position.z = 2;
  const parent = new THREE.Group();
  parent.add(blocker);
  scene.add(parent);
  const ray = new THREE.Raycaster(new THREE.Vector3(0, 0, 5), new THREE.Vector3(0, 0, -1));
  return {
    clue,
    blocker,
    parent,
    pick: () => {
      scene.updateMatrixWorld(true);
      return pickDiscoveryId(ray.intersectObjects(scene.children, true), new Set(['letter']));
    },
    dispose: () => {
      geometry.dispose();
      material.dispose();
      blocker.material.dispose();
    },
  };
}

test('a clue behind an opaque world surface cannot be picked, including unavailable clue props', () => {
  const f = fixture();
  try {
    assert.equal(f.pick(), null);
    f.parent.userData.discoveryId = 'camp';
    assert.equal(f.pick(), null, 'An unavailable prop cannot expose an available clue behind it');
    f.parent.visible = false;
    assert.equal(f.pick(), 'letter');
    f.clue.visible = false;
    assert.equal(f.pick(), null, 'A hidden parent also hides all discovery child meshes');
  } finally {
    f.dispose();
  }
});

test('nonrendered and translucent effects do not obstruct visible clues', () => {
  const f = fixture();
  try {
    f.blocker.material.visible = false;
    assert.equal(f.pick(), 'letter');
    f.blocker.material.visible = true;
    f.blocker.material.transparent = true;
    f.blocker.material.opacity = 0.25;
    assert.equal(f.pick(), 'letter');
    f.clue.children[0].visible = false;
    assert.equal(f.pick(), null);
  } finally {
    f.dispose();
  }
});

test('the actual meadow conservatory occludes the garden vault from the eastern approach', () => {
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({ fillStyle: '', fillRect() {} }),
    }),
  } as unknown as Document;
  let scenery: ReturnType<typeof createRegionScenery> | undefined;
  try {
    scenery = createRegionScenery();
    scenery.update(0, false, {
      position: { x: 93, z: 64 },
      delta: 0,
      running: false,
      discovery: createDiscoveryProgress('demo'),
      today: '2026-09-26',
    });
    scenery.group.updateMatrixWorld(true);
    const target = new THREE.Vector3(69, getTerrainHeight(69, 60) + 1.05, 60);
    const origin = new THREE.Vector3(93, getTerrainHeight(93, 64) + 4, 64);
    const ray = new THREE.Raycaster(origin, target.clone().sub(origin).normalize());
    const hits = ray.intersectObject(scenery.group, true);
    const vault = scenery.group.getObjectByName('discovery-vault');
    assert(vault);
    const vaultHits = ray.intersectObject(vault, true);
    assert.equal(pickDiscoveryId(vaultHits, new Set(['vault'])), 'vault');
    assert(hits[0].distance < vaultHits[0].distance, 'The conservatory is in front of the vault');
    assert.equal(pickDiscoveryId(hits, new Set(['vault'])), null);
  } finally {
    scenery?.dispose();
    if (previousDocument) globalThis.document = previousDocument;
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
