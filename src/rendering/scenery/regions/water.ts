import { buildRegionScenery } from '../kit';
import type { RegionScenery } from '../types';
import { buildWaterArchitecture } from '../water/architecture';
import { buildWaterEcology } from '../water/ecology';
import { paintArchitecture } from '../paintedSurfaces';

export function createRegionScenery(): RegionScenery {
  return buildRegionScenery(
    'water',
    ['#f3eee0', '#b8c4bb', '#57a9bc', '#967851', '#eee4c7', '#819b70'],
    (kit) => {
      paintArchitecture(kit);
      buildWaterArchitecture(kit);
      buildWaterEcology(kit);
    },
  );
}
