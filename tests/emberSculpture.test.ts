import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { createCompanion } from '../src/rendering/models/ember';
import { sculptedForm, sculptedPanel } from '../src/rendering/models/emberGeometry';

/** Weld the intentionally duplicated shading seam, then require a closed two-manifold shell. */
function assertClosedSurface(geometry: THREE.BufferGeometry) {
  const positions = geometry.getAttribute('position');
  const vertices = Array.from({ length: positions.count }, (_, i) =>
    [positions.getX(i), positions.getY(i), positions.getZ(i)]
      .map((value) => Math.round(value * 100000))
      .join(','),
  );
  const edges = new Map<string, number>();
  const index = geometry.index!;
  for (let i = 0; i < index.count; i += 3) {
    const face = [0, 1, 2].map((offset) => vertices[index.getX(i + offset)]);
    assert.equal(new Set(face).size, 3, 'Each face must have three distinct positions');
    for (let side = 0; side < 3; side++) {
      const edge = [face[side], face[(side + 1) % 3]].sort().join('|');
      edges.set(edge, (edges.get(edge) ?? 0) + 1);
    }
  }
  assert.ok(
    [...edges.values()].every((count) => count === 2),
    'No open seams or duplicate faces',
  );
  const normals = geometry.getAttribute('normal');
  assert.ok(Array.from(normals.array).every(Number.isFinite));
}

test('sculpted body forms remain closed, outward-facing and use at most two material groups', () => {
  for (const axis of ['z', 'y'] as const) {
    const geometry = sculptedForm(
      [
        { center: [0, 0, 0], width: 0.2, depth: 0.25 },
        { center: axis === 'z' ? [0, 0.2, 0.5] : [0, -0.5, 0.1], width: 0.3, depth: 0.28 },
        { center: axis === 'z' ? [0, 0, 1] : [0, -1, 0], width: 0.12, depth: 0.13 },
      ],
      axis,
      true,
    );
    try {
      assertClosedSurface(geometry);
      assert.equal(geometry.groups.length, 2);
      const positions = geometry.getAttribute('position');
      const index = geometry.index!;
      const a = new THREE.Vector3(),
        b = new THREE.Vector3(),
        c = new THREE.Vector3();
      let volume = 0;
      for (let i = 0; i < index.count; i += 3) {
        a.fromBufferAttribute(positions, index.getX(i));
        b.fromBufferAttribute(positions, index.getX(i + 1));
        c.fromBufferAttribute(positions, index.getX(i + 2));
        volume += a.dot(b.cross(c)) / 6;
      }
      assert.ok(volume > 0, 'Front faces must point outward');
    } finally {
      geometry.dispose();
    }
  }
  const panel = sculptedPanel([
    [-0.4, 0],
    [0, 0.5],
    [0.4, 0],
    [0, -0.5],
  ]);
  try {
    assertClosedSurface(panel);
    assert.ok(panel.getAttribute('normal').getZ(0) < 0, 'Front dome must face the camera');
  } finally {
    panel.dispose();
  }
});

test('all dragon forms retain continuous torso and head surfaces within a bounded render cost', () => {
  for (const stage of [0, 1, 2, 3] as const) {
    const model = createCompanion(stage);
    try {
      for (const name of ['ember-sculpted-torso', 'ember-sculpted-head']) {
        const mesh = model.group.getObjectByName(name) as THREE.Mesh;
        assert.ok(mesh?.isMesh);
        assertClosedSurface(mesh.geometry);
        assert.equal(mesh.geometry.groups.length, 2);
      }
      let meshes = 0,
        triangles = 0;
      model.group.traverse((part) => {
        if (!(part instanceof THREE.Mesh)) return;
        meshes++;
        triangles += (part.geometry.index?.count ?? part.geometry.attributes.position.count) / 3;
      });
      assert.ok(meshes <= 90);
      assert.ok(triangles <= 34500, 'Sculpting must not require an unbounded polygon increase');
      const joints = [0, 1, 2].map((i) => model.group.getObjectByName(`ember-tail-joint-${i}`)!);
      model.animate(1, 0);
      const first = joints.map((joint) => joint.rotation.y);
      model.animate(1.4, 0);
      assert.ok(joints.every((joint, i) => joint.rotation.y !== first[i]));
      assert.ok(joints.every((joint) => Math.abs(joint.rotation.y) < 0.12));
      if (stage === 3) {
        const seat = model.rideSeat!.clone();
        model.setFlying!(true);
        model.animate(1.4, 0);
        assert.ok(model.rideSeat!.distanceTo(seat) > 0.01);
        assert.ok(model.rideSeat!.toArray().every(Number.isFinite));
      }
    } finally {
      model.dispose();
    }
  }
});
