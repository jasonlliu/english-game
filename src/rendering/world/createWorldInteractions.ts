import * as THREE from 'three';
import { getCrystalPositions, getTerrainHeight as terrainHeight } from '../../game/world';
import type { WorldRenderContext } from './context';
export function createWorldInteractions(
  context: WorldRenderContext,
  initialTreasureOpened: boolean,
) {
  const {
    region,
    theme,
    scene,
    keep,
    mat,
    basic,
    mesh,
    cube,
    pebbleGeometry,
    cylinder,
    stone,
    stoneLight,
    stoneDark,
    gold,
    glowing,
    moss,
  } = context;
  const getTerrainHeight = (x: number, z: number) => terrainHeight(x, z, region);
  const CRYSTAL_POSITIONS = getCrystalPositions(region);
  const inlandDecor = new THREE.Group();
  inlandDecor.name = 'inland-ruin-decor';
  if (region !== 'water') scene.add(inlandDecor);
  // Ancient stone architecture is on the far hill, visible from the first frame.
  const ruins = new THREE.Group();
  ruins.position.set(-8, getTerrainHeight(-8, -27), -27);
  inlandDecor.add(ruins);
  mesh(cylinder, stoneDark, ruins, [0, 0.13, 0], [5.3, 0.22, 4.5]);
  mesh(cylinder, stone, ruins, [0, 0.27, 0], [4.7, 0.16, 4]);
  for (const side of [-1, 1]) {
    mesh(cube, stone, ruins, [side * 3.7, 3.35, 0], [1.25, 6.5, 1.5]);
    mesh(cube, stoneLight, ruins, [side * 3.7, 6.8, 0], [1.85, 0.4, 2]);
    mesh(cube, moss, ruins, [side * 3.7, 7.05, 0], [1.83, 0.1, 1.95]);
    mesh(cube, glowing, ruins, [side * 3.7, 3.8, 0.762], [0.085, 3.5, 0.025]);
  }
  const portal = new THREE.Group();
  portal.position.set(0, 4.1, 0);
  ruins.add(portal);
  const stoneArch = keep(new THREE.TorusGeometry(3.15, 0.42, 5, 28, Math.PI));
  mesh(stoneArch, stoneLight, portal).rotation.z = 0;
  for (const side of [-1, 1])
    mesh(cube, stoneLight, ruins, [side * 3.15, 2.15, 0], [0.82, 4, 0.84]);
  const portalRing = mesh(
    keep(new THREE.TorusGeometry(2.67, 0.045, 5, 72)),
    glowing,
    portal,
    [0, 0, 0.15],
  );
  const veil = mesh(
    keep(new THREE.CircleGeometry(2.62, 64)),
    basic(theme.glow, {
      transparent: true,
      opacity: 0.13,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    portal,
    [0, 0, 0.11],
    [1, 1, 1],
    false,
  );
  const swirl = new THREE.Group();
  portal.add(swirl);
  for (let i = 0; i < 3; i++)
    mesh(
      keep(new THREE.TorusGeometry(0.8 + i * 0.65, 0.018, 3, 44, 3.8)),
      glowing,
      swirl,
      [0, 0, 0.16],
    ).rotation.z = i * 2;
  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * Math.PI * 2;
    const rune = mesh(
      cube,
      glowing,
      portal,
      [Math.cos(angle) * 2.83, Math.sin(angle) * 2.83, 0.3],
      [0.055, 0.18, 0.025],
    );
    rune.rotation.z = angle;
  }
  for (const [x, z, height] of [
    [-15.5, -24.2, 4],
    [-0.8, -24.8, 5.2],
  ]) {
    const y = getTerrainHeight(x, z);
    mesh(cube, stoneDark, inlandDecor, [x, y + 0.2, z], [2, 0.4, 1.9]);
    mesh(cube, stone, inlandDecor, [x, y + height / 2, z], [1.35, height, 1.5]);
    mesh(cube, stoneLight, inlandDecor, [x, y + height, z], [1.9, 0.4, 2]);
  }
  const portalLight = new THREE.PointLight(theme.glow, 10, 13);
  portalLight.position.set(-8, ruins.position.y + 3, -24);
  inlandDecor.add(portalLight);
  for (const [x, z, height] of [
    [-31.6, -5, 3.5],
    [-27.8, -9.6, 2.8],
  ]) {
    const rock = mesh(
      pebbleGeometry,
      stone,
      inlandDecor,
      [x, getTerrainHeight(x, z) + height * 0.45, z],
      [1.4, height, 1.15],
    );
    rock.rotation.z = 0.14;
    mesh(
      cube,
      glowing,
      inlandDecor,
      [x + 0.1, getTerrainHeight(x, z) + height, z + 0.96],
      [0.12, 1.05, 0.03],
    );
  }
  const crystalColors =
    region === 'meadow'
      ? ['#ffcc66', '#65f3d1', '#93bfff']
      : [theme.glow, theme.flowers[0], theme.water[1]];
  const crystals = CRYSTAL_POSITIONS.map((point, id) => {
    const group = new THREE.Group();
    group.position.set(point.x, getTerrainHeight(point.x, point.z) + 1.9, point.z);
    scene.add(group);
    const color = crystalColors[id];
    mesh(
      keep(new THREE.OctahedronGeometry(1, 0)),
      mat(color, { emissive: color, emissiveIntensity: 0.65, metalness: 0.23, roughness: 0.18 }),
      group,
      [0, 0, 0],
      [0.55, 1.04, 0.55],
    );
    mesh(keep(new THREE.TorusGeometry(0.98, 0.035, 4, 40)), basic(color), group).rotation.x =
      Math.PI / 2;
    const beam = mesh(
      keep(new THREE.CylinderGeometry(0.34, 0.6, 11, 12, 1, true)),
      basic(color, {
        transparent: true,
        opacity: 0.075,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
      group,
      [0, 4, 0],
      [1, 1, 1],
      false,
    );
    beam.renderOrder = 1;
    return group;
  });
  const chest = new THREE.Group();
  chest.position.set(-5.1, getTerrainHeight(-5.1, -20.2), -20.2);
  chest.rotation.y = 0.2;
  if (region !== 'water') scene.add(chest);
  const chestWood = mat('#986b45');
  mesh(cube, chestWood, chest, [0, 0.48, 0], [1.65, 0.9, 1.2]);
  for (const side of [-1, 1]) mesh(cube, gold, chest, [side * 0.59, 0.47, 0], [0.18, 0.96, 1.26]);
  mesh(cube, gold, chest, [0, 0.7, 0.64], [0.27, 0.3, 0.07]);
  const chestLid = new THREE.Group();
  chestLid.position.set(0, 0.93, -0.62);
  chest.add(chestLid);
  mesh(cube, chestWood, chestLid, [0, 0.16, 0.62], [1.73, 0.34, 1.27]);
  for (const side of [-1, 1])
    mesh(cube, gold, chestLid, [side * 0.59, 0.17, 0.62], [0.18, 0.38, 1.33]);
  const chestGlow = mesh(keep(new THREE.OctahedronGeometry(0.45, 0)), glowing, chest, [0, 1.25, 0]);
  let chestOpenness = initialTreasureOpened ? 1 : 0;
  const waypoint = mesh(
    keep(new THREE.TorusGeometry(0.55, 0.035, 4, 32)),
    basic('#fff5c9', { transparent: true, opacity: 0.9, depthWrite: false }),
    scene,
    [0, 0, 0],
    [1, 1, 1],
    false,
  );
  waypoint.rotation.x = -Math.PI / 2;
  waypoint.visible = false;
  return {
    crystals,
    waypoint,
    createWildMarkers(parent: THREE.Group) {
      const halo = mesh(
        keep(new THREE.TorusGeometry(1.1, 0.04, 5, 48)),
        basic(theme.glow, { transparent: true, opacity: 0.75, depthWrite: false }),
        parent,
        [0, 0.1, 0],
        [1, 1, 1],
        false,
      );
      halo.rotation.x = -Math.PI / 2;
      const mark = mesh(keep(new THREE.OctahedronGeometry(0.16, 0)), glowing, parent, [0, 2.6, 0]);
      return { halo, mark };
    },
    update(time: number, delta: number, collected: ReadonlySet<number>, treasureOpened: boolean) {
      crystals.forEach((crystal, id) => {
        crystal.visible = !collected.has(id);
        crystal.position.y =
          getTerrainHeight(CRYSTAL_POSITIONS[id].x, CRYSTAL_POSITIONS[id].z) +
          1.9 +
          Math.sin(time * 1.6 + id) * 0.22;
        crystal.rotation.y = time * 0.65;
      });
      portalRing.rotation.z = time * 0.055;
      swirl.rotation.z = -time * 0.13;
      veil.scale.setScalar(1 + Math.sin(time * 0.8) * 0.015);
      chestOpenness = THREE.MathUtils.lerp(
        chestOpenness,
        treasureOpened ? 1 : 0,
        1 - Math.exp(-delta * 8),
      );
      chestLid.rotation.x = -chestOpenness * 1.3;
      chestGlow.visible = chestOpenness > 0.2;
      chestGlow.rotation.y = time * 0.8;
      waypoint.scale.setScalar(1 + Math.sin(time * 3) * 0.1);
    },
  };
}
