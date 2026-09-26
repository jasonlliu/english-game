import type { Group } from 'three';
import type { DiscoveryProgress } from '../../game/discovery';
export interface WildlifeObservation {
  readonly id: string;
  readonly kind: 'deer' | 'rabbit' | 'bird' | 'fox' | 'butterfly';
  readonly x: number;
  readonly z: number;
  readonly alert: number;
  readonly speed: number;
  readonly startled: boolean;
}
export interface SceneryFrame {
  position: { x: number; z: number };
  delta: number;
  running: boolean;
  discovery?: DiscoveryProgress;
  today?: string;
  companion?: boolean;
  observingId?: string;
  discoveryInteraction?: { id: string; serial: number };
  race?: { active: boolean; nextGate: number };
}
export interface RegionScenery {
  readonly group: Group;
  wildlife?(): readonly WildlifeObservation[];
  update(time: number, visited?: boolean, frame?: SceneryFrame): void;
  dispose(): void;
}
export type SceneryFactory = () => RegionScenery;
export interface SceneryModule {
  createRegionScenery: SceneryFactory;
}
