import type { Group } from 'three';
export interface SceneryFrame {
  position: { x: number; z: number };
  delta: number;
  running: boolean;
}
export interface RegionScenery {
  readonly group: Group;
  update(time: number, visited?: boolean, frame?: SceneryFrame): void;
  dispose(): void;
}
export type SceneryFactory = () => RegionScenery;
export interface SceneryModule {
  createRegionScenery: SceneryFactory;
}
