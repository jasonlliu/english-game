import type * as THREE from 'three';
import { anatomyKit, type PetKit, type SpeciesAnatomy } from './anatomy';

/** A tide dragon: high curved neck, branching coral crown and a long fan-fin tail. */
export function buildRipple(k: PetKit): SpeciesAnatomy {
  const a = anatomyKit(k);
  const blue = k.material('#207f9b', { roughness: 0.36 });
  const aqua = k.material('#55c8cb', { roughness: 0.38 });
  const pearl = k.material('#f5efcf', { roughness: 0.25, metalness: 0.16 });
  const fin = k.material('#6f8bdc', { roughness: 0.4, side: 2 });
  const glow = k.material('#caffed', { emissive: '#60e7d7', emissiveIntensity: 0.5 });
  k.soft(k.rig, blue, [0, 0.47, 0.12], [0.28, 0.29, 0.64]);
  k.tapered(
    k.rig,
    aqua,
    [
      [0, 0.47, -0.25],
      [0, 0.82, -0.44],
      [0, 1.12, -0.43],
    ],
    [0.26, 0.19, 0.16],
  );
  k.tapered(
    k.rig,
    pearl,
    [
      [0, 0.43, -0.41],
      [0, 0.8, -0.59],
      [0, 1.11, -0.55],
    ],
    [0.15, 0.105, 0.1],
    0.55,
  );
  const head = k.pivot(k.rig, [0, 1.19, -0.46]);
  k.soft(head, aqua, [0, 0, 0], [0.25, 0.2, 0.28]);
  k.soft(head, pearl, [0, -0.065, -0.25], [0.17, 0.095, 0.2]);
  k.soft(head, blue, [0, -0.013, -0.41], [0.095, 0.043, 0.051], true);
  const eyes = k.eyes(head, 0.055, -0.24, 0.145, 0.051, '#944e7d');
  const fans: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    k.tapered(
      head,
      pearl,
      [
        [side * 0.14, 0.12, 0.02],
        [side * 0.21, 0.31, 0.12],
        [side * 0.23, 0.43, 0.23],
      ],
      [0.047, 0.03, 0.003],
    );
    k.tapered(
      head,
      pearl,
      [
        [side * 0.2, 0.29, 0.11],
        [side * 0.32, 0.32, 0.07],
        [side * 0.37, 0.4, 0.04],
      ],
      [0.023, 0.016, 0.003],
    );
    const fan = k.pivot(head, [side * 0.2, 0.015, 0.06]);
    fan.scale.x = side;
    a.fin(
      fan,
      fin,
      [0, 0, 0],
      [
        [0, 0],
        [0.17, 0.3],
        [0.21, 0.12],
        [0.39, 0.13],
        [0.28, -0.03],
        [0.38, -0.2],
        [0.06, -0.14],
      ],
    );
    k.tube(
      fan,
      aqua,
      [
        [0, 0, -0.015],
        [0.12, 0.04, -0.015],
        [0.34, 0.12, -0.015],
      ],
      0.012,
    );
    fans.push(fan);
    k.tapered(
      head,
      pearl,
      [
        [side * 0.09, -0.1, -0.36],
        [side * 0.28, -0.1, -0.48],
        [side * 0.4, 0.0, -0.49],
      ],
      [0.017, 0.012, 0.002],
    );
  }
  const tail = k.pivot(k.rig, [0, 0.46, 0.54]);
  k.tapered(
    tail,
    blue,
    [
      [0, 0, 0],
      [0.16, -0.04, 0.4],
      [0.18, 0.13, 0.76],
      [0.09, 0.31, 1.05],
    ],
    [0.2, 0.14, 0.085, 0.014],
  );
  for (const side of [-1, 1]) {
    const fan = k.pivot(tail, [0.12, 0.2, 0.8]);
    fan.rotation.x = Math.PI / 2;
    fan.scale.x = side;
    a.fin(
      fan,
      fin,
      [0, 0, 0],
      [
        [0, 0],
        [0.25, 0.12],
        [0.46, 0.49],
        [0.2, 0.41],
        [0.1, 0.65],
        [0.0, 0.31],
      ],
      0.018,
    );
  }
  for (let i = 0; i < 4; i++) {
    const crest = a.fin(
      k.rig,
      fin,
      [0, 0.74 - i * 0.045, -0.04 + i * 0.19],
      [
        [0, 0],
        [-0.06, 0.17],
        [0.12, 0.32],
        [0.16, 0.01],
      ],
    );
    crest.rotation.y = Math.PI / 2;
  }
  const heart = k.pivot(k.rig, [0, 0.8, -0.63]);
  k.soft(heart, glow, [0, 0, 0], [0.077, 0.077, 0.077], true);
  return {
    legs: a.legs(aqua, pearl, 0.245, 0.32, 0.28, 0.085),
    eyes,
    head,
    tail,
    glow,
    signature(time) {
      fans.forEach((fan, i) => {
        fan.rotation.y = (i ? 1 : -1) * (0.28 + Math.sin(time * 1.8) * 0.12);
      });
      heart.position.y = 0.8 + Math.sin(time * 1.8) * 0.025;
    },
  };
}
