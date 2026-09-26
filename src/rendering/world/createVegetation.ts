import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getTerrainHeight, lakeDistance } from '../../game/world';
import type { WorldRenderContext } from './context';
export function createVegetation(context: WorldRenderContext) {
  const {
    region,
    theme,
    scene,
    WORLD_TREES,
    distanceToTrail,
    keep,
    mat,
    random,
    mesh,
    pebbleGeometry,
    stoneDark,
    moss,
    matrixDummy,
  } = context;
  // Smooth, varied silhouettes: merged leafy crowns and layered, curved firs.
  const merge = (parts: THREE.BufferGeometry[]) => {
    const geometry = mergeGeometries(parts, false)!;
    parts.forEach((part) => part.dispose());
    return keep(geometry);
  };
  const leafyParts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const geometry = new THREE.SphereGeometry(1, 16, 12);
    const leafVertices = geometry.attributes.position;
    for (let j = 0; j < leafVertices.count; j++) {
      const x = leafVertices.getX(j),
        y = leafVertices.getY(j),
        z = leafVertices.getZ(j);
      const noise =
        1 + Math.sin(x * 7.1 + i) * Math.cos(y * 5.8 - i) * Math.sin(z * 6.6 + 2) * 0.13;
      leafVertices.setXYZ(j, x * noise, y * noise, z * noise);
    }
    geometry.computeVertexNormals();
    const angle = i * 2.4;
    geometry.scale(i === 0 ? 1.65 : 1.1 + (i % 3) * 0.12, 1.0 + (i % 2) * 0.4, 1.2);
    geometry.translate(
      i === 0 ? 0 : Math.cos(angle) * 1.1,
      4.3 + Math.sin(i * 1.3) * 0.72,
      i === 0 ? 0 : Math.sin(angle) * 1.1,
    );
    leafyParts.push(geometry);
  }
  const broadleafGeometry = merge(leafyParts);
  const pinePoints: THREE.Vector2[] = [];
  for (let i = 0; i <= 22; i++) {
    const t = i / 22;
    const radius = (1 - t) * (1.55 + Math.sin(t * Math.PI * 9) * 0.24);
    pinePoints.push(new THREE.Vector2(Math.max(0.015, radius), 1.65 + t * 5.7));
  }
  const pineGeometry = keep(new THREE.LatheGeometry(pinePoints, 10));
  const branchPart = (
    from: THREE.Vector3,
    to: THREE.Vector3,
    baseRadius: number,
    tipRadius: number,
  ) => {
    const direction = to.clone().sub(from);
    const geometry = new THREE.CylinderGeometry(tipRadius, baseRadius, direction.length(), 7);
    geometry.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()),
    );
    geometry.translate((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
    return geometry;
  };
  const regionCrowns: THREE.BufferGeometry[] = [pineGeometry, broadleafGeometry];
  if (region === 'water' || region === 'fire') {
    for (let variant = 0; variant < 2; variant++) {
      if (region === 'fire' && variant === 0) {
        regionCrowns[variant] = pineGeometry;
        continue;
      }
      const branches: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 7; i++) {
        const angle = i * 2.39 + variant;
        const start = new THREE.Vector3(0, 2.8 + (i % 3) * 0.48, 0);
        const elbow = new THREE.Vector3(
          Math.cos(angle) * (1.1 + (i % 2) * 0.4),
          4.1 + (i % 3) * 0.42,
          Math.sin(angle) * (1.1 + (i % 2) * 0.4),
        );
        const tip = elbow
          .clone()
          .add(
            new THREE.Vector3(
              Math.cos(angle) * 0.17,
              region === 'water' ? 1.12 : 0.48,
              Math.sin(angle) * 0.17,
            ),
          );
        branches.push(branchPart(start, elbow, 0.16, 0.09), branchPart(elbow, tip, 0.09, 0.035));
        if (region === 'water') {
          const bulb = new THREE.SphereGeometry(0.2, 8, 6);
          bulb.scale(1, 1.5, 1);
          bulb.translate(tip.x, tip.y, tip.z);
          branches.push(bulb);
        }
      }
      regionCrowns[variant] = merge(branches);
    }
  } else if (region === 'earth') {
    for (let variant = 0; variant < 2; variant++) {
      const rings: THREE.Vector2[] = [];
      for (let i = 0; i < 20; i++) {
        const height = 1.1 + i * 0.29;
        const radius =
          (height < 2.7 ? 0.27 : 0.57) +
          Math.sin(i * 1.2 + variant) * (height < 2.7 ? 0.025 : 0.11) +
          (i > 13 ? Math.sin(((i - 13) / 6) * Math.PI) * 0.75 : 0);
        rings.push(new THREE.Vector2(radius, height));
      }
      rings.push(new THREE.Vector2(0, 6.8));
      regionCrowns[variant] = keep(new THREE.LatheGeometry(rings, 9));
    }
  } else if (region === 'steel') {
    for (let variant = 0; variant < 2; variant++) {
      const panels: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 4; i++) {
        const panel = new THREE.BoxGeometry(2.25 - i * 0.28, 0.14, 1.18 - i * 0.11);
        panel.rotateY(i * 0.8 + variant);
        panel.translate(0, 3.3 + i * 0.7, 0);
        panels.push(panel);
        const collar = new THREE.TorusGeometry(0.47 + i * 0.06, 0.09, 5, 12);
        collar.rotateX(Math.PI / 2);
        collar.translate(0, 3.15 + i * 0.7, 0);
        panels.push(collar);
      }
      regionCrowns[variant] = merge(panels);
    }
  } else if (region === 'fairy') {
    regionCrowns[0] = keep(
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0, 4.0),
          new THREE.Vector2(0.8, 3.92),
          new THREE.Vector2(1.8, 3.99),
          new THREE.Vector2(2.35, 4.22),
          new THREE.Vector2(2.3, 4.47),
          new THREE.Vector2(1.94, 4.82),
          new THREE.Vector2(1.43, 5.22),
          new THREE.Vector2(0.7, 5.58),
          new THREE.Vector2(0, 5.72),
        ],
        20,
      ),
    );
  }
  const trunkGeometry = keep(new THREE.CylinderGeometry(0.16, 0.34, 4.9, 7));
  trunkGeometry.translate(0, 2.45, 0);
  const treeMaterial = mat('#ffffff', {
    roughness: region === 'steel' ? 0.35 : 0.92,
    metalness: region === 'steel' ? 0.75 : 0,
  });
  const trunkMaterial = mat(theme.trunk, {
    metalness: region === 'steel' ? 0.68 : 0,
    roughness: region === 'steel' ? 0.35 : 0.9,
  });
  const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, WORLD_TREES.length);
  trunks.castShadow = true;
  trunks.receiveShadow = true;
  WORLD_TREES.forEach((tree, index) => {
    matrixDummy.position.set(tree.x, getTerrainHeight(tree.x, tree.z) - 0.05, tree.z);
    matrixDummy.rotation.set(0, tree.rotation, Math.sin(index) * 0.025);
    matrixDummy.scale.setScalar(tree.size);
    matrixDummy.updateMatrix();
    trunks.setMatrixAt(index, matrixDummy.matrix);
  });
  scene.add(trunks);
  for (const variant of [0, 1]) {
    const trees = WORLD_TREES.filter((tree) => tree.variant === variant);
    const crowns = new THREE.InstancedMesh(regionCrowns[variant], treeMaterial, trees.length);
    crowns.castShadow = true;
    crowns.receiveShadow = true;
    trees.forEach((tree, index) => {
      matrixDummy.position.set(tree.x, getTerrainHeight(tree.x, tree.z), tree.z);
      matrixDummy.rotation.set(0, tree.rotation, Math.sin(index) * 0.025);
      matrixDummy.scale.setScalar(tree.size);
      matrixDummy.updateMatrix();
      crowns.setMatrixAt(index, matrixDummy.matrix);
      crowns.setColorAt(
        index,
        region === 'fire' && variant === 0
          ? new THREE.Color('#cbd8d8').lerp(new THREE.Color('#708e92'), random() * 0.33)
          : new THREE.Color(theme.foliage[variant]).lerp(
              new THREE.Color(theme.foliage[2]),
              random() * 0.32,
            ),
      );
    });
    scene.add(crowns);
  }
  // Instancing keeps thousands of grass blades, blossoms, and stones inexpensive.
  const grassVertices: number[] = [];
  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI) / 3,
      dx = Math.cos(angle) * 0.018,
      dz = Math.sin(angle) * 0.018;
    const bendX = Math.sin(angle + 0.7) * 0.065,
      bendZ = Math.cos(angle + 0.7) * 0.065;
    const midY = 0.2 + i * 0.025,
      tipY = 0.34 + i * 0.025;
    grassVertices.push(-dx, 0, -dz, dx, 0, dz, bendX + dx * 0.7, midY, bendZ + dz * 0.7);
    grassVertices.push(
      -dx,
      0,
      -dz,
      bendX + dx * 0.7,
      midY,
      bendZ + dz * 0.7,
      bendX - dx * 0.7,
      midY,
      bendZ - dz * 0.7,
    );
    grassVertices.push(
      bendX - dx * 0.7,
      midY,
      bendZ - dz * 0.7,
      bendX + dx * 0.7,
      midY,
      bendZ + dz * 0.7,
      bendX * 1.8,
      tipY,
      bendZ * 1.8,
    );
  }
  const grassGeometry = keep(new THREE.BufferGeometry());
  grassGeometry.setAttribute('position', new THREE.Float32BufferAttribute(grassVertices, 3));
  grassGeometry.computeVertexNormals();
  const grassMaterial = mat('#ffffff', { side: THREE.DoubleSide, roughness: 1 });
  const wind = { value: 0 };
  grassMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.windTime = wind;
    shader.vertexShader = 'uniform float windTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n transformed.x += sin(windTime*1.3+instanceMatrix[3].x*.25+instanceMatrix[3].z*.18)*position.y*position.y*.24;',
    );
  };
  const grassLimit = region === 'meadow' ? 24000 : 14000;
  const scatterSize = region === 'meadow' ? 215 : 140;
  const grassInstances = new THREE.InstancedMesh(grassGeometry, grassMaterial, grassLimit);
  grassInstances.receiveShadow = true;
  let grassCount = 0;
  for (
    let i = 0;
    i < (region === 'meadow' ? grassLimit * 1.5 : 20000) && grassCount < grassLimit;
    i++
  ) {
    const x = (random() - 0.5) * scatterSize,
      z = (random() - 0.5) * scatterSize;
    if (lakeDistance(x, z) < 1.19 || distanceToTrail(x, z) < 1.9 || Math.hypot(x + 8, z + 26) < 5.1)
      continue;
    matrixDummy.position.set(x, getTerrainHeight(x, z) + 0.025, z);
    matrixDummy.rotation.set(0, random() * 6.28, 0);
    matrixDummy.scale.setScalar(0.68 + random() * 1.15);
    matrixDummy.updateMatrix();
    grassInstances.setMatrixAt(grassCount, matrixDummy.matrix);
    grassInstances.setColorAt(
      grassCount++,
      new THREE.Color(theme.grass[0]).lerp(new THREE.Color(theme.grass[1]), random() * 0.65),
    );
  }
  grassInstances.count = Math.min(
    grassCount,
    region === 'steel' ? 3800 : region === 'fire' ? 4800 : region === 'earth' ? 8000 : grassCount,
  );
  scene.add(grassInstances);
  const flowerParts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const petal = new THREE.SphereGeometry(0.09, 5, 4);
    petal.scale(1, 0.4, 1.45);
    petal.rotateY(i * Math.PI * 0.4);
    petal.translate(Math.sin(i * Math.PI * 0.4) * 0.105, 0.31, Math.cos(i * Math.PI * 0.4) * 0.105);
    flowerParts.push(petal);
  }
  const originalFlowerGeometry = merge(flowerParts);
  let flowerGeometry: THREE.BufferGeometry = originalFlowerGeometry;
  if (region === 'water') {
    const shellVertices: number[] = [0, 0.08, 0],
      shellIndices: number[] = [];
    for (let i = 0; i <= 12; i++) {
      const angle = -Math.PI * 0.48 + (i / 12) * Math.PI * 0.96;
      shellVertices.push(
        Math.sin(angle) * 0.29,
        0.08 + (i % 2 ? 0.07 : 0.03),
        Math.cos(angle) * 0.32,
      );
      if (i < 12) shellIndices.push(0, i + 2, i + 1);
    }
    flowerGeometry = keep(new THREE.BufferGeometry());
    flowerGeometry.setAttribute('position', new THREE.Float32BufferAttribute(shellVertices, 3));
    flowerGeometry.setIndex(shellIndices);
    flowerGeometry.computeVertexNormals();
  } else if (region === 'fire' || region === 'earth') {
    flowerGeometry = keep(new THREE.OctahedronGeometry(0.2, 0));
    flowerGeometry.scale(0.85, region === 'fire' ? 1.65 : 0.7, 0.85);
    flowerGeometry.translate(0, region === 'fire' ? 0.2 : 0.09, 0);
  } else if (region === 'steel') {
    flowerGeometry = keep(new THREE.TorusGeometry(0.16, 0.04, 4, 8));
    flowerGeometry.rotateX(-Math.PI / 2);
    flowerGeometry.translate(0, 0.08, 0);
  }
  const flowerMaterial = mat('#ffffff', {
    emissive: region === 'fairy' ? '#ba86bf' : '#000000',
    emissiveIntensity: region === 'fairy' ? 0.42 : 0,
    metalness: region === 'steel' ? 0.6 : 0,
  });
  const flowers = new THREE.InstancedMesh(flowerGeometry, flowerMaterial, 1500);
  const flowerCenters = [
    [-5, 25],
    [7, 18],
    [-14, 7],
    [10, 10],
    [-22, -1],
    [19, 12],
    [1, 34],
    [-8, -15],
  ];
  if (region === 'meadow')
    flowerCenters.push(
      [-72, 43],
      [-48, 58],
      [22, 80],
      [62, 48],
      [78, 45],
      [87, 51],
      [66, 64],
      [-14, -76],
      [22, -73],
    );
  let flowerCount = 0;
  const flowerLimit = region === 'meadow' ? 1400 : 650;
  for (
    let i = 0;
    i < (region === 'meadow' ? flowerLimit * 1.25 : 750) && flowerCount < flowerLimit;
    i++
  ) {
    const center = flowerCenters[i % flowerCenters.length];
    const angle = random() * Math.PI * 2,
      radius = Math.sqrt(random()) * 7;
    const x = center[0] + Math.cos(angle) * radius,
      z = center[1] + Math.sin(angle) * radius;
    if (distanceToTrail(x, z) < 1.85 || lakeDistance(x, z) < 1.17) continue;
    matrixDummy.position.set(x, getTerrainHeight(x, z) + 0.04, z);
    matrixDummy.rotation.set(0, random() * 6.28, 0);
    matrixDummy.scale.setScalar(0.32 + random() * 0.5);
    matrixDummy.updateMatrix();
    flowers.setMatrixAt(flowerCount, matrixDummy.matrix);
    flowers.setColorAt(flowerCount++, new THREE.Color(theme.flowers[i % 4]));
  }
  flowers.count = flowerCount;
  scene.add(flowers);
  const rockCount = region === 'meadow' ? 360 : 240;
  const rocks = new THREE.InstancedMesh(pebbleGeometry, stoneDark, rockCount);
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  for (let i = 0; i < rockCount; i++) {
    const x = (random() - 0.5) * (region === 'meadow' ? 210 : 135),
      z = (random() - 0.5) * (region === 'meadow' ? 210 : 135);
    const size = distanceToTrail(x, z) < 2 ? 0.08 : 0.22 + random() * 0.65;
    matrixDummy.position.set(x, getTerrainHeight(x, z) + size * 0.12, z);
    matrixDummy.rotation.set(random(), random(), random());
    matrixDummy.scale.set(size * 1.5, size * 0.75, size);
    matrixDummy.updateMatrix();
    rocks.setMatrixAt(i, matrixDummy.matrix);
  }
  scene.add(rocks);
  for (const [x, z, size] of [
    [-57, -28, 8],
    [-60, -45, 10],
    [47, -39, 7],
  ]) {
    const cliff = mesh(
      pebbleGeometry,
      stoneDark,
      scene,
      [x, getTerrainHeight(x, z) + size * 0.65, z],
      [size, size * 1.7, size * 0.83],
    );
    cliff.rotation.z = 0.1;
    cliff.rotation.y = 0.4;
    mesh(
      pebbleGeometry,
      moss,
      scene,
      [x - size * 0.22, getTerrainHeight(x, z) + size * 1.7, z + size * 0.1],
      [size * 0.59, size * 0.28, size * 0.5],
    );
  }
  return { wind, regionCrowns };
}
