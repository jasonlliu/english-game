import type { Group } from 'three';
import type { DiscoveryProgress } from '../../game/discovery';
export interface SceneryFrame {
  position: { x: number; z: number };
  delta: number;
  running: boolean;
  discovery?: DiscoveryProgress;
  today?: string;
  companion?: boolean;
  discoveryInteraction?: { id: string; serial: number };
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
