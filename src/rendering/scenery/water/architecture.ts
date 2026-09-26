import * as THREE from 'three';
import type { SceneryKit } from '../kit';
import { getRegionLake } from '../../../game/worldLayout';

const WATER_LEVEL = getRegionLake('water').waterLevel;

/** Coastal silhouettes are authored separately from the inland village kit. */
export function buildWaterArchitecture(kit: SceneryKit) {
  const {
    staticRoot,
    origin,
    material,
    add,
    box,
    ball,
    cylinder,
    cone,
    torus,
    arch,
    plaster,
    stone,
    roofMat,
    wood,
    trim,
    dark,
    gold,
    warm,
    white,
    glass,
  } = kit;
  const cobalt = material('#28658b');
  const coral = material('#d77661');
  const sailCloth = material('#fff3d9', { side: THREE.DoubleSide });
  const limestone = material('#dfdfc7');
  const strata = material('#aabbb3');

  const sanctuary = origin(-8, -34);
  sanctuary.name = 'water-pearl-sanctuary';
  const plinth = cylinder(sanctuary, stone, 0, 0.2, 0, 8.4, 8.4, 0.6, 32);
  plinth.scale.z = 0.64;
  const lower = cylinder(sanctuary, white, 0, 0.6, 0, 7.9, 8.1, 0.4, 32);
  lower.scale.z = 0.64;
  // An open column ring and a broad pearl dome replace the inland gabled facade.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const x = Math.sin(a) * 7.25,
      z = Math.cos(a) * 4.35;
    if (Math.abs(x) < 3 && z > 0) continue;
    cylinder(sanctuary, white, x, 3.7, z, 0.3, 0.46, 6.2, 12);
    cylinder(sanctuary, trim, x, 0.94, z, 0.64, 0.64, 0.28, 12);
    cylinder(sanctuary, trim, x, 6.75, z, 0.66, 0.58, 0.3, 12);
  }
  const cornice = cylinder(sanctuary, white, 0, 7.0, 0, 8.35, 8.35, 0.55, 32);
  cornice.scale.z = 0.64;
  add(
    sanctuary,
    new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    roofMat,
    0,
    7.22,
    0,
    8.25,
    4.9,
    5.3,
  );
  cylinder(sanctuary, gold, 0, 12.65, 0, 0.13, 0.22, 1.1);
  ball(sanctuary, white, 0, 13.45, 0, 0.64, 0.64, 0.64);
  const pearl = material('#b7e8de', { emissive: '#67c7cb', emissiveIntensity: 0.45 });
  ball(sanctuary, pearl, 0, 3.9, 3.5, 1.22, 1.22, 1.22);
  arch(sanctuary, white, 0, 0.7, 4.6, 5.8, 6.4, 0.65);
  torus(sanctuary, gold, 0, 3.9, 3.55, 1.6, 0.07);
  kit.onUpdate((_time, visited) => {
    pearl.emissiveIntensity = visited ? 0.9 : 0.45;
  });
  for (const side of [-1, 1]) {
    const pavilion = origin(-8 + side * 11, -32);
    pavilion.name = `water-sanctuary-pavilion-${side}`;
    cylinder(pavilion, white, 0, 3.4, 0, 1.55, 1.85, 6.8, 12);
    cylinder(pavilion, trim, 0, 6.8, 0, 1.95, 1.95, 0.3, 12);
    add(
      pavilion,
      new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      roofMat,
      0,
      6.95,
      0,
      1.93,
      2.0,
      1.93,
    );
    box(pavilion, dark, 0, 4.0, 1.61, 0.6, 1.75, 0.12);
    arch(pavilion, trim, 0, 3.0, 1.7, 1.3, 2.55, 0.18);
  }

  const lighthouse = origin(60, 38);
  lighthouse.name = 'water-striped-lighthouse';
  cylinder(lighthouse, stone, 0, 0.15, 0, 2.65, 2.65, 0.55, 24);
  cylinder(lighthouse, white, 0, 8.7, 0, 1.52, 2.25, 17.4, 24);
  for (const y of [4.4, 9.4, 14.4]) {
    const radius = 2.25 - (y / 17.4) * 0.73;
    cylinder(lighthouse, cobalt, 0, y, 0, radius - 0.052, radius + 0.08, 2.8, 24);
  }
  cylinder(lighthouse, trim, 0, 17.45, 0, 2.7, 2.7, 0.45, 24);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    cylinder(
      lighthouse,
      cobalt,
      Math.sin(a) * 2.35,
      18.0,
      Math.cos(a) * 2.35,
      0.055,
      0.055,
      0.9,
      5,
    );
  }
  torus(lighthouse, cobalt, 0, 18.35, 0, 2.35, 0.065, true);
  cylinder(lighthouse, glass, 0, 18.85, 0, 1.35, 1.35, 2.35, 16);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    cylinder(lighthouse, gold, Math.sin(a) * 1.39, 18.85, Math.cos(a) * 1.39, 0.065, 0.065, 2.4, 6);
  }
  cone(lighthouse, cobalt, 0, 20.65, 0, 2.12, 1.4, 16);
  cylinder(lighthouse, gold, 0, 21.45, 0, 0.055, 0.08, 1.0, 6);
  const beacon = ball(lighthouse, warm, 0, 18.85, 0, 0.72, 0.88, 0.72);
  beacon.name = 'water-lighthouse-beacon';
  kit.animate(beacon, (time) => {
    beacon.scale.set(0.72, 0.88 + Math.sin(time * 1.5) * 0.08, 0.72);
  });
  box(lighthouse, dark, 0, 1.4, 2.18, 1.0, 2.5, 0.13);
  arch(lighthouse, trim, 0, 0.2, 2.23, 1.8, 2.8, 0.2);
  for (const y of [6.5, 12.0]) box(lighthouse, dark, 0, y, 2.04 - y * 0.022, 0.38, 1.0, 0.16);

  const coastalHome = (x: number, z: number, w: number, d: number, h: number, store: boolean) => {
    const home = origin(x, z);
    home.name = store ? 'water-harbor-market' : 'water-flat-roof-house';
    box(home, stone, 0, 0.1, 0, w + 0.25, 0.5, d + 0.2);
    box(home, plaster, 0, h / 2, 0, w, h, d);
    box(home, cobalt, 0, 0.35, d / 2 + 0.02, w, 0.65, 0.08);
    box(home, trim, 0, h, 0, w + 0.35, 0.28, d + 0.3);
    for (const side of [-1, 1])
      box(home, plaster, side * (w / 2 - 0.05), h + 0.4, 0, 0.22, 0.72, d);
    box(home, plaster, 0, h + 0.4, -d / 2 + 0.05, w, 0.72, 0.2);
    const upper = store ? 1.8 : 2.5;
    box(home, white, w * 0.17, h + upper / 2, -d * 0.2, w * 0.53, upper, d * 0.5);
    box(home, roofMat, w * 0.17, h + upper + 0.1, -d * 0.2, w * 0.6, 0.26, d * 0.57);
    for (const side of [-1, 1]) {
      const wx = side * w * 0.31;
      box(home, dark, wx, h * 0.6, d / 2 + 0.045, 0.68, 1.04, 0.08);
      for (const shutter of [-1, 1]) {
        const panel = box(
          home,
          cobalt,
          wx + shutter * 0.46,
          h * 0.6,
          d / 2 + 0.14,
          0.32,
          1.16,
          0.09,
        );
        panel.rotation.y = -shutter * 0.3;
      }
    }
    box(home, cobalt, 0, 1.2, d / 2 + 0.07, 0.95, 2.4, 0.15);
    if (store) {
      const shade = add(
        home,
        new THREE.CylinderGeometry(1, 1, w * 0.84, 16, 1, true, 0, Math.PI),
        sailCloth,
        0,
        h + 0.25,
        d * 0.2,
        1,
        1,
        0.9,
      );
      shade.rotation.z = Math.PI / 2;
      for (const sx of [-1, 1])
        cylinder(home, wood, sx * w * 0.4, h + 0.4, d * 0.35, 0.045, 0.045, 1.1, 6);
    } else {
      const awning = box(home, sailCloth, 0, h - 0.35, d * 0.32, w * 0.78, 0.08, d * 0.34);
      awning.rotation.x = -0.1;
    }
    return home;
  };
  coastalHome(56, 52, 5.9, 4.8, 3.7, false);
  coastalHome(43, 53, 5.1, 3.9, 3.2, true);

  const quay = origin(48, 46);
  quay.name = 'water-rope-wharf';
  for (let i = 0; i < 22; i++) box(quay, wood, 0, 0.05, 3 - i * 0.52, 6.4, 0.18, 0.46);
  for (const x of [-3.05, 3.05]) {
    for (const z of [-7.5, -3.9, -0.3, 3.3]) {
      cylinder(quay, wood, x, -0.08, z, 0.17, 0.2, 2.2, 8);
      torus(quay, trim, x, 0.62, z, 0.19, 0.045, true);
    }
    for (let i = 0; i < 3; i++) {
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(x, 0.88, -7.5 + i * 3.6),
        new THREE.Vector3(x, 0.35, -5.7 + i * 3.6),
        new THREE.Vector3(x, 0.88, -3.9 + i * 3.6),
      );
      add(quay, new THREE.TubeGeometry(curve, 8, 0.055, 5, false), trim);
    }
  }
  for (const x of [-2, 2]) {
    cylinder(quay, wood, x, 0.44, 1.3, 0.4, 0.36, 0.8, 10);
    torus(quay, dark, x, 0.2, 1.3, 0.37, 0.04, true);
    torus(quay, dark, x, 0.68, 1.3, 0.37, 0.04, true);
  }

  const sailboat = (x: number, z: number, yaw: number, size: number, striped: boolean) => {
    const ship = new THREE.Group();
    ship.name = `water-sailboat-${x}`;
    ship.position.set(x, WATER_LEVEL, z);
    ship.rotation.y = yaw;
    ship.scale.setScalar(size);
    staticRoot.add(ship);
    ball(ship, striped ? cobalt : coral, 0, 0.15, 0, 1.05, 0.6, 3.0);
    box(ship, wood, 0, 0.57, 0, 1.65, 0.15, 4.4);
    cylinder(ship, wood, 0, 4.05, 0, 0.07, 0.12, 7.5, 8);
    box(ship, wood, 0.95, 2.0, 0, 2.2, 0.1, 0.1);
    const sail = new THREE.BufferGeometry();
    sail.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [
          0.08, 7.4, 0, 0.08, 2.05, 0, 2.8, 2.05, 0.35, -0.12, 6.35, 0, -2.1, 1.65, 0.28, -0.12,
          1.65, 0,
        ],
        3,
      ),
    );
    sail.computeVertexNormals();
    add(ship, sail, sailCloth);
    const pennant = add(
      ship,
      new THREE.ConeGeometry(0.28, 1.1, 3),
      striped ? coral : cobalt,
      0.5,
      7.55,
      0,
    );
    pennant.rotation.z = -Math.PI / 2;
    kit.animate(ship, (time) => {
      ship.position.y = WATER_LEVEL + Math.sin(time * 1.25 + x) * 0.12;
      ship.rotation.z = Math.sin(time * 0.8 + z) * 0.035;
      ship.rotation.y = yaw + Math.sin(time * 0.3 + x) * 0.06;
    });
  };
  sailboat(17, 25, -0.6, 0.75, false);
  sailboat(33, 7, 0.8, 1.15, true);
  sailboat(61, -8, -0.2, 0.9, false);

  const seaArch = new THREE.Group();
  seaArch.name = 'water-limestone-sea-arch';
  seaArch.position.set(44, WATER_LEVEL - 0.25, -27);
  staticRoot.add(seaArch);
  // A thick, uneven limestone crown reads as eroded geology, not a scaled-up doorway.
  const archShape = new THREE.Shape();
  for (const [i, [x, y]] of [
    [-12, 0],
    [-11, 8],
    [-9.5, 12],
    [-8, 15],
    [-3, 17.1],
    [1, 17.5],
    [7, 16.5],
    [9.7, 12],
    [12, 0],
    [7.3, 0],
    [6.6, 6],
    [5, 10],
    [1, 12],
    [-3, 11.5],
    [-5.5, 8],
    [-7.2, 0],
  ].entries()) {
    if (i === 0) archShape.moveTo(x, y);
    else archShape.lineTo(x, y);
  }
  archShape.closePath();
  const archGeometry = new THREE.ExtrudeGeometry(archShape, { depth: 5.6, bevelEnabled: false });
  archGeometry.translate(0, 0, -2.8);
  add(seaArch, archGeometry, limestone);
  for (const side of [-1, 1]) {
    cylinder(seaArch, limestone, side * 9.5, 5.5, 0, 2.25, 3.6, 11.0, 7);
    cylinder(seaArch, strata, side * 9.5, 3.0, 0, 3.14, 3.32, 0.5, 7);
    cylinder(seaArch, white, side * 9.2, 10.9, 0, 2.28, 2.5, 0.65, 7);
    const crown = cone(seaArch, limestone, side * 8.2, 13.0, 0, 2.4, 4.2, 5);
    crown.rotation.y = side * 0.3;
  }
  for (const [x, z, radius, height] of [
    [71, -25, 3.2, 15],
    [62, -39, 4, 10],
    [22, -28, 2.2, 9],
  ]) {
    const stack = new THREE.Group();
    stack.name = `water-sea-stack-${x}`;
    stack.position.set(x, WATER_LEVEL - 0.2, z);
    staticRoot.add(stack);
    cylinder(stack, limestone, 0, height / 2, 0, radius * 0.55, radius, height, 7);
    cylinder(stack, strata, 0, height * 0.3, 0, radius * 0.88, radius * 0.92, 0.6, 7);
    cone(stack, white, 0, height, 0, radius * 0.65, height * 0.22, 7);
  }

  const arcade = origin(-30, 7);
  arcade.name = 'water-shell-arcade';
  box(arcade, plaster, 0, 3.4, 0, 13.8, 6.8, 2.7);
  box(arcade, trim, 0, 7.0, 0, 14.0, 0.5, 3.0);
  for (const x of [-5.8, 0, 5.8]) {
    arch(arcade, white, x, 0, 3, 5.5, 7.5, 1.4);
    torus(arcade, cobalt, x, 5.25, 3.72, 1.0, 0.1);
  }
  for (const side of [-1, 1]) box(arcade, plaster, side * 6, 3.5, 2.5, 2.0, 7, 5.2);
  for (let i = 0; i < 10; i++) {
    const shell = ball(arcade, trim, -6.3 + i * 1.4, 7.48, 0, 0.3, 0.33, 0.18);
    shell.rotation.z = (i % 2 ? 1 : -1) * 0.3;
  }
  const cascades = origin(-44, -39);
  cascades.name = 'water-terraced-cascade';
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 1.7,
      h = 8 + i * 7;
    const ledge = cylinder(
      cascades,
      limestone,
      x,
      h / 2,
      -i * 1.6,
      5.8 - i * 0.65,
      6.7 - i * 0.6,
      h,
      7,
    );
    ledge.scale.z = 0.65;
    const band = cylinder(
      cascades,
      strata,
      x,
      h - 0.8,
      -i * 1.6,
      5.85 - i * 0.65,
      6.0 - i * 0.65,
      0.65,
      7,
    );
    band.scale.z = 0.65;
    kit.waterfall(cascades, x, 4.6 - i * 0.4, 3.2 - i * 0.4, h);
  }
}
