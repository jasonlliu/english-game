import * as THREE from 'three';
import { buildRegionScenery } from '../kit';
import { buildTemple } from '../temple';
import type { RegionScenery } from '../types';
export function createRegionScenery(): RegionScenery {
  return buildRegionScenery(
    'meadow',
    ['#d8c9a3', '#8d947b', '#56787b', '#6c5140', '#ded5b2', '#729873'],
    (kit) => {
      const {
        box,
        ball,
        cylinder,
        cone,
        torus,
        origin,
        roof,
        arch,
        window,
        house,
        fence,
        waterfall,
        animate,
        stone,
        plaster,
        roofMat,
        wood,
        trim,
        gold,
        leaves,
        terracotta,
        white,
      } = kit;
      buildTemple(kit, (temple, templeWindow) => {
        roof(temple, roofMat, 0, 8.05, 0, 18.1, 3.6, 11.8);
        roof(temple, trim, 0, 11.2, -0.5, 9.5, 2.2, 7.7);
        torus(temple, gold, 0, 11.3, 5.92, 1.0, 0.09);
        ball(temple, templeWindow, 0, 11.3, 5.94, 0.55, 0.55, 0.13);
      });
      house(-36, 15, 5.6, 4.7, 3.65);
      house(-25, 12, 4.65, 4.6, 3.45);
      house(-31, 22, 5.4, 4.6, 3.55, terracotta);
      const mill = origin(-31, 6);
      cylinder(mill, plaster, 0, 5.2, 0, 1.6, 2.45, 10.4, 14);
      cone(mill, roofMat, 0, 11.45, 0, 2.3, 3.1);
      cylinder(mill, stone, 0, 0.35, 0, 2.5, 2.6, 0.7);
      window(mill, 0, 5.7, 1.92, 0.75, 1.25);
      box(mill, wood, 0, 1.1, 2.4, 1.3, 2.2, 0.15);
      const rotor = new THREE.Group();
      rotor.position.set(0, 9.4, 2.4);
      mill.add(rotor);
      for (let i = 0; i < 4; i++) {
        const wing = new THREE.Group();
        wing.rotation.z = (i * Math.PI) / 2;
        rotor.add(wing);
        box(wing, wood, 0, 2.7, 0, 0.15, 5.7, 0.16);
        box(wing, white, 0.63, 3.3, 0.04, 1.12, 3.5, 0.08);
        for (let j = 0; j < 5; j++) box(wing, wood, 0.57, 1.85 + j * 0.7, 0.1, 1.25, 0.06, 0.11);
      }
      ball(rotor, gold, 0, 0, 0.15, 0.38, 0.38, 0.27);
      animate(rotor, (time) => {
        rotor.rotation.z = time * 0.16;
      });
      const farm = house(18, 25, 6.5, 5.5, 4.0, terracotta);
      box(farm, wood, 0, 1.65, 2.87, 2.1, 3.3, 0.22);
      const field = origin(16, 16);
      box(field, wood, 0, 0.01, 0, 9, 0.09, 5.2);
      for (let row = 0; row < 7; row++)
        for (let col = 0; col < 12; col++) {
          const x = -4.1 + col * 0.74,
            z = -2.25 + row * 0.7;
          box(field, gold, x, 0.34, z, 0.055, 0.63, 0.055);
          ball(field, gold, x, 0.71, z, 0.12, 0.25, 0.1);
        }
      fence(field, -4.7, -3.1, 9.3);
      const falls = origin(-46, -32);
      box(falls, stone, 0, 9.0, 0, 12.1, 18, 9.4);
      box(falls, stone, -2, 18, 0, 8, 6, 7);
      ball(falls, leaves, 0, 21.2, 0, 5.7, 1.6, 4.4);
      waterfall(falls, 2, 4.88, 3.9, 20);
      const bridge = origin(-41, -26);
      arch(bridge, trim, 0, 3, 0, 24, 12, 2.3);
      box(bridge, stone, 0, 15.0, 0, 24.2, 0.65, 3.4);
      for (const side of [-1, 1]) box(bridge, stone, side * 11.3, 7, 0, 1.4, 14, 2.8);
      for (let i = 0; i < 13; i++) box(bridge, trim, -11.6 + i * 1.93, 15.7, 1.55, 0.16, 1.1, 0.14);
    },
  );
}
