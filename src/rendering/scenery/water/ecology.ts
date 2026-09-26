import * as THREE from 'three';
import { getRegionLake, getTerrainHeight, getWorldTrees, lakeDistance } from '../../../game/world';
import type { SceneryKit } from '../kit';

/** Coastal silhouettes and wildlife belong to the water chunk, not the shared world renderer. */
export function buildWaterEcology(kit: SceneryKit): void {
  const { staticRoot, material, add, ball, cylinder, cone, animate } = kit;
  const lake = getRegionLake('water');
  const bark = material('#967052');
  const frond = material('#4d9174', { side: THREE.DoubleSide });
  const tips = material('#8db68b', { side: THREE.DoubleSide });
  const reed = material('#849e6b');
  const shell = material('#f8dfc4');
  const seabird = material('#fff8e7');
  const wingtip = material('#506879');
  const amber = material('#ebae63');
  const fishBlue = material('#58a5af', { metalness: 0.24, roughness: 0.4 });
  const anchor = (name: string, x: number, z: number) => {
    const group = new THREE.Group();
    group.name = name;
    group.position.set(x, getTerrainHeight(x, z, 'water'), z);
    staticRoot.add(group);
    return group;
  };
  const leafGeometry = new THREE.BufferGeometry();
  leafGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [
        0, 0, 0, -0.22, 0.12, 0.35, 0.22, 0.12, 0.35, -0.22, 0.12, 0.35, -0.17, 0.04, 0.68, 0.22,
        0.12, 0.35, 0.22, 0.12, 0.35, -0.17, 0.04, 0.68, 0.17, 0.04, 0.68, -0.17, 0.04, 0.68, 0,
        -0.26, 1, 0.17, 0.04, 0.68,
      ],
      3,
    ),
  );
  leafGeometry.computeVertexNormals();
  for (const [index, tree] of getWorldTrees('water').entries()) {
    const palm = anchor(`water-coastal-tree-${index}`, tree.x, tree.z);
    palm.rotation.y = tree.rotation;
    palm.scale.setScalar(tree.size);
    const height = tree.variant === 0 ? 7 : 4.8;
    // The base stays on the shared collision anchor; only the upper trunk leans toward the sea.
    for (let section = 0; section < 4; section++) {
      const trunk = cylinder(
        palm,
        bark,
        section * 0.09,
        ((section + 0.5) * height) / 4,
        0,
        0.17 + (3 - section) * 0.016,
        0.21 + (3 - section) * 0.02,
        height / 4 + 0.1,
        7,
      );
      trunk.rotation.z = -0.05;
    }
    const count = tree.variant === 0 ? 9 : 13;
    for (let i = 0; i < count; i++) {
      const leaf = add(
        palm,
        leafGeometry,
        i % 3 ? frond : tips,
        0.3,
        height,
        0,
        tree.variant === 0 ? 2.2 : 3.6,
        tree.variant === 0 ? 3.1 : 4.5,
        tree.variant === 0 ? 3.7 : 2.9,
      );
      leaf.rotation.y = (i * Math.PI * 2) / count;
      leaf.rotation.x = tree.variant === 0 ? 0.05 : 0.36;
    }
    if (tree.variant === 0)
      for (let i = 0; i < 3; i++)
        ball(
          palm,
          bark,
          0.3 + Math.cos(i * 2.1) * 0.32,
          height - 0.2,
          Math.sin(i * 2.1) * 0.32,
          0.24,
          0.32,
          0.24,
        );
  }

  // Follow the actual irregular coast so reeds and shells never end up in the middle of the bay.
  for (let i = 0; i < 31; i++) {
    const angle = Math.PI * (0.54 + (i / 30) * 0.94);
    let x = lake.x,
      z = lake.z;
    for (let radius = 0.8; radius < 1.3; radius += 0.01) {
      x = lake.x + Math.cos(angle) * lake.radiusX * radius;
      z = lake.z + Math.sin(angle) * lake.radiusZ * radius;
      if (lakeDistance(x, z, 'water') > 1.075) break;
    }
    const shore = anchor(`water-shore-cluster-${i}`, x, z);
    if (i % 3 === 0) {
      for (let stem = 0; stem < 6; stem++) {
        const h = 0.65 + (stem % 3) * 0.3;
        const stalk = cylinder(
          shore,
          reed,
          Math.cos(stem * 2.4) * 0.4,
          h / 2,
          Math.sin(stem * 2.4) * 0.4,
          0.022,
          0.044,
          h,
          4,
        );
        stalk.rotation.z = Math.sin(stem) * 0.14;
        const blade = add(
          shore,
          leafGeometry,
          tips,
          stalk.position.x,
          h * 0.36,
          stalk.position.z,
          0.3,
          1,
          1.1,
        );
        blade.rotation.y = stem * 2.4;
        blade.rotation.x = -0.85;
      }
    } else {
      const conch = cone(shore, shell, 0, 0.15, 0, 0.26, 0.55, 7);
      conch.rotation.z = Math.PI * 0.4;
      ball(shore, shell, -0.2, 0.12, 0, 0.26, 0.14, 0.3);
      ball(shore, amber, -0.31, 0.1, 0.07, 0.12, 0.07, 0.17);
    }
  }

  const wingGeometry = new THREE.BufferGeometry();
  wingGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [0, 0, 0.18, 0, 0, -0.24, 0.74, 0.06, -0.3, 0, 0, 0.18, 0.74, 0.06, -0.3, 1.3, -0.04, -0.58],
      3,
    ),
  );
  wingGeometry.computeVertexNormals();
  seabird.side = wingtip.side = THREE.DoubleSide;
  for (let i = 0; i < 6; i++) {
    const gull = new THREE.Group();
    gull.name = `water-gull-${i}`;
    staticRoot.add(gull);
    ball(gull, seabird, 0, 0, 0, 0.18, 0.17, 0.49);
    ball(gull, seabird, 0, 0.14, 0.4, 0.16, 0.17, 0.2);
    const beak = cone(gull, amber, 0, 0.12, 0.65, 0.08, 0.26, 5);
    beak.rotation.x = Math.PI / 2;
    const left = add(gull, wingGeometry, seabird, 0.1, 0.07, 0);
    const right = add(gull, wingGeometry, seabird, -0.1, 0.07, 0, -1, 1, 1);
    const tail = add(gull, leafGeometry, wingtip, 0, 0, -0.25, 1, 0.4, 0.55);
    tail.rotation.y = Math.PI;
    animate(gull, (time) => {
      const angle = time * (0.11 + i * 0.004) + i * 1.7;
      gull.position.set(
        6 + Math.cos(angle) * (17 + i * 1.1),
        13 + i * 1.8 + Math.sin(angle * 2) * 1.2,
        5 + Math.sin(angle) * (24 + i),
      );
      gull.rotation.set(-0.04, -angle, -0.13);
      const flap = Math.sin(time * 4.2 + i) * (Math.sin(time * 0.6 + i) > 0.3 ? 0.24 : 0.035);
      left.rotation.z = flap;
      right.rotation.z = -flap;
    });
  }

  // Two instanced draws animate three schools; adding fish does not multiply draw calls.
  const bodyGeometry = new THREE.SphereGeometry(1, 8, 6);
  bodyGeometry.scale(0.17, 0.14, 0.45);
  const tailGeometry = new THREE.ConeGeometry(0.23, 0.36, 3);
  tailGeometry.rotateX(Math.PI / 2);
  tailGeometry.scale(1, 0.32, 1);
  tailGeometry.translate(0, 0, -0.48);
  const bodies = new THREE.InstancedMesh(bodyGeometry, fishBlue, 24);
  const tails = new THREE.InstancedMesh(tailGeometry, amber, 24);
  bodies.name = 'water-fish-school-bodies';
  tails.name = 'water-fish-school-tails';
  // Register shared geometries with the kit's ownership/disposal scope.
  add(staticRoot, bodyGeometry, fishBlue).removeFromParent();
  add(staticRoot, tailGeometry, amber).removeFromParent();
  bodies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  tails.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  bodies.frustumCulled = tails.frustumCulled = false;
  const shoals = new THREE.Group();
  shoals.name = 'water-fish-schools';
  shoals.add(bodies, tails);
  staticRoot.add(shoals);
  const dummy = new THREE.Object3D();
  animate(shoals, (time) => {
    for (let i = 0; i < 24; i++) {
      const school = Math.floor(i / 8),
        offset = i % 8;
      const angle = time * 0.23 + school * 2.1;
      const centerX = lake.x - lake.radiusX * (0.66 - school * 0.18);
      const centerZ = lake.z + (school - 1) * 11;
      const x = centerX + Math.cos(angle) * 3.6 + Math.cos(offset * 2.4) * 1.2;
      const z = centerZ + Math.sin(angle) * 4.3 + Math.sin(offset * 2.4) * 1.1;
      const cycle = ((time + school * 5 + offset * 0.1) % 17) / 17;
      const leap = cycle < 0.1 ? Math.sin((cycle * Math.PI) / 0.1) * 0.95 : 0;
      dummy.position.set(x, lake.waterLevel - 0.16 + leap, z);
      dummy.rotation.set(
        leap ? Math.cos((cycle * Math.PI) / 0.1) * 0.5 : 0,
        -angle,
        Math.sin(time * 9 + i) * 0.05,
      );
      dummy.scale.setScalar(0.7 + (offset % 3) * 0.13);
      dummy.updateMatrix();
      bodies.setMatrixAt(i, dummy.matrix);
      tails.setMatrixAt(i, dummy.matrix);
    }
    bodies.instanceMatrix.needsUpdate = tails.instanceMatrix.needsUpdate = true;
  });
}
