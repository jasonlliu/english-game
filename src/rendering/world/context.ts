import * as THREE from 'three';
import type { RegionId } from '../../game/adventure';
import {
  getRegionTrails,
  getWorldTrees,
  distanceToTrail as worldDistanceToTrail,
} from '../../game/world';
import { WORLD_THEMES } from './themes';
/** Resource owner and seeded builder utilities for one outdoor scene instance. */
export function createWorldRenderContext(region: RegionId) {
  const scene = new THREE.Group();
  scene.name = 'world-environment';
  const theme = WORLD_THEMES[region];
  const WORLD_TREES = getWorldTrees(region),
    TRAILS = getRegionTrails(region);
  const distanceToTrail = (x: number, z: number) => worldDistanceToTrail(x, z, region);
  const geometryResources: THREE.BufferGeometry[] = [];
  const materialResources: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  const keep = <T extends THREE.BufferGeometry>(geometry: T): T => {
    geometryResources.push(geometry);
    return geometry;
  };
  const mat = (color: string, options: THREE.MeshStandardMaterialParameters = {}) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.87, ...options });
    materialResources.push(material);
    return material;
  };
  const basic = (color: string, options: THREE.MeshBasicMaterialParameters = {}) => {
    const material = new THREE.MeshBasicMaterial({ color, ...options });
    materialResources.push(material);
    return material;
  };
  const matrixDummy = new THREE.Object3D();
  let seed = 853729;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const mesh = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    parent: THREE.Object3D,
    position: number[] = [0, 0, 0],
    scale: number[] = [1, 1, 1],
    shadows = true,
  ) => {
    const result = new THREE.Mesh(geometry, material);
    result.position.set(position[0], position[1], position[2]);
    result.scale.set(scale[0], scale[1], scale[2]);
    result.castShadow = shadows;
    result.receiveShadow = true;
    parent.add(result);
    return result;
  };
  const cube = keep(new THREE.BoxGeometry(1, 1, 1));
  const sphere = keep(new THREE.SphereGeometry(1, 12, 8));
  const pebbleGeometry = keep(new THREE.IcosahedronGeometry(1, 1));
  const cylinder = keep(new THREE.CylinderGeometry(1, 1, 1, 12));
  const stone = mat(theme.stone[0], { metalness: region === 'steel' ? 0.62 : 0.03 });
  const stoneLight = mat(theme.stone[1], { metalness: region === 'steel' ? 0.7 : 0.03 });
  const stoneDark = mat(theme.stone[2], { metalness: region === 'steel' ? 0.5 : 0.03 });
  const gold = mat('#dfb66a', { metalness: 0.45, roughness: 0.35 });
  const glowing = mat(theme.glow, {
    emissive: theme.glow,
    emissiveIntensity: 1.1,
    roughness: 0.22,
  });
  const moss = mat(theme.moss);
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    scene.traverse((object) => {
      if (object instanceof THREE.InstancedMesh) object.dispose();
      if (
        object instanceof THREE.DirectionalLight ||
        object instanceof THREE.PointLight ||
        object instanceof THREE.SpotLight
      )
        object.shadow.dispose();
    });
    new Set(geometryResources).forEach((geometry) => geometry.dispose());
    new Set(materialResources).forEach((material) => material.dispose());
    new Set(textures).forEach((texture) => texture.dispose());
    geometryResources.length = 0;
    materialResources.length = 0;
    textures.length = 0;
    scene.removeFromParent();
    scene.clear();
  };
  return {
    region,
    theme,
    scene,
    WORLD_TREES,
    TRAILS,
    distanceToTrail,
    geometryResources,
    materialResources,
    textures,
    keep,
    mat,
    basic,
    random,
    mesh,
    cube,
    sphere,
    pebbleGeometry,
    cylinder,
    stone,
    stoneLight,
    stoneDark,
    gold,
    glowing,
    moss,
    matrixDummy,
    dispose,
  };
}
export type WorldRenderContext = ReturnType<typeof createWorldRenderContext>;
