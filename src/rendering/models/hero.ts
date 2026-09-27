import * as THREE from 'three';
import { modelKit } from './modelKit';
import { readLocomotion, sampleFootstep, solveLeg } from './locomotion';
import { heroHairCap, heroLoft, type HeroSection } from './heroGeometry';
import type { ModelRig, Point } from './types';

/** Original sunny young explorer. Forward is -Z; scene owns position and heading. */
export function createHero(): ModelRig {
  const k = modelKit();
  try {
    const { group, rig, soft, material, pivot, tube, tapered, mesh } = k;
    group.name = 'sunny-young-explorer';
    const cloth = (color: string) => material(color, { roughness: 0.88, metalness: 0 });
    const skin = material('#edb48b', { roughness: 0.76, metalness: 0 });
    const cheek = material('#db9279', { roughness: 0.79, metalness: 0 });
    const blue = cloth('#387eb6'),
      blueLight = cloth('#629dca'),
      blueDark = cloth('#28537e');
    const navy = cloth('#303d56'),
      navyLight = cloth('#41516b'),
      ivory = cloth('#f5efdf');
    const yellow = cloth('#e7ad47'),
      yellowLight = cloth('#f4c66c'),
      ochre = cloth('#b87933');
    const strapMaterial = cloth('#79573c'),
      soleMaterial = cloth('#343c49');
    const hair = material('#4c3227', { roughness: 0.73, metalness: 0 });
    const hairLight = material('#654331', { roughness: 0.72, metalness: 0 });
    const hairDark = cloth('#362921');
    const ink = material('#32251f', { roughness: 0.64, metalness: 0 });
    const white = material('#fff9eb', { side: THREE.DoubleSide, roughness: 0.32, metalness: 0 });
    const iris = material('#936038', { roughness: 0.4, metalness: 0 });
    const shine = material('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.35 });
    const profile = (
      parent: THREE.Object3D,
      mat: THREE.Material,
      sections: HeroSection[],
      options: Parameters<typeof heroLoft>[1] = {},
    ) => mesh(parent, heroLoft(sections, options), mat);
    const outline = (
      parent: THREE.Object3D,
      mat: THREE.Material,
      shape: THREE.Shape,
      point: Point,
    ) => mesh(parent, new THREE.ShapeGeometry(shape, 18), mat, point);

    const hipShell = profile(rig, navy, [
      [1.34, 0.23, 0.126, 0.014],
      [1.44, 0.267, 0.148, 0.014],
      [1.56, 0.24, 0.14, 0],
    ]);
    hipShell.name = 'hero-shorts-waist';
    profile(rig, ivory, [
      [1.46, 0.272, 0.158, 0],
      [1.55, 0.275, 0.164, 0],
      [1.8, 0.268, 0.153, 0],
      [2.08, 0.316, 0.156, 0.001],
      [2.17, 0.272, 0.124, 0],
    ]);
    const jacketSections: HeroSection[] = [
      [1.49, 0.294, 0.181, 0],
      [1.58, 0.288, 0.181, 0],
      [1.79, 0.284, 0.176, 0.004],
      [2.02, 0.337, 0.177, 0.004],
      [2.15, 0.358, 0.16, 0.006],
      [2.21, 0.282, 0.121, 0.012],
    ];
    blue.side = THREE.DoubleSide;
    const jacket = profile(rig, blue, jacketSections, { gap: 0.34 });
    jacket.name = 'hero-blue-short-jacket';
    profile(rig, skin, [
      [2.14, 0.084, 0.077, 0.005],
      [2.27, 0.088, 0.081, 0.002],
      [2.39, 0.097, 0.081, 0.002],
    ]);
    tube(
      rig,
      ivory,
      [
        [-0.123, 2.164, -0.11],
        [0, 2.118, -0.16],
        [0.123, 2.164, -0.11],
      ],
      0.018,
    );
    for (const side of [-1, 1]) {
      tube(
        rig,
        yellow,
        jacketSections.map(
          ([y, w, d, z]): Point => [side * Math.sin(0.34) * w, y, -Math.cos(0.34) * d + z - 0.004],
        ),
        0.008,
      );
      tube(
        rig,
        blueLight,
        [
          [side * 0.195, 1.56, -0.14],
          [side * 0.248, 1.66, -0.104],
          [side * 0.25, 1.71, -0.099],
        ],
        0.017,
      );
      tube(
        rig,
        blueDark,
        [
          [side * 0.13, 1.515, -0.166],
          [side * 0.256, 1.515, -0.093],
          [side * 0.29, 1.515, 0.045],
        ],
        0.016,
      );
    }

    // A folded hood frames the face; its warm lining is readable from the usual back view.
    const hood = profile(rig, yellow, [
      [2.04, 0.087, 0.035, 0.16],
      [2.12, 0.205, 0.094, 0.142],
      [2.235, 0.272, 0.122, 0.106],
      [2.3, 0.222, 0.079, 0.079],
    ]);
    hood.name = 'hero-yellow-hood';
    tube(
      rig,
      yellowLight,
      [
        [-0.249, 2.245, 0.057],
        [-0.178, 2.291, 0.137],
        [0, 2.29, 0.171],
        [0.178, 2.291, 0.137],
        [0.249, 2.245, 0.057],
      ],
      0.026,
    );
    for (const side of [-1, 1])
      tapered(
        rig,
        yellowLight,
        [
          [side * 0.225, 2.266, 0.058],
          [side * 0.174, 2.205, -0.063],
          [side * 0.122, 2.122, -0.15],
        ],
        [0.045, 0.04, 0.016],
        0.4,
      );

    const backpack = pivot(rig, [0, 0, 0]);
    backpack.name = 'hero-explorer-backpack';
    profile(
      backpack,
      ochre,
      [
        [1.59, 0.18, 0.072, 0.246],
        [1.65, 0.256, 0.118, 0.259],
        [2.02, 0.255, 0.117, 0.25],
        [2.145, 0.178, 0.07, 0.237],
      ],
      { square: 0.62 },
    );
    profile(
      backpack,
      yellow,
      [
        [1.615, 0.174, 0.069, 0.264],
        [1.69, 0.237, 0.102, 0.28],
        [2.006, 0.236, 0.102, 0.272],
        [2.122, 0.169, 0.065, 0.25],
      ],
      { square: 0.62 },
    );
    profile(
      backpack,
      yellowLight,
      [
        [1.668, 0.128, 0.016, 0.383],
        [1.713, 0.197, 0.03, 0.384],
        [1.965, 0.196, 0.025, 0.381],
        [2.004, 0.138, 0.013, 0.372],
      ],
      { square: 0.52 },
    );
    tube(
      backpack,
      ochre,
      [
        [-0.187, 1.728, 0.401],
        [-0.187, 1.94, 0.399],
        [0, 1.991, 0.394],
        [0.187, 1.94, 0.399],
        [0.187, 1.728, 0.401],
      ],
      0.008,
    );
    const sunShape = new THREE.Shape();
    for (let i = 0; i < 32; i++) {
      const angle = (i / 32) * Math.PI * 2;
      const radius = i % 4 === 0 ? 0.081 : i % 2 === 0 ? 0.051 : 0.048;
      const x = Math.sin(angle) * radius,
        y = Math.cos(angle) * radius;
      if (i === 0) sunShape.moveTo(x, y);
      else sunShape.lineTo(x, y);
    }
    sunShape.closePath();
    const sunHole = new THREE.Path();
    sunHole.absarc(0, 0, 0.027, 0, Math.PI * 2, true);
    sunShape.holes.push(sunHole);
    const badge = outline(backpack, blueDark, sunShape, [0, 1.844, 0.42]);
    badge.name = 'hero-sun-emblem';
    for (const side of [-1, 1]) {
      tube(
        rig,
        strapMaterial,
        [
          [side * 0.222, 1.64, 0.235],
          [side * 0.25, 2.055, 0.157],
          [side * 0.253, 2.195, 0.012],
          [side * 0.243, 2.055, -0.143],
          [side * 0.2, 1.73, -0.153],
        ],
        0.031,
      );
      tube(
        rig,
        ochre,
        [
          [side * 0.253, 2.166, -0.069],
          [side * 0.243, 2.046, -0.173],
          [side * 0.21, 1.817, -0.182],
        ],
        0.009,
      );
    }

    // Broad cheeks taper into a small chin; nose and muzzle share a continuous surface.
    const head = pivot(rig, [0, 2.594, -0.006]);
    head.name = 'hero-head';
    const face = profile(
      head,
      skin,
      [
        [-0.274, 0.04, 0.054, -0.015],
        [-0.24, 0.105, 0.098, -0.006],
        [-0.167, 0.181, 0.137, 0.005],
        [-0.065, 0.23, 0.166, 0.013],
        [0.043, 0.244, 0.175, 0.012],
        [0.154, 0.229, 0.165, 0.018],
        [0.229, 0.174, 0.129, 0.024],
        [0.27, 0.061, 0.048, 0.021],
      ],
      { radial: 40, face: true },
    );
    face.name = 'hero-sculpted-face';
    const eyes: THREE.Group[] = [];
    for (const side of [-1, 1]) {
      const eye = pivot(head, [side * 0.108, 0.003, -0.158]);
      eye.rotation.y = side * -0.2;
      const almond = new THREE.Shape();
      almond.moveTo(-0.058, -0.002);
      almond.bezierCurveTo(-0.05, 0.053, 0.041, 0.055, 0.061, 0.006);
      almond.bezierCurveTo(0.04, -0.04, -0.043, -0.043, -0.058, -0.002);
      outline(eye, white, almond, [0, 0, 0]);
      soft(eye, iris, [side * -0.005, 0.004, -0.008], [0.031, 0.041, 0.009], true);
      soft(eye, ink, [side * -0.005, 0.004, -0.015], [0.019, 0.032, 0.006], true);
      soft(eye, shine, [-0.012, 0.025, -0.022], [0.01, 0.011, 0.004], true);
      tube(
        eye,
        ink,
        [
          [-0.059, -0.001, -0.004],
          [-0.04, 0.035, -0.005],
          [0.006, 0.044, -0.005],
          [0.046, 0.028, -0.005],
          [0.06, 0.007, -0.004],
        ],
        0.006,
      );
      eyes.push(eye);
      tapered(
        head,
        hairDark,
        [
          [side * 0.052, 0.083, -0.16],
          [side * 0.097, 0.099, -0.155],
          [side * 0.164, 0.075, -0.128],
        ],
        [0.007, 0.011, 0.003],
        0.62,
      );
      soft(head, skin, [side * 0.235, -0.045, 0.02], [0.047, 0.077, 0.045], true);
      soft(head, cheek, [side * 0.257, -0.047, -0.009], [0.022, 0.043, 0.022], true);
    }
    const smile = new THREE.Shape();
    smile.moveTo(-0.071, -0.121);
    smile.quadraticCurveTo(0, -0.151, 0.071, -0.121);
    smile.quadraticCurveTo(0.045, -0.172, 0, -0.171);
    smile.quadraticCurveTo(-0.041, -0.169, -0.071, -0.121);
    const mouth = outline(
      head,
      material('#753f30', { side: THREE.DoubleSide, roughness: 0.8 }),
      smile,
      [0, 0, -0.162],
    );
    mouth.name = 'hero-friendly-smile';
    const teeth = new THREE.Shape();
    teeth.moveTo(-0.052, -0.131);
    teeth.quadraticCurveTo(0, -0.147, 0.052, -0.131);
    teeth.quadraticCurveTo(0.042, -0.149, 0, -0.15);
    teeth.quadraticCurveTo(-0.043, -0.148, -0.052, -0.131);
    outline(head, white, teeth, [0, 0, -0.165]);

    const hairCap = mesh(head, heroHairCap(), hair);
    hairCap.name = 'hero-chestnut-hair';
    // Broad swept locks overlap the cap; the lifted fringe keeps both eyes clear.
    for (let i = 0; i < 7; i++) {
      const x = -0.195 + i * 0.062;
      const fringe = [0.014, 0.036, 0.08, 0.116, 0.132, 0.071, 0.017][i];
      tapered(
        head,
        i === 2 || i === 5 ? hairLight : hair,
        [
          [x - 0.055, 0.277 - Math.abs(x) * 0.23, 0.044],
          [x - 0.033, 0.244, -0.114],
          [x + 0.012, fringe + 0.058, -0.184],
          [x + 0.031, fringe, -0.169],
        ],
        [0.071, 0.073, 0.04, 0.002],
        0.32,
      );
    }
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++)
        tapered(
          head,
          i === 1 ? hairLight : hair,
          [
            [side * (0.098 + i * 0.048), 0.243 - i * 0.023, 0.105],
            [side * (0.227 + i * 0.018), 0.109 - i * 0.01, 0.101 - i * 0.047],
            [side * (0.279 - i * 0.018), -0.019 - i * 0.025, 0.083 - i * 0.055],
            [side * (0.246 - i * 0.024), -0.098 - i * 0.011, 0.08 - i * 0.053],
          ],
          [0.065, 0.061, 0.032, 0.002],
          0.36,
        );
      tapered(
        head,
        hair,
        [
          [side * 0.09, 0.2, 0.18],
          [side * 0.172, 0.073, 0.227],
          [side * 0.154, -0.109, 0.191],
        ],
        [0.073, 0.065, 0.002],
        0.4,
      );
    }
    tapered(
      head,
      hairLight,
      [
        [-0.169, 0.259, 0.089],
        [-0.054, 0.35, 0.044],
        [0.086, 0.33, -0.02],
        [0.151, 0.262, -0.085],
      ],
      [0.049, 0.066, 0.047, 0.002],
      0.32,
    );
    tapered(
      head,
      hair,
      [
        [-0.11, 0.241, 0.115],
        [-0.18, 0.306, 0.087],
        [-0.22, 0.37, 0.06],
      ],
      [0.06, 0.05, 0.002],
      0.32,
    );

    const legPivots: THREE.Group[] = [],
      knees: THREE.Group[] = [],
      ankles: THREE.Group[] = [];
    const armPivots: THREE.Group[] = [],
      elbows: THREE.Group[] = [];
    for (const side of [-1, 1]) {
      const leg = pivot(rig, [side * 0.145, 1.46, 0.01]);
      leg.name = `hero-hip-${side}`;
      profile(
        leg,
        navy,
        [
          [-0.695, 0.118, 0.117, 0],
          [-0.59, 0.122, 0.128, 0.009],
          [-0.31, 0.133, 0.142, 0.013],
          [0.041, 0.128, 0.139, 0],
        ],
        { square: 0.83 },
      );
      profile(
        leg,
        navyLight,
        [
          [-0.706, 0.123, 0.12, 0],
          [-0.661, 0.123, 0.123, 0.001],
        ],
        { square: 0.86 },
      );
      tube(
        leg,
        navyLight,
        [
          [side * 0.122, -0.193, -0.055],
          [side * 0.137, -0.3, -0.041],
          [side * 0.125, -0.503, -0.061],
        ],
        0.009,
      );
      const knee = pivot(leg, [0, -0.69, 0]);
      knee.name = `hero-knee-${side}`;
      profile(knee, skin, [
        [-0.538, 0.063, 0.069, 0.003],
        [-0.4, 0.077, 0.081, 0.016],
        [-0.22, 0.097, 0.091, 0.026],
        [-0.05, 0.1, 0.094, 0.002],
        [0.054, 0.103, 0.09, -0.001],
      ]);
      profile(knee, ivory, [
        [-0.618, 0.075, 0.079, 0],
        [-0.49, 0.075, 0.08, 0.01],
        [-0.43, 0.081, 0.085, 0.014],
      ]);
      profile(knee, blue, [
        [-0.461, 0.081, 0.085, 0.012],
        [-0.436, 0.082, 0.086, 0.014],
      ]);
      const ankle = pivot(knee, [0, -0.6, 0]);
      ankle.name = `hero-ankle-${side}`;
      profile(
        ankle,
        ivory,
        [
          [-0.135, 0.111, 0.208, -0.073],
          [-0.071, 0.113, 0.206, -0.074],
          [0.028, 0.096, 0.144, -0.021],
          [0.074, 0.075, 0.084, 0.004],
        ],
        { square: 0.84 },
      );
      profile(
        ankle,
        soleMaterial,
        [
          [-0.17, 0.112, 0.213, -0.071],
          [-0.144, 0.116, 0.216, -0.071],
        ],
        { square: 0.8 },
      );
      profile(
        ankle,
        ivory,
        [
          [-0.145, 0.117, 0.216, -0.071],
          [-0.114, 0.115, 0.214, -0.071],
        ],
        { square: 0.81 },
      );
      tapered(
        ankle,
        blue,
        [
          [side * 0.077, 0.048, 0.06],
          [side * 0.114, -0.037, -0.052],
          [side * 0.078, -0.068, -0.166],
        ],
        [0.025, 0.027, 0.018],
        0.32,
      );
      for (let lace = 0; lace < 3; lace++)
        tube(
          ankle,
          blueLight,
          [
            [-0.045, 0.034 - lace * 0.022, -0.078 - lace * 0.04],
            [0, 0.043 - lace * 0.022, -0.084 - lace * 0.04],
            [0.045, 0.034 - lace * 0.022, -0.078 - lace * 0.04],
          ],
          0.008,
        );
      legPivots.push(leg);
      knees.push(knee);
      ankles.push(ankle);
      const arm = pivot(rig, [side * 0.342, 2.145, 0.006]);
      arm.name = `hero-shoulder-${side}`;
      profile(arm, blue, [
        [-0.344, 0.095, 0.103, 0],
        [-0.26, 0.107, 0.11, 0.007],
        [-0.104, 0.124, 0.126, 0.006],
        [0.015, 0.119, 0.115, 0],
        [0.085, 0.07, 0.074, 0],
        [0.105, 0.008, 0.012, 0],
      ]);
      profile(arm, blueLight, [
        [-0.362, 0.105, 0.111, 0],
        [-0.3, 0.11, 0.114, 0.001],
      ]);
      const elbow = pivot(arm, [0, -0.36, 0]);
      elbow.name = `hero-elbow-${side}`;
      profile(elbow, skin, [
        [-0.292, 0.044, 0.05, -0.001],
        [-0.16, 0.063, 0.065, 0.003],
        [-0.045, 0.079, 0.075, 0],
        [0.035, 0.085, 0.082, 0],
      ]);
      profile(
        elbow,
        skin,
        [
          [-0.421, 0.043, 0.029, -0.014],
          [-0.374, 0.059, 0.042, -0.016],
          [-0.323, 0.057, 0.043, -0.004],
          [-0.273, 0.045, 0.043, 0],
        ],
        { square: 0.78 },
      );
      const thumb = soft(elbow, skin, [-side * 0.053, -0.351, -0.044], [0.022, 0.053, 0.026], true);
      thumb.rotation.z = side * 0.35;
      armPivots.push(arm);
      elbows.push(elbow);
    }

    // Retain the planted-foot lengths and hip contract while changing the silhouette.
    const parts = [...rig.children];
    const hips = pivot(rig, [0, 1.46, 0]);
    hips.name = 'hero-pelvis';
    const chest = pivot(rig, [0, 1.46, 0]);
    chest.name = 'hero-chest';
    const hipParts = new Set<THREE.Object3D>([hipShell, ...legPivots]);
    for (const part of parts) {
      part.position.y -= 1.46;
      (hipParts.has(part) ? hips : chest).add(part);
    }
    let riding = false;
    const hipPoint = new THREE.Vector3(0, 1.46, 0.01);
    const riderHip = hipPoint.clone();
    return {
      group,
      riderHip,
      setRiding(value) {
        riding = value;
      },
      animate(time, speed, jump = 0, motion) {
        const pose = readLocomotion(time, speed, jump, motion);
        time = pose.time;
        jump = pose.jump;
        const move = pose.weight * (1 - jump * 0.65),
          gait = pose.phase,
          run = pose.run;
        const bodyDrop = move * (-0.19 - run * 0.05 + Math.sin(gait) ** 2 * (0.1 + run * 0.02));
        rig.position.y = riding
          ? Math.sin(time * 3.5) * 0.006
          : bodyDrop + Math.sin(time * 1.9) * 0.005 * (1 - move);
        rig.rotation.x = riding ? -0.025 : jump * 0.035;
        rig.rotation.z = 0;
        hips.rotation.y = riding ? 0 : Math.sin(gait) * move * (0.028 + run * 0.022);
        chest.rotation.y = riding ? 0 : -Math.sin(gait) * move * (0.035 + run * 0.035);
        chest.rotation.x = riding ? -0.045 : -move * (0.025 + run * 0.16);
        chest.rotation.z = riding ? 0 : Math.sin(gait) * move * 0.012;
        legPivots.forEach((leg, index) => {
          const side = index === 0 ? -1 : 1,
            reach = 0.624 + run * 0.079;
          const step = sampleFootstep(
            gait + index * Math.PI,
            reach,
            0.18 + run * 0.22,
            (2 * reach) / (2.4 + run * 1.3),
          );
          const angles = solveLeg(step.z * move, 1.29 + bodyDrop - step.lift * move, 0.69, 0.6);
          leg.position.x = side * (riding ? 0.22 : 0.145);
          leg.rotation.x = riding ? 1.1 : angles.hip - jump * 0.16;
          leg.rotation.z = riding ? side * 0.22 : 0;
          knees[index].rotation.x = riding ? -1.04 : angles.knee - jump * 0.25;
          ankles[index].rotation.x = riding ? 0 : -angles.hip - angles.knee + step.pitch * move;
        });
        armPivots.forEach((arm, index) => {
          const side = index === 0 ? -1 : 1;
          arm.rotation.x = riding
            ? 0.92 + Math.sin(time * 3.5) * 0.012
            : -Math.cos(gait + index * Math.PI) * move * (0.32 + run * 0.37) - jump * 0.24;
          arm.rotation.z = side * (riding ? -0.17 : 0.06);
          elbows[index].rotation.x = riding
            ? 0.2
            : 0.08 +
              move * (0.2 + run * 0.92) +
              Math.sin(gait + index * Math.PI) * move * run * 0.13;
        });
        backpack.rotation.x = riding ? 0.016 : Math.sin(gait * 2) * move * 0.008;
        head.rotation.y = Math.sin(time * 0.62) * 0.055 * (1 - move);
        head.rotation.x = riding ? 0.065 : -Math.sin(gait * 2) * move * 0.012;
        const blink = (time + 0.2) % 5.7;
        eyes.forEach((eye) => {
          eye.scale.y = blink < 0.12 ? Math.max(0.06, Math.abs(blink - 0.06) / 0.06) : 1;
        });
        rig.updateMatrix();
        riderHip.copy(hipPoint).applyMatrix4(rig.matrix);
      },
      dispose: k.dispose,
    };
  } catch (error) {
    k.dispose();
    throw error;
  }
}
