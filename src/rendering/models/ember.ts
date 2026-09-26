import * as THREE from 'three';
import { modelKit } from './modelKit';
import { sculptedForm, sculptedPanel, type FormSection } from './emberGeometry';
import {
  quadrupedPhase,
  readLocomotion,
  sampleFootstep,
  sampleSuspension,
  solveLeg,
} from './locomotion';
import type { ModelRig, Point } from './types';

/** Original solar dragon. One flowing torso, an authored wedge-shaped head and articulated limbs.
 * Forward is -Z; locomotion keeps the same support-foot and saddle contracts at every growth stage. */
export function createCompanion(stage: 0 | 1 | 2 | 3): ModelRig {
  const k = modelKit();
  try {
    const { group, rig, material, mesh, soft, pivot, tapered, tube } = k;
    group.name = `ember-companion-${stage}`;
    const amber = material(stage === 0 ? '#eda94c' : '#d47a2e', { roughness: 0.68 });
    const sun = material('#eea94e', { roughness: 0.62 });
    const ivory = material('#f5e5bc', { roughness: 0.7 });
    const navy = material('#284754', { roughness: 0.62, metalness: 0.07 });
    const gold = material('#dda750', { roughness: 0.52, metalness: 0.2 });
    const dark = material('#132d35', { roughness: 0.47 });
    const glow = material('#8bccc1', {
      emissive: '#328d7b',
      emissiveIntensity: 0.12,
      roughness: 0.4,
    });
    const eyeColor = material('#d5b853', { roughness: 0.28 });
    const white = material('#fff8e5', { roughness: 0.45 });
    const leather = material('#443d35', { roughness: 0.88 });
    const form = (
      parent: THREE.Object3D,
      mat: THREE.Material,
      sections: FormSection[],
      axis: 'z' | 'y' = 'z',
      belly = false,
    ) => {
      const object: THREE.Mesh = mesh(parent, sculptedForm(sections, axis, belly), mat);
      if (belly) object.material = [mat, ivory];
      return object;
    };
    const shield = sculptedPanel(
      [
        [-0.45, 0.24],
        [-0.28, 0.5],
        [0.24, 0.4],
        [0.48, 0.08],
        [0.21, -0.37],
        [0, -0.52],
        [-0.31, -0.22],
      ],
      0.1,
    );
    const plate = (parent: THREE.Object3D, mat: THREE.Material, p: Point, s: Point) =>
      mesh(parent, shield, mat, p, s);
    const crystalGeometry = new THREE.OctahedronGeometry(1);
    const crystal = (parent: THREE.Object3D, p: Point, s: Point) =>
      mesh(parent, crystalGeometry, glow, p, s);
    // Tiny claws share a low-resolution closed surface; they do not need horn-sized tubes.
    const clawGeometry = sculptedForm(
      [
        { center: [0, -0.052, -0.105], width: 0.002, depth: 0.002 },
        { center: [0, -0.025, -0.07], width: 0.023, depth: 0.017 },
        { center: [0, 0, 0], width: 0.031, depth: 0.023 },
      ],
      'z',
      false,
      8,
      8,
    );

    // Neck, chest, waist and haunch flow through the same closed surface. A continuous pale
    // ventral material region replaces the former stack of separate chest ornaments.
    const body = form(
      rig,
      amber,
      [
        { center: [0, 1.28, -0.72], width: 0.16, depth: 0.18 },
        { center: [0, 1.2, -0.51], width: 0.25, depth: 0.3 },
        { center: [0, 1.01, -0.28], width: 0.39, depth: 0.39 },
        { center: [0, 0.87, 0.05], width: 0.36, depth: 0.31 },
        { center: [0, 0.83, 0.33], width: 0.32, depth: 0.27 },
        { center: [0, 0.84, 0.57], width: 0.4, depth: 0.33 },
        { center: [0, 0.87, 0.81], width: 0.24, depth: 0.21 },
        { center: [0, 0.88, 0.94], width: 0.11, depth: 0.13 },
      ],
      'z',
      true,
    );
    body.name = 'ember-sculpted-torso';
    for (const side of [-1, 1]) {
      if (stage >= 2) {
        const shoulder = plate(rig, navy, [side * 0.36, 1.13, -0.28], [0.51, 0.56, 0.95]);
        shoulder.rotation.y = -side * 1.06;
        shoulder.rotation.z = -side * 0.25;
        const trim = plate(rig, gold, [side * 0.42, 1.14, -0.3], [0.32, 0.4, 0.6]);
        trim.rotation.copy(shoulder.rotation);
        const gem = crystal(rig, [side * 0.45, 1.23, -0.28], [0.05, 0.105, 0.06]);
        gem.rotation.z = side * -0.3;
      }
      // One swept cheek-to-shoulder ruff, with a strong silhouette instead of a necklace of balls.
      tapered(
        rig,
        ivory,
        [
          [side * 0.22, 1.26, -0.49],
          [side * 0.47, 1.22, -0.3],
          [side * 0.58, 1.27, -0.08],
        ],
        [0.105, 0.085, 0.004],
        0.48,
      );
    }

    const legs: Array<{
      pivot: THREE.Group;
      knee: THREE.Group;
      ankle: THREE.Group;
      front: boolean;
    }> = [];
    for (const side of [-1, 1]) {
      for (const front of [true, false]) {
        const leg = pivot(rig, [side * 0.3, 0.86, front ? -0.43 : 0.54]);
        leg.name = `pet-hip-${legs.length}`;
        const upper = form(
          leg,
          amber,
          [
            {
              center: [0, front ? 0.27 : 0.19, 0.035],
              width: front ? 0.085 : 0.13,
              depth: front ? 0.12 : 0.18,
            },
            {
              center: [0, -0.02, front ? 0.02 : 0.07],
              width: front ? 0.16 : 0.205,
              depth: front ? 0.15 : 0.23,
            },
            {
              center: [0, -0.19, front ? 0.025 : 0.055],
              width: front ? 0.115 : 0.16,
              depth: front ? 0.13 : 0.17,
            },
            { center: [0, -0.35, 0.0], width: 0.087, depth: 0.092 },
            { center: [0, -0.43, 0], width: 0.075, depth: 0.075 },
          ],
          'y',
        );
        upper.name = `ember-upper-limb-${legs.length}`;
        const knee = pivot(leg, [0, -0.39, 0]);
        knee.name = `pet-knee-${legs.length}`;
        form(
          knee,
          navy,
          [
            { center: [0, 0.055, 0], width: 0.085, depth: 0.085 },
            { center: [0, -0.035, 0.006], width: 0.094, depth: 0.1 },
            { center: [0, -0.18, 0.013], width: 0.07, depth: 0.078 },
            { center: [0, -0.315, 0], width: 0.086, depth: 0.08 },
            { center: [0, -0.375, 0], width: 0.075, depth: 0.065 },
          ],
          'y',
        );
        const ankle = pivot(knee, [0, -0.345, 0]);
        ankle.name = `pet-ankle-${legs.length}`;
        form(ankle, navy, [
          { center: [0, -0.01, -0.28], width: 0.095, depth: 0.065 },
          { center: [0, -0.005, -0.21], width: 0.16, depth: 0.12 },
          { center: [0, 0.005, -0.08], width: 0.15, depth: 0.13 },
          { center: [0, 0.025, 0.05], width: 0.095, depth: 0.1 },
          { center: [0, 0.02, 0.09], width: 0.055, depth: 0.06 },
        ]);
        for (const toe of [-1, 0, 1]) {
          mesh(ankle, clawGeometry, ivory, [toe * 0.081, -0.005, -0.23]);
        }
        legs.push({ pivot: leg, knee, ankle, front });
      }
    }

    const head = pivot(rig, [0, 1.31, -0.67]);
    head.name = 'ember-head';
    const cranium = form(
      head,
      sun,
      [
        { center: [0, -0.03, -0.53], width: 0.145, depth: 0.095 },
        { center: [0, -0.025, -0.43], width: 0.215, depth: 0.13 },
        { center: [0, 0.015, -0.29], width: 0.28, depth: 0.2 },
        { center: [0, 0.065, -0.11], width: 0.335, depth: 0.28 },
        { center: [0, 0.055, 0.09], width: 0.28, depth: 0.26 },
        { center: [0, 0.025, 0.25], width: 0.15, depth: 0.155 },
        { center: [0, 0.015, 0.29], width: 0.055, depth: 0.065 },
      ],
      'z',
      true,
    );
    cranium.name = 'ember-sculpted-head';
    const eyeOutline = sculptedPanel(
      [
        [-0.14, 0.02],
        [-0.087, 0.093],
        [0.02, 0.106],
        [0.135, 0.047],
        [0.102, -0.04],
        [-0.032, -0.058],
        [-0.115, -0.026],
      ],
      0.034,
    );
    const eyeGroups: THREE.Group[] = [];
    for (const side of [-1, 1]) {
      soft(head, dark, [side * 0.097, 0.033, -0.51], [0.018, 0.012, 0.012], true);
      tube(
        head,
        dark,
        [
          [side * 0.04, -0.085, -0.53],
          [side * 0.145, -0.083, -0.47],
          [side * 0.228, -0.058, -0.33],
        ],
        0.006,
      );
      const eye = pivot(head, [side * 0.26, 0.14, -0.215]);
      eye.rotation.y = -side * 0.61;
      eye.rotation.z = side * -0.12;
      eye.scale.set(side * 0.88, 0.84, 1);
      mesh(eye, eyeOutline, navy, [0, 0, 0], [1.13, 1.18, 1]);
      mesh(eye, eyeOutline, white, [0, 0, -0.018], [0.98, 0.92, 1]);
      soft(eye, eyeColor, [0, 0.012, -0.06], [0.049, 0.066, 0.018], true);
      soft(eye, dark, [0, 0.012, -0.076], [0.018, 0.049, 0.009], true);
      soft(eye, white, [-0.023, 0.043, -0.094], [0.016, 0.02, 0.006], true);
      eyeGroups.push(eye);
    }
    const crest = plate(head, navy, [0, 0.274, -0.137], [0.24, 0.36, 0.44]);
    crest.rotation.x = -0.7;
    const ears: Array<{ group: THREE.Group; rest: number }> = [];
    for (const side of [-1, 1]) {
      const ear = pivot(head, [side * 0.265, 0.12, 0.135]);
      ear.rotation.z = -side * 0.95;
      ear.rotation.y = side * 0.45;
      const outer = plate(ear, navy, [0, 0.13, 0], [0.18, 0.43, 0.42]);
      outer.rotation.z = Math.PI;
      const inset = plate(ear, ivory, [0, 0.14, -0.025], [0.1, 0.28, 0.24]);
      inset.rotation.z = Math.PI;
      ears.push({ group: ear, rest: ear.rotation.z });
      const growth = stage >= 2 ? 1 : 0.62;
      const horn = tapered(
        head,
        ivory,
        [
          [side * 0.215, 0.26, 0.09],
          [side * 0.28, 0.32 + growth * 0.13, 0.22],
          [side * 0.28, 0.36 + growth * 0.15, 0.46],
          [side * 0.23, 0.43 + growth * 0.16, 0.68],
        ],
        [0.091, 0.071, 0.033, 0.002],
        0.8,
      );
      horn.name = `ember-crown-horn-${side}`;
      if (stage >= 2) {
        tapered(
          head,
          gold,
          [
            [side * 0.18, 0.32, 0.09],
            [side * 0.11, 0.48, 0.25],
            [side * 0.08, 0.59, 0.45],
          ],
          [0.037, 0.025, 0.002],
          0.8,
        );
      }
    }

    const tail = pivot(rig, [0, 0.87, 0.85]);
    tail.name = 'ember-plated-tail';
    const tailJoints: THREE.Group[] = [];
    let parent = tail;
    for (let segment = 0; segment < 3; segment++) {
      const joint = pivot(parent, segment ? [0, 0.07, 0.39] : [0, 0, 0]);
      joint.name = `ember-tail-joint-${segment}`;
      const width = 0.155 - segment * 0.043;
      form(joint, amber, [
        { center: [0, -0.012, -0.025], width, depth: width * 0.84 },
        { center: [0, 0.005, 0.14], width: width * 0.88, depth: width * 0.75 },
        { center: [0, 0.065, 0.36], width: width * 0.68, depth: width * 0.58 },
        { center: [0, 0.085, 0.43], width: width * 0.62, depth: width * 0.52 },
      ]);
      const armor = plate(
        joint,
        stage >= 2 ? navy : gold,
        [0, width * 0.73 + 0.02, 0.15],
        [width * 1.8, 0.4, 0.45],
      );
      armor.rotation.x = -Math.PI / 2;
      tailJoints.push(joint);
      parent = joint;
    }
    const tailTip = plate(parent, navy, [0, 0.15, 0.49], [0.31, 0.51, 0.65]);
    tailTip.rotation.x = 0.3;
    tailTip.rotation.z = Math.PI;
    const tailLight = plate(parent, gold, [0, 0.15, 0.474], [0.18, 0.35, 0.35]);
    tailLight.rotation.copy(tailTip.rotation);
    const talisman = crystal(rig, [0, 1.11, -0.658], [0.05, 0.09, 0.035]);
    talisman.name = 'ember-heart-crystal';

    if (stage < 3) {
      for (const side of [-1, 1]) {
        const bud = plate(
          rig,
          navy,
          [side * 0.3, 1.1, 0.24],
          [0.19, stage >= 2 ? 0.61 : 0.34, 0.65],
        );
        bud.rotation.z = -side * 0.43;
        bud.rotation.x = -0.65;
      }
      if (stage >= 2) {
        for (let i = 0; i < 3; i++) {
          const spine = plate(rig, navy, [0, 1.2 - i * 0.03, 0.13 + i * 0.22], [0.08, 0.27, 0.5]);
          spine.rotation.y = Math.PI / 2;
          spine.rotation.z = Math.PI;
        }
      }
    }
    const wings: Array<{ group: THREE.Group; side: number }> = [];
    const ridingTack = pivot(rig, [0, 0, 0]);
    ridingTack.visible = false;
    if (stage === 3) {
      soft(rig, ivory, [0, 1.27, 0.38], [0.345, 0.036, 0.34]);
      soft(rig, leather, [0, 1.31, 0.38], [0.314, 0.045, 0.31]);
      soft(rig, navy, [0, 1.355, 0.615], [0.292, 0.092, 0.052]);
      for (const side of [-1, 1]) {
        tube(
          rig,
          gold,
          [
            [side * 0.28, 1.3, 0.37],
            [side * 0.43, 0.98, 0.38],
            [side * 0.39, 0.68, 0.31],
          ],
          0.024,
        );
        const stirrup = mesh(rig, new THREE.TorusGeometry(0.068, 0.012, 6, 16), gold, [
          side * 0.4,
          0.67,
          0.3,
        ]);
        stirrup.rotation.y = Math.PI / 2;
        tube(
          ridingTack,
          leather,
          [
            [side * 0.24, 1.13, -0.48],
            [side * 0.27, 1.3, -0.3],
            [side * 0.21, 1.6, -0.2],
          ],
          0.018,
        );
      }
      const membrane = material('#e9b066', { roughness: 0.74, side: THREE.DoubleSide });
      const wingOutline = new THREE.Shape();
      wingOutline.moveTo(0, 0);
      wingOutline.quadraticCurveTo(0.65, -0.39, 1.27, -0.29);
      wingOutline.quadraticCurveTo(1.83, -0.2, 2.2, 0.18);
      wingOutline.quadraticCurveTo(1.91, 0.3, 1.58, 0.88);
      wingOutline.quadraticCurveTo(1.31, 0.5, 1.17, 1.16);
      wingOutline.quadraticCurveTo(0.88, 0.68, 0.62, 1.12);
      wingOutline.quadraticCurveTo(0.39, 0.57, 0, 0.34);
      wingOutline.closePath();
      const wingPoint = (x: number, z: number): Point => [
        x,
        Math.sin((x / 2.2) * Math.PI) * 0.47 - z * 0.16,
        z,
      ];
      const wingGeometry = new THREE.ShapeGeometry(wingOutline, 10);
      const positions = wingGeometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        positions.setXYZ(i, ...wingPoint(positions.getX(i), positions.getY(i)));
      }
      wingGeometry.computeVertexNormals();
      for (const side of [-1, 1]) {
        const wing = pivot(rig, [side * 0.34, 1.17, 0.03]);
        wing.name = `ember-solar-wing-${side}`;
        wing.scale.x = side;
        mesh(wing, wingGeometry, membrane);
        tube(
          wing,
          navy,
          wingOutline.getPoints(18).map(({ x, y }) => wingPoint(x, y)),
          0.022,
        );
        tapered(
          wing,
          ivory,
          [[0, 0, 0], wingPoint(0.65, -0.28), wingPoint(1.29, -0.28), wingPoint(2.2, 0.18)],
          [0.08, 0.064, 0.033, 0.004],
        );
        for (const [x, z] of [
          [1.58, 0.88],
          [1.17, 1.16],
          [0.62, 1.12],
        ]) {
          tube(
            wing,
            gold,
            [wingPoint(0.47, -0.17), wingPoint((x + 0.47) / 2, z * 0.4), wingPoint(x, z)],
            0.012,
          );
        }
        const wingGem = crystal(wing, wingPoint(0.49, -0.18), [0.09, 0.13, 0.12]);
        wingGem.rotation.z = -0.35;
        wings.push({ group: wing, side });
      }
    }

    const size = [0.82, 0.95, 1.04, 1.1][stage];
    rig.scale.setScalar(size);
    const saddlePoint = new THREE.Vector3(0, 1.355, 0.38);
    const rideSeat = stage === 3 ? saddlePoint.clone().multiplyScalar(size) : undefined;
    let flying = false;
    let disposed = false;
    return {
      group,
      locomotion: {
        walkSpeed: 1.8 * size,
        runSpeed: 6.2 * size,
        walkStride: (0.6 / 0.42) * size,
        runStride: (0.86 / 0.25) * size,
      },
      rideSeat,
      setFlying(value) {
        flying = stage === 3 && value;
        ridingTack.visible = flying;
      },
      animate(time, speed, jump = 0, motion) {
        if (disposed) return;
        const pose = readLocomotion(time, speed, jump, motion);
        time = pose.time;
        jump = pose.jump;
        const movement = pose.weight * (1 - jump * 0.5);
        const stride = pose.phase;
        const run = pose.run;
        const reach = 0.3 + run * 0.13;
        const duty = (2 * reach) / (0.6 / 0.42 + run * (0.86 / 0.25 - 0.6 / 0.42));
        const bodyDrop =
          movement * (-0.075 - run * 0.1 + run * sampleSuspension(stride, duty) * 0.19);
        rig.position.y = flying
          ? Math.sin(time * 5) * 0.035
          : bodyDrop * size + Math.sin(time * 2.25) * 0.009 * (1 - movement);
        rig.rotation.z = flying ? Math.sin(time * 2.5) * 0.018 : 0;
        rig.rotation.x = flying ? -0.04 : -jump * 0.06;
        legs.forEach(({ pivot: leg, knee, ankle, front }, index) => {
          const step = sampleFootstep(
            quadrupedPhase(stride, index, run),
            reach,
            0.13 + run * 0.09,
            duty,
          );
          const angles = solveLeg(
            step.z * movement,
            0.735 + bodyDrop - step.lift * movement,
            0.39,
            0.345,
          );
          leg.rotation.x = flying ? (front ? -1.03 : 1.12) : angles.hip + jump * 0.16;
          leg.position.y = flying ? 0.91 : 0.86;
          knee.rotation.x = flying ? 0 : angles.knee;
          ankle.rotation.x = flying ? 0 : -angles.hip - angles.knee + step.pitch * movement;
        });
        tail.rotation.y = Math.sin(time * 2.1) * (0.18 + movement * 0.13);
        tail.rotation.x = Math.sin(time * 2.7) * 0.035 + movement * 0.08;
        tailJoints.forEach((joint, index) => {
          joint.rotation.y =
            Math.sin(time * 2.1 - index * 0.65) * (0.04 + index * 0.018 + movement * 0.03);
        });
        head.rotation.y = Math.sin(time * 0.75) * 0.075 * (1 - movement * 0.75);
        head.rotation.x = Math.sin(time * 1.6) * 0.025 - movement * 0.04;
        for (const { group: ear, rest } of ears)
          ear.rotation.z = rest + Math.sin(time * 2.6 + rest * 4) * 0.035;
        const blinkAt = (time + 0.7) % 5.6;
        const openness = blinkAt < 0.14 ? Math.max(0.045, Math.abs(blinkAt - 0.07) / 0.07) : 1;
        for (const eye of eyeGroups) eye.scale.y = openness * 0.84;
        for (const { group: wing, side } of wings) {
          wing.rotation.z =
            side *
            (0.1 +
              (flying
                ? Math.sin(time * 5.2) * 0.58
                : Math.sin(time * 1.8) * 0.045 + Math.sin(stride) * movement * 0.14));
          wing.rotation.x = flying
            ? -0.1 + Math.cos(time * 5.2) * 0.08
            : Math.sin(time * 1.8) * 0.028 - 0.1;
        }
        glow.emissiveIntensity = 0.13 + Math.sin(time * 1.8) * 0.025;
        talisman.rotation.y = Math.sin(time * 1.1) * 0.08;
        if (rideSeat) {
          rig.updateMatrix();
          rideSeat.copy(saddlePoint).applyMatrix4(rig.matrix);
        }
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        k.dispose();
      },
    };
  } catch (error) {
    k.dispose();
    throw error;
  }
}
