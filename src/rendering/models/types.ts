import type * as THREE from 'three';
export type { PetId } from '../../game/adventure';
export interface ModelRig {
  group: THREE.Group;
  animate(time: number, speed: number, jump?: number): void;
  setRiding?(riding: boolean): void;
  setFlying?(flying: boolean): void;
  /** Animated anchor in group-local coordinates; transform with group.localToWorld. */
  rideSeat?: THREE.Vector3;
  /** Human hip anchor, also in group-local coordinates. */
  riderHip?: THREE.Vector3;
  dispose(): void;
}
export type Point = [number, number, number];
