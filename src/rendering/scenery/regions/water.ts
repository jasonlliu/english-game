import * as THREE from 'three';
import { buildRegionScenery } from '../kit';
import { buildTemple } from '../temple';
import type { RegionScenery } from '../types';
export function createRegionScenery(): RegionScenery {
  return buildRegionScenery(
    'water',
    ['#edf0db', '#9fbbb9', '#4794aa', '#87796a', '#f4e8c5', '#729873'],
    (kit) => {
      const {
        staticRoot,
        material,
        add,
        box,
        ball,
        cylinder,
        cone,
        origin,
        arch,
        house,
        waterfall,
        plaster,
        roofMat,
        wood,
        trim,
        dark,
        gold,
        warm,
        glass,
        leaves,
        white,
      } = kit;
      buildTemple(kit, (temple) => {
        const dome = add(
          temple,
          new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2),
          roofMat,
          0,
          8.2,
          -0.6,
          6.3,
          5.0,
          4.6,
        );
        dome.rotation.y = 0.15;
        cylinder(temple, gold, 0, 13.65, -0.6, 0.08, 0.12, 1.2);
        ball(temple, warm, 0, 14.3, -0.6, 0.27, 0.27, 0.27);
      });
      const tower = origin(48, 13);
      cylinder(tower, white, 0, 7.65, 0, 1.65, 2.45, 15.3, 20);
      for (const y of [3.5, 8.5, 13.6])
        cylinder(tower, glass, 0, y, 0, 2.43 - y * 0.05, 2.45 - y * 0.05, 0.43, 20);
      cylinder(tower, trim, 0, 15.5, 0, 2.7, 2.7, 0.5);
      cylinder(tower, glass, 0, 16.65, 0, 1.45, 1.45, 1.8);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        box(tower, gold, Math.sin(a) * 1.52, 16.7, Math.cos(a) * 1.52, 0.13, 2, 0.13);
      }
      cone(tower, roofMat, 0, 18.4, 0, 2.2, 2.0);
      ball(tower, warm, 0, 16.7, 0, 0.6, 0.9, 0.6);
      box(tower, dark, 0, 1.2, 2.39, 1.15, 2.4, 0.15);
      house(54, 22, 5.8, 4.8, 4.05);
      house(42, 26, 5.0, 3.9, 3.5);
      const quay = origin(42, 18);
      for (let i = 0; i < 9; i++) box(quay, wood, -5 + i * 0.62, -0.12, -5, 0.54, 0.16, 5.5);
      for (const x of [-5, 0])
        for (const z of [-7.5, -2.5]) cylinder(quay, wood, x, -0.5, z, 0.12, 0.15, 1.5);
      const ship = new THREE.Group();
      ship.position.set(35, 0.74, 1);
      ship.rotation.y = -0.45;
      staticRoot.add(ship);
      ball(ship, wood, 0, 0.6, 0, 1.4, 0.65, 3.2);
      box(ship, wood, 0, 1.02, 0, 2.2, 0.2, 5.6);
      cylinder(ship, wood, 0, 4.4, 0, 0.08, 0.15, 7.6);
      box(ship, wood, 0, 7.5, 0, 4.0, 0.12, 0.12);
      const sail = new THREE.BufferGeometry();
      sail.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(
          [-0.08, 7.4, 0, -0.08, 2.0, 0, 3.6, 2.2, 0.25, 0.08, 7.4, 0, -3, 2.4, 0.25, 0.08, 2.0, 0],
          3,
        ),
      );
      sail.computeVertexNormals();
      const sailMat = material('#f4eee0', { side: THREE.DoubleSide });
      add(ship, sail, sailMat);
      const arcade = origin(-30, 7);
      box(arcade, plaster, 0, 3.4, 0, 13.8, 6.8, 2.7);
      box(arcade, trim, 0, 7.0, 0, 14.2, 0.5, 3.1);
      for (const x of [-5.8, 0, 5.8]) arch(arcade, white, x, 0, 3, 5.5, 7.5, 1.4);
      for (const side of [-1, 1]) box(arcade, plaster, side * 6, 3.5, 2.5, 2.0, 7, 5.2);
      const cascades = origin(-44, -39);
      for (let i = 0; i < 3; i++) {
        box(
          cascades,
          plaster,
          (i - 1) * 2.0,
          4 + i * 6,
          -i * 1.4,
          12 - i * 2,
          8 + i * 4,
          9 - i * 1.5,
        );
        waterfall(cascades, (i - 1) * 1.8, 4.5 - i * 0.3, 3.5 - i * 0.6, 8 + i * 7);
      }
      ball(cascades, leaves, -2, 25, 0, 4.5, 1.4, 3.6);
    },
  );
}
