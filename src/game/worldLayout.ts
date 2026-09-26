import type { RegionId } from './adventure';
import { REGION_PATHS } from './landmarks';

export type WorldZone = 'ruins' | 'grove' | 'shore';
export interface WorldPoint {
  x: number;
  z: number;
}
export interface WorldTree extends WorldPoint {
  size: number;
  variant: number;
  rotation: number;
}

export interface WorldBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}
const COMPACT_BOUNDS: Readonly<WorldBounds> = Object.freeze({
  minX: -72,
  maxX: 72,
  minZ: -72,
  maxZ: 72,
});
/** Compatibility default: callers without a region are exploring the meadow. */
export const WORLD_BOUNDS: Readonly<WorldBounds> = Object.freeze({
  minX: -108,
  maxX: 108,
  minZ: -108,
  maxZ: 108,
});
export function getWorldBounds(region: RegionId = 'meadow'): Readonly<WorldBounds> {
  return region === 'meadow' ? WORLD_BOUNDS : COMPACT_BOUNDS;
}
export const SPAWN_POSITION: WorldPoint = { x: 0, z: 24 };
export const WORLD_ZONES: Record<WorldZone, WorldPoint> = {
  ruins: { x: -8, z: -23 },
  grove: { x: -25, z: -5 },
  shore: { x: 23, z: 3 },
};
export const CRYSTAL_POSITIONS: WorldPoint[] = [
  WORLD_ZONES.ruins,
  WORLD_ZONES.grove,
  WORLD_ZONES.shore,
];
const WATER_ZONES = { ...WORLD_ZONES, shore: { x: 12, z: 36 } };
const WATER_CRYSTALS = Object.values(WATER_ZONES);
export function getRegionZones(region: RegionId = 'meadow'): Record<WorldZone, WorldPoint> {
  return region === 'water' ? WATER_ZONES : WORLD_ZONES;
}
export function getCrystalPositions(region: RegionId = 'meadow'): WorldPoint[] {
  return region === 'water' ? WATER_CRYSTALS : CRYSTAL_POSITIONS;
}
export const LAKE = { x: 32, z: -5, radiusX: 13, radiusZ: 15, waterLevel: 0.55 } as const;
const COAST = { x: 41, z: -8, radiusX: 42, radiusZ: 45, waterLevel: 0.55 };
export function getRegionLake(region: RegionId = 'meadow') {
  return region === 'water' ? COAST : LAKE;
}
export const TRAILS: WorldPoint[][] = [
  [
    { x: 8, z: 76 },
    { x: 3, z: 54 },
    { x: 0, z: 30 },
    { x: 1, z: 18 },
    { x: -3, z: 8 },
    { x: -2, z: -4 },
    { x: -7, z: -15 },
    { x: -8, z: -27 },
  ],
  [
    { x: -2, z: 4 },
    { x: -10, z: 1 },
    { x: -17, z: -5 },
    { x: -25, z: -5 },
    { x: -34, z: -12 },
  ],
  [
    { x: -2, z: 6 },
    { x: 6, z: 4 },
    { x: 14, z: 7 },
    { x: 22, z: 6 },
    { x: 24, z: 3 },
  ],
  [
    { x: -8, z: -25 },
    { x: -20, z: -24 },
    { x: -23, z: -30 },
    { x: -30, z: -30 },
    { x: -34, z: -27 },
    { x: -34, z: -12 },
  ],
];

export function getRegionTrails(region: RegionId = 'meadow'): WorldPoint[][] {
  return region === 'water' ? REGION_PATHS.water : [...TRAILS, ...REGION_PATHS[region]];
}
