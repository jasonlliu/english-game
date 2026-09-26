import { anatomyKit, type PetKit, type SpeciesAnatomy } from './anatomy';

/** A little walking mountain, with overlapping stone slabs and a living crystal grove. */
export function buildMoss(k: PetKit): SpeciesAnatomy {
  const a = anatomyKit(k);
  const skin = k.material('#73886b', { roughness: 0.93 });
  const stone = k.material('#52665d', { roughness: 0.94 });
  const edge = k.material('#a3ab83', { roughness: 0.88 });
  const ivory = k.material('#e9d7a1');
  const green = k.material('#508b64');
  const glow = k.material('#aadcb2', {
    emissive: '#5ba97d',
    emissiveIntensity: 0.33,
    roughness: 0.33,
  });
  k.soft(k.rig, skin, [0, 0.46, 0.09], [0.62, 0.36, 0.66]);
  for (let row = 0; row < 3; row++) {
    a.plate(
      k.rig,
      stone,
      [0, 0.73 + (row === 1 ? 0.055 : 0), -0.3 + row * 0.36],
      [0.57, 0.22, 0.31],
    );
    for (const side of [-1, 1]) {
      const slab = a.plate(
        k.rig,
        row % 2 ? edge : stone,
        [side * 0.48, 0.53, -0.34 + row * 0.37],
        [0.21, 0.3, 0.29],
      );
      slab.rotation.z = side * 0.28;
    }
  }
  const head = k.pivot(k.rig, [0, 0.45, -0.73]);
  k.soft(head, skin, [0, 0, 0], [0.32, 0.27, 0.31]);
  a.plate(head, edge, [0, 0.16, 0.01], [0.36, 0.17, 0.31]);
  k.soft(head, ivory, [0, -0.1, -0.24], [0.23, 0.095, 0.16]);
  k.soft(head, stone, [0, -0.055, -0.365], [0.1, 0.055, 0.06], true);
  const eyes = k.eyes(head, 0.044, -0.271, 0.18, 0.045, '#d59b41');
  for (const side of [-1, 1]) {
    k.tapered(
      head,
      ivory,
      [
        [side * 0.2, -0.13, -0.13],
        [side * 0.32, -0.13, -0.33],
        [side * 0.29, 0.09, -0.48],
      ],
      [0.076, 0.053, 0.004],
    );
    a.plate(head, stone, [side * 0.31, 0.02, 0.09], [0.14, 0.14, 0.21]);
  }
  const grove = k.pivot(k.rig, [0, 0.89, 0.09]);
  k.tapered(
    grove,
    stone,
    [
      [0, 0, 0],
      [-0.025, 0.2, 0.03],
      [0.02, 0.38, 0.02],
    ],
    [0.086, 0.05, 0.028],
  );
  k.tapered(
    grove,
    stone,
    [
      [0, 0.18, 0.025],
      [-0.2, 0.3, 0.03],
      [-0.27, 0.4, 0.02],
    ],
    [0.05, 0.03, 0.006],
  );
  k.tapered(
    grove,
    stone,
    [
      [0, 0.25, 0.025],
      [0.19, 0.36, 0.03],
      [0.26, 0.39, 0.06],
    ],
    [0.04, 0.025, 0.004],
  );
  a.plate(grove, green, [-0.19, 0.4, 0.04], [0.29, 0.12, 0.23]);
  a.plate(grove, green, [0.17, 0.43, 0.04], [0.28, 0.14, 0.25]);
  a.plate(grove, glow, [0.02, 0.55, 0.02], [0.1, 0.2, 0.1]);
  for (const side of [-1, 1]) {
    a.plate(k.rig, glow, [side * 0.33, 0.94, 0.38], [0.095, 0.26, 0.11]);
    a.plate(k.rig, glow, [side * 0.46, 0.76, 0.45], [0.085, 0.18, 0.095]);
  }
  const tail = k.pivot(k.rig, [0, 0.4, 0.61]);
  k.tapered(
    tail,
    skin,
    [
      [0, 0, 0],
      [0.03, -0.07, 0.24],
      [0.03, 0.035, 0.42],
    ],
    [0.12, 0.09, 0.025],
  );
  a.plate(tail, stone, [0.03, 0.035, 0.38], [0.18, 0.14, 0.17]);
  const legs = a.legs(skin, stone, 0.48, 0.38, 0.32, 0.155);
  return {
    legs,
    eyes,
    head,
    tail,
    glow,
    signature(time, move) {
      grove.rotation.z = Math.sin(time * 1.25) * 0.018 * (1 - move * 0.5);
    },
  };
}
