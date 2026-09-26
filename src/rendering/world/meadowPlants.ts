import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

function merge(parts: THREE.BufferGeometry[]) {
  const result = mergeGeometries(parts, false)!;
  parts.forEach((part) => part.dispose());
  result.computeBoundingBox();
  result.computeBoundingSphere();
  return result;
}

/** Compound crowns have a quiet solid interior and individually shaped leaves at the edge. */
export function createLeafCrown(shrub = false, variant = 0, distant = false) {
  const random = seeded(53813 + variant * 177 + (shrub ? 701 : 0));
  const clusters = shrub
    ? [
        [0, 0.65, 0, 0.7, 0.61, 0.65],
        [-0.52, 0.47, 0.1, 0.57, 0.48, 0.55],
        [0.5, 0.46, -0.2, 0.62, 0.43, 0.56],
      ]
    : [
        [0, 4.65, 0, 1.48, 1.28, 1.32],
        [-1.03, 4.55, 0.14, 1.04, 0.98, 1.12],
        [1.09, 4.42, 0.47, 1.0, 0.87, 0.99],
        [0.08, 5.6, -0.16, 1.04, 1.07, 0.97],
        [0.15, 4.65, -1.12, 1.05, 1.06, 0.91],
      ];
  const parts: THREE.BufferGeometry[] = [];
  for (const [cx, cy, cz, rx, ry, rz] of clusters) {
    const core = new THREE.IcosahedronGeometry(1, 1);
    const vertices = core.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i),
        y = vertices.getY(i),
        z = vertices.getZ(i);
      const ripple = 1 + Math.sin(x * 9 + z * 4) * Math.cos(y * 7 + cx) * 0.11;
      vertices.setXYZ(
        i,
        cx + x * rx * ripple * 0.91,
        cy + y * ry * ripple * 0.91,
        cz + z * rz * ripple * 0.91,
      );
    }
    // Keep smooth ellipsoid normals across duplicated triangle vertices. Recomputing
    // non-indexed normals here would turn distant foliage into faceted mineral lumps.
    const normals = core.attributes.normal,
      normal = new THREE.Vector3();
    for (let i = 0; i < vertices.count; i++) {
      normal
        .set(
          (vertices.getX(i) - cx) / (rx * rx),
          (vertices.getY(i) - cy) / (ry * ry),
          (vertices.getZ(i) - cz) / (rz * rz),
        )
        .normalize();
      normals.setXYZ(i, normal.x, normal.y, normal.z);
    }
    parts.push(core);
  }
  const vertices: number[] = [];
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3(),
    d = new THREE.Vector3(),
    e = new THREE.Vector3(),
    f = new THREE.Vector3(),
    center = new THREE.Vector3();
  for (let i = 0; i < (distant ? 36 : shrub ? 106 : 220); i++) {
    const [cx, cy, cz, rx, ry, rz] = clusters[i % clusters.length];
    const angle = random() * Math.PI * 2,
      vertical = random() * 1.84 - 0.84;
    const radius = Math.sqrt(1 - vertical * vertical);
    center.set(
      cx + Math.cos(angle) * radius * rx,
      cy + vertical * ry,
      cz + Math.sin(angle) * radius * rz,
    );
    const length = (shrub ? 0.1 : 0.18) + random() * (shrub ? 0.11 : 0.18);
    const yaw = angle + (random() - 0.5) * 1.5;
    const along = new THREE.Vector3(Math.cos(yaw), 0.28 + random() * 0.65, Math.sin(yaw))
      .normalize()
      .multiplyScalar(length);
    const across = new THREE.Vector3(-Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(
      length * 0.69,
    );
    a.copy(center).sub(along);
    b.copy(center).addScaledVector(along, -0.42).add(across);
    c.copy(center).addScaledVector(along, 0.42).add(across);
    d.copy(center).add(along);
    e.copy(center).addScaledVector(along, 0.42).sub(across);
    f.copy(center).addScaledVector(along, -0.42).sub(across);
    const ridge = center.clone().add(new THREE.Vector3(0, length * 0.12, 0));
    for (const [p, q] of [
      [a, b],
      [b, c],
      [c, d],
      [d, e],
      [e, f],
      [f, a],
    ])
      vertices.push(...p.toArray(), ...q.toArray(), ...ridge.toArray());
  }
  const leaves = new THREE.BufferGeometry();
  leaves.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  leaves.computeVertexNormals();
  parts.push(leaves);
  // Merge needs matching attributes; leaf fans do not need texture coordinates.
  parts.forEach((part) => part.deleteAttribute('uv'));
  const result = merge(parts);
  const positions = result.attributes.position;
  const colors: number[] = [];
  const low = new THREE.Color(shrub ? '#4d883f' : '#3e783e');
  const high = new THREE.Color(shrub ? '#abc777' : '#a4c375');
  for (let i = 0; i < positions.count; i++) {
    let x = positions.getX(i),
      y = positions.getY(i),
      z = positions.getZ(i);
    if (shrub) y = Math.max(0, y / 1.4);
    else if (variant) {
      x *= 0.8;
      z *= 0.86;
      y = 2.7 + (y - 2.7) * 1.07;
    }
    const radius = Math.hypot(x, z);
    if (!shrub && radius > 2.62) {
      x *= 2.62 / radius;
      z *= 2.62 / radius;
    }
    positions.setXYZ(i, x, Math.min(shrub ? 1 : 7.25, y), z);
    const light = THREE.MathUtils.clamp(
      (shrub ? y : (y - 3) / 4.2) * 0.68 + 0.1 + random() * 0.14,
      0,
      1,
    );
    colors.push(...low.clone().lerp(high, light).toArray());
  }
  result.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  result.computeBoundingBox();
  if (shrub) result.scale(1, 1 / result.boundingBox!.max.y, 1);
  softenPlantNormals(result, 0.65);
  result.computeBoundingBox();
  result.computeBoundingSphere();
  return result;
}

/** Branch forks start above the walking character; the existing central trunk collider still fits. */
export function createBranchedTrunk(variant = 0, distant = false) {
  const parts: THREE.BufferGeometry[] = [];
  const branch = (from: THREE.Vector3, to: THREE.Vector3, base: number, tip: number) => {
    const delta = to.clone().sub(from);
    const geometry = new THREE.CylinderGeometry(tip, base, delta.length(), 5, 1);
    geometry.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()),
    );
    geometry.translate((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
    parts.push(geometry);
  };
  branch(new THREE.Vector3(), new THREE.Vector3(0.08, 3.8, -0.04), 0.3, 0.16);
  branch(new THREE.Vector3(0.08, 3.4, -0.04), new THREE.Vector3(-0.12, 5.8, 0.1), 0.16, 0.025);
  for (let i = 0; i < (distant ? 0 : 6); i++) {
    const angle = i * 2.4 + variant * 0.6;
    const end = new THREE.Vector3(
      Math.cos(angle) * 1.42,
      4.1 + (i % 3) * 0.49,
      Math.sin(angle) * 1.4,
    );
    const start = new THREE.Vector3(0, 2.8 + (i % 3) * 0.37, 0);
    const elbow = start.clone().lerp(end, 0.57);
    elbow.y += 0.2;
    branch(start, elbow, 0.13, 0.073);
    branch(elbow, end, 0.073, 0.018);
  }
  return merge(parts);
}

/** One tuft contains bent blades of several lengths, rather than three isolated triangles. */
export function createGrassTuft(blades = 11) {
  const random = seeded(24093),
    vertices: number[] = [],
    colors: number[] = [];
  const low = new THREE.Color('#397c30'),
    high = new THREE.Color('#8db94b');
  for (let i = 0; i < blades; i++) {
    const angle = random() * Math.PI * 2,
      radius = Math.sqrt(random()) * 0.43;
    const x = Math.cos(angle) * radius,
      z = Math.sin(angle) * radius;
    const height = 0.53 + random() * 0.47,
      width = 0.04 + random() * 0.034;
    const dx = Math.cos(angle + 1) * width,
      dz = Math.sin(angle + 1) * width;
    const bx = Math.cos(angle) * height * 0.27,
      bz = Math.sin(angle) * height * 0.27;
    const a = [x - dx, 0, z - dz],
      b = [x + dx, 0, z + dz];
    const c = [x + bx * 0.36 - dx * 0.64, height * 0.58, z + bz * 0.36 - dz * 0.64];
    const d = [x + bx * 0.36 + dx * 0.64, height * 0.58, z + bz * 0.36 + dz * 0.64];
    const tip = [x + bx, height, z + bz];
    for (const point of [a, b, c, b, d, c, c, d, tip]) {
      vertices.push(...point);
      colors.push(
        ...low
          .clone()
          .lerp(high, (point[1] / height) * 0.84)
          .toArray(),
      );
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  softenPlantNormals(geometry, 0.92);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Foliage normals represent light filtered through a leaf bed, not hard upright plastic fins. */
function softenPlantNormals(geometry: THREE.BufferGeometry, upward: number) {
  const normals = geometry.attributes.normal,
    normal = new THREE.Vector3();
  for (let i = 0; i < normals.count; i++) {
    normal
      .set(
        normals.getX(i) * (1 - upward),
        Math.abs(normals.getY(i)) * (1 - upward) + upward,
        normals.getZ(i) * (1 - upward),
      )
      .normalize();
    normals.setXYZ(i, normal.x, normal.y, normal.z);
  }
}

export function applyPlantWind(
  material: THREE.MeshStandardMaterial,
  wind: { value: number },
  strength: number,
  roots: number,
) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.plantWindTime = wind;
    shader.vertexShader = 'uniform float plantWindTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vec3 plantBase = instanceMatrix[3].xyz;
      float plantHeight = max(0.0, position.y - ${roots.toFixed(2)});
      float plantSway = sin(plantWindTime * .8 + plantBase.x * .13 + plantBase.z * .18);
      plantSway += sin(plantWindTime * 1.7 + position.x * 3. + plantBase.z * .27) * .23;
      transformed.x += plantSway * plantHeight * ${strength.toFixed(3)};
      transformed.z += plantSway * plantHeight * ${(strength * 0.38).toFixed(3)};
    `,
    );
    // Three normally reverses the back face of a two-sided leaf. Preserve the upward
    // light-collecting normal so backlit grass remains green instead of nearly black.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_begin>',
      `#include <normal_fragment_begin>
      #ifdef DOUBLE_SIDED
        normal *= faceDirection;
      #endif
    `,
    );
  };
  material.customProgramCacheKey = () => `meadow-plant-${strength}-${roots}`;
}
