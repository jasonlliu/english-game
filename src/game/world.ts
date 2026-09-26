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
export const LAKE = { x: 32, z: -5, radiusX: 13, radiusZ: 15, waterLevel: 0.55 } as const;
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

const smoothstep = (low: number, high: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
};
export function lakeDistance(x: number, z: number) {
  const nx = (x - LAKE.x) / LAKE.radiusX;
  const nz = (z - LAKE.z) / LAKE.radiusZ;
  const angle = Math.atan2(nz, nx);
  const shorePeninsula = Math.exp(-((x - 22.5) ** 2 / 35 + (z - 4) ** 2 / 29)) * 0.42;
  return (
    Math.hypot(nx, nz) / (1 + Math.sin(angle * 3 + 0.7) * 0.055 + Math.cos(angle * 5) * 0.027) +
    shorePeninsula
  );
}
export function getTerrainHeight(x: number, z: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return 0;
  const meadow =
    1.8 +
    Math.sin(x * 0.062 + 0.5) * Math.cos(z * 0.055) * 1.5 +
    Math.sin(x * 0.13 + z * 0.082) * 0.32 +
    Math.cos(z * 0.14 - x * 0.071) * 0.25;
  const templeHill = Math.exp(-((x + 8) ** 2 / 170 + (z + 27) ** 2 / 190)) * 3.8;
  const westernRidge = Math.exp(-((x + 54) ** 2 / 260 + (z + 27) ** 2 / 800)) * 8;
  const rearHills = smoothstep(34, 85, -z) * (5 + Math.sin(x * 0.09) * 3);
  const ground = meadow + templeHill + westernRidge + rearHills;
  const lakeBlend = smoothstep(0.76, 1.18, lakeDistance(x, z));
  return -0.7 + (ground + 0.7) * lakeBlend;
}

export function getRegionTrails(region: RegionId = 'meadow'): WorldPoint[][] {
  return [...TRAILS, ...REGION_PATHS[region]];
}
function distanceToPaths(x: number, z: number, paths: WorldPoint[][]): number {
  let distance = Infinity;
  for (const path of paths)
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1],
        b = path[i];
      const dx = b.x - a.x,
        dz = b.z - a.z;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
      distance = Math.min(distance, Math.hypot(x - a.x - dx * t, z - a.z - dz * t));
    }
  return distance;
}
export function distanceToTrail(x: number, z: number, region: RegionId = 'meadow'): number {
  return distanceToPaths(x, z, getRegionTrails(region));
}

// Seeded positions are shared by rendering, movement collision, and navigation.
function makeTrees(): WorldTree[] {
  let seed = 97123;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const trees: WorldTree[] = [];
  for (let i = 0; i < 1180; i++) {
    const x = (random() - 0.5) * 158;
    const z = (random() - 0.5) * 158;
    const size = 0.78 + random() * 0.88;
    const variant = random() < 0.43 ? 0 : 1;
    const rotation = random() * Math.PI * 2;
    const distance = distanceToPaths(x, z, TRAILS);
    if (lakeDistance(x, z) < 1.23 || distance < 4.3 || Math.hypot(x + 8, z + 26) < 10) continue;
    if (
      Math.hypot(x - SPAWN_POSITION.x, z - SPAWN_POSITION.z) < 11 ||
      Math.hypot(x + 25, z + 5) < 5
    )
      continue;
    if (x > -18 && x < 18 && z > 4 && z < 51) continue;
    // The eastern opening reveals the lake across the meadow on arrival.
    if (x > 10 && x < 29 && z > 2 && z < 29) continue;
    // Preserve a long, open view from the spawn meadow to the temple.
    if (Math.abs(x + 4) < 12 && z > -24 && z < 31 && random() < 0.86) continue;
    if (trees.some((tree) => Math.hypot(x - tree.x, z - tree.z) < 3.1)) continue;
    trees.push({ x, z, size, variant, rotation });
  }
  return trees;
}
const TREE_CANDIDATES = makeTrees();
function makeOuterMeadowTrees(): WorldTree[] {
  let seed = 17849;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const trees: WorldTree[] = [];
  for (let i = 0; i < 1800 && trees.length < 250; i++) {
    const x = (random() - 0.5) * 220,
      z = (random() - 0.5) * 220;
    if (Math.max(Math.abs(x), Math.abs(z)) < 77) continue;
    if (trees.some((tree) => Math.hypot(tree.x - x, tree.z - z) < 4.2)) continue;
    trees.push({
      x,
      z,
      size: 0.82 + random() * 0.75,
      variant: random() < 0.4 ? 0 : 1,
      rotation: random() * Math.PI * 2,
    });
  }
  return trees;
}
const OUTER_MEADOW_TREES = makeOuterMeadowTrees();
const treeCache = new Map<RegionId, WorldTree[]>();
export function getWorldTrees(region: RegionId = 'meadow'): WorldTree[] {
  if (!treeCache.has(region)) {
    const density = { meadow: 0.14, water: 0.42, fire: 0.52, earth: 0.6, steel: 0.55, fairy: 0.19 }[
      region
    ];
    const candidates =
      region === 'meadow' ? [...TREE_CANDIDATES, ...OUTER_MEADOW_TREES] : TREE_CANDIDATES;
    const trees = candidates
      .filter((tree) => {
        if (REGION_VOLUMES[region].some((volume) => distanceToVolume(tree.x, tree.z, volume) < 4.8))
          return false;
        if (
          REGION_PLACES[region].some((place) => Math.hypot(place.x - tree.x, place.z - tree.z) < 5)
        )
          return false;
        // Keep the arrival camera behind a viewpoint out of the tree crowns.
        // This narrow corridor preserves nearby woodland without forcing a close-up on arrival.
        if (
          REGION_PLACES[region].some((place) => {
            if (!place.lookAt) return false;
            const dx = place.x - place.lookAt.x,
              dz = place.z - place.lookAt.z;
            const length = Math.hypot(dx, dz);
            if (!length) return false;
            const along = Math.max(
              0,
              Math.min(15, ((tree.x - place.x) * dx + (tree.z - place.z) * dz) / length),
            );
            return (
              Math.hypot(
                tree.x - place.x - (dx * along) / length,
                tree.z - place.z - (dz * along) / length,
              ) <
              tree.size * 2.3 + 1.5
            );
          })
        )
          return false;
        if (distanceToTrail(tree.x, tree.z, region) < 4.3) return false;
        // Forest patches replace the old uniformly repeated field of trunks.
        return (
          Math.sin(tree.x * 0.071 + 1.7) * Math.cos(tree.z * 0.097 - 0.3) +
            Math.sin(tree.z * 0.042) * 0.35 >
          density
        );
      })
      .map((tree) => (region === 'fire' && tree.x < -12 ? { ...tree, variant: 0 } : tree));
    treeCache.set(region, trees);
  }
  return treeCache.get(region)!;
}
export const WORLD_TREES = getWorldTrees();
export const WORLD_OBSTACLES = [
  { x: -11.7, z: -27, radius: 1.05 },
  { x: -4.3, z: -27, radius: 1.05 },
  { x: -15.5, z: -24.2, radius: 1.05 },
  { x: -0.8, z: -24.8, radius: 1.05 },
  { x: -5.1, z: -20.2, radius: 1.0 },
  { x: -31.6, z: -5, radius: 1.45 },
  { x: -27.8, z: -9.6, radius: 1.2 },
  { x: -57, z: -28, radius: 8 },
  { x: -60, z: -45, radius: 10 },
  { x: 47, z: -39, radius: 7 },
] as const;

export function clampToWorld(position: WorldPoint, region: RegionId = 'meadow'): WorldPoint {
  const bounds = getWorldBounds(region);
  return {
    x: Math.max(
      bounds.minX,
      Math.min(bounds.maxX, Number.isFinite(position.x) ? position.x : SPAWN_POSITION.x),
    ),
    z: Math.max(
      bounds.minZ,
      Math.min(bounds.maxZ, Number.isFinite(position.z) ? position.z : SPAWN_POSITION.z),
    ),
  };
}
export function isWalkable(
  x: number,
  z: number,
  radius = 0.6,
  region: RegionId = 'meadow',
): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(radius) || radius < 0)
    return false;
  const bounds = getWorldBounds(region);
  if (
    x < bounds.minX + radius ||
    x > bounds.maxX - radius ||
    z < bounds.minZ + radius ||
    z > bounds.maxZ - radius
  )
    return false;
  if (lakeDistance(x, z) < 1.065 + radius / 15) return false;
  for (const obstacle of WORLD_OBSTACLES)
    if (Math.hypot(x - obstacle.x, z - obstacle.z) < radius + obstacle.radius) return false;
  for (const volume of REGION_VOLUMES[region])
    if ((volume.minY ?? 0) < 2.6 && distanceToVolume(x, z, volume) <= radius) return false;
  for (const tree of getWorldTrees(region))
    if (Math.hypot(x - tree.x, z - tree.z) < radius + tree.size * 0.23) return false;
  return true;
}
export function resolveMovement(
  from: WorldPoint,
  to: WorldPoint,
  region: RegionId = 'meadow',
): WorldPoint {
  if (!Number.isFinite(from.x) || !Number.isFinite(from.z)) return { ...SPAWN_POSITION };
  if (!Number.isFinite(to.x) || !Number.isFinite(to.z)) return { ...from };
  const destination = clampToWorld(to, region);
  const distance = Math.hypot(destination.x - from.x, destination.z - from.z);
  const steps = Math.max(1, Math.ceil(distance / 0.32));
  const dx = (destination.x - from.x) / steps,
    dz = (destination.z - from.z) / steps;
  let position = { ...from };
  for (let step = 0; step < steps; step++) {
    const next = { x: position.x + dx, z: position.z + dz };
    if (isWalkable(next.x, next.z, 0.6, region)) position = next;
    else if (isWalkable(next.x, position.z, 0.6, region)) position.x = next.x;
    else if (isWalkable(position.x, next.z, 0.6, region)) position.z = next.z;
  }
  return position;
}

function clearSegment(from: WorldPoint, to: WorldPoint, region: RegionId): boolean {
  if (!isWalkable(from.x, from.z, 0.6, region) || !isWalkable(to.x, to.z, 0.6, region))
    return false;
  const dx = to.x - from.x,
    dz = to.z - from.z,
    lengthSquared = dx * dx + dz * dz;
  const intersectsCircle = (x: number, z: number, radius: number) => {
    const t = lengthSquared
      ? Math.max(0, Math.min(1, ((x - from.x) * dx + (z - from.z) * dz) / lengthSquared))
      : 0;
    return (from.x + dx * t - x) ** 2 + (from.z + dz * t - z) ** 2 < (radius + 0.6) ** 2;
  };
  for (const obstacle of WORLD_OBSTACLES)
    if (intersectsCircle(obstacle.x, obstacle.z, obstacle.radius)) return false;
  for (const tree of getWorldTrees(region))
    if (intersectsCircle(tree.x, tree.z, tree.size * 0.23)) return false;
  for (const volume of REGION_VOLUMES[region]) {
    if ((volume.minY ?? 0) >= 2.6) continue;
    let low = 0,
      high = 1;
    for (const [origin, direction, center, half] of [
      [from.x, dx, volume.x, volume.halfX + 0.6],
      [from.z, dz, volume.z, volume.halfZ + 0.6],
    ]) {
      if (Math.abs(direction) < 1e-10) {
        if (Math.abs(origin - center) > half) {
          low = 2;
          break;
        }
      } else {
        const a = (center - half - origin) / direction,
          b = (center + half - origin) / direction;
        low = Math.max(low, Math.min(a, b));
        high = Math.min(high, Math.max(a, b));
      }
    }
    if (low <= high) return false;
  }
  const count = Math.max(1, Math.ceil(Math.sqrt(lengthSquared) / 0.1));
  for (let i = 0; i <= count; i++)
    if (lakeDistance(from.x + (dx * i) / count, from.z + (dz * i) / count) < 1.065 + 0.6 / 15)
      return false;
  return true;
}

/** Deterministic A* with a heap frontier; shortcuts require continuous clearance. */
export function getNavigationPath(
  from: WorldPoint,
  to: WorldPoint,
  region: RegionId = 'meadow',
): WorldPoint[] {
  if (!isWalkable(from.x, from.z, 0.6, region) || !isWalkable(to.x, to.z, 0.6, region)) return [];
  if (clearSegment(from, to, region)) return [{ ...to }];
  const cell = 2;
  const key = (x: number, z: number) => `${x},${z}`;
  const point = (x: number, z: number) => ({ x: x * cell, z: z * cell });
  const nearestNode = (position: WorldPoint) => {
    const centerX = Math.round(position.x / cell),
      centerZ = Math.round(position.z / cell);
    let result: { x: number; z: number } | null = null;
    let best = Infinity;
    for (let dx = -2; dx <= 2; dx++)
      for (let dz = -2; dz <= 2; dz++) {
        const p = point(centerX + dx, centerZ + dz);
        const distance = Math.hypot(position.x - p.x, position.z - p.z);
        if (distance < best && clearSegment(position, p, region)) {
          result = { x: centerX + dx, z: centerZ + dz };
          best = distance;
        }
      }
    return result;
  };
  const start = nearestNode(from),
    goal = nearestNode(to);
  if (!start || !goal) return [];
  type Node = { x: number; z: number; g: number; f: number; parent: Node | null };
  const open: Node[] = [{ ...start, g: 0, f: 0, parent: null }];
  const push = (node: Node) => {
    let index = open.length;
    open.push(node);
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (open[parent].f <= node.f) break;
      open[index] = open[parent];
      index = parent;
    }
    open[index] = node;
  };
  const pop = () => {
    const result = open[0],
      last = open.pop()!;
    if (open.length) {
      let index = 0;
      while (index * 2 + 1 < open.length) {
        let child = index * 2 + 1;
        if (child + 1 < open.length && open[child + 1].f < open[child].f) child++;
        if (last.f <= open[child].f) break;
        open[index] = open[child];
        index = child;
      }
      open[index] = last;
    }
    return result;
  };
  const costs = new Map<string, number>([[key(start.x, start.z), 0]]);
  const closed = new Set<string>();
  let end: Node | null = null;
  const bounds = getWorldBounds(region);
  const budget =
    Math.ceil(((bounds.maxX - bounds.minX) / cell + 1) * ((bounds.maxZ - bounds.minZ) / cell + 1)) *
    3;
  for (let attempt = 0; open.length && attempt < budget; attempt++) {
    const current = pop();
    const currentKey = key(current.x, current.z);
    if (closed.has(currentKey)) continue;
    closed.add(currentKey);
    if (current.x === goal.x && current.z === goal.z) {
      end = current;
      break;
    }
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++) {
        if (!dx && !dz) continue;
        const x = current.x + dx,
          z = current.z + dz;
        const nextKey = key(x, z);
        if (closed.has(nextKey)) continue;
        const next = point(x, z),
          here = point(current.x, current.z);
        if (!clearSegment(here, next, region)) continue;
        const g = current.g + Math.hypot(dx, dz);
        if (g >= (costs.get(nextKey) ?? Infinity)) continue;
        costs.set(nextKey, g);
        push({ x, z, g, f: g + Math.hypot(x - goal.x, z - goal.z), parent: current });
      }
  }
  if (!end) return [];
  const path: WorldPoint[] = [{ ...to }];
  for (let node: Node | null = end; node; node = node.parent) path.unshift(point(node.x, node.z));
  path.unshift({ ...from });
  const simplified: WorldPoint[] = [];
  let anchor = 0;
  while (anchor < path.length - 1) {
    let next = path.length - 1;
    while (next > anchor + 1 && !clearSegment(path[anchor], path[next], region)) next--;
    simplified.push(path[next]);
    anchor = next;
  }
  return simplified;
}
import type { RegionId } from './adventure';
import { REGION_PATHS, REGION_PLACES, REGION_VOLUMES, distanceToVolume } from './landmarks';
