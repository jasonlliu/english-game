import type { SceneryKit } from '../kit';
import { createStratifiedCliff } from '../../world/rockGeometry';

export function buildMeadowCliffs(kit: SceneryKit) {
  const cliff = createStratifiedCliff();
  const stone = kit.material('#ffffff', { vertexColors: true, roughness: 1 });
  const falls = kit.origin(-46, -32);
  kit.add(falls, cliff, stone, -0.7, 9.2, -0.5, 6.3, 18.4, 4.5);
  kit.add(falls, cliff, stone, -2.1, 18.4, -1.2, 4.1, 5.8, 3.3);
  kit.add(falls, cliff, stone, 3.9, 6.5, 0.8, 1.85, 13, 3.0);
  kit.waterfall(falls, 1.3, 4.5, 2.4, 15.7, 4.5);
  kit.waterfall(falls, 2.2, 5.0, 2.8, 4.5, 0.18);
  // A shaded lip makes the upper fall read as a cut in the rock face.
  kit.box(falls, kit.rockDark, 1.2, 20.0, 3.7, 2.0, 0.22, 0.8);
}
