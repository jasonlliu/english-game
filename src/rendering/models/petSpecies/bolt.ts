import * as THREE from 'three';
import { anatomyKit, type PetKit, type SpeciesAnatomy } from './anatomy';

/** A clockwork griffin: articulated talons, blade feathers and a spinning chest dynamo. */
export function buildBolt(k: PetKit): SpeciesAnatomy {
  const a = anatomyKit(k);
  const steel = k.material('#b5d0d7', { roughness: 0.35, metalness: 0.65 });
  const dark = k.material('#29465b', { roughness: 0.5, metalness: 0.5 });
  const brass = k.material('#e9bc62', { roughness: 0.36, metalness: 0.6 });
  const glow = k.material('#a1fff2', {
    emissive: '#38cfdf',
    emissiveIntensity: 0.55,
    roughness: 0.27,
  });
  a.plate(k.rig, dark, [0, 0.86, 0.02], [0.3, 0.4, 0.38]);
  a.plate(k.rig, steel, [0, 1.02, -0.16], [0.35, 0.3, 0.27]);
  const core = k.pivot(k.rig, [0, 0.98, -0.39]);
  k.mesh(core, new THREE.TorusGeometry(0.15, 0.03, 6, 20), brass);
  a.plate(core, glow, [0, 0, 0], [0.115, 0.115, 0.072]);
  for (const x of [-1, 1]) a.block(core, steel, [x * 0.14, 0, -0.02], [0.045, 0.08, 0.055]);
  k.tapered(
    k.rig,
    dark,
    [
      [0, 1.13, -0.03],
      [0, 1.27, -0.2],
      [0, 1.41, -0.27],
    ],
    [0.17, 0.13, 0.12],
  );
  const head = k.pivot(k.rig, [0, 1.42, -0.28]);
  a.plate(head, steel, [0, 0, 0], [0.25, 0.22, 0.28]);
  a.plate(head, dark, [0, 0.02, -0.2], [0.23, 0.1, 0.1]);
  const beak = a.spike(head, brass, [0, -0.045, -0.32], [0.105, 0.28, 0.105]);
  beak.rotation.x = -Math.PI / 2 - 0.16;
  const eyes = k.eyes(head, 0.047, -0.27, 0.137, 0.046, '#53b7c5');
  for (const side of [-1, 1]) {
    const crest = a.fin(
      head,
      dark,
      [side * 0.1, 0.14, 0.04],
      [
        [-0.025, 0],
        [-0.1, 0.09],
        [0, 0.45],
        [0.06, 0.28],
        [0.08, 0.0],
      ],
    );
    crest.rotation.x = 0.75;
    crest.rotation.z = side * -0.2;
    a.plate(head, brass, [side * 0.24, 0.0, 0.02], [0.04, 0.08, 0.1]);
  }
  const wings: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const wing = k.pivot(k.rig, [side * 0.27, 1.05, 0.1]);
    wing.scale.x = side;
    a.plate(wing, brass, [0.04, 0, 0], [0.12, 0.12, 0.12]);
    for (let i = 0; i < 3; i++) {
      const feather = a.fin(
        wing,
        i === 1 ? steel : dark,
        [0.1 + i * 0.04, -i * 0.12, i * 0.07],
        [
          [0, 0],
          [0.18, 0.15],
          [0.69 - i * 0.08, 0.08],
          [0.86 - i * 0.13, -0.09],
          [0.33, -0.065],
          [0.1, -0.11],
        ],
      );
      feather.rotation.y = -0.25;
      a.fin(
        wing,
        glow,
        [0.18 + i * 0.04, -i * 0.12, i * 0.07 - 0.021],
        [
          [0, 0.065],
          [0.43 - i * 0.07, 0.025],
          [0.46 - i * 0.07, 0],
          [0.06, 0.025],
        ],
        0.01,
      );
    }
    wings.push(wing);
  }
  const tail = k.pivot(k.rig, [0, 0.79, 0.34]);
  k.tapered(
    tail,
    dark,
    [
      [0, 0, 0],
      [0, -0.07, 0.28],
      [0, -0.03, 0.55],
    ],
    [0.115, 0.07, 0.035],
  );
  for (const side of [-1, 0, 1]) {
    const vane = a.fin(
      tail,
      side ? steel : brass,
      [side * 0.075, -0.02, 0.35],
      [
        [-0.04, 0],
        [-0.08, 0.31],
        [0, 0.59],
        [0.08, 0.31],
        [0.04, 0],
      ],
    );
    vane.rotation.x = Math.PI / 2;
    vane.rotation.y = side * 0.3;
  }
  const legs = a.legs(dark, brass, 0.225, 0.12, 0.67, 0.1, true, true);
  for (const leg of legs) {
    for (const x of [-0.07, 0, 0.07]) {
      const talon = a.spike(leg.ankle, steel, [x, 0, -0.15], [0.028, 0.21, 0.035]);
      talon.rotation.x = -Math.PI / 2;
    }
  }
  return {
    legs,
    eyes,
    head,
    tail,
    glow,
    signature(time, move) {
      core.rotation.z = time * 0.65;
      wings.forEach((wing, i) => {
        wing.rotation.y = (i ? 1 : -1) * (0.42 + move * 0.25 + Math.sin(time * 1.5) * 0.055);
        wing.rotation.z = (i ? 1 : -1) * (-0.08 + move * 0.15);
      });
    },
  };
}
