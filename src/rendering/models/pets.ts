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
import { buildRipple } from './petSpecies/ripple';
import { buildCinder } from './petSpecies/cinder';
import { buildMoss } from './petSpecies/moss';
import { buildBolt } from './petSpecies/bolt';
import { buildLumi } from './petSpecies/lumi';
import type { ModelRig, PetId } from './types';

const builders = {
  ripple: buildRipple,
  cinder: buildCinder,
  moss: buildMoss,
  bolt: buildBolt,
  lumi: buildLumi,
};

/** Species builders supply anatomy; one distance-driven rig keeps feet and lifetime consistent. */
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
    const { group, rig } = k;
    group.name = `companion-${petId}-${stage}`;
    const anatomy = builders[petId](k);
    const { legs, eyes, head, tail, glow, tack, seat } = anatomy;
    const size = stage === 0 ? 0.88 : stage === 3 ? 1.13 : stage === 2 ? 1.065 : 1;
    rig.scale.setScalar(size);
    const rideSeat = seat?.clone().multiplyScalar(size);
    const biped = legs.length === 2;
    const height = legs[0].height;
    const walkStride = (height * 0.9) / 0.42;
    const runStride = height * (biped ? 8 : 10);
    let flying = false;
    return {
      group,
      locomotion: {
        walkSpeed: (biped ? 1.2 : 0.85) * size,
        runSpeed: (petId === 'moss' ? 3.2 : 4.2) * size,
        walkStride: walkStride * size,
        runStride: runStride * size,
      },
      rideSeat,
      setFlying(value) {
        flying = !!seat && value;
        if (tack) tack.visible = flying;
      },
      animate(time, speed, jump = 0, motion) {
        const pose = readLocomotion(time, speed, jump, motion);
        time = pose.time;
        jump = pose.jump;
        const move = pose.weight * (1 - jump * 0.5);
        const { phase, run } = pose;
        const reach = height * (0.45 + run * 0.15);
        const cycleLength = THREE.MathUtils.lerp(walkStride, runStride, run);
        const duty = (2 * reach) / cycleLength;
        const suspension = sampleSuspension(phase, duty);
        const bodyDrop = move * height * (-0.18 - run * 0.13 + run * suspension * 0.65);
        rig.position.y = flying
          ? Math.sin(time * 6.5) * 0.025
          : bodyDrop * size + Math.sin(time * 1.7) * 0.007 * (1 - move);
        rig.rotation.x = flying ? 0.05 : 0;
        rig.rotation.z = flying ? Math.sin(time * 2.1) * 0.022 : 0;
        legs.forEach((leg, index) => {
          const gait = biped ? phase + index * Math.PI : quadrupedPhase(phase, index, run);
          const step = sampleFootstep(gait, reach, height * (0.22 + run * 0.12), duty);
          const angles = solveLeg(
            step.z * move,
            Math.max(
              (leg.upper + leg.lower) * 0.4,
              leg.height - leg.sole + bodyDrop - step.lift * move,
            ),
            leg.upper,
            leg.lower,
          );
          leg.hip.rotation.x = flying ? 0.68 : angles.hip + jump * 0.08;
          leg.knee.rotation.x = flying ? -1.48 : angles.knee;
          leg.ankle.rotation.x = flying ? -0.2 : -angles.hip - angles.knee + step.pitch * move;
        });
        if (head) {
          head.rotation.y = Math.sin(time * 0.7) * 0.075 * (1 - move * 0.65);
          head.rotation.x = Math.sin(time * 1.3) * 0.024 * (1 - move) - move * run * 0.025;
        }
        if (tail) {
          const amplitude = petId === 'moss' ? 0.055 : petId === 'cinder' ? 0.11 : 0.18;
          tail.rotation.y = Math.sin(time * 1.75) * amplitude * (1 + move * 0.4);
        }
        const blink = (time + 0.5) % 5.3;
        eyes.forEach((eye) => {
          eye.scale.y = blink < 0.13 ? Math.max(0.06, Math.abs(blink - 0.065) / 0.065) : 1;
        });
        if (glow) glow.emissiveIntensity = 0.42 + Math.sin(time * 1.8) * 0.085;
        anatomy.signature?.(time, move, flying);
        if (rideSeat && seat) {
          rig.updateMatrix();
          rideSeat.copy(seat).applyMatrix4(rig.matrix);
        }
      },
      dispose: k.dispose,
    };
  } catch (error) {
    k.dispose();
    throw error;
  }
}
