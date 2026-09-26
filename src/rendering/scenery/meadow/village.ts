import * as THREE from 'three';
import type { SceneryKit } from '../kit';

/** Distinct silhouettes stay inside the village's existing navigation volumes. */
export function buildMeadowVillage(kit: SceneryKit) {
  const {
    origin,
    box,
    ball,
    cylinder,
    roof,
    window,
    torus,
    material,
    animate,
    stone,
    plaster,
    wood,
    trim,
    roofMat,
    terracotta,
    white,
    gold,
    leaves,
    warm,
  } = kit;
  const beam = (
    p: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    length: number,
    angle: number,
  ) => {
    const part = box(p, wood, x, y, z, 0.14, length, 0.16);
    part.rotation.z = angle;
  };
  const flowerBox = (p: THREE.Object3D, x: number, y: number, z: number) => {
    box(p, terracotta, x, y, z, 1.1, 0.27, 0.27);
    for (let i = 0; i < 4; i++) {
      ball(p, leaves, x - 0.4 + i * 0.26, y + 0.23, z, 0.19, 0.2, 0.2);
      ball(p, i % 2 ? white : gold, x - 0.4 + i * 0.26, y + 0.4, z, 0.11, 0.1, 0.12);
    }
  };
  const inn = origin(-36, 15);
  box(inn, stone, 0, 0.27, 0, 5.8, 0.65, 4.75);
  box(inn, plaster, -0.62, 2.13, 0, 4.15, 3.75, 4.5);
  box(inn, plaster, 1.94, 1.65, 0, 1.3, 2.8, 4.5);
  roof(inn, roofMat, -0.62, 3.98, 0, 4.6, 2.35, 4.95);
  roof(inn, terracotta, 1.92, 3.08, 0, 1.85, 1.1, 4.95);
  for (const x of [-2.58, -0.6, 1.27, 2.55]) box(inn, wood, x, 2.05, 2.3, 0.18, 3.75, 0.2);
  for (const y of [0.7, 2.65, 3.83]) box(inn, wood, -0.62, y, 2.32, 4.2, 0.17, 0.18);
  for (const side of [-1, 1]) beam(inn, -0.62 + side * 0.8, 4.96, 2.36, 2.5, side * 0.63);
  window(inn, -1.63, 3.22, 2.31, 0.83, 0.78);
  window(inn, 0.38, 3.22, 2.31, 0.83, 0.78);
  box(inn, wood, -0.6, 1.3, 2.36, 1.0, 2.15, 0.15);
  flowerBox(inn, -1.65, 2.57, 2.35);
  flowerBox(inn, 0.4, 2.57, 2.35);
  box(inn, wood, 2.04, 2.19, 2.4, 0.84, 0.85, 0.14);
  torus(inn, gold, 2.04, 2.24, 2.5, 0.25, 0.055);
  ball(inn, warm, 0.35, 1.88, 2.46, 0.15, 0.22, 0.1);

  const shop = origin(-25, 12);
  box(shop, stone, 0, 0.24, 0, 4.7, 0.5, 4.7);
  box(shop, wood, 0, 1.36, -0.57, 4.35, 2.35, 3.2);
  const canopy = kit.add(
    shop,
    new THREE.CylinderGeometry(2.3, 2.3, 4.8, 14, 1, false, -Math.PI / 2, Math.PI),
    roofMat,
    0,
    2.36,
    0,
  );
  canopy.rotation.x = -Math.PI / 2;
  for (let i = 0; i < 7; i++) {
    const stripe = box(
      shop,
      i % 2 ? white : terracotta,
      -1.93 + i * 0.64,
      2.35,
      1.72,
      0.64,
      0.12,
      1.1,
    );
    stripe.rotation.x = 0.14;
    box(shop, i % 2 ? white : terracotta, -1.93 + i * 0.64, 2.18, 2.28, 0.64, 0.25, 0.12);
  }
  box(shop, trim, 0, 0.99, 1.83, 4.15, 1.2, 0.72);
  for (const side of [-1, 1]) {
    box(shop, wood, side * 2.11, 1.5, 2.3, 0.15, 2.65, 0.15);
    cylinder(shop, wood, side * 1.4, 1.82, 1.8, 0.45, 0.38, 0.52, 10);
    for (let i = 0; i < 5; i++)
      ball(
        shop,
        side < 0 ? terracotta : gold,
        side * 1.4 + Math.sin(i * 2.4) * 0.25,
        2.09,
        1.8 + Math.cos(i * 2.4) * 0.23,
        0.14,
        0.16,
        0.14,
      );
  }

  const cottage = origin(-31, 22);
  cylinder(cottage, stone, 0, 0.4, 0, 2.15, 2.4, 0.8, 8);
  cylinder(cottage, plaster, 0, 2.3, 0, 2.05, 2.1, 3.4, 8);
  kit.cone(cottage, terracotta, 0, 5.05, 0, 2.7, 2.25, 8).scale.z = 0.9;
  window(cottage, -0.88, 2.42, 1.95, 0.53, 1.2);
  box(cottage, wood, 0.57, 1.25, 2.03, 1.2, 2.25, 0.12);
  flowerBox(cottage, -0.93, 1.47, 2.15);
  const flag = new THREE.Group();
  flag.name = 'meadow-inn-banner';
  flag.position.set(1.6, 3.9, 2.05);
  inn.add(flag);
  box(flag, terracotta, 0.26, -0.36, 0, 0.52, 0.82, 0.04);
  box(flag, gold, 0.26, -0.42, 0.03, 0.09, 0.52, 0.04);
  animate(flag, (time) => {
    flag.rotation.x = Math.sin(time * 1.6) * 0.16;
  });

  const farm = origin(18, 25);
  box(farm, stone, 0, 0.26, 0, 6.7, 0.62, 5.6);
  box(farm, wood, -0.85, 2.06, 0, 4.5, 3.8, 5.3);
  roof(farm, terracotta, -0.85, 3.94, 0, 4.95, 2.6, 5.85);
  const shed = box(farm, roofMat, 2.25, 3.38, 0, 1.8, 0.18, 5.8);
  shed.rotation.z = -0.27;
  for (const x of [-2.8, -0.85, 1.1, 2.93]) box(farm, trim, x, 1.85, 2.75, 0.12, 3.2, 0.12);
  box(farm, terracotta, -0.85, 1.78, 2.74, 3.24, 3.0, 0.16);
  for (const angle of [-0.79, 0.79]) beam(farm, -0.85, 1.78, 2.86, 4.1, angle);
  window(farm, -0.85, 4.63, 2.74, 0.75, 0.77);
  for (let i = 0; i < 3; i++) box(farm, gold, 2.0, 0.6 + i * 0.62, -1.7 + i * 0.46, 1.25, 0.6, 1.0);
  box(inn, stone, -1.5, 5.25, -1.16, 0.55, 1.9, 0.62);
  const smoke = new THREE.Group();
  smoke.name = 'meadow-chimney-smoke';
  smoke.position.set(-1.5, 6.2, -1.16);
  inn.add(smoke);
  const vapor = material('#e9ddd0', { transparent: true, opacity: 0.3, depthWrite: false });
  for (let i = 0; i < 3; i++) ball(smoke, vapor, 0, 0, 0, 1, 1, 1).castShadow = false;
  animate(smoke, (time) =>
    smoke.children.forEach((puff, i) => {
      const life = (time * 0.22 + i / 3) % 1;
      puff.position.set(life * 1.2, life * 2.2, Math.sin(life * 3) * 0.25);
      puff.scale.setScalar(Math.sin(life * Math.PI) * 0.43);
    }),
  );
}
