import type * as THREE from 'three';
import { anatomyKit, type PetKit, type SpeciesAnatomy } from './anatomy';

/** A two-legged volcanic runner, balanced by a long tail and swept basalt horns. */
export function buildCinder(k: PetKit): SpeciesAnatomy {
  const a = anatomyKit(k);
  const red = k.material('#b73f35');
  const orange = k.material('#ef9e4b');
  const basalt = k.material('#3d3845', { roughness: 0.64 });
  const cream = k.material('#f8df9b');
  const glow = k.material('#ffd77b', { emissive: '#ff761e', emissiveIntensity: 0.5 });
  const body = k.soft(k.rig, red, [0, 0.79, 0.12], [0.29, 0.43, 0.42]);
  body.rotation.x = -0.35;
  k.soft(k.rig, orange, [0, 0.82, -0.16], [0.2, 0.34, 0.16]);
  k.tapered(
    k.rig,
    red,
    [
      [0, 0.99, -0.06],
      [0, 1.17, -0.25],
      [0, 1.27, -0.38],
    ],
    [0.21, 0.17, 0.16],
  );
  const head = k.pivot(k.rig, [0, 1.33, -0.39]);
  a.plate(head, red, [0, 0, -0.02], [0.31, 0.26, 0.33]);
  k.soft(head, orange, [0, -0.06, -0.28], [0.21, 0.115, 0.24]);
  a.plate(head, basalt, [0, -0.0, -0.42], [0.18, 0.06, 0.07]);
  const eyes = k.eyes(head, 0.07, -0.26, 0.155, 0.058, '#f4c465');
  const arms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    k.tapered(
      head,
      basalt,
      [
        [side * 0.18, 0.12, 0.05],
        [side * 0.24, 0.29, 0.23],
        [side * 0.19, 0.33, 0.47],
      ],
      [0.09, 0.062, 0.004],
    );
    k.tapered(
      head,
      glow,
      [
        [side * 0.19, 0.18, 0.13],
        [side * 0.23, 0.27, 0.27],
        [side * 0.2, 0.3, 0.4],
      ],
      [0.018, 0.015, 0.002],
    );
    const brow = a.plate(head, basalt, [side * 0.165, 0.17, -0.22], [0.13, 0.05, 0.12]);
    brow.rotation.z = side * -0.18;
    const arm = k.pivot(k.rig, [side * 0.24, 0.99, -0.08]);
    k.tapered(
      arm,
      red,
      [
        [0, 0, 0],
        [side * 0.06, -0.17, 0.04],
        [side * 0.07, -0.23, -0.12],
      ],
      [0.085, 0.057, 0.054],
    );
    a.plate(arm, basalt, [side * 0.06, -0.02, 0.04], [0.14, 0.17, 0.18]);
    for (const clawX of [-0.035, 0.035]) {
      const claw = a.spike(arm, cream, [side * 0.07 + clawX, -0.235, -0.18], [0.023, 0.1, 0.025]);
      claw.rotation.x = -Math.PI / 2;
    }
    arms.push(arm);
    for (let i = 0; i < 3; i++) {
      a.plate(k.rig, basalt, [side * 0.27, 0.98 - i * 0.14, 0.13 + i * 0.065], [0.095, 0.15, 0.23]);
      a.plate(k.rig, glow, [side * 0.32, 0.91 - i * 0.14, 0.13 + i * 0.065], [0.015, 0.028, 0.13]);
    }
  }
  const tail = k.pivot(k.rig, [0, 0.71, 0.42]);
  k.tapered(
    tail,
    red,
    [
      [0, 0, 0],
      [0.03, -0.12, 0.35],
      [0.11, -0.04, 0.73],
      [0.12, 0.12, 1.02],
    ],
    [0.22, 0.14, 0.07, 0.025],
  );
  const flame = k.pivot(tail, [0.12, 0.03, 0.95]);
  a.fin(
    flame,
    orange,
    [0, 0, 0],
    [
      [-0.13, 0],
      [-0.24, 0.2],
      [-0.07, 0.15],
      [0.02, 0.57],
      [0.13, 0.28],
      [0.22, 0.4],
      [0.18, 0.08],
      [0.07, -0.08],
    ],
  );
  a.fin(
    flame,
    glow,
    [0, 0.025, -0.023],
    [
      [-0.085, 0],
      [-0.09, 0.13],
      [0.035, 0.37],
      [0.07, 0.13],
      [0.13, 0.2],
      [0.09, 0.015],
    ],
  );
  for (let i = 0; i < 4; i++) {
    const ridge = a.fin(
      k.rig,
      basalt,
      [0, 1.17 - i * 0.13, 0.13 + i * 0.13],
      [
        [-0.1, 0],
        [-0.02, 0.22],
        [0.16, 0.09],
        [0.12, 0],
      ],
    );
    ridge.rotation.y = Math.PI / 2;
  }
  const legs = a.legs(red, basalt, 0.24, 0.17, 0.62, 0.125, true);
  for (const leg of legs) {
    for (const x of [-0.065, 0, 0.065]) {
      const toe = a.spike(leg.ankle, cream, [x, -0.005, -0.22], [0.027, 0.14, 0.033]);
      toe.rotation.x = -Math.PI / 2;
    }
  }
  return {
    legs,
    eyes,
    head,
    tail,
    glow,
    signature(time, move) {
      flame.scale.y = 1 + Math.sin(time * 5) * 0.08;
      flame.rotation.z = Math.sin(time * 2.8) * 0.07;
      arms.forEach((arm, i) => {
        arm.rotation.x = -0.12 - move * 0.28 + Math.sin(time * 1.4 + i) * 0.025 * (1 - move);
      });
    },
  };
}
