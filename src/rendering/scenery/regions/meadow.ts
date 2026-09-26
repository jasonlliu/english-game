import * as THREE from 'three';
import { createMeadowRace } from '../meadow/race';
import { buildRegionScenery } from '../kit';
import { buildTemple } from '../temple';
import { buildMeadowExpansion } from '../meadow/landmarks';
import { buildMeadowVillage } from '../meadow/village';
import { createMeadowWildlife } from '../meadow/wildlife';
import { createMeadowSecrets } from '../meadow/secrets';
import { buildMeadowCliffs } from '../meadow/cliffs';
import { paintArchitecture } from '../paintedSurfaces';
import type { RegionScenery } from '../types';
export function createRegionScenery(): RegionScenery {
  const scenery = buildRegionScenery(
    'meadow',
    ['#ecd8b2', '#969b83', '#638a91', '#795e49', '#ead9b5', '#79996b'],
    (kit) => {
      paintArchitecture(kit);
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
        fence,
        animate,
        stone,
        plaster,
        roofMat,
        wood,
        trim,
        gold,
        white,
      } = kit;
      buildTemple(kit, (temple, templeWindow) => {
        roof(temple, roofMat, 0, 8.05, 0, 18.1, 3.6, 11.8);
        roof(temple, trim, 0, 11.2, -0.5, 9.5, 2.2, 7.7);
        torus(temple, gold, 0, 11.3, 5.92, 1.0, 0.09);
        ball(temple, templeWindow, 0, 11.3, 5.94, 0.55, 0.55, 0.13);
      });
      buildMeadowVillage(kit);
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
      buildMeadowCliffs(kit);
      const bridge = origin(-41, -26);
      arch(bridge, trim, 0, 3, 0, 24, 12, 2.3);
      box(bridge, stone, 0, 15.0, 0, 24.2, 0.65, 3.4);
      for (const side of [-1, 1]) box(bridge, stone, side * 11.3, 7, 0, 1.4, 14, 2.8);
      for (let i = 0; i < 13; i++) box(bridge, trim, -11.6 + i * 1.93, 15.7, 1.55, 0.16, 1.1, 0.14);
      buildMeadowExpansion(kit);
    },
  );
  let wildlife: ReturnType<typeof createMeadowWildlife> | undefined;
  let race: ReturnType<typeof createMeadowRace> | undefined;
  let secrets: ReturnType<typeof createMeadowSecrets> | undefined;
  try {
    race = createMeadowRace();
    scenery.group.add(race.group);
    wildlife = createMeadowWildlife();
    scenery.group.add(wildlife.group);
    secrets = createMeadowSecrets();
    scenery.group.add(secrets.group);
    return {
      group: scenery.group,
      wildlife: () => wildlife?.observe() ?? [],
      update(time, visited, frame) {
        scenery.update(time, visited);
        race?.update(time, frame);
        wildlife?.update(time, frame);
        secrets?.update(time, frame);
      },
      dispose() {
        race?.dispose();
        secrets?.dispose();
        wildlife?.dispose();
        scenery.dispose();
      },
    };
  } catch (error) {
    race?.dispose();
    secrets?.dispose();
    wildlife?.dispose();
    scenery.dispose();
    throw error;
  }
}
