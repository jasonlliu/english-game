import * as THREE from 'three';
import { DAILY_DISCOVERY_POSITIONS, DISCOVERY_SITES } from '../../game/discovery';
import { REGION_PLACES, REGION_VOLUMES, distanceToVolume } from '../../game/landmarks';
import {
  CRYSTAL_POSITIONS,
  SPAWN_POSITION,
  getTerrainHeight,
  getWorldObstacles,
  isWalkable,
  lakeDistance,
} from '../../game/world';
import type { WorldRenderContext } from './context';
import { createStratifiedCliff } from './rockGeometry';
import {
  applyPlantWind,
  createBranchedTrunk,
  createGrassTuft,
  createLeafCrown,
} from './meadowPlants';

const clearings = [
  ...Object.values(DISCOVERY_SITES).map((site) => site.position),
  ...DAILY_DISCOVERY_POSITIONS,
  ...CRYSTAL_POSITIONS,
];
const obstacles = getWorldObstacles('meadow');

/** High foliage frames paths; all clue props, viewpoints and arrival remain readable. */
export function canPlaceMeadowShrub(
  x: number,
  z: number,
  distanceToTrail: (x: number, z: number) => number,
) {
  if (
    Math.abs(x) > 103 ||
    Math.abs(z) > 103 ||
    distanceToTrail(x, z) < 3.55 ||
    !isWalkable(x, z, 1.5, 'meadow')
  )
    return false;
  if (
    Math.hypot(x - SPAWN_POSITION.x, z - SPAWN_POSITION.z) < 8.5 ||
    (Math.abs(x) < 8 && z > 20 && z < 43)
  )
    return false;
  if (clearings.some((point) => Math.hypot(x - point.x, z - point.z) < 4.2)) return false;
  for (const place of REGION_PLACES.meadow) {
    if (Math.hypot(x - place.x, z - place.z) < 5.5) return false;
    if (!place.lookAt) continue;
    const dx = place.lookAt.x - place.x,
      dz = place.lookAt.z - place.z,
      length = Math.hypot(dx, dz);
    const along = ((x - place.x) * dx + (z - place.z) * dz) / length;
    const across = Math.abs((x - place.x) * dz - (z - place.z) * dx) / length;
    if (along > -14 && along < length + 2 && across < 3.1) return false;
  }
  return true;
}

export function createMeadowVegetation(context: WorldRenderContext) {
  const {
    scene,
    WORLD_TREES,
    keep,
    mat,
    random,
    matrixDummy,
    distanceToTrail,
    mesh,
    pebbleGeometry,
    stoneDark,
  } = context;
  const wind = { value: 0 };
  const foliage = mat('#ffffff', {
    vertexColors: true,
    side: THREE.DoubleSide,
    roughness: 0.94,
    emissive: '#609240',
    emissiveIntensity: 0.045,
  });
  const shrubMaterial = mat('#ffffff', {
    vertexColors: true,
    side: THREE.DoubleSide,
    roughness: 0.96,
    emissive: '#6c9b42',
    emissiveIntensity: 0.07,
  });
  const grassMaterial = mat('#ffffff', {
    vertexColors: true,
    side: THREE.DoubleSide,
    roughness: 1,
    emissive: '#4b8b30',
    emissiveIntensity: 0.1,
  });
  applyPlantWind(foliage, wind, 0.025, 3.1);
  applyPlantWind(shrubMaterial, wind, 0.035, 0);
  applyPlantWind(grassMaterial, wind, 0.11, 0);
  const bark = mat('#777058', { roughness: 0.97 });
  const tint = new THREE.Color();
  const instance = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    capacity: number,
    name: string,
    shadow = true,
  ) => {
    const result = new THREE.InstancedMesh(geometry, material, capacity);
    result.name = name;
    result.castShadow = shadow;
    result.receiveShadow = true;
    scene.add(result);
    return result;
  };
  const tiers: Array<{
    near: THREE.InstancedMesh;
    far: THREE.InstancedMesh;
    distance: number;
    limit: number;
    matrices?: Float32Array;
    colors?: Float32Array;
  }> = [];
  const tiered = (
    nearGeometry: THREE.BufferGeometry,
    farGeometry: THREE.BufferGeometry,
    material: THREE.Material,
    capacity: number,
    name: string,
    distance: number,
    limit = Infinity,
    shadow = true,
  ) => {
    const near = instance(nearGeometry, material, capacity, name, shadow);
    const far = instance(
      farGeometry,
      material,
      capacity,
      `${name}-distant`,
      shadow && distance > 25,
    );
    tiers.push({ near, far, distance, limit });
    return near;
  };
  const set = (
    target: THREE.InstancedMesh,
    index: number,
    x: number,
    z: number,
    sx: number,
    sy = sx,
    sz = sx,
    rotation = random() * Math.PI * 2,
  ) => {
    matrixDummy.position.set(x, getTerrainHeight(x, z) - 0.015, z);
    matrixDummy.rotation.set(0, rotation, 0);
    matrixDummy.scale.set(sx, sy, sz);
    matrixDummy.updateMatrix();
    target.setMatrixAt(index, matrixDummy.matrix);
  };
  const regionCrowns: THREE.BufferGeometry[] = [];
  for (let variant = 0; variant < 2; variant++) {
    const trees = WORLD_TREES.filter((tree) => tree.variant === variant);
    const crownGeometry = keep(createLeafCrown(false, variant));
    regionCrowns.push(crownGeometry);
    const crowns = tiered(
      crownGeometry,
      keep(createLeafCrown(false, variant, true)),
      foliage,
      trees.length,
      `meadow-tree-crowns-${variant}`,
      30,
    );
    const trunks = tiered(
      keep(createBranchedTrunk(variant)),
      keep(createBranchedTrunk(variant, true)),
      bark,
      trees.length,
      `meadow-tree-branches-${variant}`,
      30,
    );
    trees.forEach((tree, index) => {
      set(crowns, index, tree.x, tree.z, tree.size, tree.size, tree.size, tree.rotation);
      set(trunks, index, tree.x, tree.z, tree.size, tree.size, tree.size, tree.rotation);
      crowns.setColorAt(
        index,
        tint.setHSL(0.17 + random() * 0.05, 0.09 + random() * 0.14, 0.82 + random() * 0.15),
      );
    });
  }

  const shrubs = tiered(
    keep(createLeafCrown(true)),
    keep(createLeafCrown(true, 0, true)),
    shrubMaterial,
    440,
    'meadow-shrub-thickets',
    24,
  );
  const anchors: Array<[number, number]> = [
    [-12, 14],
    [-14, 31],
    [10, 36],
    [17, 12],
    [-12, -3],
    [-31, -7],
    [16, -17],
  ];
  for (let i = 0; i < 160; i++) anchors.push([(random() - 0.5) * 202, (random() - 0.5) * 202]);
  let shrubCount = 0;
  for (const [cx, cz] of anchors) {
    const angle = random() * Math.PI * 2;
    for (let j = 0; j < 5 && shrubCount < 440; j++) {
      const along = (j - 2) * 1.18;
      const x = cx + Math.cos(angle) * along + (random() - 0.5) * 0.5;
      const z = cz + Math.sin(angle) * along + (random() - 0.5) * 0.5;
      if (!canPlaceMeadowShrub(x, z, distanceToTrail)) continue;
      const height = shrubCount % 19 === 0 ? 2.3 : 1.1 + random() * 0.9;
      set(shrubs, shrubCount, x, z, 0.94 + random() * 0.35, height, 0.85 + random() * 0.38);
      shrubs.setColorAt(
        shrubCount++,
        tint.setHSL(0.17 + random() * 0.05, 0.12, 0.83 + random() * 0.14),
      );
    }
  }
  shrubs.count = shrubCount;

  const grass = tiered(
    keep(createGrassTuft()),
    keep(createGrassTuft(3)),
    grassMaterial,
    17000,
    'meadow-grass-beds',
    28,
    65,
    false,
  );
  const grassAnchors: Array<[number, number, number]> = [
    [-10, 15, 9],
    [10, 21, 9],
    [-10, 34, 8],
    [8, 38, 9],
    [18, 8, 7],
    [-20, -9, 10],
  ];
  for (const [x, z] of anchors) grassAnchors.push([x, z, 4 + random() * 7]);
  const groundFree = (x: number, z: number) =>
    Math.abs(x) < 106 &&
    Math.abs(z) < 106 &&
    lakeDistance(x, z) > 1.2 &&
    !REGION_VOLUMES.meadow.some(
      (volume) => (volume.minY ?? 0) < 2.6 && distanceToVolume(x, z, volume) < 0.6,
    ) &&
    !obstacles.some(
      (obstacle) => Math.hypot(x - obstacle.x, z - obstacle.z) < obstacle.radius + 0.3,
    );
  let grassCount = 0;
  for (const [cx, cz, radius] of grassAnchors) {
    for (let i = 0; i < 145 && grassCount < 17000; i++) {
      const angle = random() * Math.PI * 2,
        r = Math.sqrt(random()) * radius;
      const x = cx + Math.cos(angle) * r,
        z = cz + Math.sin(angle) * r;
      const road = distanceToTrail(x, z);
      if (
        road < 2.05 ||
        !groundFree(x, z) ||
        clearings.some((point) => Math.hypot(x - point.x, z - point.z) < 1.3)
      )
        continue;
      const bed = 0.5 + 0.5 * Math.sin(x * 0.13 + Math.cos(z * 0.1));
      const height = Math.min(1.18, 0.38 + bed * 0.5 + random() * 0.3) * (road < 3 ? 0.63 : 1);
      set(grass, grassCount, x, z, 0.8 + random() * 0.4, height, 0.8 + random() * 0.4);
      grass.setColorAt(grassCount++, tint.setHSL(0.16 + bed * 0.05, 0.12, 0.84 + random() * 0.13));
    }
  }
  grass.count = grassCount;

  // Sparse blossoms sit within grass beds, with only the flower garden gathering a larger patch.
  const blossom = keep(new THREE.IcosahedronGeometry(0.08, 0));
  blossom.scale(1, 0.43, 1);
  blossom.translate(0, 0.32, 0);
  const flowers = instance(blossom, mat('#fff1cd'), 330, 'meadow-wildflowers', false);
  let flowerCount = 0;
  const flowerCenters = [
    [-11, 15],
    [13, 32],
    [-70, 42],
    [67, 53],
    [78, 49],
    [64, 63],
  ];
  for (let i = 0; i < 500 && flowerCount < 330; i++) {
    const [cx, cz] = flowerCenters[i % flowerCenters.length],
      angle = random() * Math.PI * 2,
      radius = Math.sqrt(random()) * 5;
    const x = cx + Math.cos(angle) * radius,
      z = cz + Math.sin(angle) * radius;
    if (distanceToTrail(x, z) < 2 || !groundFree(x, z)) continue;
    set(flowers, flowerCount, x, z, 0.7 + random() * 0.7);
    flowers.setColorAt(flowerCount++, tint.set(i % 4 ? '#f3dfad' : '#c1b8dd'));
  }
  flowers.count = flowerCount;
  const rocks = instance(pebbleGeometry, stoneDark, 260, 'meadow-ground-stones');
  for (let i = 0; i < rocks.count; i++) {
    const x = (random() - 0.5) * 210,
      z = (random() - 0.5) * 210;
    const size = distanceToTrail(x, z) < 2 ? 0.05 : 0.2 + random() * 0.55;
    set(rocks, i, x, z, size * 1.5, size * 0.65, size);
  }
  const cliffGeometry = keep(createStratifiedCliff());
  const cliffMaterial = mat('#ffffff', { vertexColors: true, roughness: 1 });
  for (const [x, z, size] of [
    [-57, -28, 8],
    [-60, -45, 10],
    [47, -39, 7],
  ]) {
    mesh(
      cliffGeometry,
      cliffMaterial,
      scene,
      [x, getTerrainHeight(x, z) + size * 1.24, z],
      [size, size * 2.48, size * 0.83],
    );
  }
  const lastPosition = new THREE.Vector2(Infinity, Infinity);
  const update = (position: { x: number; z: number }) => {
    if (!scene.children.length || !Number.isFinite(position.x) || !Number.isFinite(position.z))
      return;
    if (Math.hypot(position.x - lastPosition.x, position.z - lastPosition.y) < 3) return;
    lastPosition.set(position.x, position.z);
    for (const tier of tiers) {
      if (!tier.matrices) {
        tier.matrices = new Float32Array(
          tier.near.instanceMatrix.array.slice(0, tier.near.count * 16),
        );
        if (tier.near.instanceColor)
          tier.colors = new Float32Array(
            tier.near.instanceColor.array.slice(0, tier.near.count * 3),
          );
        tier.near.userData.totalPlants = tier.near.count;
      }
      let nearCount = 0,
        farCount = 0;
      const count = tier.matrices.length / 16;
      for (let i = 0; i < count; i++) {
        const offset = i * 16;
        const dx = tier.matrices[offset + 12] - position.x,
          dz = tier.matrices[offset + 14] - position.z;
        const distanceSquared = dx * dx + dz * dz;
        if (distanceSquared > tier.limit * tier.limit) continue;
        const close = distanceSquared < tier.distance * tier.distance;
        const target = close ? tier.near : tier.far;
        const index = close ? nearCount++ : farCount++;
        target.instanceMatrix.array.set(tier.matrices.subarray(offset, offset + 16), index * 16);
        if (tier.colors) {
          tint.fromArray(tier.colors, i * 3);
          target.setColorAt(index, tint);
        }
      }
      tier.near.count = nearCount;
      tier.far.count = farCount;
      for (const target of [tier.near, tier.far]) {
        target.instanceMatrix.needsUpdate = true;
        if (target.instanceColor) target.instanceColor.needsUpdate = true;
        const radius =
          target === tier.near
            ? tier.distance + 22
            : Number.isFinite(tier.limit)
              ? tier.limit + 22
              : 330;
        target.boundingSphere ??= new THREE.Sphere();
        target.boundingSphere.set(new THREE.Vector3(position.x, 12, position.z), radius);
      }
    }
  };
  update(SPAWN_POSITION);
  return { wind, regionCrowns, update };
}
