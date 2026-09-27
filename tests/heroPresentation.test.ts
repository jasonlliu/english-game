import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { createHero } from '../src/rendering/models/hero';

test('hero sculpting retains valid surface data within a bounded render cost', () => {
  const hero = createHero();
  try {
    const geometries = new Set<THREE.BufferGeometry>();
    let drawCalls = 0,
      triangles = 0;
    hero.group.traverse((part) => {
      if (!(part instanceof THREE.Mesh)) return;
      const geometry = part.geometry;
      geometries.add(geometry);
      drawCalls += Array.isArray(part.material) ? geometry.groups.length : 1;
      triangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3;
    });
    assert.ok(geometries.size > 0);
    for (const geometry of geometries) {
      const positions = geometry.getAttribute('position');
      const normals = geometry.getAttribute('normal');
      assert.ok(positions.count >= 3);
      assert.ok(Array.from(positions.array).every(Number.isFinite));
      assert.equal(normals.count, positions.count);
      assert.ok(Array.from(normals.array).every(Number.isFinite));
      // Parametric spheres retain unused pole vertices; only drawn normals affect lighting.
      const vertices = geometry.index
        ? new Set(geometry.index.array)
        : Array.from({ length: positions.count }, (_, i) => i);
      for (const i of vertices) {
        const length = Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i));
        assert.ok(length > 0.99 && length < 1.01, 'Lighting requires finite unit normals');
      }
      if (geometry.index) {
        assert.equal(geometry.index.count % 3, 0);
        for (const index of geometry.index.array)
          assert.ok(Number.isInteger(index) && index >= 0 && index < positions.count);
      }
    }
    // The previous ranger used 112 draw calls and 50,654 triangles before shadows.
    assert.ok(drawCalls <= 112, `Hero draw calls grew to ${drawCalls}`);
    assert.ok(triangles <= 51000, `Hero triangle count grew to ${triangles}`);
  } finally {
    hero.dispose();
  }
});

test('the riding anchor tracks the actual pelvis under animation and scene transforms', () => {
  const hero = createHero();
  try {
    assert.ok(hero.setRiding && hero.riderHip);
    const anchor = hero.riderHip;
    const left = hero.group.getObjectByName('hero-hip--1')!;
    const right = hero.group.getObjectByName('hero-hip-1')!;
    assert.ok(left && right);
    hero.setRiding(true);
    hero.group.position.set(7, 15, -9);
    hero.group.scale.setScalar(1.3);
    for (const time of [0, 0.3, 1.7, 4.2, 20]) {
      hero.group.rotation.y = time;
      hero.animate(time, 1);
      hero.group.updateMatrixWorld(true);
      const pelvis = left
        .getWorldPosition(new THREE.Vector3())
        .add(right.getWorldPosition(new THREE.Vector3()))
        .multiplyScalar(0.5);
      const seat = hero.group.localToWorld(anchor.clone());
      assert.equal(hero.riderHip, anchor, 'Scenes may retain the animated anchor reference');
      assert.ok(pelvis.distanceTo(seat) < 1e-6, 'The saddle must follow the visible pelvis');
    }
  } finally {
    hero.dispose();
  }
});
