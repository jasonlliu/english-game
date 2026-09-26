import type { RegionId } from '../../game/adventure';
import { createModuleLoader } from '../../loading/createModuleLoader';
import type { SceneryModule } from './types';
// Keep imports literal so each region remains an independently emitted chunk.
// This registry caches JavaScript modules, never THREE objects or GPU resources.
const modules = createModuleLoader<RegionId, SceneryModule>({
  meadow: () => import('./regions/meadow'),
  water: () => import('./regions/water'),
  fire: () => import('./regions/fire'),
  earth: () => import('./regions/earth'),
  steel: () => import('./regions/steel'),
  fairy: () => import('./regions/fairy'),
});
export const loadRegionScenery = modules.load;
export const preloadRegionScenery = modules.preload;
export const peekRegionScenery = modules.peek;
