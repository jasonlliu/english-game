import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { REGION_IDS } from '../src/game/adventure';
import { createHero } from '../src/rendering/models/hero';
import { createPet } from '../src/rendering/models/pets';
import { createTempleEnvironment } from '../src/rendering/temple/environment';
import { createTempleLifetime } from '../src/rendering/temple/lifetime';

function watchResources(root: THREE.Object3D) {
  const resources = new Set<THREE.BufferGeometry | THREE.Material>();
  root.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
      resources.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        resources.add(material);
    }
  });
  const counts = new Map([...resources].map((resource) => [resource, 0]));
  for (const resource of resources)
    resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource)! + 1));
  return () => {
    assert.ok(resources.size > 10);
    assert.ok(
      [...counts.values()].every((count) => count === 1),
      'Every owned geometry and material must be released exactly once',
    );
  };
}

test('temple lifetimes unwind partial initialization, remove handlers and tolerate a broken cleanup', () => {
  const lifetime = createTempleLifetime();
  const target = new EventTarget();
  const released: number[] = [];
  let events = 0;
  lifetime.add(() => {
    released.push(1);
  });
  lifetime.add(() => {
    released.push(2);
    throw new Error('cleanup failed');
  });
  lifetime.add(() => {
    released.push(3);
  });
  lifetime.listen(target, 'test', () => {
    events++;
  });
  target.dispatchEvent(new Event('test'));
  lifetime.dispose();
  lifetime.dispose();
  target.dispatchEvent(new Event('test'));
  lifetime.add(() => {
    released.push(4);
  });
  assert.equal(lifetime.disposed, true);
  assert.equal(events, 1);
  assert.deepEqual(released, [3, 2, 1, 4]);
});

test('each temple environment has independent geometry and releases it across repeated visits', () => {
  for (const region of REGION_IDS) {
    const first = createTempleEnvironment(region);
    const second = createTempleEnvironment(region);
    assert.notEqual(first.scene, second.scene);
    const checkFirst = watchResources(first.scene),
      checkSecond = watchResources(second.scene);
    first.update(1, [0], false, 0.016);
    first.dispose();
    first.dispose();
    checkFirst();
    assert.equal(first.scene.children.length, 0);
    assert.ok(
      second.scene.children.length > 20,
      'Disposing one visit must not invalidate a second visit',
    );
    second.update(2, [0, 1, 2], true, 0.016);
    second.dispose();
    second.dispose();
    checkSecond();
  }
});

test('all split models retain valid geometry, animations, and idempotent ownership cleanup', () => {
  const models = [
    createHero(),
    ...([0, 1, 2, 3] as const).map((stage) => createPet('ember', stage)),
    ...(['ripple', 'cinder', 'moss', 'bolt', 'lumi'] as const).map((pet) => createPet(pet)),
  ];
  for (const model of models) {
    const check = watchResources(model.group);
    model.animate(1, 0.5, 0.2);
    const bounds = new THREE.Box3().setFromObject(model.group);
    assert.ok(!bounds.isEmpty());
    assert.ok([...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite));
    model.dispose();
    model.dispose();
    check();
    assert.equal(model.group.children.length, 0);
  }
});
