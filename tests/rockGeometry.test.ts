import assert from 'node:assert/strict';
import test from 'node:test';
import { createStratifiedCliff } from '../src/rendering/world/rockGeometry';

test('stratified rocks stay inside walking and flight clearance envelopes', () => {
  const geometry = createStratifiedCliff();
  try {
    const positions = geometry.attributes.position;
    const normals = geometry.attributes.normal;
    for (let i = 0; i < positions.count; i++) {
      assert(Math.hypot(positions.getX(i), positions.getZ(i)) <= 1.000001);
      assert(Math.abs(positions.getY(i)) <= 0.508);
      assert(Math.abs(Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i)) - 1) < 1e-5);
    }
    // Outdoor rocks are centred at 1.24*radius and scaled to 2.48*radius tall.
    // Their existing flight clearance contract reserves 2.65*radius above the ground.
    assert(1.24 + 0.508 * 2.48 < 2.65);
    assert(geometry.attributes.color.count === positions.count);
  } finally {
    geometry.dispose();
  }
});
