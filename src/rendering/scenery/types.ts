import type { Group } from 'three';
export interface RegionScenery {
  readonly group: Group;
  update(time: number, visited?: boolean): void;
  dispose(): void;
}
export type SceneryFactory = () => RegionScenery;
export interface SceneryModule {
  createRegionScenery: SceneryFactory;
}
