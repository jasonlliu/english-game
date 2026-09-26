import * as THREE from 'three';
import type { Point } from './types';

export interface FormSection {
  center: Point;
  width: number;
  depth: number;
}

/** Smooth, closed cross sections author one connected silhouette instead of overlapping spheres.
 * Z forms run front-to-back; Y forms run shoulder-to-foot. Two index groups allow a clean belly
 * colour boundary without an extra shell, material per face, or a per-frame geometry update. */
export function sculptedForm(
  sections: FormSection[],
  axis: 'z' | 'y' = 'z',
  belly = false,
  rings = 28,
  sides = 16,
) {
  const path = new THREE.CatmullRomCurve3(
    sections.map(({ center }) => new THREE.Vector3(...center)),
  );
  const radii = new THREE.CatmullRomCurve3(
    sections.map(({ width, depth }) => new THREE.Vector3(width, depth, 0)),
  );
  const vertices: number[] = [];
  const upper: number[] = [];
  const lower: number[] = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const center = path.getPoint(t);
    const radius = radii.getPoint(t);
    for (let j = 0; j <= sides; j++) {
      const theta = (j / sides) * Math.PI * 2;
      const x = Math.cos(theta) * Math.max(0.002, radius.x);
      const other = Math.sin(theta) * Math.max(0.002, radius.y);
      vertices.push(
        center.x + x,
        center.y + (axis === 'z' ? other : 0),
        center.z + (axis === 'y' ? other : 0),
      );
      if (i < rings && j < sides) {
        const a = i * (sides + 1) + j;
        const b = a + sides + 1;
        const indices = belly && Math.sin(((j + 0.5) / sides) * Math.PI * 2) < -0.4 ? lower : upper;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  for (const end of [0, rings]) {
    const center = path.getPoint(end / rings);
    const cap = vertices.length / 3;
    vertices.push(center.x, center.y, center.z);
    for (let j = 0; j < sides; j++) {
      const a = end * (sides + 1) + j;
      if (end === 0) upper.push(cap, a + 1, a);
      else upper.push(cap, a, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex([...upper, ...lower]);
  geometry.addGroup(0, upper.length, 0);
  if (lower.length) geometry.addGroup(upper.length, lower.length, 1);
  geometry.computeVertexNormals();
  // The UV seam uses duplicated positions; give it a shared normal to avoid a visible ridge.
  const normals = geometry.getAttribute('normal');
  const normal = new THREE.Vector3();
  for (let i = 0; i <= rings; i++) {
    const a = i * (sides + 1),
      b = a + sides;
    normal
      .set(
        normals.getX(a) + normals.getX(b),
        normals.getY(a) + normals.getY(b),
        normals.getZ(a) + normals.getZ(b),
      )
      .normalize();
    normals.setXYZ(a, normal.x, normal.y, normal.z);
    normals.setXYZ(b, normal.x, normal.y, normal.z);
  }
  return geometry;
}

/** A gently domed, closed armour panel. Polygon corners define the silhouette, not bevel stacks. */
export function sculptedPanel(outline: Array<[number, number]>, dome = 0.08) {
  const vertices = [0, 0, -dome, 0, 0, dome * 0.3];
  const indices: number[] = [];
  for (const [x, y] of outline) vertices.push(x, y, 0);
  for (let i = 0; i < outline.length; i++) {
    const a = i + 2,
      b = ((i + 1) % outline.length) + 2;
    indices.push(0, a, b, 1, b, a);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
