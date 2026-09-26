import { buildRegionScenery } from '../kit';
import { buildTemple } from '../temple';
import type { RegionScenery } from '../types';
export function createRegionScenery(): RegionScenery {
  return buildRegionScenery(
    'earth',
    ['#d1a16e', '#9c6848', '#9d5e43', '#846445', '#efd0a1', '#729873'],
    (kit) => {
      const {
        box,
        ball,
        cylinder,
        torus,
        origin,
        arch,
        house,
        stone,
        plaster,
        trim,
        dark,
        gold,
        warm,
        terracotta,
        sandstone,
        ocean,
      } = kit;
      buildTemple(kit, (temple) => {
        box(temple, sandstone, 0, 8.5, 0, 17.0, 1.2, 10.8);
        box(temple, trim, 0, 9.15, 0, 16.2, 0.18, 10.1);
        box(temple, terracotta, 0, 9.8, -0.2, 13.2, 1.25, 7.6);
        box(temple, trim, 0, 10.48, -0.2, 13.5, 0.17, 7.9);
        box(temple, sandstone, 0, 11.08, -0.4, 9.6, 1.08, 5.1);
        box(temple, trim, 0, 11.69, -0.4, 9.9, 0.19, 5.4);
        box(temple, stone, 0, 12.18, -0.5, 5.8, 0.8, 3.2);
        torus(temple, gold, 0, 12.4, 2.0, 1.4, 0.16);
        ball(temple, warm, 0, 12.4, 2.03, 0.63, 0.63, 0.15);
        for (const side of [-1, 1]) box(temple, gold, side * 6.5, 9.75, 4.95, 0.24, 1.4, 0.24);
      });
      const cliff = origin(-47, -6);
      for (let i = 0; i < 7; i++) {
        box(
          cliff,
          i % 2 ? terracotta : sandstone,
          0,
          1.6 + i * 3.0,
          -i * 0.35,
          13.6 - i * 0.75,
          3.0,
          15.5 - i * 0.7,
        );
        for (const side of [-1, 1])
          box(cliff, stone, side * (6 - i * 0.23), 2 + i * 3, 4.4 - i * 0.15, 0.45, 2.6, 5.0);
      }
      for (let i = 0; i < 5; i++) {
        const x = (i - 2) * 2.4;
        box(cliff, dark, x, 3.2 + (i % 2) * 6, 7.81, 1.5, 2.8, 0.15);
        arch(cliff, trim, x, 1.8 + (i % 2) * 6, 7.95, 2.1, 3.4, 0.35);
        box(cliff, sandstone, x, 1.6 + (i % 2) * 6, 8.0, 2.7, 0.3, 0.65);
      }
      house(-41, 13, 5.9, 5.0, 4.1, sandstone);
      for (const [x, z, r, h] of [
        [-47, -36, 4.4, 19],
        [-25, -37, 2.9, 16],
      ]) {
        const pillar = origin(x, z);
        for (let i = 0; i < 7; i++)
          cylinder(
            pillar,
            i % 2 ? terracotta : sandstone,
            0,
            ((i + 0.5) * h) / 7,
            0,
            r * (1 - i * 0.035),
            r * (1 - i * 0.025),
            h / 7,
            9,
          );
      }
      const bridge = origin(-36, -36);
      arch(bridge, trim, 0, 3.4, 0, 22, 12, 2.5);
      box(bridge, sandstone, 0, 15.3, 0, 24.2, 0.6, 3.2);
      for (let i = 0; i < 13; i++) box(bridge, trim, -11.5 + i * 1.92, 16.0, 1.45, 0.13, 1.0, 0.12);
      const oasis = origin(18, 17);
      cylinder(oasis, trim, 0, 0.28, 0, 4.7, 4.8, 0.6, 24);
      cylinder(oasis, ocean, 0, 0.62, 0, 3.9, 3.9, 0.08, 24);
      oasis.scale.z = 0.82;
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        cylinder(oasis, plaster, Math.sin(a) * 4.2, 1.15, Math.cos(a) * 4.2, 0.18, 0.24, 2.3, 9);
      }
      const ruin = origin(23, 26);
      box(ruin, sandstone, 0, 2.6, -1.5, 7.2, 5.2, 1.3);
      for (const x of [-3, 0, 3]) {
        cylinder(ruin, trim, x, 3.2, 1.8, 0.33, 0.45, 6.4, 10);
        box(ruin, trim, x, 6.4, 1.8, 1.15, 0.45, 1.1);
      }
      box(ruin, sandstone, 0, 6.7, 1.8, 7.4, 0.6, 1.1);
    },
  );
}
