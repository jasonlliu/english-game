import * as THREE from 'three';
import { buildRegionScenery } from '../kit';
import { buildTemple } from '../temple';
import type { RegionScenery } from '../types';
export function createRegionScenery(): RegionScenery {
  return buildRegionScenery(
    'steel',
    ['#a8b9be', '#697f8b', '#566f7c', '#667779', '#c5d1cc', '#729873'],
    (kit) => {
      const {
        add,
        box,
        ball,
        cylinder,
        torus,
        origin,
        roof,
        arch,
        window,
        house,
        animate,
        stone,
        roofMat,
        trim,
        dark,
        iron,
        gold,
        warm,
        glass,
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
      const observatory = origin(-30, 9);
      cylinder(observatory, stone, 0, 3.2, 0, 6.05, 6.2, 6.4, 20);
      cylinder(observatory, trim, 0, 6.5, 0, 6.4, 6.4, 0.4, 28);
      add(
        observatory,
        new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2),
        roofMat,
        0,
        6.7,
        0,
        6.2,
        6.5,
        6.2,
      );
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        box(observatory, gold, Math.sin(a) * 5.8, 3.25, Math.cos(a) * 5.8, 0.18, 6.5, 0.18);
      }
      box(observatory, dark, 0, 1.8, 6.06, 2.1, 3.6, 0.15);
      arch(observatory, trim, 0, 0, 6.18, 3.1, 4.8, 0.5);
      const scope = new THREE.Group();
      scope.position.set(0, 12.9, -1.1);
      scope.rotation.x = -0.48;
      observatory.add(scope);
      cylinder(scope, iron, 0, 1.2, 0, 0.8, 1, 5.7, 16);
      cylinder(scope, gold, 0, 4.2, 0, 0.95, 0.95, 0.2, 16);
      cylinder(scope, glass, 0, 4.33, 0, 0.77, 0.77, 0.05, 20);
      house(-40, 14, 5.8, 5.0, 4.1, iron);
      const aqueduct = origin(12, -11);
      for (const z of [-13, 1, 14]) {
        box(aqueduct, stone, 0, 5.8, z, 2.5, 11.6, 4.25);
        box(aqueduct, trim, 0, 1.0, z, 2.75, 1.2, 4.5);
      }
      box(aqueduct, stone, 0, 12.0, 0, 3.7, 0.8, 31.6);
      for (const side of [-1, 1]) box(aqueduct, trim, side * 1.7, 13.0, 0, 0.3, 1.6, 31.6);
      box(aqueduct, glass, 0, 12.5, 0, 2.8, 0.08, 31.5);
      for (const z of [-6, 7]) {
        const a = arch(aqueduct, trim, 0, 3, z, 12.5, 9, 1.2);
        a.rotation.y = Math.PI / 2;
      }
      const workshop = origin(49, 17);
      box(workshop, stone, 0, 3.7, 0, 9.7, 7.4, 8.0);
      roof(workshop, iron, 0, 7.35, 0, 10.1, 2.4, 8.5);
      for (const x of [-3, 0, 3]) window(workshop, x, 4.8, 4.05, 1.4, 2.0);
      box(workshop, dark, 0, 1.8, 4.07, 2.7, 3.6, 0.1);
      const stack = origin(56, 17);
      cylinder(stack, iron, 0, 7.4, 0, 1.2, 1.4, 14.8, 12);
      torus(stack, gold, 0, 14.4, 0, 1.3, 0.15, true);
      const gear = new THREE.Group();
      gear.position.set(-4.8, 4.0, 4.35);
      workshop.add(gear);
      torus(gear, gold, 0, 0, 0, 2.1, 0.23);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const tooth = box(gear, gold, Math.sin(a) * 2.2, Math.cos(a) * 2.2, 0, 0.45, 0.6, 0.4);
        tooth.rotation.z = -a;
      }
      for (let i = 0; i < 6; i++) {
        const beam = box(gear, iron, 0, 0, 0, 0.2, 4.0, 0.25);
        beam.rotation.z = (i * Math.PI) / 3;
      }
      animate(gear, (t) => {
        gear.rotation.z = t * 0.06;
      });
    },
  );
}
