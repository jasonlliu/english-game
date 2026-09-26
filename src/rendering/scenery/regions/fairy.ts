import * as THREE from 'three';
import { buildRegionScenery } from '../kit';
import { buildTemple } from '../temple';
import type { RegionScenery } from '../types';
export function createRegionScenery(): RegionScenery {
  return buildRegionScenery(
    'fairy',
    ['#dccac8', '#a695ae', '#947da5', '#8e6e79', '#efe0d4', '#b7a1b9'],
    (kit) => {
      const {
        add,
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
        mountain,
        animate,
        stone,
        plaster,
        roofMat,
        wood,
        trim,
        dark,
        gold,
        warm,
        leaves,
        terracotta,
        white,
        flowerPink,
      } = kit;
      buildTemple(kit, (temple, templeWindow) => {
        ball(temple, trim, 0, 8.3, 0, 8.4, 0.55, 5.3);
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3;
          const petal = ball(
            temple,
            i % 2 ? flowerPink : roofMat,
            Math.sin(angle) * 3.0,
            9.4 + Math.cos(i) * 0.16,
            Math.cos(angle) * 2.0,
            3.4,
            0.55,
            2.0,
          );
          petal.rotation.y = angle;
          petal.rotation.z = Math.sin(angle) * -0.28;
          petal.rotation.x = Math.cos(angle) * 0.23;
        }
        ball(temple, flowerPink, 0, 10.3, 0, 2.3, 2.4, 2.3);
        const aureole = torus(temple, gold, 0, 13.4, 0, 2.3, 0.105, true);
        aureole.rotation.y = 0.16;
        torus(temple, templeWindow, 0, 13.4, 0, 1.92, 0.065, true);
        add(
          temple,
          new THREE.OctahedronGeometry(0.7, 0),
          templeWindow,
          0,
          13.45,
          0,
          0.65,
          1.5,
          0.65,
        );
      });
      const tree = origin(-30, 8);
      cylinder(tree, wood, 0, 7.7, 0, 1.7, 3.1, 15.4, 12);
      for (let i = 0; i < 7; i++) {
        const a = i * 2.4;
        const branch = cylinder(
          tree,
          wood,
          Math.sin(a) * 2.4,
          13 + Math.sin(i) * 2,
          Math.cos(a) * 2.4,
          0.3,
          0.85,
          7.0,
          8,
        );
        branch.rotation.z = Math.sin(a) * 0.8;
        branch.rotation.x = Math.cos(a) * 0.8;
        ball(
          tree,
          leaves,
          Math.sin(a) * 4.4,
          18.7 + Math.sin(i * 1.8) * 1.9,
          Math.cos(a) * 4.0,
          4.8,
          3.8,
          4.6,
        );
      }
      const deck = cylinder(tree, wood, 0, 8.7, 0, 6.6, 6.6, 0.4, 20);
      deck.rotation.y = 0.12;
      for (const side of [-1, 1]) {
        box(tree, plaster, side * 4.1, 10.6, 0.7, 3.6, 3.7, 3.8);
        roof(tree, roofMat, side * 4.1, 12.4, 0.7, 4.5, 2.3, 4.8);
        window(tree, side * 4.1, 10.9, 2.65, 0.9, 1.3);
      }
      for (let i = 0; i < 16; i++) {
        const a = (i * Math.PI) / 8;
        cylinder(tree, wood, Math.sin(a) * 6.2, 9.3, Math.cos(a) * 6.2, 0.06, 0.07, 1.2, 6);
        ball(tree, warm, Math.sin(a) * 6.1, 10.1, Math.cos(a) * 6.1, 0.16, 0.23, 0.16);
      }
      house(-38, 16, 4.3, 4.3, 3.4);
      const mushroom = (x: number, z: number, r: number, h: number, color: THREE.Material) => {
        const p = origin(x, z);
        cylinder(p, plaster, 0, h * 0.37, 0, r * 0.51, r * 0.62, h * 0.74, 18);
        add(
          p,
          new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
          color,
          0,
          h * 0.67,
          0,
          r,
          h * 0.32,
          r,
        );
        cylinder(p, trim, 0, h * 0.67, 0, r, r, 0.13, 24);
        box(p, dark, 0, 1.1, r * 0.6, 1.0, 2.2, 0.12);
        arch(p, wood, 0, 0, r * 0.66, 1.5, 2.65, 0.2);
        window(p, -r * 0.31, h * 0.42, r * 0.57, 0.55, 0.8);
        for (let i = 0; i < 8; i++) {
          const a = i * 2.4;
          ball(
            p,
            white,
            Math.sin(a) * r * 0.67,
            h * 0.86 + Math.cos(i) * h * 0.035,
            Math.cos(a) * r * 0.67,
            0.25,
            0.075,
            0.25,
          );
        }
      };
      mushroom(18, 18, 2.6, 7.2, flowerPink);
      mushroom(10, 19, 2.05, 5.3, roofMat);
      mushroom(22, 27, 2.7, 7.7, terracotta);
      const garden = origin(-43, -32);
      for (const [x, z, w, h] of [
        [-5, -1, 3.1, 16],
        [5, -1, 2.4, 12],
      ])
        mountain(garden, x, 0, z, w, h, stone);
      const floating = new THREE.Group();
      floating.position.y = 15.6;
      garden.add(floating);
      for (let i = 0; i < 4; i++) {
        const x = (i - 1.5) * 4.1,
          y = Math.sin(i * 1.7) * 2,
          z = Math.cos(i) * 2;
        const rock = cone(floating, stone, x, y, z, 2.5, 4, 6);
        rock.rotation.z = Math.PI;
        ball(floating, leaves, x, y + 2, z, 2.5, 0.5, 2.1);
        ball(floating, flowerPink, x, y + 2.6, z, 0.9, 0.65, 0.85);
      }
      animate(floating, (t) => {
        floating.position.y = 15.6 + Math.sin(t * 0.5) * 0.3;
      });
      const gateway = origin(-36, -25);
      arch(gateway, trim, 0, 0, 0, 5.8, 8.7, 0.85);
      for (const side of [-1, 1])
        for (let i = 0; i < 8; i++)
          ball(gateway, flowerPink, side * (2.5 - i * 0.08), i * 0.85, 0.45, 0.3, 0.24, 0.25);
    },
  );
}
