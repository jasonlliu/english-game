import * as THREE from 'three';

export type HeroSection = [number, number, number, number];

/** Closed, smooth tailored/anatomical cross-sections; all ownership stays with modelKit. */
export function heroLoft(
  sections: HeroSection[],
  options: { radial?: number; gap?: number; square?: number; face?: boolean } = {},
) {
  const radial = options.radial ?? 24;
  const steps = Math.max(8, (sections.length - 1) * (options.face ? 4 : 3));
  const gap = options.gap ?? 0;
  const positions: number[] = [];
  const indices: number[] = [];
  const cubic = (a: number, b: number, c: number, d: number, t: number) =>
    0.5 *
    (2 * b +
      (-a + c) * t +
      (2 * a - 5 * b + 4 * c - d) * t * t +
      (-a + 3 * b - 3 * c + d) * t * t * t);
  const shape = (n: number) => Math.sign(n) * Math.abs(n) ** (options.square ?? 1);
  for (let row = 0; row <= steps; row++) {
    const at = (row / steps) * (sections.length - 1);
    const n = Math.min(Math.floor(at), sections.length - 2);
    const t = at - n;
    const a = sections[Math.max(0, n - 1)];
    const b = sections[n];
    const c = sections[n + 1];
    const d = sections[Math.min(sections.length - 1, n + 2)];
    const y = THREE.MathUtils.lerp(b[0], c[0], t);
    const w = Math.max(0.002, cubic(a[1], b[1], c[1], d[1], t));
    const depth = Math.max(0.002, cubic(a[2], b[2], c[2], d[2], t));
    const offset = cubic(a[3], b[3], c[3], d[3], t);
    for (let col = 0; col <= radial; col++) {
      const angle = Math.PI + gap + (col / radial) * (Math.PI * 2 - gap * 2);
      const x = shape(Math.sin(angle)) * w;
      let z = shape(Math.cos(angle)) * depth + offset;
      if (options.face && Math.cos(angle) < 0) {
        // The bridge, nose and soft muzzle are part of the face, not attached primitives.
        const front = Math.max(0, -Math.cos(angle));
        const nose = 0.044 * Math.exp(-((x / 0.033) ** 2) - ((y + 0.055) / 0.054) ** 2);
        const muzzle = 0.012 * Math.exp(-((x / 0.105) ** 2) - ((y + 0.13) / 0.065) ** 2);
        z -= (nose + muzzle) * front;
      }
      positions.push(x, y, z);
      if (row < steps && col < radial) {
        const i = row * (radial + 1) + col;
        indices.push(i, i + 1, i + radial + 1, i + 1, i + radial + 2, i + radial + 1);
      }
    }
  }
  if (!gap) {
    for (const row of [0, steps]) {
      const section = row === 0 ? sections[0] : sections[sections.length - 1];
      const center = positions.length / 3;
      positions.push(0, section[0], section[3]);
      for (let col = 0; col < radial; col++) {
        const i = row * (radial + 1) + col;
        indices.push(center, row === 0 ? i + 1 : i, row === 0 ? i : i + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  // Average the periodic seam so the broad surfaces have no visible shading zipper.
  if (!gap) {
    const normals = geometry.getAttribute('normal');
    for (let row = 0; row <= steps; row++) {
      const a = row * (radial + 1),
        b = a + radial;
      const x = normals.getX(a) + normals.getX(b);
      const y = normals.getY(a) + normals.getY(b);
      const z = normals.getZ(a) + normals.getZ(b);
      const length = Math.hypot(x, y, z) || 1;
      normals.setXYZ(a, x / length, y / length, z / length);
      normals.setXYZ(b, x / length, y / length, z / length);
    }
  }
  return geometry;
}

/** One broad cap provides hair volume underneath a few deliberately swept locks. */
export function heroHairCap() {
  const geometry = new THREE.SphereGeometry(1, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.74);
  const p = geometry.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i);
    const side = Math.atan2(x, z);
    const wave = 1 + Math.sin(side * 5 + y * 3) * 0.035 + Math.cos(side * 3 - y * 4) * 0.025;
    const front = Math.max(0, -z);
    const nape = Math.max(0, -y) * 0.26 * (1 - front);
    p.setXYZ(
      i,
      x * 0.264 * wave,
      0.118 + y * 0.225 + front * 0.07 - nape,
      z * 0.207 * wave + 0.021,
    );
  }
  geometry.computeVertexNormals();
  return geometry;
}
