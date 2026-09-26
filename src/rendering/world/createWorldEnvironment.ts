import type { RegionId } from '../../game/adventure';
import type { WorldPoint } from '../../game/world';
import { createWorldRenderContext } from './context';
import { createAmbientLife } from './createAmbientLife';
import { createAtmosphere } from './createAtmosphere';
import { createTerrain } from './createTerrain';
import { createVegetation } from './createVegetation';
import { createWater } from './createWater';
import { createWorldInteractions } from './createWorldInteractions';
export interface WorldEnvironmentFrame {
  time: number;
  delta: number;
  position: WorldPoint;
  height: number;
  collected: ReadonlySet<number>;
  treasureOpened: boolean;
}
/** Presentation only. Player movement and interactions remain owned by WorldScene. */
export function createWorldEnvironment(region: RegionId, initialTreasureOpened = false) {
  const context = createWorldRenderContext(region);
  try {
    const { sunlight } = createAtmosphere(context);
    const terrain = createTerrain(context);
    const vegetation =
      region === 'water' ? { wind: { value: 0 }, regionCrowns: [] } : createVegetation(context);
    const water = createWater(context, vegetation.regionCrowns);
    const interactions = createWorldInteractions(context, initialTreasureOpened);
    const life = createAmbientLife(context);
    return {
      group: context.scene,
      terrain,
      sunlight,
      crystals: interactions.crystals,
      waypoint: interactions.waypoint,
      createWildMarkers: interactions.createWildMarkers,
      update({ time, delta, position, height, collected, treasureOpened }: WorldEnvironmentFrame) {
        vegetation.wind.value = time;
        water.update(time);
        interactions.update(time, delta, collected, treasureOpened);
        life.update(time, position, height);
      },
      dispose: context.dispose,
    };
  } catch (error) {
    context.dispose();
    throw error;
  }
}
export type WorldEnvironment = ReturnType<typeof createWorldEnvironment>;
