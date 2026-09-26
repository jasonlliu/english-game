import * as THREE from 'three';
import type { modelKit } from '../modelKit';
import type { Point } from '../types';

export type PetKit = ReturnType<typeof modelKit>;
export interface PetLeg {
  hip: THREE.Group;
  knee: THREE.Group;
  ankle: THREE.Group;
  height: number;
  upper: number;
  lower: number;
  sole: number;
}
export interface SpeciesAnatomy {
  legs: PetLeg[];
  eyes: THREE.Group[];
  head?: THREE.Group;
  tail?: THREE.Group;
  wings?: THREE.Group[];
  seat?: THREE.Vector3;
  tack?: THREE.Group;
  glow?: THREE.MeshStandardMaterial;
  signature?(time: number, move: number, flying: boolean): void;
}

/** The common rig owns motion and lifetime; species own their actual anatomy. */
export function anatomyKit(k: PetKit) {
  let angular: THREE.BufferGeometry | undefined;
  let claw: THREE.BufferGeometry | undefined;
  let box: THREE.BufferGeometry | undefined;
  const plate = (parent: THREE.Object3D, mat: THREE.Material, p: Point, s: Point) =>
    k.mesh(parent, (angular ??= new THREE.IcosahedronGeometry(1, 0)), mat, p, s);
  const block = (parent: THREE.Object3D, mat: THREE.Material, p: Point, s: Point) =>
    k.mesh(parent, (box ??= new THREE.BoxGeometry(1, 1, 1)), mat, p, s);
  const spike = (parent: THREE.Object3D, mat: THREE.Material, p: Point, s: Point) =>
    k.mesh(parent, (claw ??= new THREE.ConeGeometry(1, 1, 5)), mat, p, s);

  function fin(
    parent: THREE.Object3D,
    mat: THREE.Material,
    p: Point,
    outline: Array<[number, number]>,
    depth = 0.035,
  ) {
    const shape = new THREE.Shape();
    outline.forEach(([x, y], index) => {
      if (index) shape.lineTo(x, y);
      else shape.moveTo(x, y);
    });
    shape.closePath();
    return k.mesh(
      parent,
      new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: true,
        bevelSize: 0.008,
        bevelThickness: 0.008,
        bevelSegments: 1,
      }),
      mat,
      p,
    );
  }
  function legs(
    mat: THREE.Material,
    footMat: THREE.Material,
    x: number,
    z: number,
    height: number,
    width: number,
    biped = false,
    mechanical = false,
  ): PetLeg[] {
    const result: PetLeg[] = [];
    for (const side of [-1, 1]) {
      for (const at of biped ? [z] : [-z, z]) {
        const sole = width * 0.5;
        const upper = (height - sole) * 0.53;
        const lower = (height - sole) * 0.53;
        const hip = k.pivot(k.rig, [side * x, height, at]);
        const knee = k.pivot(hip, [0, -upper, 0]);
        const ankle = k.pivot(knee, [0, -lower, 0]);
        hip.name = `pet-hip-${result.length}`;
        knee.name = `pet-knee-${result.length}`;
        ankle.name = `pet-ankle-${result.length}`;
        const limb = mechanical ? plate : k.soft;
        limb(hip, mat, [0, -upper * 0.43, 0], [width, upper * 0.68, width]);
        limb(knee, mat, [0, -lower * 0.46, 0], [width * 0.65, lower * 0.7, width * 0.75]);
        limb(ankle, footMat, [0, 0, -width * 0.4], [width * 1.08, sole, width * 1.55]);
        if (mechanical) {
          plate(knee, footMat, [0, 0, -width * 0.5], [width * 0.82, width * 0.85, width * 0.6]);
        }
        result.push({ hip, knee, ankle, height, upper, lower, sole });
      }
    }
    return result;
  }
  return { plate, spike, block, fin, legs };
}
