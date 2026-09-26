import type { ComponentProps } from 'react';
import type TempleScene from '../components/TempleScene';
import type { WorldSceneProps } from '../components/WorldScene';
import type { RegionId } from '../game/adventure';
import { REGION_IDS } from '../game/adventure';
import { loadRegionScenery } from '../rendering/scenery/registry';
import AsyncView from './AsyncView';
import { createModuleLoader } from './createModuleLoader';

const outdoor = createModuleLoader({ world: () => import('../components/WorldScene') });
const indoors = createModuleLoader({ temple: () => import('../components/TempleScene') });
const loadOutdoor = async (region: RegionId) => {
  const [world, scenery] = await Promise.all([outdoor.load('world'), loadRegionScenery(region)]);
  return { Scene: world.default, factory: scenery.createRegionScenery };
};
const outdoorRequests = Object.fromEntries(
  REGION_IDS.map((region) => [region, () => loadOutdoor(region)]),
) as Record<RegionId, () => ReturnType<typeof loadOutdoor>>;
const templeRequest = () => indoors.load('temple');

/** Only prefetch on a concrete user's intent, never all regions on startup. */
export function preloadRegionScene(region: RegionId) {
  void loadOutdoor(region).catch(() => undefined);
}
export function preloadTempleScene() {
  indoors.preload('temple');
}

export function OutdoorScene(props: Omit<WorldSceneProps, 'sceneryFactory'>) {
  return (
    <AsyncView load={outdoorRequests[props.region ?? 'meadow']}>
      {({ Scene, factory }) => <Scene {...props} sceneryFactory={factory} />}
    </AsyncView>
  );
}
export function IndoorScene(props: ComponentProps<typeof TempleScene>) {
  return (
    <AsyncView load={templeRequest} label="正在打开神庙的门…">
      {({ default: Scene }) => <Scene {...props} />}
    </AsyncView>
  );
}
