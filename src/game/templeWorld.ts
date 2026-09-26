import type { WorldPoint } from './world';

export const TEMPLE_SPAWN = { x: 0, z: 11 };
export const TEMPLE_BOUNDS = { minX: -11.3, maxX: 11.3, minZ: -15.4, maxZ: 14.4 };
export const TEMPLE_SEALS = [
  { x: -7, z: -2 },
  { x: 0, z: -7 },
  { x: 7, z: -2 },
];
export const TEMPLE_TARGETS = [
  { x: -7, z: 0.3 },
  { x: 0, z: -4.6 },
  { x: 7, z: 0.3 },
  { x: 0, z: -10 },
  { x: 0, z: 12.5 },
];
export const TEMPLE_COLUMNS = [-9, 9].flatMap((x) =>
  [8, -1, -10].map((z) => ({ x, z, radius: 0.9 })),
);
export const TEMPLE_OBSTACLES = [
  ...TEMPLE_COLUMNS,
  ...TEMPLE_SEALS.map((p) => ({ ...p, radius: 0.8 })),
  { x: 0, z: -13, radius: 1.55 },
];

export function isTempleWalkable(point: WorldPoint): boolean {
  const { x, z } = point;
  return (
    Number.isFinite(x) &&
    Number.isFinite(z) &&
    x >= TEMPLE_BOUNDS.minX &&
    x <= TEMPLE_BOUNDS.maxX &&
    z >= TEMPLE_BOUNDS.minZ &&
    z <= TEMPLE_BOUNDS.maxZ &&
    TEMPLE_OBSTACLES.every((o) => Math.hypot(x - o.x, z - o.z) >= o.radius + 0.4)
  );
}
export function resolveTempleMovement(from: WorldPoint, to: WorldPoint): WorldPoint {
  if (!isTempleWalkable(from)) return { ...TEMPLE_SPAWN };
  if (!Number.isFinite(to.x) || !Number.isFinite(to.z)) return { ...from };
  const target = {
    x: Math.min(TEMPLE_BOUNDS.maxX, Math.max(TEMPLE_BOUNDS.minX, to.x)),
    z: Math.min(TEMPLE_BOUNDS.maxZ, Math.max(TEMPLE_BOUNDS.minZ, to.z)),
  };
  const count = Math.max(1, Math.ceil(Math.hypot(target.x - from.x, target.z - from.z) / 0.18));
  const dx = (target.x - from.x) / count,
    dz = (target.z - from.z) / count;
  let result = { ...from };
  for (let i = 0; i < count; i++) {
    const next = { x: result.x + dx, z: result.z + dz };
    if (clearPath(result, next)) result = next;
    else if (clearPath(result, { x: next.x, z: result.z })) result.x = next.x;
    else if (clearPath(result, { x: result.x, z: next.z })) result.z = next.z;
  }
  return result;
}
function clearPath(a: WorldPoint, b: WorldPoint) {
  if (!isTempleWalkable(a) || !isTempleWalkable(b)) return false;
  const dx = b.x - a.x,
    dz = b.z - a.z,
    lengthSquared = dx * dx + dz * dz;
  // A short chord can enter a column between sampled points. Test the whole
  // segment, including the swept movement steps and navigation shortcuts.
  return TEMPLE_OBSTACLES.every((obstacle) => {
    const t = lengthSquared
      ? Math.max(
          0,
          Math.min(1, ((obstacle.x - a.x) * dx + (obstacle.z - a.z) * dz) / lengthSquared),
        )
      : 0;
    return (
      Math.hypot(a.x + t * dx - obstacle.x, a.z + t * dz - obstacle.z) >= obstacle.radius + 0.4
    );
  });
}
export function getTemplePath(from: WorldPoint, to: WorldPoint): WorldPoint[] {
  if (!isTempleWalkable(from) || !isTempleWalkable(to)) return [];
  if (clearPath(from, to)) return [{ ...to }];
  const nearest = (p: WorldPoint) => {
    let best: WorldPoint | null = null,
      distance = Infinity;
    for (let x = Math.round(p.x) - 2; x <= Math.round(p.x) + 2; x++)
      for (let z = Math.round(p.z) - 2; z <= Math.round(p.z) + 2; z++) {
        const d = Math.hypot(p.x - x, p.z - z);
        if (d < distance && clearPath(p, { x, z })) {
          best = { x, z };
          distance = d;
        }
      }
    return best;
  };
  const start = nearest(from),
    end = nearest(to);
  if (!start || !end) return [];
  const key = (p: WorldPoint) => `${p.x},${p.z}`;
  const queue = [start],
    parents = new Map<string, WorldPoint | null>([[key(start), null]]);
  let found = false;
  for (let n = 0; n < queue.length && n < 1000; n++) {
    const p = queue[n];
    if (p.x === end.x && p.z === end.z) {
      found = true;
      break;
    }
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      const next = { x: p.x + dx, z: p.z + dz };
      if (!parents.has(key(next)) && clearPath(p, next)) {
        parents.set(key(next), p);
        queue.push(next);
      }
    }
  }
  if (!found) return [];
  const raw = [{ ...to }];
  for (let node: WorldPoint | null = end; node; node = parents.get(key(node)) ?? null)
    raw.unshift(node);
  raw.unshift(from);
  const path: WorldPoint[] = [];
  let anchor = 0;
  while (anchor < raw.length - 1) {
    let next = raw.length - 1;
    while (next > anchor + 1 && !clearPath(raw[anchor], raw[next])) next--;
    path.push(raw[next]);
    anchor = next;
  }
  return path;
}
