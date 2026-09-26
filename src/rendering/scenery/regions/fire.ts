import * as THREE from 'three';
import { buildRegionScenery } from '../kit';
import { buildTemple } from '../temple';
import type { RegionScenery } from '../types';
export function createRegionScenery(): RegionScenery {
  return buildRegionScenery(
    'fire',
    ['#716a72', '#45464f', '#718692', '#66585a', '#dfddda', '#729873'],
    (kit) => {
      const {
        material,
        add,
        box,
        ball,
        cylinder,
        cone,
        torus,
        origin,
        roof,
        window,
        house,
        mountain,
        animate,
        stone,
        trim,
        dark,
        iron,
        gold,
        snow,
        ice,
        rockDark,
        ocean,
      } = kit;
      buildTemple(kit, (temple) => {
        box(temple, rockDark, 0, 8.35, 0, 16.9, 0.8, 10.6);
        for (const side of [-1, 1]) {
          cone(temple, rockDark, side * 4.6, 10.8, -0.5, 3.1, 5.3, 4).rotation.y = Math.PI / 4;
          cone(temple, iron, side * 4.6, 13.0, -0.5, 1.4, 2.7, 4).rotation.y = Math.PI / 4;
          box(temple, gold, side * 4.6, 8.87, 4.3, 2.5, 0.13, 0.18);
        }
        const emberCrystal = material('#ffc27d', {
          emissive: '#ff742d',
          emissiveIntensity: 0.7,
          metalness: 0.12,
          roughness: 0.3,
        });
        add(temple, new THREE.OctahedronGeometry(1, 0), emberCrystal, 0, 12.45, 1, 1.1, 2.35, 1.1);
        torus(temple, gold, 0, 10.2, 1, 1.45, 0.1, true);
      });
      const glacier = origin(-46, -13);
      mountain(glacier, 0, 0, 0, 8, 28, rockDark, true);
      mountain(glacier, -4, 0, 4, 4.7, 18, snow, true);
      mountain(glacier, 5, 0, -1, 3.4, 22, ice, true);
      for (let i = 0; i < 5; i++) {
        const shelf = box(glacier, ice, (i - 2) * 1.3, 1.9 + i * 0.35, 6.5, 1.6, 3.6, 2.6);
        shelf.rotation.z = (i - 2) * 0.08;
      }
      const spire = origin(-40, 0);
      mountain(spire, 0, 0, 0, 3.3, 16, ice, true);
      mountain(spire, 1.6, 0, 1.2, 1.4, 9, snow);
      const mountainBackdrop = origin(-99, -100);
      mountain(mountainBackdrop, 0, 0, 0, 20, 58, stone, true);
      mountain(mountainBackdrop, 26, 0, -18, 19, 48, stone, true);
      const spring = origin(18, 18);
      cylinder(spring, stone, 0, 0.24, 0, 4.5, 4.6, 0.7, 28);
      cylinder(spring, ocean, 0, 0.62, 0, 3.75, 3.75, 0.09, 28);
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        ball(spring, rockDark, Math.sin(a) * 4.1, 0.8, Math.cos(a) * 3.2, 0.65, 0.55, 0.55);
      }
      spring.scale.z = 0.78;
      const steamMat = material('#eee7e1', { transparent: true, opacity: 0.19, depthWrite: false });
      const steam = new THREE.Group();
      origin(18, 18).add(steam);
      steam.scale.z = 0.78;
      for (let i = 0; i < 6; i++)
        ball(
          steam,
          steamMat,
          Math.sin(i * 2.1) * 2,
          1.5 + i * 0.45,
          Math.cos(i * 2.1) * 1.5,
          0.7,
          0.3,
          0.7,
        );
      animate(steam, (t) => {
        steam.position.y = Math.sin(t * 0.5) * 0.22;
        steam.rotation.y = t * 0.045;
      });
      house(22, 27, 6.7, 5.3, 4.1);
      const watch = origin(12, -27);
      box(watch, rockDark, 0, 5.7, 0, 6.0, 11.4, 6.0);
      box(watch, stone, 0, 12.0, 0, 6.5, 1, 6.5);
      for (const side of [-1, 1])
        for (const axis of [-1, 1]) box(watch, trim, side * 2.3, 14.1, axis * 2.3, 0.5, 4.0, 0.5);
      roof(watch, stone, 0, 16, 0, 6.6, 1.5, 6.6);
      window(watch, 0, 6, 3.03, 1.2, 3.2);
      box(watch, dark, 0, 1.5, 3.05, 1.8, 3, 0.15);
    },
  );
}
