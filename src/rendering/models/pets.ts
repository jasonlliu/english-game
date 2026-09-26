import * as THREE from 'three';
import { createCompanion } from './ember';
import { modelKit } from './modelKit';
import {
  quadrupedPhase,
  readLocomotion,
  sampleFootstep,
  sampleSuspension,
  solveLeg,
} from './locomotion';
import type { ModelRig, PetId, Point } from './types';
export function createPet(petId: PetId, stage: 0 | 1 | 2 | 3 = 1): ModelRig {
  if (petId === 'ember') {
    const model = createCompanion(stage);
    model.group.scale.setScalar(0.68);
    if (model.locomotion) {
      model.locomotion = {
        walkSpeed: model.locomotion.walkSpeed * 0.68,
        runSpeed: model.locomotion.runSpeed * 0.68,
        walkStride: model.locomotion.walkStride * 0.68,
        runStride: model.locomotion.runStride * 0.68,
      };
    }
    return model;
  }
  const k = modelKit();
  try {
    const { group, rig, soft, material, pivot, tube, tapered, leaf, mesh } = k;
    group.name = `companion-${petId}-${stage}`;
    const cream = material('#f4e9c9');
    const dark = material('#263b41');
    const gold = material('#d5b46a', { metalness: 0.55, roughness: 0.37 });
    const eyeGroups: THREE.Group[] = [];
    const legs: Array<{
      pivot: THREE.Group;
      knee?: THREE.Group;
      ankle?: THREE.Group;
      height: number;
      upper: number;
      lower: number;
    }> = [];
    const wings: THREE.Group[] = [];
    let head: THREE.Group | undefined;
    let tail: THREE.Group | undefined;
    let emissive: THREE.MeshStandardMaterial | undefined;
    let ridingTack: THREE.Group | undefined;
    const paws = (mat: THREE.Material, x: number, z: number, height = 0.28, width = 0.115) => {
      for (const side of [-1, 1]) {
        for (const front of [-1, 1]) {
          const leg = pivot(rig, [side * x, height, front * z]);
          leg.name = `pet-hip-${legs.length}`;
          const upper = (height - 0.065) * 0.5;
          const lower = upper;
          soft(leg, mat, [0, -upper * 0.48, 0], [width, upper * 0.82, width * 1.12]);
          const knee = pivot(leg, [0, -upper, 0]);
          knee.name = `pet-knee-${legs.length}`;
          soft(knee, mat, [0, -lower * 0.48, 0], [width * 0.84, lower * 0.83, width]);
          const ankle = pivot(knee, [0, -lower, 0]);
          ankle.name = `pet-ankle-${legs.length}`;
          soft(ankle, mat, [0, 0, -0.05], [width * 1.14, 0.065, width * 1.48]);
          legs.push({ pivot: leg, knee, ankle, height, upper, lower });
        }
      }
    };
    if (petId === 'ripple') {
      const blue = material('#5aafc9', { roughness: 0.44 });
      const light = material('#addde0', { roughness: 0.48 });
      const fin = material('#347f9f', { roughness: 0.43 });
      soft(rig, blue, [0, 0.51, 0.1], [0.31, 0.38, 0.49]);
      soft(rig, light, [0, 0.55, -0.237], [0.236, 0.31, 0.125]);
      paws(blue, 0.24, 0.24, 0.26, 0.1);
      head = pivot(rig, [0, 0.94, -0.3]);
      soft(head, blue, [0, 0, 0], [0.29, 0.266, 0.264]);
      soft(head, light, [0, -0.09, -0.195], [0.21, 0.13, 0.145]);
      soft(head, dark, [0, -0.016, -0.322], [0.056, 0.039, 0.041], true);
      eyeGroups.push(...k.eyes(head, 0.047, -0.235, 0.128, 0.061, '#564935'));
      for (const side of [-1, 1]) {
        const ear = leaf(head, fin, [side * 0.237, 0.105, 0.025], 0.26, 0.39);
        ear.rotation.z = side * -0.7;
        ear.rotation.y = side * 0.18;
        const inner = leaf(head, light, [side * 0.244, 0.125, -0.005], 0.14, 0.29);
        inner.rotation.z = side * -0.7;
        for (let dot = 0; dot < 3; dot += 1)
          soft(
            head,
            fin,
            [side * (0.078 + dot * 0.044), -0.066 + (dot % 2) * 0.026, -0.319 + dot * 0.018],
            [0.009, 0.009, 0.006],
            true,
          );
      }
      tail = pivot(rig, [0, 0.37, 0.43]);
      tapered(
        tail,
        blue,
        [
          [0, 0, 0],
          [0.04, 0.035, 0.3],
          [0.11, 0.12, 0.63],
          [0.12, 0.2, 0.76],
        ],
        [0.17, 0.16, 0.105, 0.012],
        0.48,
      );
      const tailFin = leaf(tail, fin, [0.08, 0.1, 0.48], 0.35, 0.37);
      tailFin.rotation.x = Math.PI / 2;
      tube(
        rig,
        gold,
        [
          [-0.2, 0.76, -0.3],
          [0, 0.65, -0.37],
          [0.2, 0.76, -0.3],
        ],
        0.015,
      );
      emissive = material('#aaf7ec', { emissive: '#52c7c9', emissiveIntensity: 0.33 });
      soft(rig, emissive, [0, 0.655, -0.388], [0.057, 0.075, 0.038], true);
    } else if (petId === 'cinder') {
      const red = material('#c7613b');
      const orange = material('#e99443');
      const plate = material('#823f35');
      soft(rig, red, [0, 0.43, 0.09], [0.26, 0.28, 0.48]);
      soft(rig, orange, [0, 0.43, -0.24], [0.195, 0.215, 0.16]);
      paws(red, 0.275, 0.28, 0.22, 0.091);
      head = pivot(rig, [0, 0.69, -0.36]);
      soft(head, red, [0, 0, 0], [0.272, 0.22, 0.26]);
      soft(head, orange, [0, -0.065, -0.2], [0.22, 0.12, 0.19]);
      eyeGroups.push(...k.eyes(head, 0.055, -0.218, 0.153, 0.061, '#dcb454'));
      for (const side of [-1, 1]) {
        soft(head, plate, [side * 0.086, -0.028, -0.371], [0.016, 0.011, 0.008], true);
        tapered(
          head,
          plate,
          [
            [side * 0.17, 0.12, 0.08],
            [side * 0.22, 0.26, 0.14],
            [side * 0.25, 0.31, 0.26],
          ],
          [0.072, 0.043, 0.006],
        );
      }
      for (let i = 0; i < 4; i += 1) {
        const crest = leaf(
          rig,
          orange,
          [0, 0.67 - i * 0.03, -0.01 + i * 0.15],
          0.14,
          0.2 - i * 0.02,
        );
        crest.rotation.y = Math.PI / 2;
        crest.rotation.x = -0.22;
      }
      tail = pivot(rig, [0, 0.39, 0.43]);
      tapered(
        tail,
        red,
        [
          [0, 0, 0],
          [0.1, -0.07, 0.28],
          [0.23, 0.035, 0.59],
          [0.22, 0.21, 0.79],
        ],
        [0.14, 0.1, 0.064, 0.018],
      );
      emissive = material('#f9b848', { emissive: '#e86e25', emissiveIntensity: 0.42 });
      const outerFlame = leaf(tail, orange, [0.22, 0.13, 0.74], 0.29, 0.41);
      outerFlame.rotation.z = -0.22;
      const innerFlame = leaf(tail, emissive, [0.22, 0.15, 0.701], 0.16, 0.28);
      innerFlame.rotation.z = -0.22;
    } else if (petId === 'moss') {
      const skin = material('#889576');
      const shellMat = material('#536d60', { roughness: 0.96 });
      const seam = material('#364f44');
      const leafMat = material('#9abb63');
      soft(rig, skin, [0, 0.3, 0.03], [0.52, 0.235, 0.58]);
      mesh(
        rig,
        new THREE.SphereGeometry(1, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2),
        shellMat,
        [0, 0.35, 0.05],
        [0.57, 0.44, 0.65],
      );
      const rim = mesh(
        rig,
        new THREE.TorusGeometry(1, 0.05, 8, 64),
        skin,
        [0, 0.355, 0.05],
        [0.57, 0.65, 0.7],
      );
      rim.rotation.x = Math.PI / 2;
      for (const angle of [0, Math.PI / 3, (Math.PI * 2) / 3]) {
        const points: Point[] = [];
        for (let i = 0; i <= 20; i += 1) {
          const a = (i / 20) * Math.PI;
          points.push([
            Math.cos(a) * Math.cos(angle) * 0.573,
            0.35 + Math.sin(a) * 0.442,
            0.05 + Math.cos(a) * Math.sin(angle) * 0.653,
          ]);
        }
        tube(rig, seam, points, 0.012);
      }
      for (const radius of [0.45, 0.78]) {
        const points: Point[] = [];
        for (let i = 0; i <= 32; i += 1) {
          const a = (i / 32) * Math.PI * 2;
          points.push([
            Math.cos(a) * radius * 0.573,
            0.35 + Math.sqrt(1 - radius * radius) * 0.445,
            0.05 + Math.sin(a) * radius * 0.653,
          ]);
        }
        tube(rig, seam, points, 0.011);
      }
      paws(skin, 0.405, 0.36, 0.185, 0.132);
      head = pivot(rig, [0, 0.4, -0.66]);
      soft(head, skin, [0, 0, 0], [0.235, 0.185, 0.245]);
      soft(head, cream, [0, -0.065, -0.15], [0.179, 0.085, 0.107]);
      eyeGroups.push(...k.eyes(head, 0.044, -0.211, 0.12, 0.045, '#664e39'));
      tapered(
        rig,
        leafMat,
        [
          [0, 0.77, 0.1],
          [0.025, 0.93, 0.11],
          [0.04, 1.1, 0.1],
        ],
        [0.029, 0.022, 0.009],
      );
      const left = leaf(rig, leafMat, [0.015, 0.91, 0.1], 0.25, 0.3);
      left.rotation.z = 0.9;
      const right = leaf(rig, material('#75994c'), [0.036, 0.97, 0.13], 0.21, 0.26);
      right.rotation.z = -0.91;
      tail = pivot(rig, [0, 0.25, 0.58]);
      tapered(
        tail,
        skin,
        [
          [0, 0, 0],
          [0.03, 0.02, 0.19],
          [0.02, 0.025, 0.28],
        ],
        [0.08, 0.042, 0.007],
      );
    } else if (petId === 'bolt') {
      const steel = material('#c7d0d0', { roughness: 0.31, metalness: 0.66 });
      const slate = material('#4e626a', { roughness: 0.4, metalness: 0.58 });
      emissive = material('#b0f6e4', {
        emissive: '#5ccdc0',
        emissiveIntensity: 0.42,
        roughness: 0.25,
      });
      soft(rig, steel, [0, 0.47, 0.09], [0.31, 0.3, 0.44]);
      paws(slate, 0.238, 0.255, 0.27, 0.101);
      for (const side of [-1, 1])
        for (const z of [-0.255, 0.255]) {
          const joint = mesh(rig, new THREE.CylinderGeometry(0.095, 0.095, 0.048, 24), gold, [
            side * 0.3,
            0.33,
            z,
          ]);
          joint.rotation.z = Math.PI / 2;
          soft(rig, slate, [side * 0.33, 0.33, z], [0.011, 0.048, 0.048], true);
        }
      head = pivot(rig, [0, 0.84, -0.32]);
      soft(head, steel, [0, 0, 0], [0.3, 0.255, 0.245]);
      soft(head, slate, [0, 0.007, -0.214], [0.244, 0.096, 0.051]);
      for (const side of [-1, 1]) {
        const ear = leaf(head, steel, [side * 0.178, 0.143, 0.002], 0.23, 0.28);
        ear.rotation.z = side * -0.27;
        const inset = leaf(head, slate, [side * 0.178, 0.161, -0.028], 0.13, 0.19);
        inset.rotation.z = side * -0.27;
        const eye = pivot(head, [side * 0.112, 0.015, -0.26]);
        soft(eye, emissive, [0, 0, 0], [0.068, 0.038, 0.012], true);
        eyeGroups.push(eye);
      }
      soft(head, gold, [0, -0.08, -0.261], [0.035, 0.027, 0.023], true);
      tube(
        head,
        slate,
        [
          [-0.06, -0.128, -0.222],
          [0, -0.138, -0.234],
          [0.06, -0.128, -0.222],
        ],
        0.008,
      );
      soft(rig, slate, [0, 0.73, 0.19], [0.172, 0.08, 0.24]);
      for (let i = 0; i < 3; i += 1)
        soft(rig, emissive, [0, 0.799, 0.05 + i * 0.125], [0.1, 0.017, 0.032], true);
      tail = pivot(rig, [0, 0.44, 0.45]);
      tube(
        tail,
        slate,
        [
          [0, 0, 0],
          [0.07, 0.02, 0.24],
          [0.13, 0.22, 0.43],
          [0.12, 0.43, 0.43],
        ],
        0.046,
      );
      const gearShape = new THREE.Shape();
      for (let i = 0; i < 48; i += 1) {
        const a = (i / 48) * Math.PI * 2;
        const r = i % 4 < 2 ? 0.153 : 0.119;
        if (i === 0) gearShape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else gearShape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      gearShape.closePath();
      const hole = new THREE.Path();
      hole.absarc(0, 0, 0.065, 0, Math.PI * 2, true);
      gearShape.holes.push(hole);
      mesh(
        tail,
        new THREE.ExtrudeGeometry(gearShape, {
          depth: 0.048,
          bevelEnabled: true,
          bevelSize: 0.008,
          bevelThickness: 0.007,
          bevelSegments: 2,
          curveSegments: 24,
        }),
        gold,
        [0.12, 0.45, 0.409],
      );
    } else {
      const pink = material('#c899cc');
      const pale = material('#edd6e8');
      const violet = material('#a57fbc');
      soft(rig, pink, [0, 0.39, 0.055], [0.26, 0.32, 0.29]);
      soft(rig, pale, [0, 0.365, -0.2], [0.173, 0.22, 0.104]);
      for (const side of [-1, 1]) {
        const foot = pivot(rig, [side * 0.182, 0.13, -0.01]);
        foot.name = `pet-foot-${legs.length}`;
        soft(foot, pink, [0, 0, -0.07], [0.141, 0.13, 0.228]);
        legs.push({ pivot: foot, height: 0.13, upper: 0, lower: 0 });
        soft(rig, pink, [side * 0.224, 0.414, -0.14], [0.07, 0.177, 0.093]);
      }
      head = pivot(rig, [0, 0.742, -0.21]);
      soft(head, pink, [0, 0, 0], [0.27, 0.235, 0.238]);
      soft(head, pale, [0, -0.087, -0.172], [0.166, 0.106, 0.106]);
      soft(head, violet, [0, -0.051, -0.27], [0.033, 0.025, 0.018], true);
      eyeGroups.push(...k.eyes(head, 0.026, -0.208, 0.123, 0.064, '#8163a8'));
      for (const side of [-1, 1]) {
        const ear = leaf(head, pink, [side * 0.135, 0.146, 0.028], 0.22, 0.58);
        ear.rotation.z = side * -0.19;
        const inset = leaf(head, pale, [side * 0.135, 0.184, -0.007], 0.117, 0.455);
        inset.rotation.z = side * -0.19;
      }
      soft(rig, pale, [0, 0.4, 0.335], [0.13, 0.13, 0.13]);
      emissive = material('#fce8b7', { emissive: '#dfbf81', emissiveIntensity: 0.3 });
      mesh(
        head,
        new THREE.OctahedronGeometry(0.059),
        emissive,
        [0, 0.148, -0.194],
        [0.7, 1.1, 0.25],
      );
      const membrane = material('#d2b9ed', {
        transparent: true,
        opacity: 0.62,
        side: THREE.DoubleSide,
        roughness: 0.3,
        emissive: '#9585ba',
        emissiveIntensity: 0.12,
        depthWrite: false,
      });
      for (const side of [-1, 1]) {
        const wing = pivot(rig, [side * 0.14, 0.5, 0.19]);
        wing.scale.x = side;
        const upper = leaf(wing, membrane, [0, 0, 0], 0.43, 0.72, 0.008);
        upper.rotation.z = -0.63;
        const lower = leaf(wing, membrane, [0.04, -0.03, 0.019], 0.34, 0.46, 0.008);
        lower.rotation.z = -1.75;
        tube(
          wing,
          pale,
          [
            [0, 0, -0.013],
            [0.2, 0.29, -0.017],
            [0.405, 0.576, -0.013],
          ],
          0.01,
        );
        tube(
          wing,
          pale,
          [
            [0, 0, -0.012],
            [0.24, -0.006, -0.012],
            [0.47, -0.105, -0.012],
          ],
          0.008,
        );
        wings.push(wing);
      }
      const saddle = material('#96749b', { roughness: 0.86 });
      soft(rig, saddle, [0, 0.682, 0.19], [0.235, 0.044, 0.242]);
      soft(rig, pale, [0, 0.655, 0.19], [0.251, 0.025, 0.265]);
      soft(rig, saddle, [0, 0.733, 0.373], [0.215, 0.083, 0.046]);
      tube(
        rig,
        gold,
        [
          [-0.18, 0.719, 0.004],
          [0, 0.775, -0.03],
          [0.18, 0.719, 0.004],
        ],
        0.016,
      );
      for (const side of [-1, 1])
        tube(
          rig,
          saddle,
          [
            [side * 0.23, 0.655, 0.1],
            [side * 0.26, 0.43, 0.05],
            [side * 0.15, 0.245, 0.0],
          ],
          0.017,
        );
      ridingTack = pivot(rig, [0, 0, 0]);
      ridingTack.visible = false;
      for (const side of [-1, 1]) {
        tube(
          ridingTack,
          gold,
          [
            [side * 0.125, 0.654, -0.407],
            [side * 0.18, 0.76, -0.27],
            [side * 0.17, 0.94, -0.2],
          ],
          0.01,
        );
      }
    }
    if (stage >= 2) {
      const marking = material('#d0f5dd', { emissive: '#79baa2', emissiveIntensity: 0.2 });
      for (const side of [-1, 1])
        mesh(
          rig,
          new THREE.OctahedronGeometry(0.045),
          marking,
          [side * 0.2, petId === 'moss' ? 0.72 : 0.59, petId === 'moss' ? 0.1 : -0.26],
          [0.68, 1.2, 0.5],
        );
    }
    const size = stage === 0 ? 0.88 : stage === 3 ? 1.13 : stage === 2 ? 1.065 : 1;
    rig.scale.setScalar(size);
    const seatPoint = new THREE.Vector3(0, 0.725, 0.19);
    const rideSeat = petId === 'lumi' ? seatPoint.clone().multiplyScalar(size) : undefined;
    let flying = false;
    const legHeight = legs[0].height;
    return {
      group,
      locomotion: {
        walkSpeed: (petId === 'lumi' ? 0.8 : 0.75) * size,
        runSpeed: 3.6 * size,
        walkStride: (petId === 'lumi' ? 0.65 : (2 * legHeight * 0.45) / 0.42) * size,
        runStride: (petId === 'lumi' ? 1.8 : 10 * legHeight) * size,
      },
      rideSeat,
      setFlying(value) {
        flying = petId === 'lumi' && value;
        if (ridingTack) ridingTack.visible = flying;
      },
      animate(time, speed, jump = 0, motion) {
        const pose = readLocomotion(time, speed, jump, motion);
        time = pose.time;
        jump = pose.jump;
        const move = pose.weight * (1 - jump * 0.5);
        const gait = pose.phase;
        const run = pose.run;
        const reach = petId === 'lumi' ? 0.12 + run * 0.1 : legHeight * (0.45 + run * 0.15);
        const cycleLength =
          petId === 'lumi' ? 0.65 + run * 1.15 : legHeight * (0.9 / 0.42 + run * (10 - 0.9 / 0.42));
        const duty = (2 * reach) / cycleLength;
        const bodyDrop =
          petId === 'lumi'
            ? move * sampleSuspension(gait, duty) * (0.06 + run * 0.1)
            : move * legHeight * (-0.24 - run * 0.16 + run * sampleSuspension(gait, duty) * 0.8);
        rig.position.y = flying
          ? Math.sin(time * 5) * 0.027
          : bodyDrop * size + Math.sin(time * 2) * 0.008 * (1 - move);
        rig.rotation.z = flying ? Math.sin(time * 2.5) * 0.026 : 0;
        rig.rotation.x = flying ? 0.06 : 0;
        legs.forEach(({ pivot: leg, knee, ankle, height, upper, lower }, index) => {
          const phase =
            petId === 'lumi' ? gait + index * Math.PI : quadrupedPhase(gait, index, run);
          const step = sampleFootstep(
            phase,
            reach,
            petId === 'lumi' ? 0.08 + run * 0.11 : height * (0.22 + run * 0.1),
            duty,
          );
          if (knee && ankle) {
            const angles = solveLeg(
              step.z * move,
              Math.max((upper + lower) * 0.4, height - 0.065 + bodyDrop - step.lift * move),
              upper,
              lower,
            );
            leg.rotation.x = angles.hip + jump * 0.08;
            knee.rotation.x = angles.knee;
            ankle.rotation.x = -angles.hip - angles.knee + step.pitch * move;
          } else {
            leg.position.y = flying ? 0.22 : height + step.lift * move - bodyDrop;
            leg.position.z = flying ? -0.01 : -0.01 + step.z * move;
            leg.rotation.x = flying ? -0.58 : step.pitch * move + jump * 0.08;
          }
        });
        if (head) {
          head.rotation.y = Math.sin(time * 0.8) * 0.08 * (1 - move * 0.5);
          head.rotation.x = Math.sin(time * 1.5) * 0.02 * (1 - move) - move * run * 0.035;
        }
        if (tail) tail.rotation.y = Math.sin(time * 2.3) * (0.15 + move * 0.1);
        wings.forEach((wing, index) => {
          const side = index === 0 ? -1 : 1;
          wing.rotation.y =
            side * (0.22 + Math.sin(time * (flying ? 9 : 7)) * (flying ? 0.96 : 0.29));
          wing.rotation.z = flying ? side * (0.1 + Math.cos(time * 9) * 0.24) : 0;
        });
        const blink = (time + 0.5) % 5.3;
        eyeGroups.forEach((eye) => {
          eye.scale.y = blink < 0.13 ? Math.max(0.06, Math.abs(blink - 0.065) / 0.065) : 1;
        });
        if (emissive) emissive.emissiveIntensity = 0.32 + Math.sin(time * 2) * 0.08;
        if (rideSeat) {
          rig.updateMatrix();
          rideSeat.copy(seatPoint).applyMatrix4(rig.matrix);
        }
      },
      dispose: k.dispose,
    };
  } catch (error) {
    k.dispose();
    throw error;
  }
}
