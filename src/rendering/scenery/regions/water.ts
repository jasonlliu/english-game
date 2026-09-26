import { buildRegionScenery } from '../kit';
import type { RegionScenery } from '../types';
import { buildWaterArchitecture } from '../water/architecture';
import { buildWaterEcology } from '../water/ecology';

export function createRegionScenery(): RegionScenery {
  return buildRegionScenery(
    'water',
    ['#f3eee0', '#b8c4bb', '#57a9bc', '#967851', '#eee4c7', '#819b70'],
    (kit) => {
      buildWaterArchitecture(kit);
      buildWaterEcology(kit);
    },
  );
}
