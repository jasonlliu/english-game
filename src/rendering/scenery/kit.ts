import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getTerrainHeight } from '../../game/world';
import { REGION_IDS } from '../../game/adventure';
import type { RegionScenery } from './types';
export type SceneryPalette = readonly [
  wall: string,
  stone: string,
  roof: string,
  wood: string,
  trim: string,
  leaves: string,
];
export function createSceneryKit(name: string, palette: SceneryPalette) {
  const terrainRegion = REGION_IDS.find((id) => id === name) ?? 'meadow';
  const group = new THREE.Group();
  group.name = `architecture-${name}`;
  const staticRoot = new THREE.Group();
  group.add(staticRoot);
  const geometries = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>();
  const textures: THREE.Texture[] = [];
  const updates: Array<(time: number, visited: boolean) => void> = [];
  const animations: Array<{
    object: THREE.Object3D;
    update: (time: number) => void;
  }> = [];
  const onUpdate = (update: (time: number, visited: boolean) => void) => {
    updates.push(update);
  };
  const animate = (object: THREE.Object3D, update: (time: number) => void) => {
    animations.push({ object, update });
  };
  const palettes = palette;
  const material = (color: string, options: THREE.MeshStandardMaterialParameters = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.83, ...options });
    materials.add(m);
    return m;
  };
  const stone = material(palettes[1]),
    plaster = material(palettes[0]),
    roofMat = material(palettes[2]),
    wood = material(palettes[3]),
    trim = material(palettes[4]);
  const dark = material('#34434a'),
    iron = material('#506b73', { metalness: 0.68, roughness: 0.42 }),
    gold = material('#c8a86b', { metalness: 0.4, roughness: 0.5 });
  const warm = material('#f5d18f', { emissive: '#efa854', emissiveIntensity: 0.65 }),
    glass = material('#6ec8d0', {
      emissive: '#3c9ba9',
      emissiveIntensity: 0.23,
      metalness: 0.3,
      roughness: 0.24,
    });
  const leaves = material(palette[5]),
    snow = material('#e6ece8'),
    ice = material('#9dcbd8', { metalness: 0.18, roughness: 0.28 });
  const terracotta = material('#ba8061'),
    white = material('#f3ebd9'),
    sandstone = material('#c99367'),
    rockDark = material('#665e64'),
    flowerPink = material('#dfabc7', { emissive: '#b971a2', emissiveIntensity: 0.14 });
  const ocean = material('#58b2be', {
    metalness: 0.28,
    roughness: 0.22,
    transparent: true,
    opacity: 0.86,
  });
  const add = (
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    mat: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
    sx = 1,
    sy = 1,
    sz = 1,
  ) => {
    geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1),
    sphereGeometry = new THREE.SphereGeometry(1, 16, 12);
  geometries.add(boxGeometry);
  geometries.add(sphereGeometry);
  const box = (
    p: THREE.Object3D,
    m: THREE.Material,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
  ) => add(p, boxGeometry, m, x, y, z, w, h, d);
  const ball = (
    p: THREE.Object3D,
    m: THREE.Material,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
  ) => add(p, sphereGeometry, m, x, y, z, w, h, d);
  const cylinder = (
    p: THREE.Object3D,
    m: THREE.Material,
    x: number,
    y: number,
    z: number,
    top: number,
    bottom: number,
    height: number,
    sides = 16,
  ) => add(p, new THREE.CylinderGeometry(top, bottom, height, sides), m, x, y, z);
  const cone = (
    p: THREE.Object3D,
    m: THREE.Material,
    x: number,
    y: number,
    z: number,
    radius: number,
    height: number,
    sides = 12,
  ) => add(p, new THREE.ConeGeometry(radius, height, sides), m, x, y, z);
  const torus = (
    p: THREE.Object3D,
    m: THREE.Material,
    x: number,
    y: number,
    z: number,
    r: number,
    tube: number,
    flat = false,
  ) => {
    const object = add(p, new THREE.TorusGeometry(r, tube, 6, 36), m, x, y, z);
    if (flat) object.rotation.x = Math.PI / 2;
    return object;
  };
  const origin = (x: number, z: number) => {
    const p = new THREE.Group();
    p.position.set(x, getTerrainHeight(x, z, terrainRegion), z);
    staticRoot.add(p);
    return p;
  };
  const roof = (
    p: THREE.Object3D,
    m: THREE.Material,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
  ) => {
    const g = new THREE.BufferGeometry();
    const v = [
      -w / 2,
      0,
      -d / 2,
      w / 2,
      0,
      -d / 2,
      0,
      h,
      -d / 2,
      -w / 2,
      0,
      d / 2,
      0,
      h,
      d / 2,
      w / 2,
      0,
      d / 2,
      -w / 2,
      0,
      -d / 2,
      0,
      h,
      -d / 2,
      0,
      h,
      d / 2,
      -w / 2,
      0,
      -d / 2,
      0,
      h,
      d / 2,
      -w / 2,
      0,
      d / 2,
      w / 2,
      0,
      -d / 2,
      w / 2,
      0,
      d / 2,
      0,
      h,
      d / 2,
      w / 2,
      0,
      -d / 2,
      0,
      h,
      d / 2,
      0,
      h,
      -d / 2,
    ];
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.computeVertexNormals();
    return add(p, g, m, x, y, z);
  };
  const arch = (
    p: THREE.Object3D,
    m: THREE.Material,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    depth = 0.8,
  ) => {
    const r = w / 2,
      spring = h - r,
      inner = r - 0.6,
      s = new THREE.Shape();
    s.moveTo(-r, 0);
    s.lineTo(-r, spring);
    s.absarc(0, spring, r, Math.PI, 0, true);
    s.lineTo(r, 0);
    s.lineTo(inner, 0);
    s.lineTo(inner, spring);
    s.absarc(0, spring, inner, 0, Math.PI, false);
    s.lineTo(-inner, 0);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 20 });
    g.translate(0, 0, -depth / 2);
    return add(p, g, m, x, y, z);
  };
  const window = (p: THREE.Object3D, x: number, y: number, z: number, w = 0.7, h = 1) => {
    box(p, dark, x, y, z, w + 0.22, h + 0.22, 0.1);
    box(p, warm, x, y, z + 0.065, w, h, 0.07);
    box(p, trim, x, y, z + 0.115, 0.075, h + 0.16, 0.09);
    box(p, trim, x, y, z + 0.115, w + 0.14, 0.07, 0.09);
    box(p, trim, x, y - h / 2 - 0.14, z + 0.12, w + 0.35, 0.16, 0.3);
  };
  const house = (
    x: number,
    z: number,
    w: number,
    d: number,
    height: number,
    roofColor = roofMat,
  ) => {
    const p = origin(x, z);
    box(p, stone, 0, -0.2, 0, w + 0.25, 0.7, d + 0.25);
    box(p, plaster, 0, height / 2, 0, w, height, d);
    for (const side of [-1, 1]) {
      box(p, wood, side * (w / 2 - 0.14), height / 2, d / 2 + 0.035, 0.2, height, 0.15);
      box(p, wood, side * (w / 2 - 0.14), height / 2, -d / 2 - 0.035, 0.2, height, 0.15);
    }
    box(p, wood, 0, height * 0.55, d / 2 + 0.04, w, 0.16, 0.17);
    roof(p, roofColor, 0, height - 0.03, 0, w + 0.75, height * 0.62, d + 0.8);
    box(p, wood, 0, 1.03, d / 2 + 0.065, 1.18, 2.06, 0.15);
    box(p, dark, 0, 1.01, d / 2 + 0.155, 0.89, 1.86, 0.06);
    ball(p, gold, 0.31, 1.0, d / 2 + 0.21, 0.06, 0.06, 0.05);
    window(p, -w * 0.29, height * 0.62, d / 2 + 0.1);
    window(p, w * 0.29, height * 0.62, d / 2 + 0.1);
    if (w > 5) window(p, 0, height + height * 0.22, d / 2 + 0.2, 0.66, 0.72);
    const chimney = box(
      p,
      stone,
      w * 0.28,
      height + height * 0.4,
      -d * 0.22,
      0.58,
      height * 0.7,
      0.65,
    );
    chimney.rotation.z = 0.02;
    box(p, trim, w * 0.28, height + height * 0.77, -d * 0.22, 0.78, 0.18, 0.83);
    return p;
  };
  const fence = (p: THREE.Object3D, x: number, z: number, length: number) => {
    for (let i = 0; i <= Math.floor(length / 1.5); i++)
      box(p, wood, x + i * 1.5, 0.63, z, 0.13, 1.26, 0.13);
    box(p, wood, x + length / 2, 0.5, z, length, 0.12, 0.13);
    box(p, wood, x + length / 2, 1.0, z, length, 0.12, 0.13);
  };
  const mountain = (
    p: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    r: number,
    h: number,
    mat: THREE.Material,
    whiteCap = false,
  ) => {
    const peak = cone(p, mat, x, y + h / 2, z, r, h, 7);
    peak.rotation.y = 0.33;
    if (whiteCap) {
      const cap = cone(p, snow, x, y + h * 0.855, z, r * 0.31, h * 0.31, 7);
      cap.rotation.y = 0.33;
    }
  };
  let flowTexture: THREE.CanvasTexture | undefined;
  let flowing: THREE.MeshBasicMaterial | undefined;
  const getFlowMaterial = () => {
    if (flowing) return flowing;
    const waterCanvas = document.createElement('canvas');
    waterCanvas.width = 64;
    waterCanvas.height = 128;
    const wc = waterCanvas.getContext('2d');
    if (!wc) throw new Error('Could not create waterfall texture');
    wc.fillStyle = '#84d5d8';
    wc.fillRect(0, 0, 64, 128);
    for (let i = 0; i < 30; i++) {
      wc.fillStyle = `rgba(235,255,246,${0.12 + (i % 5) * 0.1})`;
      wc.fillRect((i * 23) % 64, (i * 31) % 128, 1 + (i % 3), 10 + (i % 23));
    }
    flowTexture = new THREE.CanvasTexture(waterCanvas);
    flowTexture.wrapS = flowTexture.wrapT = THREE.RepeatWrapping;
    flowTexture.repeat.set(2, 4);
    flowTexture.colorSpace = THREE.SRGBColorSpace;
    textures.push(flowTexture);
    flowing = new THREE.MeshBasicMaterial({
      map: flowTexture,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    materials.add(flowing);
    return flowing;
  };
  const waterfall = (
    p: THREE.Object3D,
    x: number,
    z: number,
    width: number,
    height: number,
    y = 0,
  ) => {
    add(p, new THREE.PlaneGeometry(width, height, 1, 1), getFlowMaterial(), x, y + height / 2, z);
    for (let i = 0; i < 5; i++)
      ball(
        p,
        white,
        x + (i - 2) * width * 0.17,
        y + 0.35,
        z + 0.15,
        width * 0.25,
        0.23,
        width * 0.34,
      );
    const pool = add(p, new THREE.CircleGeometry(width * 0.92, 24), ocean, x, y + 0.08, z + 0.5);
    pool.rotation.x = -Math.PI / 2;
    pool.scale.y = 0.72;
  };
  let disposed = false,
    finalized = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    geometries.forEach((geometry) => geometry.dispose());
    geometries.clear();
    materials.forEach((mat) => mat.dispose());
    materials.clear();
    textures.forEach((texture) => texture.dispose());
    textures.length = 0;
    updates.length = 0;
    animations.length = 0;
    group.removeFromParent();
    group.clear();
  };
  const finish = (): RegionScenery => {
    if (finalized || disposed) throw new Error('A scenery kit can only be finalized once');
    staticRoot.updateMatrixWorld(true);
    // Preserve every animated object's original local coordinate frame. Its frozen
    // parent transform moves into a wrapper; animation callbacks never mix spaces.
    const inverseRoot = group.matrixWorld.clone().invert();
    for (const { object } of animations) {
      const parent = object.parent;
      if (!parent) continue;
      const frame = new THREE.Group();
      frame.matrixAutoUpdate = false;
      frame.matrix.multiplyMatrices(inverseRoot, parent.matrixWorld);
      group.add(frame);
      frame.add(object);
    }
    staticRoot.updateMatrixWorld(true);
    const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
    staticRoot.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
      const copy = object.geometry.clone();
      geometries.add(copy);
      copy.applyMatrix4(object.matrixWorld);
      copy.deleteAttribute('uv1');
      if (!copy.hasAttribute('uv'))
        copy.setAttribute(
          'uv',
          new THREE.BufferAttribute(new Float32Array(copy.getAttribute('position').count * 2), 2),
        );
      const expanded = copy.index ? copy.toNonIndexed() : copy;
      if (expanded !== copy) {
        geometries.add(expanded);
        copy.dispose();
        geometries.delete(copy);
      }
      const bucket = buckets.get(object.material) ?? [];
      bucket.push(expanded);
      buckets.set(object.material, bucket);
    });
    for (const [mat, parts] of buckets) {
      const geometry = mergeGeometries(parts, false);
      parts.forEach((part) => {
        part.dispose();
        geometries.delete(part);
      });
      if (!geometry) throw new Error('Unable to merge scenery geometry');
      geometries.add(geometry);
      const batch = new THREE.Mesh(geometry, mat);
      batch.castShadow = mat !== flowing;
      batch.receiveShadow = true;
      group.add(batch);
    }
    group.remove(staticRoot);
    staticRoot.clear();
    // Static source buffers have been replaced by merged buffers. Retain only
    // geometry actually used by the final scene, including dynamic shared meshes.
    const liveGeometry = new Set<THREE.BufferGeometry>();
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) liveGeometry.add(object.geometry);
    });
    for (const geometry of geometries)
      if (!liveGeometry.has(geometry)) {
        geometry.dispose();
        geometries.delete(geometry);
      }
    finalized = true;
    return {
      group,
      update(time, visited = false) {
        if (disposed) return;
        animations.forEach((animation) => animation.update(time));
        updates.forEach((update) => update(time, visited));
        if (flowTexture) flowTexture.offset.y = -time * 0.35;
      },
      dispose,
    };
  };
  return {
    group,
    staticRoot,
    material,
    add,
    box,
    ball,
    cylinder,
    cone,
    torus,
    origin,
    roof,
    arch,
    window,
    house,
    fence,
    mountain,
    waterfall,
    animate,
    onUpdate,
    finish,
    dispose,
    stone,
    plaster,
    roofMat,
    wood,
    trim,
    dark,
    iron,
    gold,
    warm,
    glass,
    leaves,
    snow,
    ice,
    terracotta,
    white,
    sandstone,
    rockDark,
    flowerPink,
    ocean,
  };
}
export type SceneryKit = ReturnType<typeof createSceneryKit>;
export function buildRegionScenery(
  name: string,
  palette: SceneryPalette,
  build: (kit: SceneryKit) => void,
): RegionScenery {
  const kit = createSceneryKit(name, palette);
  try {
    build(kit);
    return kit.finish();
  } catch (error) {
    kit.dispose();
    throw error;
  }
}
