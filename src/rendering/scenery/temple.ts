import type * as THREE from 'three';
import type { SceneryKit } from './kit';
/** The reusable sanctuary facade; roof geometry belongs to the loaded region. */
export function buildTemple(
  kit: SceneryKit,
  buildRoof: (temple: THREE.Group, window: THREE.MeshStandardMaterial) => void,
) {
  const {
    material,
    box,
    cylinder,
    cone,
    origin,
    arch,
    window,
    stone,
    plaster,
    roofMat,
    trim,
    dark,
    gold,
  } = kit;
  // The outdoor sanctuary has a real façade, portico, side towers and roofline.
  const temple = origin(-8, -34);
  box(temple, stone, 0, 0.05, 0, 17, 0.6, 10.8);
  box(temple, plaster, -5.2, 4.0, 4.75, 5.8, 8, 1.2);
  box(temple, plaster, 5.2, 4.0, 4.75, 5.8, 8, 1.2);
  box(temple, stone, -8, 4, 0, 1.0, 8, 10);
  box(temple, stone, 8, 4, 0, 1, 8, 10);
  box(temple, stone, 0, 4, -4.8, 16, 8, 0.8);
  box(temple, dark, 0, 3.4, 4.0, 4.3, 6.8, 0.3);
  arch(temple, trim, 0, 0, 5.2, 5.3, 7.5, 1.0);
  const templeWindow = material('#69c9bb', { emissive: '#4fb89a', emissiveIntensity: 0.3 });
  box(temple, templeWindow, 0, 3.1, 4.2, 2.55, 5.7, 0.12);
  for (const side of [-1, 1]) {
    for (const x of [3.5, 6.7]) {
      cylinder(temple, trim, side * x, 3.7, 5.0, 0.37, 0.48, 7.4, 12);
      box(temple, stone, side * x, 0.24, 5, 0.95, 0.48, 0.95);
      box(temple, trim, side * x, 7.25, 5, 1.1, 0.45, 1.1);
    }
    window(temple, side * 5.3, 4.7, 5.41, 1.25, 2.1);
    const tower = origin(-8 + side * 11, -32);
    box(tower, stone, 0, 4.5, 0, 3.7, 9, 4.4);
    box(tower, trim, 0, 8.6, 0, 4.0, 0.5, 4.7);
    cone(tower, roofMat, 0, 10.1, 0, 2.7, 2.5, 4);
    window(tower, 0, 6.0, 2.23, 0.8, 1.65);
  }
  box(temple, trim, 0, 7.85, 0.2, 17.3, 0.7, 11.0);
  buildRoof(temple, templeWindow);
  for (let i = 0; i < 7; i++) box(temple, gold, (i - 3) * 2.15, 7.82, 5.77, 0.35, 0.35, 0.08);
  kit.onUpdate((_time, visited) => {
    templeWindow.emissiveIntensity = visited ? 0.7 : 0.27;
  });
}
