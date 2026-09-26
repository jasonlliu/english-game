import {
  DISCOVERY_INTERACTION_DISTANCE,
  getAvailableDiscoverySites,
  type DiscoveryProgress,
  type DiscoverySite,
} from './discovery';
import type { WorldPoint } from './worldLayout';

export interface DiscoveryProximity {
  near: DiscoverySite | null;
  sense: DiscoverySite | null;
}

/** Interaction can revisit a clue; a companion only points out unfinished discoveries. */
export function getDiscoveryProximity(
  progress: DiscoveryProgress | undefined,
  today: string,
  position: WorldPoint,
  active: boolean,
): DiscoveryProximity {
  let near: DiscoverySite | null = null;
  let sense: DiscoverySite | null = null;
  if (!active || !progress || !Number.isFinite(position.x) || !Number.isFinite(position.z))
    return { near, sense };
  let nearDistance = DISCOVERY_INTERACTION_DISTANCE;
  let senseDistance = 19;
  for (const site of getAvailableDiscoverySites(progress, today)) {
    const distance = Math.hypot(position.x - site.position.x, position.z - site.position.z);
    if (distance <= nearDistance) {
      near = site;
      nearDistance = distance;
    }
    const unfinished =
      site.kind === 'daily'
        ? !progress.dailyFinds.includes(today)
        : site.kind === 'bell'
          ? progress.chimes.length < 3
          : site.kind === 'vault'
            ? progress.chimes.length === 3 && !progress.completed
            : !progress.found.some((id) => id === site.id);
    if (unfinished && distance < senseDistance) {
      sense = site;
      senseDistance = distance;
    }
  }
  return { near, sense };
}
