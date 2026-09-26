import * as THREE from 'three';
import type { SceneryKit } from '../kit';

/** Every solid structure has a matching meadow volume in game/landmarks.ts. */
export function buildMeadowExpansion(kit: SceneryKit) {
  const {
    box,
    ball,
    cylinder,
    cone,
    torus,
    origin,
    roof,
    arch,
    house,
    waterfall,
    animate,
    material,
    stone,
    wood,
    trim,
    gold,
    white,
    leaves,
    glass,
    dark,
  } = kit;
  const canvas = material('#c6b48b'),
    tealCanvas = material('#689d8b'),
    lavender = material('#a8a0b6');
  const lodge = house(-86, 31, 7, 6, 3.9, tealCanvas);
  for (const side of [-1, 1]) {
    box(lodge, wood, side * 2.8, 2.1, 3.25, 0.2, 4.2, 0.2);
    box(lodge, trim, side * 2.8, 3.4, 3.25, 0.46, 0.12, 0.46);
  }
  roof(lodge, canvas, 0, 3.7, 2.9, 7.2, 0.5, 1.0);
  const tent = (
    x: number,
    z: number,
    w: number,
    d: number,
    height: number,
    cloth: THREE.Material,
  ) => {
    const site = origin(x, z);
    roof(site, cloth, 0, 0.12, 0, w, height, d);
    box(site, wood, 0, height / 2, d / 2 + 0.04, 0.09, height, 0.09);
    const opening = cone(site, dark, 0, height * 0.39, d / 2 + 0.03, w * 0.23, height * 0.74, 3);
    opening.scale.z = 0.06;
    opening.rotation.z = Math.PI / 2;
    ball(site, canvas, -w * 0.33, 0.3, d * 0.34, 0.36, 0.29, 0.32);
  };
  tent(-73, 32, 6.8, 5.8, 3.75, canvas);
  tent(-86, 49, 5.4, 4.8, 3.3, tealCanvas);
  const spring = origin(-92, 35);
  ball(spring, stone, 0, 2.3, 0, 2.4, 2.65, 1.9);
  ball(spring, leaves, -0.6, 4.9, 0.1, 1.8, 0.45, 1.35);
  waterfall(spring, 0, 2.05, 2.2, 4.9);
  const fire = origin(-80, 34);
  for (let i = 0; i < 9; i++)
    ball(fire, stone, Math.cos(i * 0.698) * 1.0, 0.24, Math.sin(i * 0.698) * 1.0, 0.24, 0.22, 0.28);
  for (const side of [-1, 1]) {
    const log = cylinder(fire, wood, 0, 0.28, side * 0.22, 0.16, 0.19, 1.6, 8);
    log.rotation.z = side * 1.05;
  }
  const ember = material('#eeb371', { emissive: '#d78840', emissiveIntensity: 0.5 });
  ball(fire, ember, 0, 0.41, 0, 0.35, 0.3, 0.35);
  const flame = new THREE.Group();
  flame.name = 'meadow-campfire';
  flame.position.y = 0.36;
  fire.add(flame);
  for (let i = 0; i < 4; i++) {
    const tongue = cone(
      flame,
      ember,
      Math.sin(i * 2.4) * 0.2,
      0.35,
      Math.cos(i * 2.4) * 0.18,
      0.19,
      0.76,
      5,
    );
    tongue.rotation.z = Math.sin(i) * 0.2;
  }
  animate(flame, (time) => {
    flame.scale.set(1 + Math.sin(time * 7) * 0.1, 0.85 + Math.sin(time * 11) * 0.17, 1);
    flame.rotation.y = time * 0.5;
  });

  // A garden arch and a small conservatory frame the eastern field of wildflowers.
  const garden = origin(70, 50);
  arch(garden, trim, 0, 0, 0, 7.6, 6, 1.1);
  for (let i = 0; i < 11; i++) {
    const angle = (i / 10) * Math.PI;
    ball(garden, leaves, Math.cos(angle) * 3.65, 4.1 + Math.sin(angle) * 1.8, 0.1, 0.5, 0.4, 0.46);
    if (i % 2 === 0)
      ball(
        garden,
        lavender,
        Math.cos(angle) * 3.68,
        4.1 + Math.sin(angle) * 1.84,
        0.46,
        0.23,
        0.24,
        0.2,
      );
  }
  const greenhouse = origin(81, 63);
  box(greenhouse, stone, 0, 0.35, 0, 7.7, 0.7, 5.4);
  box(greenhouse, glass, 0, 2.4, 0, 7.4, 3.9, 5.0);
  roof(greenhouse, glass, 0, 4.28, 0, 8.0, 2.3, 5.8);
  roof(greenhouse, wood, 0, 4.29, 0, 0.18, 2.32, 5.95);
  for (const side of [-1, 1])
    for (let i = 0; i < 5; i++) {
      box(greenhouse, trim, -3.7 + i * 1.85, 2.4, side * 2.56, 0.12, 3.9, 0.12);
      box(greenhouse, trim, 0, 1.55 + i * 0.62, side * 2.56, 7.4, 0.065, 0.12);
    }
  for (const side of [-1, 1]) box(greenhouse, wood, side * 0.66, 1.6, 2.62, 0.14, 2.7, 0.12);
  box(greenhouse, wood, 0, 2.95, 2.62, 1.45, 0.13, 0.12);
  for (const side of [-1, 1]) {
    roof(greenhouse, tealCanvas, side * 2.5, 4.3, 0, 1.5, 0.48, 5.85);
    for (let i = 0; i < 4; i++) {
      box(greenhouse, canvas, side * 2.35, 0.92 + i * 0.62, -1.9, 1.3, 0.15, 0.9);
      ball(
        greenhouse,
        i % 2 ? lavender : leaves,
        side * 2.35,
        1.15 + i * 0.62,
        -1.9,
        0.53,
        0.25,
        0.39,
      );
    }
  }
  for (let i = 0; i < 6; i++) {
    const planter = origin(60 + i * 3.2, 66 + Math.sin(i) * 2);
    cylinder(planter, canvas, 0, 0.2, 0, 0.28, 0.2, 0.4, 8);
    for (let sprig = 0; sprig < 3; sprig++) {
      cylinder(
        planter,
        leaves,
        Math.sin(sprig * 2.1) * 0.13,
        0.66,
        Math.cos(sprig * 2.1) * 0.13,
        0.025,
        0.035,
        0.85,
        5,
      );
      ball(
        planter,
        sprig % 2 ? white : lavender,
        Math.sin(sprig * 2.1) * 0.13,
        1.05,
        Math.cos(sprig * 2.1) * 0.13,
        0.14,
        0.25,
        0.14,
      );
    }
  }

  // The northern ridge remains walkable beneath its open stone gateway.
  const gateway = origin(-4, -90);
  for (const side of [-1, 1]) {
    const column = origin(-4 + side * 7, -90);
    box(column, stone, 0, 3.1, 0, 1.1, 6.2, 1.4);
    box(column, trim, 0, 6.25, 0, 1.2, 0.35, 1.55);
    torus(column, gold, 0, 4.8, 0.73, 0.34, 0.055);
  }
  box(gateway, stone, 0, 6.25, 0, 15.3, 0.8, 1.5);
  const belfry = origin(-4, -99);
  cylinder(belfry, stone, 0, 0.25, 0, 2.8, 3, 0.5, 12);
  cylinder(belfry, stone, 0, 3.85, 0, 2.1, 2.55, 7.2, 12);
  for (const side of [-1, 1])
    for (const depth of [-1, 1]) box(belfry, wood, side * 1.52, 9, depth * 1.52, 0.2, 3.3, 0.2);
  roof(belfry, tealCanvas, 0, 10.5, 0, 5.4, 2.0, 5.4);
  const bell = new THREE.Group();
  bell.position.set(0, 9.6, 0);
  belfry.add(bell);
  cylinder(bell, gold, 0, -0.6, 0, 0.4, 0.85, 1.4, 16);
  torus(bell, gold, 0, -1.3, 0, 0.85, 0.08, true);
  ball(bell, wood, 0, -1.27, 0, 0.15, 0.27, 0.15);
  animate(bell, (time) => {
    bell.rotation.z = Math.sin(time * 0.82) * 0.12;
  });
  for (const [x, z] of [
    [-13, -97],
    [5, -99],
  ]) {
    const stoneSite = origin(x, z);
    box(stoneSite, stone, 0, 1.45, 0, 2.3, 2.9, 4.0);
    box(stoneSite, leaves, 0, 3.0, 0, 2.5, 0.4, 4.2);
  }
}
