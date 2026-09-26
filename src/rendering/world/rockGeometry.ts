import * as THREE from 'three';

/** Eroded, grass-capped rock; its horizontal radius stays inside the unit collider. */
export function createStratifiedCliff() {
  const geometry = new THREE.CylinderGeometry(0.76, 1, 1, 18, 12);
  const position = geometry.attributes.position;
  const colors: number[] = [];
  const sandstone = new THREE.Color('#a69b80');
  const shaded = new THREE.Color('#6c7767');
  const turf = new THREE.Color('#668b40');
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i),
      x = position.getX(i),
      z = position.getZ(i);
    const angle = Math.atan2(z, x);
    const ridge = Math.floor((y + 0.5) * 6);
    const erosion = 1 + Math.sin(angle * 3.0 + 1.7) * 0.065 + Math.sin(angle * 7.0) * 0.035;
    const ledge = 1 + Math.sin(ridge * 3.71) * 0.065;
    const scale = Math.min(erosion * ledge, 1 / Math.max(0.001, Math.hypot(x, z)));
    position.setXYZ(i, x * scale, y + Math.sin(angle * 5.0) * 0.007, z * scale);
    const color = shaded.clone().lerp(sandstone, 0.45 + Math.sin(angle * 2.0 + y * 5.0) * 0.22);
    if (y > 0.41) color.lerp(turf, THREE.MathUtils.smoothstep(y, 0.41, 0.49));
    color.multiplyScalar(0.94 + Math.sin(ridge * 2.1) * 0.065);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}
