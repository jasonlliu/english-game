import type { RegionId } from './adventure';
import { REGION_VOLUMES, distanceToVolume } from './landmarks';
import {
  getRegionLake,
  SPAWN_POSITION,
  getWorldObstacles,
  clampToWorld,
  getTerrainHeight,
  getWorldBounds,
  getWorldTrees,
  isWalkable,
  lakeDistance,
  type WorldPoint,
} from './world';

export interface FlightPosition extends WorldPoint {
  y: number;
}
export interface FlightStatus {
  flying: boolean;
  landing: boolean;
  altitude: number;
}
export const FLIGHT_CEILING = 65;
export const FLIGHT_SPEED = 12;
export const FLIGHT_VERTICAL_SPEED = 7;
const CLEARANCE = 3;

export { canPetFly } from './flightEligibility';

function boundedPoint(point: WorldPoint, region: RegionId): WorldPoint {
  const p = clampToWorld(point, region);
  const bounds = getWorldBounds(region);
  return {
    x: Math.max(bounds.minX + 1.5, Math.min(bounds.maxX - 1.5, p.x)),
    z: Math.max(bounds.minZ + 1.5, Math.min(bounds.maxZ - 1.5, p.z)),
  };
}
const smooth = (t: number) => {
  const value = Math.max(0, Math.min(1, t));
  return value * value * (3 - 2 * value);
};

/** Reserve clearance above terrain, tree crowns and each region's tallest shared landmarks. */
export function getFlightFloor(x: number, z: number, region: RegionId = 'meadow'): number {
  if (!Number.isFinite(x) || !Number.isFinite(z))
    return getFlightFloor(SPAWN_POSITION.x, SPAWN_POSITION.z, region);
  const LAKE = getRegionLake(region);
  const ground = Math.max(
    getTerrainHeight(x, z, region),
    lakeDistance(x, z, region) < 1.1 ? LAKE.waterLevel : -Infinity,
  );
  let floor = ground + CLEARANCE;
  for (const tree of getWorldTrees(region)) {
    const distance = Math.hypot(x - tree.x, z - tree.z);
    const crown = tree.size * 2.7 + 1.5;
    if (distance > crown + 8) continue;
    const top = getTerrainHeight(tree.x, tree.z, region) + tree.size * 7.4 + CLEARANCE;
    floor = Math.max(
      floor,
      ground +
        CLEARANCE +
        Math.max(0, top - ground - CLEARANCE) * smooth((crown + 8 - distance) / 8),
    );
  }
  for (const obstacle of getWorldObstacles(region)) {
    const distance = Math.hypot(x - obstacle.x, z - obstacle.z);
    const top =
      getTerrainHeight(obstacle.x, obstacle.z, region) +
      (obstacle.radius > 5 ? obstacle.radius * 2.65 : 9) +
      CLEARANCE;
    floor = Math.max(
      floor,
      ground +
        CLEARANCE +
        Math.max(0, top - ground - CLEARANCE) * smooth((obstacle.radius + 10 - distance) / 8),
    );
  }
  for (const volume of REGION_VOLUMES[region]) {
    const influence = smooth((8 - distanceToVolume(x, z, volume)) / 8);
    const top = getTerrainHeight(volume.x, volume.z, region) + volume.height + CLEARANCE;
    floor = Math.max(floor, ground + CLEARANCE + Math.max(0, top - ground - CLEARANCE) * influence);
  }
  // Temple ring, and the large coral/volcano/gear/mushroom installations in the lake.
  for (const landmark of region === 'water'
    ? []
    : [
        { x: -8, z: -27, radius: 7, height: 12 },
        { x: LAKE.x, z: LAKE.z, radius: 12, height: 26 },
      ]) {
    const influence = smooth(
      (landmark.radius + 10 - Math.hypot(x - landmark.x, z - landmark.z)) / 10,
    );
    const top =
      Math.max(getTerrainHeight(landmark.x, landmark.z, region), LAKE.waterLevel) +
      landmark.height +
      CLEARANCE;
    floor = Math.max(floor, ground + CLEARANCE + Math.max(0, top - ground - CLEARANCE) * influence);
  }
  return Math.min(FLIGHT_CEILING - 6, floor);
}

/** Air movement ignores ground obstacles, while respecting overhead clearance and world limits. */
export function moveFlight(
  position: FlightPosition,
  direction: WorldPoint,
  vertical: number,
  dt: number,
  region: RegionId = 'meadow',
): FlightPosition {
  const from = boundedPoint(position, region);
  const delta = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.1)) : 0;
  const dx = Number.isFinite(direction.x) ? direction.x : 0,
    dz = Number.isFinite(direction.z) ? direction.z : 0;
  const length = Math.hypot(dx, dz);
  const divisor = Math.max(1, length);
  const to = boundedPoint(
    {
      x: from.x + (dx / divisor) * FLIGHT_SPEED * delta,
      z: from.z + (dz / divisor) * FLIGHT_SPEED * delta,
    },
    region,
  );
  const distance = Math.hypot(to.x - from.x, to.z - from.z);
  let floor = getFlightFloor(from.x, from.z, region);
  const samples = Math.max(1, Math.ceil(distance / 0.4));
  for (let i = 1; i <= samples; i++)
    floor = Math.max(
      floor,
      getFlightFloor(
        from.x + ((to.x - from.x) * i) / samples,
        from.z + ((to.z - from.z) * i) / samples,
        region,
      ),
    );
  const startingY = Number.isFinite(position.y) ? position.y : floor + 4;
  const ascent = Number.isFinite(vertical) ? Math.max(-1, Math.min(1, vertical)) : 0;
  return {
    ...to,
    y: Math.min(
      FLIGHT_CEILING,
      Math.max(floor, startingY + ascent * FLIGHT_VERTICAL_SPEED * delta),
    ),
  };
}

function safeLanding(point: WorldPoint, region: RegionId): boolean {
  const bounds = getWorldBounds(region);
  if (
    point.x < bounds.minX + 1.5 ||
    point.x > bounds.maxX - 1.5 ||
    point.z < bounds.minZ + 1.5 ||
    point.z > bounds.maxZ - 1.5
  )
    return false;
  if (!isWalkable(point.x, point.z, 1.1, region) || lakeDistance(point.x, point.z, region) < 1.18)
    return false;
  if (
    getWorldTrees(region).some(
      (tree) => Math.hypot(point.x - tree.x, point.z - tree.z) < tree.size * 2.7 + 1.5,
    )
  )
    return false;
  if (REGION_VOLUMES[region].some((volume) => distanceToVolume(point.x, point.z, volume) < 2.1))
    return false;
  if (
    getWorldObstacles(region).some(
      (obstacle) => Math.hypot(point.x - obstacle.x, point.z - obstacle.z) < obstacle.radius + 2.1,
    )
  )
    return false;
  if (Math.hypot(point.x + 8, point.z + 27) < 7) return false;
  const height = getTerrainHeight(point.x, point.z, region);
  return [
    [2, 0],
    [-2, 0],
    [0, 2],
    [0, -2],
  ].every(
    ([dx, dz]) => Math.abs(getTerrainHeight(point.x + dx, point.z + dz, region) - height) < 1.5,
  );
}

/** Find open land under or near the rider, never water, a tree trunk or a ruin pillar. */
export function findLandingSpot(from: WorldPoint, region: RegionId = 'meadow'): WorldPoint {
  const center = boundedPoint(from, region);
  if (safeLanding(center, region)) return center;
  for (let radius = 0.75; radius <= 55; radius += 0.75) {
    const samples = Math.ceil((2 * Math.PI * radius) / 0.9);
    for (let i = 0; i < samples; i++) {
      const angle = (i / samples) * Math.PI * 2;
      const candidate = {
        x: center.x + Math.cos(angle) * radius,
        z: center.z + Math.sin(angle) * radius,
      };
      if (safeLanding(candidate, region)) return candidate;
    }
  }
  return { ...SPAWN_POSITION };
}
