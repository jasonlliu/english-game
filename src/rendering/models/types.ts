import type * as THREE from 'three';
import type { LocomotionProfile } from '../../game/locomotion';
export type { PetId } from '../../game/adventure';
/** One full left/right stride is 2π radians, accumulated from distance travelled. */
export interface LocomotionPose {
  phase: number;
  run: number;
}
export interface ModelRig {
  group: THREE.Group;
  /** Movement blend and distance-per-cycle calibrated to this model's scale. */
  locomotion?: LocomotionProfile;
  animate(time: number, speed: number, jump?: number, motion?: LocomotionPose): void;
  setRiding?(riding: boolean): void;
  setFlying?(flying: boolean): void;
  /** Animated anchor in group-local coordinates; transform with group.localToWorld. */
  rideSeat?: THREE.Vector3;
  /** Human hip anchor, also in group-local coordinates. */
  riderHip?: THREE.Vector3;
  dispose(): void;
}
export type Point = [number, number, number];
