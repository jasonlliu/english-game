import * as THREE from 'three';
import { anatomyKit, type PetKit, type SpeciesAnatomy } from './anatomy';

/** A celestial deer whose long antlers echo the veins of its broad manta wings. */
export function buildLumi(k: PetKit): SpeciesAnatomy {
  const a = anatomyKit(k);
  const pale = k.material('#e9e0f4', { roughness: 0.5 });
  const violet = k.material('#8d82c9', { roughness: 0.45 });
  const deep = k.material('#5e568a');
  const gold = k.material('#ecd5a2', { roughness: 0.38, metalness: 0.32 });
  const wingMat = k.material('#9fa1e4', {
    roughness: 0.4,
    side: THREE.DoubleSide,
    emissive: '#616cb1',
    emissiveIntensity: 0.15,
  });
  const glow = k.material('#f7f0c7', { emissive: '#e7cba2', emissiveIntensity: 0.4 });
  k.soft(k.rig, violet, [0, 0.85, 0.08], [0.28, 0.29, 0.48]);
  k.soft(k.rig, pale, [0, 0.87, -0.25], [0.25, 0.31, 0.26]);
  k.tapered(
    k.rig,
    pale,
    [
      [0, 0.86, -0.27],
      [0, 1.15, -0.39],
      [0, 1.39, -0.37],
    ],
    [0.21, 0.15, 0.12],
  );
  const head = k.pivot(k.rig, [0, 1.46, -0.38]);
  k.soft(head, pale, [0, 0, 0], [0.185, 0.2, 0.245]);
  k.soft(head, violet, [0, -0.11, -0.24], [0.13, 0.09, 0.16]);
  k.soft(head, deep, [0, -0.09, -0.365], [0.052, 0.032, 0.034], true);
  const eyes = k.eyes(head, 0.016, -0.2, 0.11, 0.048, '#9076b6');
  for (const side of [-1, 1]) {
    const ear = a.fin(
      head,
      violet,
      [side * 0.16, 0.09, 0.01],
      [
        [0, 0],
        [side * 0.28, 0.2],
        [side * 0.27, 0.035],
        [side * 0.08, -0.045],
      ],
    );
    ear.rotation.y = side * -0.3;
    k.tapered(
      head,
      gold,
      [
        [side * 0.095, 0.16, 0.02],
        [side * 0.15, 0.35, 0.08],
        [side * 0.28, 0.5, 0.06],
        [side * 0.32, 0.61, -0.02],
      ],
      [0.041, 0.032, 0.022, 0.003],
    );
    k.tapered(
      head,
      gold,
      [
        [side * 0.15, 0.34, 0.08],
        [side * 0.065, 0.48, 0.01],
        [side * 0.095, 0.59, -0.03],
      ],
      [0.024, 0.016, 0.003],
    );
    a.plate(head, glow, [side * 0.32, 0.61, -0.02], [0.028, 0.054, 0.028]);
  }
  a.plate(head, glow, [0, 0.1, -0.208], [0.043, 0.075, 0.025]);
  const wings: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const wing = k.pivot(k.rig, [side * 0.22, 0.96, 0.11]);
    wing.scale.x = side;
    a.fin(
      wing,
      wingMat,
      [0, 0, 0],
      [
        [0, 0],
        [0.24, 0.3],
        [0.93, 0.64],
        [1.19, 0.54],
        [0.94, 0.22],
        [0.77, 0.16],
        [0.9, -0.04],
        [0.54, -0.19],
        [0.46, -0.31],
        [0.15, -0.14],
      ],
      0.018,
    );
    k.tube(
      wing,
      gold,
      [
        [0, 0, -0.019],
        [0.36, 0.28, -0.019],
        [0.91, 0.58, -0.019],
        [1.17, 0.54, -0.019],
      ],
      0.013,
    );
    k.tube(
      wing,
      pale,
      [
        [0, 0, -0.019],
        [0.35, 0.11, -0.019],
        [0.93, 0.23, -0.019],
      ],
      0.009,
    );
    k.tube(
      wing,
      pale,
      [
        [0, 0, -0.019],
        [0.25, -0.055, -0.019],
        [0.76, -0.07, -0.019],
      ],
      0.009,
    );
    for (const [x, y] of [
      [0.53, 0.26],
      [0.83, 0.38],
      [0.47, -0.06],
    ]) {
      a.plate(wing, glow, [x, y, -0.04], [0.035, 0.058, 0.012]);
    }
    wings.push(wing);
  }
  const tail = k.pivot(k.rig, [0, 0.91, 0.48]);
  for (const side of [-1, 1]) {
    k.tapered(
      tail,
      side < 0 ? pale : violet,
      [
        [side * 0.04, 0, 0],
        [side * 0.18, -0.11, 0.23],
        [side * 0.2, -0.4, 0.62],
        [side * 0.15, -0.27, 0.91],
      ],
      [0.065, 0.068, 0.039, 0.002],
      0.35,
    );
  }
  const seat = new THREE.Vector3(0, 1.14, 0.15);
  const tack = k.pivot(k.rig, [0, 0, 0]);
  tack.visible = false;
  k.soft(tack, deep, [0, 1.115, 0.15], [0.24, 0.043, 0.23]);
  k.soft(tack, gold, [0, 1.16, 0.32], [0.22, 0.06, 0.035]);
  for (const side of [-1, 1]) {
    k.tube(
      tack,
      gold,
      [
        [side * 0.12, 1.38, -0.59],
        [side * 0.2, 1.22, -0.3],
        [side * 0.16, 1.29, -0.01],
      ],
      0.012,
    );
  }
  return {
    legs: a.legs(pale, gold, 0.21, 0.3, 0.7, 0.066),
    eyes,
    head,
    tail,
    wings,
    glow,
    seat,
    tack,
    signature(time, _move, flying) {
      wings.forEach((wing, i) => {
        const side = i ? 1 : -1;
        wing.rotation.y = side * (flying ? 0.04 : 0.62);
        wing.rotation.z =
          side *
          (flying ? -0.16 + Math.sin(time * 6.5) * 0.52 : 0.05 + Math.sin(time * 1.8) * 0.075);
        wing.rotation.x = flying ? -0.25 : 0.08;
      });
    },
  };
}
