import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

type Zone = 'ruins' | 'grove' | 'shore';
type Stage = 0 | 1 | 2 | 3;

interface IslandSceneProps {
  stage: Stage;
  onExplore: (zone: Zone) => void;
  activeZone: Zone;
  collectedCrystals?: number[];
  onCollectCrystal?: (id: number) => void;
  onPetInteract?: () => void;
  petExcited?: number;
  treasureOpened?: boolean;
}

const EMPTY_CRYSTALS: number[] = [];

const COLORS = {
  rock: '#263c43', stone: '#69817a', grass: '#537757', moss: '#82a66d',
  aqua: '#71f9d0', orange: '#f5a250', deepOrange: '#cb6738', cream: '#ffe0a1',
};

// All geometry is original and generated locally; the scene has no asset requests.
export default function IslandScene({ stage, onExplore, activeZone, collectedCrystals = EMPTY_CRYSTALS, onCollectCrystal, onPetInteract, petExcited = 0, treasureOpened = false }: IslandSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef(stage);
  const zoneRef = useRef(activeZone);
  const exploreRef = useRef(onExplore);
  const changePetRef = useRef<((value: Stage) => void) | null>(null);
  const collectRef = useRef(onCollectCrystal);
  const collectedRef = useRef(new Set(collectedCrystals));
  const updateCrystalsRef = useRef<((ids: number[]) => void) | null>(null);
  const interactPetRef = useRef(onPetInteract);
  const excitePetRef = useRef<(() => void) | null>(null);
  const lastExcitementRef = useRef(petExcited);
  const treasureRef = useRef(treasureOpened);
  const updateTreasureRef = useRef<((opened: boolean) => void) | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => { exploreRef.current = onExplore; }, [onExplore]);
  useEffect(() => { zoneRef.current = activeZone; }, [activeZone]);
  useEffect(() => { stageRef.current = stage; changePetRef.current?.(stage); }, [stage]);
  useEffect(() => { collectRef.current = onCollectCrystal; }, [onCollectCrystal]);
  useEffect(() => { interactPetRef.current = onPetInteract; }, [onPetInteract]);
  useEffect(() => {
    collectedRef.current = new Set(collectedCrystals);
    updateCrystalsRef.current?.(collectedCrystals);
  }, [collectedCrystals]);
  useEffect(() => {
    if (petExcited !== lastExcitementRef.current) excitePetRef.current?.();
    lastExcitementRef.current = petExcited;
  }, [petExcited]);
  useEffect(() => {
    treasureRef.current = treasureOpened;
    updateTreasureRef.current?.(treasureOpened);
  }, [treasureOpened]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      setUnavailable(true);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    renderer.setClearColor('#122a2e', 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    const canvas = renderer.domElement;
    canvas.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;cursor:grab;';
    canvas.setAttribute('aria-label', '三维冒险小岛。拖动旋转，点击三颗悬浮晶石收集宝物，点击伙伴和它玩耍。也可使用场景外的探索按钮。');
    canvas.setAttribute('role', 'img');
    mount.appendChild(canvas);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2('#122a2e', 0.019);
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    let yaw = 0.24;
    let zoom = 1;
    const cameraTarget = new THREE.Vector3(0, 0.75, 0);
    const materials: THREE.Material[] = [];
    const geometries: THREE.BufferGeometry[] = [];
    let seed = 41;
    const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const material = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
      const result = new THREE.MeshStandardMaterial({ color, roughness: 0.86, metalness: 0.03, flatShading: true, ...extra });
      materials.push(result);
      return result;
    };
    const basic = (color: string, extra: Partial<THREE.MeshBasicMaterialParameters> = {}) => {
      const result = new THREE.MeshBasicMaterial({ color, ...extra });
      materials.push(result);
      return result;
    };
    const keep = <T extends THREE.BufferGeometry>(geometry: T): T => { geometries.push(geometry); return geometry; };
    const stone = material(COLORS.stone);
    const darkStone = material(COLORS.rock);
    const paleStone = material('#afbb97');
    const moss = material(COLORS.moss);
    const grass = material(COLORS.grass);
    const glow = material(COLORS.aqua, { emissive: COLORS.aqua, emissiveIntensity: 1.7, roughness: 0.25 });
    const orange = material(COLORS.orange);
    const rust = material(COLORS.deepOrange);
    const cream = material(COLORS.cream);
    const dark = material('#213943');
    const crystalMat = material('#42bca7', { metalness: 0.33, roughness: 0.18, emissive: '#197b70', emissiveIntensity: 0.32 });
    const bark = material('#6a6651');
    const leaf = material('#3e7b65');
    const leafLight = material('#6b9672');
    const gold = material('#efc274', { metalness: 0.3, roughness: 0.5 });

    const mesh = (geometry: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, position = [0, 0, 0], scale = [1, 1, 1]) => {
      const object = new THREE.Mesh(geometry, mat);
      object.position.set(position[0], position[1], position[2]);
      object.scale.set(scale[0], scale[1], scale[2]);
      object.castShadow = true;
      object.receiveShadow = true;
      parent.add(object);
      return object;
    };
    const sphere = keep(new THREE.IcosahedronGeometry(1, 1));
    const roughSphere = keep(new THREE.IcosahedronGeometry(1, 0));
    const cube = keep(new THREE.BoxGeometry(1, 1, 1));
    const cylinder = keep(new THREE.CylinderGeometry(1, 1, 1, 7));
    const cone = keep(new THREE.ConeGeometry(1, 1, 5));

    scene.add(new THREE.HemisphereLight('#beddd8', '#193b36', 2.2));
    const sun = new THREE.DirectionalLight('#fff0c8', 4.5);
    sun.position.set(-7, 12, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -9;
    sun.shadow.camera.right = 9;
    sun.shadow.camera.top = 9;
    sun.shadow.camera.bottom = -9;
    sun.shadow.normalBias = 0.045;
    sun.shadow.bias = -0.0003;
    scene.add(sun);
    const rim = new THREE.DirectionalLight('#78e7df', 2.2);
    rim.position.set(6, 5, -8);
    scene.add(rim);

    const world = new THREE.Group();
    world.rotation.y = -0.06;
    scene.add(world);

    // A stratified, asymmetrical chunk of earth, with faceted rock tapering below.
    const island = (parent: THREE.Object3D, x: number, y: number, z: number, sx: number, sz: number, depth: number) => {
      const count = 15;
      const outline = Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2;
        const variation = 0.91 + random() * 0.14;
        return [Math.cos(angle) * sx * variation, Math.sin(angle) * sz * variation];
      });
      const vertices: number[] = [];
      const colors: number[] = [];
      const tri = (a: number[], b: number[], c: number[], color: string, shade = 1) => {
        vertices.push(...a, ...b, ...c);
        const col = new THREE.Color(color).multiplyScalar(shade);
        for (let j = 0; j < 3; j++) colors.push(col.r, col.g, col.b);
      };
      for (let i = 0; i < count; i++) {
        const next = (i + 1) % count;
        const a = outline[i];
        const b = outline[next];
        const midA = [a[0] * 0.97, -depth * 0.3 - random() * 0.12, a[1] * 0.97];
        const midB = [b[0] * 0.97, -depth * 0.3 - random() * 0.12, b[1] * 0.97];
        const lowerA = [a[0] * 0.64, -depth * 0.73 - random() * 0.17, a[1] * 0.64];
        const lowerB = [b[0] * 0.64, -depth * 0.73 - random() * 0.17, b[1] * 0.64];
        tri([0, 0.06, 0], [b[0], 0, b[1]], [a[0], 0, a[1]], '#57765a', 0.91 + random() * 0.16);
        tri([a[0], 0, a[1]], [b[0], 0, b[1]], midA, '#536858', 0.8 + random() * 0.3);
        tri([b[0], 0, b[1]], midB, midA, '#516859', 0.8 + random() * 0.2);
        tri(midA, midB, lowerA, '#2f4b50', 0.85 + random() * 0.4);
        tri(midB, lowerB, lowerA, '#364d50', 0.8 + random() * 0.35);
        tri(lowerA, lowerB, [0.4, -depth, -0.3], '#253a43', 0.9 + random() * 0.35);
      }
      const geometry = keep(new THREE.BufferGeometry());
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geometry.computeVertexNormals();
      const object = mesh(geometry, material('#ffffff', { vertexColors: true }), parent, [x, y, z]);
      return object;
    };
    island(world, 0, 0, 0, 5.45, 4, 3.5);
    island(world, 6.05, -0.62, -2.5, 0.85, 0.72, 1.8);
    island(world, -5.6, -1.2, 2.8, 0.65, 0.59, 1.45);
    island(world, 3.1, -2.1, 5.05, 0.48, 0.42, 0.95);

    // Hanging roots and crystals tie the silhouette together below the grass rim.
    for (let i = 0; i < 17; i++) {
      const a = random() * Math.PI * 2;
      const x = Math.cos(a) * (4.3 + random() * 0.5);
      const z = Math.sin(a) * (3.1 + random() * 0.3);
      const root = mesh(cone, i % 4 === 0 ? crystalMat : darkStone, world, [x, -0.95 - random() * 0.5, z], [0.18 + random() * 0.2, 1 + random(), 0.25]);
      root.rotation.z = Math.PI + (random() - 0.5) * 0.3;
    }

    // Low raised terraces form a grounded top surface instead of disconnected props.
    mesh(cylinder, grass, world, [-2.95, 0.07, -0.45], [1.85, 0.26, 1.55]);
    mesh(cylinder, grass, world, [0, 0.09, -2.05], [2.2, 0.3, 1.62]);
    mesh(cylinder, moss, world, [-3.03, 0.215, -0.48], [1.73, 0.025, 1.46]);

    // Weathered cobbled paths lead to each selectable place.
    const pathStone = material('#8b9880');
    const path = (points: number[][]) => {
      for (const point of points) {
        const p = mesh(cylinder, pathStone, world, [point[0], 0.105, point[1]], [0.42 + random() * 0.1, 0.1, 0.28 + random() * 0.12]);
        p.rotation.y = random();
      }
    };
    path([[0.0, 3.2], [-0.15, 2.6], [-0.4, 2.0], [-0.75, 1.4], [-0.88, 0.78], [-0.75, 0.15], [-0.55, -0.55], [-0.32, -1.1]]);
    path([[-1.3, 0.7], [-1.95, 0.6], [-2.55, 0.4], [-3.05, 0.05]]);
    path([[0, 0.85], [0.72, 0.73], [1.45, 0.6], [2.1, 0.63], [2.7, 0.94], [3.18, 1.22]]);

    // Luminous ancient gate: a broken stone ring, inlaid runes, and translucent veil.
    const ruins = new THREE.Group();
    ruins.position.set(0, 0.21, -2.15);
    ruins.userData.zone = 'ruins';
    world.add(ruins);
    mesh(cylinder, darkStone, ruins, [0, 0.03, 0.08], [1.85, 0.22, 1.05]);
    mesh(cylinder, stone, ruins, [0, 0.19, 0.08], [1.55, 0.17, 0.85]);
    mesh(cylinder, paleStone, ruins, [0, 0.3, 0.08], [1.25, 0.12, 0.68]);
    const portal = new THREE.Group();
    portal.position.set(0, 2.02, 0);
    portal.scale.set(1, 1.12, 1);
    ruins.add(portal);
    for (let i = 0; i < 13; i++) {
      const a = (i / 13) * Math.PI * 2;
      const segment = mesh(cube, i % 3 === 0 ? paleStone : stone, portal, [Math.sin(a) * 1.45, Math.cos(a) * 1.45, 0], [0.57, 0.51, 0.5]);
      segment.rotation.z = -a;
      const rune = mesh(cube, glow, portal, [Math.sin(a) * 1.44, Math.cos(a) * 1.44, 0.27], [0.07, 0.21, 0.021]);
      rune.rotation.z = -a + (i % 2 ? 0.45 : 0);
    }
    const innerRing = mesh(keep(new THREE.TorusGeometry(1.13, 0.038, 6, 64)), glow, portal, [0, 0, 0.04]);
    const outerRing = mesh(keep(new THREE.TorusGeometry(1.21, 0.019, 5, 64)), glow, portal, [0, 0, 0.1]);
    const veilMaterial = basic('#55efd1', { transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    mesh(keep(new THREE.CircleGeometry(1.12, 48)), veilMaterial, portal, [0, 0, 0.02]);
    const portalSwirl = new THREE.Group();
    portal.add(portalSwirl);
    for (let i = 0; i < 3; i++) {
      const arc = mesh(keep(new THREE.TorusGeometry(0.4 + i * 0.24, 0.013, 3, 36, Math.PI * 1.1)), glow, portalSwirl, [0, 0, 0.08]);
      arc.rotation.z = i * 2.1;
    }
    const portalLight = new THREE.PointLight('#68ffd8', 12, 8, 2);
    portalLight.position.set(0, 1.3, 0.6);
    ruins.add(portalLight);

    const column = (x: number, z: number, height: number, tilt: number) => {
      const group = new THREE.Group();
      group.position.set(x, 0.05, z);
      group.rotation.z = tilt;
      world.add(group);
      mesh(cube, darkStone, group, [0, 0.16, 0], [0.94, 0.3, 0.92]);
      mesh(cube, stone, group, [0, height / 2 + 0.18, 0], [0.53, height, 0.59]);
      mesh(cube, paleStone, group, [0, height + 0.23, 0], [0.84, 0.23, 0.8]);
      mesh(cube, moss, group, [0.01, height + 0.36, 0], [0.89, 0.05, 0.79]);
      mesh(cube, glow, group, [0, height * 0.6, 0.302], [0.075, height * 0.32, 0.018]);
      return group;
    };
    column(-2.42, -2.63, 2.2, -0.09);
    column(2.33, -2.3, 2.68, 0.035);
    column(3.23, -2.66, 0.95, -0.1);
    mesh(cube, stone, world, [-2.17, 0.24, -1.1], [0.75, 0.42, 0.48]).rotation.y = 0.45;

    const tree = (x: number, z: number, size: number) => {
      const group = new THREE.Group();
      group.position.set(x, 0.18, z);
      group.scale.setScalar(size);
      group.rotation.y = random();
      world.add(group);
      mesh(cylinder, bark, group, [0, 0.66, 0], [0.13, 1.35, 0.13]);
      const branch = mesh(cylinder, bark, group, [0.2, 1, 0], [0.06, 0.67, 0.06]);
      branch.rotation.z = -0.6;
      mesh(roughSphere, leaf, group, [0, 1.45, 0], [0.87, 0.6, 0.8]);
      mesh(roughSphere, leafLight, group, [-0.2, 1.92, 0.04], [0.67, 0.58, 0.64]);
      mesh(roughSphere, leafLight, group, [0.47, 1.38, 0.03], [0.49, 0.43, 0.51]);
      mesh(roughSphere, leaf, group, [0.18, 2.28, -0.03], [0.42, 0.42, 0.41]);
      return group;
    };
    tree(-3.9, -1.6, 1.04);
    tree(-4.25, 0.2, 0.74);
    tree(-2.85, -2.72, 0.64);
    tree(4.17, -0.77, 0.78);

    const crystal = (parent: THREE.Object3D, x: number, y: number, z: number, size: number, tilt: number) => {
      const object = mesh(keep(new THREE.OctahedronGeometry(1, 0)), crystalMat, parent, [x, y, z], [size * 0.35, size, size * 0.35]);
      object.rotation.z = tilt;
      return object;
    };
    const grove = new THREE.Group();
    grove.position.set(-3.16, 0.2, 0.61);
    grove.userData.zone = 'grove';
    world.add(grove);
    mesh(cylinder, darkStone, grove, [0, 0.07, 0], [0.83, 0.23, 0.69]);
    crystal(grove, 0, 0.83, 0, 0.78, -0.1);
    crystal(grove, -0.45, 0.48, 0.17, 0.47, 0.35);
    crystal(grove, 0.42, 0.42, 0.24, 0.38, -0.4);
    const groveLight = new THREE.PointLight('#49ffca', 4, 4, 2);
    groveLight.position.set(0, 1.2, 0.2);
    grove.add(groveLight);

    // A miniature spring spills down the island's edge in luminous ribbons.
    const shore = new THREE.Group();
    shore.position.set(3.65, 0.1, 1.39);
    shore.userData.zone = 'shore';
    world.add(shore);
    mesh(cylinder, paleStone, shore, [0, 0.025, 0], [1.02, 0.08, 0.93]);
    const waterMat = material('#4ed4c5', { emissive: '#178c88', emissiveIntensity: 0.45, metalness: 0.35, roughness: 0.2, transparent: true, opacity: 0.88 });
    mesh(cylinder, waterMat, shore, [0, 0.085, 0], [0.87, 0.07, 0.76]);
    for (let i = 0; i < 9; i++) {
      const angle = i / 9 * Math.PI * 2;
      mesh(roughSphere, stone, shore, [Math.cos(angle) * 0.91, 0.12, Math.sin(angle) * 0.81], [0.27, 0.19, 0.23]);
    }
    mesh(cube, waterMat, world, [4.52, 0.13, 1.36], [1.03, 0.045, 0.45]);
    const waterfall = mesh(cube, waterMat, world, [4.99, -1.07, 1.36], [0.11, 2.1, 0.52]);
    waterfall.rotation.z = -0.06;
    const waterfallLine = mesh(cube, glow, world, [5.05, -1.01, 1.18], [0.015, 1.9, 0.04]);
    waterfallLine.rotation.z = -0.06;
    for (let i = 0; i < 3; i++) mesh(cube, stone, world, [2.87 + i * 0.43, 0.18, 1.52], [0.29, 0.12, 0.54]);
    const totem = mesh(cube, stone, shore, [0.27, 0.56, -0.64], [0.32, 0.96, 0.3]);
    totem.rotation.z = -0.08;
    mesh(keep(new THREE.OctahedronGeometry(0.18, 0)), glow, shore, [0.24, 1.21, -0.65]);

    // The three treasures are deliberately brighter and larger than scenery gems.
    const collectibleLocations = [
      { x: -1.66, y: 1.58, z: -0.86, color: '#ffcd66' },
      { x: -3.55, y: 1.22, z: 1.89, color: '#68f3ee' },
      { x: 3.8, y: 1.33, z: 1.99, color: '#d8a4ff' },
    ];
    const collectibles = collectibleLocations.map((location, id) => {
      const group = new THREE.Group();
      group.position.set(location.x, location.y, location.z);
      group.userData.crystalId = id;
      group.visible = !collectedRef.current.has(id);
      world.add(group);
      const gemMat = material(location.color, { emissive: location.color, emissiveIntensity: 0.6, metalness: 0.2, roughness: 0.2 });
      mesh(keep(new THREE.OctahedronGeometry(1, 0)), gemMat, group, [0, 0, 0], [0.31, 0.53, 0.31]);
      const halo = mesh(keep(new THREE.TorusGeometry(0.51, 0.018, 5, 32)), basic(location.color, { transparent: true, opacity: 0.8 }), group);
      halo.rotation.x = Math.PI / 2;
      const star = mesh(roughSphere, basic('#fff8d9'), group, [0.4, 0.32, 0], [0.055, 0.055, 0.055]);
      star.castShadow = false;
      const target = mesh(keep(new THREE.SphereGeometry(0.69, 8, 8)), basic('#ffffff', { visible: false }), group);
      target.userData.crystalId = id;
      return group;
    });
    updateCrystalsRef.current = (ids) => {
      const collected = new Set(ids);
      collectibles.forEach((group, id) => { group.visible = !collected.has(id); });
    };

    // The hinged lid and the contents exist once; opening never replaces resources.
    const chest = new THREE.Group();
    chest.position.set(2.12, 0.15, 2.68);
    chest.rotation.y = -0.18;
    world.add(chest);
    const chestWood = material('#715241');
    const chestGold = material('#f9c95b', { metalness: 0.55, roughness: 0.29 });
    mesh(cylinder, darkStone, chest, [0, -0.025, 0], [0.79, 0.1, 0.59]);
    mesh(cube, chestWood, chest, [0, 0.28, 0], [1.02, 0.54, 0.72]);
    mesh(cube, dark, chest, [0, 0.558, 0], [0.85, 0.026, 0.56]);
    for (const side of [-1, 1]) {
      mesh(cube, chestGold, chest, [side * 0.38, 0.27, 0.375], [0.11, 0.55, 0.045]);
      mesh(cube, chestGold, chest, [side * 0.38, 0.27, -0.375], [0.11, 0.55, 0.045]);
    }
    mesh(cube, chestGold, chest, [0, 0.07, 0], [1.07, 0.1, 0.79]);
    mesh(cube, chestGold, chest, [0, 0.48, 0.39], [0.18, 0.2, 0.05]);
    mesh(keep(new THREE.OctahedronGeometry(0.07, 0)), glow, chest, [0, 0.49, 0.43]);
    const chestLid = new THREE.Group();
    chestLid.position.set(0, 0.58, -0.37);
    chest.add(chestLid);
    mesh(cube, chestWood, chestLid, [0, 0.11, 0.37], [1.06, 0.25, 0.78]);
    for (const side of [-1, 1]) mesh(cube, chestGold, chestLid, [side * 0.38, 0.13, 0.37], [0.12, 0.3, 0.82]);
    mesh(cube, chestGold, chestLid, [0, -0.015, 0.78], [1.08, 0.065, 0.05]);
    const chestContents = new THREE.Group();
    chest.add(chestContents);
    for (let i = 0; i < 8; i++) {
      const coin = mesh(cylinder, chestGold, chestContents, [(i % 3 - 1) * 0.22, 0.59 + Math.floor(i / 3) * 0.055, (i % 2 - 0.5) * 0.25], [0.14, 0.045, 0.14]);
      coin.rotation.z = (i % 2 - 0.5) * 0.24;
    }
    mesh(keep(new THREE.OctahedronGeometry(1, 0)), glow, chestContents, [0, 0.84, 0], [0.16, 0.29, 0.16]);
    const treasureBeamMaterial = basic('#ffdf85', { transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const treasureBeam = mesh(keep(new THREE.CylinderGeometry(0.49, 0.22, 1.7, 12, 1, true)), treasureBeamMaterial, chestContents, [0, 1.44, 0]);
    treasureBeam.castShadow = false;
    let chestOpenAmount = treasureRef.current ? 1 : 0;
    chestLid.rotation.x = -chestOpenAmount * 1.28;
    chestContents.visible = treasureRef.current;

    // Small intentional ground detail: rock clusters, tufts, and golden wildflowers.
    for (let i = 0; i < 51; i++) {
      const a = random() * Math.PI * 2;
      const radius = 0.78 + random() * 0.17;
      const x = Math.cos(a) * 5.2 * radius;
      const z = Math.sin(a) * 3.75 * radius;
      if (x > 2.4 && z > 0.4 && z < 2.2) continue;
      if (i % 3 === 0) {
        const boulder = mesh(roughSphere, i % 2 ? stone : darkStone, world, [x, 0.13, z], [0.18 + random() * 0.24, 0.18 + random() * 0.25, 0.2 + random() * 0.22]);
        boulder.rotation.set(random(), random(), random());
      } else {
        for (let j = 0; j < 3; j++) {
          const tuft = mesh(cone, i % 7 === 0 ? gold : moss, world, [x + j * 0.075, 0.15, z], [0.045, 0.2 + random() * 0.2, 0.055]);
          tuft.rotation.z = (j - 1) * 0.28;
        }
      }
    }

    const markerRings: { zone: Zone; ring: THREE.Mesh; material: THREE.MeshBasicMaterial }[] = [];
    const makeMarker = (parent: THREE.Group, zone: Zone, radius: number, y: number) => {
      const mat = basic('#9bfddd', { transparent: true, opacity: 0.8, depthWrite: false });
      const ring = mesh(keep(new THREE.TorusGeometry(radius, 0.025, 4, 48)), mat, parent, [0, y, 0]);
      ring.rotation.x = -Math.PI / 2;
      ring.castShadow = false;
      markerRings.push({ zone, ring, material: mat });
      const target = mesh(keep(new THREE.SphereGeometry(1, 8, 8)), basic('#ffffff', { visible: false }), parent, [0, 0.75, 0], [radius + 0.15, 1.2, radius + 0.15]);
      target.userData.zone = zone;
    };
    makeMarker(ruins, 'ruins', 1.78, 0.17);
    makeMarker(grove, 'grove', 0.98, 0.12);
    makeMarker(shore, 'shore', 1.1, 0.07);

    const petPad = new THREE.Group();
    petPad.position.set(0.72, 0.14, 1.7);
    world.add(petPad);
    mesh(cylinder, darkStone, petPad, [0, -0.015, 0], [1.06, 0.13, 0.79]);
    mesh(cylinder, stone, petPad, [0, 0.06, 0], [0.92, 0.08, 0.66]);
    const petRing = mesh(keep(new THREE.TorusGeometry(0.72, 0.02, 4, 48)), glow, petPad, [0, 0.112, 0]);
    petRing.rotation.x = -Math.PI / 2;
    petRing.scale.y = 0.77;
    const petAnchor = new THREE.Group();
    petAnchor.position.set(0.72, 0.32, 1.7);
    petAnchor.rotation.y = -0.18;
    world.add(petAnchor);
    let pet: THREE.Group | null = null;
    let tail: THREE.Group | null = null;
    let wings: THREE.Group[] = [];
    let eyeGroup: THREE.Group | null = null;
    const petGeometries: THREE.BufferGeometry[] = [];
    const petGeometry = <T extends THREE.BufferGeometry>(geometry: T): T => { petGeometries.push(geometry); return geometry; };

    const makePet = (value: Stage) => {
      if (pet) petAnchor.remove(pet);
      petGeometries.splice(0).forEach((geometry) => geometry.dispose());
      pet = new THREE.Group();
      petAnchor.add(pet);
      tail = null;
      wings = [];
      eyeGroup = null;
      if (value === 0) {
        const egg = mesh(sphere, cream, pet, [0, 0.68, 0], [0.48, 0.64, 0.48]);
        egg.rotation.z = 0.08;
        for (let i = 0; i < 5; i++) {
          const angle = i / 5 * Math.PI * 2;
          const shard = mesh(petGeometry(new THREE.OctahedronGeometry(1, 0)), crystalMat, pet, [Math.sin(angle) * 0.37, 0.66, Math.cos(angle) * 0.37], [0.12, 0.28, 0.095]);
          shard.rotation.y = angle;
        }
        mesh(petGeometry(new THREE.OctahedronGeometry(0.12, 0)), glow, pet, [0, 1.46, 0]);
        return;
      }
      pet.scale.setScalar(value === 1 ? 0.83 : value === 2 ? 1.04 : 1.12);
      const body = mesh(sphere, orange, pet, [0, 0.61, -0.09], [0.43, 0.45, 0.65]);
      body.rotation.x = -0.1;
      mesh(sphere, cream, pet, [0, 0.69, 0.41], [0.3, 0.39, 0.21]);
      for (const x of [-0.3, 0.3]) {
        for (const z of [-0.43, 0.36]) {
          const leg = mesh(sphere, z < 0 ? rust : orange, pet, [x, 0.28, z], [0.16, 0.28, 0.19]);
          leg.rotation.z = x * -0.3;
          mesh(sphere, dark, pet, [x, 0.105, z + 0.08], [0.18, 0.12, 0.23]);
          mesh(cube, cream, pet, [x, 0.106, z + 0.282], [0.1, 0.065, 0.035]);
        }
      }
      const head = new THREE.Group();
      head.position.set(0, 1.09, 0.46);
      pet.add(head);
      mesh(sphere, orange, head, [0, 0, 0], [0.52, 0.45, 0.43]);
      mesh(sphere, cream, head, [0, -0.17, 0.32], [0.33, 0.2, 0.26]);
      mesh(roughSphere, dark, head, [0, -0.13, 0.54], [0.11, 0.075, 0.075]);
      for (const side of [-1, 1]) {
        const ear = mesh(cone, rust, head, [side * 0.35, 0.48, -0.035], [0.21, 0.6, 0.2]);
        ear.rotation.z = side * -0.24;
        const insideEar = mesh(cone, cream, head, [side * 0.36, 0.48, 0.097], [0.1, 0.37, 0.042]);
        insideEar.rotation.z = side * -0.24;
        const cheek = mesh(cone, orange, head, [side * 0.47, -0.11, 0], [0.18, 0.38, 0.16]);
        cheek.rotation.z = side * -1.1;
      }
      eyeGroup = new THREE.Group();
      eyeGroup.position.y = 0.055;
      head.add(eyeGroup);
      for (const side of [-1, 1]) {
        const eye = mesh(sphere, dark, eyeGroup, [side * 0.25, 0, 0.35], [0.116, 0.13, 0.075]);
        eye.rotation.y = side * 0.28;
        mesh(sphere, glow, eyeGroup, [side * 0.249, 0.015, 0.413], [0.062, 0.08, 0.023]);
        mesh(sphere, cream, eyeGroup, [side * 0.232, 0.055, 0.43], [0.023, 0.029, 0.012]);
        const eyebrow = mesh(cube, rust, head, [side * 0.25, 0.23, 0.347], [0.22, 0.045, 0.065]);
        eyebrow.rotation.z = side * 0.17;
      }
      mesh(petGeometry(new THREE.OctahedronGeometry(1, 0)), crystalMat, head, [0, 0.22, 0.359], [0.105, 0.24, 0.06]);
      tail = new THREE.Group();
      tail.position.set(0, 0.59, -0.57);
      pet.add(tail);
      const tailBase = mesh(sphere, rust, tail, [0.12, 0.2, -0.39], [0.24, 0.25, 0.47]);
      tailBase.rotation.x = 0.45;
      const tailTip = mesh(cone, cream, tail, [0.13, 0.53, -0.67], [0.27, 0.61, 0.25]);
      tailTip.rotation.x = -0.5;
      if (value >= 2) {
        for (const side of [-1, 1]) {
          const horn = mesh(petGeometry(new THREE.OctahedronGeometry(1, 0)), crystalMat, head, [side * 0.37, 0.7, -0.06], [0.14, 0.5, 0.16]);
          horn.rotation.z = side * -0.38;
          const shoulder = mesh(roughSphere, crystalMat, pet, [side * 0.4, 0.79, 0.2], [0.22, 0.31, 0.36]);
          shoulder.rotation.z = side * 0.2;
          mesh(petGeometry(new THREE.OctahedronGeometry(1, 0)), glow, pet, [side * 0.48, 0.86, 0.23], [0.055, 0.15, 0.085]);
        }
        for (let i = 0; i < 4; i++) {
          const spine = mesh(cone, crystalMat, pet, [0, 1.01 - i * 0.05, 0.04 - i * 0.2], [0.12, 0.31, 0.19]);
          spine.rotation.x = -0.22;
        }
        const chest = mesh(petGeometry(new THREE.OctahedronGeometry(1, 0)), gold, pet, [0, 0.79, 0.56], [0.19, 0.25, 0.07]);
        chest.rotation.z = 0;
      }
      if (value >= 3) {
        for (const side of [-1, 1]) {
          const wing = new THREE.Group();
          wing.position.set(side * 0.34, 0.98, -0.17);
          wing.rotation.z = side * -0.16;
          pet.add(wing);
          const points = [0, 0, 0, side * 0.52, 0.78, -0.08, side * 1.43, 1.01, -0.22, side * 1.13, 0.27, 0.08, side * 0.79, 0.09, 0.21, side * 0.41, -0.14, 0.27];
          const wingGeometry = petGeometry(new THREE.BufferGeometry());
          wingGeometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
          wingGeometry.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5]);
          wingGeometry.computeVertexNormals();
          const wingMesh = mesh(wingGeometry, crystalMat, wing);
          // Geometry is mirrored for the left wing, so show both faces explicitly.
          wingMesh.material = crystalMat;
          crystalMat.side = THREE.DoubleSide;
          const edge = new THREE.Vector3(side * 1.4, 1.0, -0.2);
          const ridge = mesh(petGeometry(new THREE.CylinderGeometry(0.035, 0.08, edge.length(), 5)), gold, wing, [edge.x / 2, edge.y / 2, edge.z / 2]);
          ridge.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), edge.clone().normalize());
          for (let i = 1; i <= 3; i++) {
            const end = new THREE.Vector3(side * (1.5 - i * 0.31), 0.68 - i * 0.25, 0.05 + i * 0.07);
            const vein = mesh(petGeometry(new THREE.CylinderGeometry(0.018, 0.035, end.length(), 4)), glow, wing, [end.x / 2, end.y / 2, end.z / 2]);
            vein.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.normalize());
          }
          wings.push(wing);
        }
      }
    };
    changePetRef.current = makePet;
    makePet(stageRef.current);

    const particleCount = 58;
    const particleCoordinates = new Float32Array(particleCount * 3);
    const particleOriginals: number[] = [];
    for (let i = 0; i < particleCount; i++) {
      particleCoordinates[i * 3] = (random() - 0.5) * 13;
      particleCoordinates[i * 3 + 1] = random() * 5 - 0.6;
      particleCoordinates[i * 3 + 2] = (random() - 0.5) * 9;
      particleOriginals.push(...particleCoordinates.slice(i * 3, i * 3 + 3));
    }
    const particleGeometry = keep(new THREE.BufferGeometry());
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particleCoordinates, 3));
    const particleMaterial = new THREE.PointsMaterial({ color: '#c1ffe0', size: 0.038, transparent: true, opacity: 0.73, sizeAttenuation: true, depthWrite: false });
    materials.push(particleMaterial);
    world.add(new THREE.Points(particleGeometry, particleMaterial));

    const burstCount = 38;
    const burstCoordinates = new Float32Array(burstCount * 3);
    const burstVelocities = new Float32Array(burstCount * 3);
    const burstGeometry = keep(new THREE.BufferGeometry());
    burstGeometry.setAttribute('position', new THREE.BufferAttribute(burstCoordinates, 3));
    const burstMaterial = new THREE.PointsMaterial({ color: '#ffdf91', size: 0.105, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
    materials.push(burstMaterial);
    const burst = new THREE.Points(burstGeometry, burstMaterial);
    burst.visible = false;
    burst.frustumCulled = false;
    world.add(burst);
    let burstStarted = -Infinity;
    const emitBurst = (position: THREE.Vector3, color: string) => {
      burst.position.copy(position);
      burstMaterial.color.set(color);
      burstStarted = performance.now();
      burst.visible = true;
      for (let i = 0; i < burstCount; i++) {
        const angle = random() * Math.PI * 2;
        const speed = 0.4 + random() * 1.5;
        burstVelocities[i * 3] = Math.cos(angle) * speed;
        burstVelocities[i * 3 + 1] = 0.65 + random() * 1.6;
        burstVelocities[i * 3 + 2] = Math.sin(angle) * speed;
      }
    };
    let excitementStarted = -Infinity;
    const excitePet = () => {
      const now = performance.now();
      // The click callback can synchronously cause a matching prop update.
      if (now - excitementStarted < 120) return;
      excitementStarted = now;
      emitBurst(petAnchor.position.clone().add(new THREE.Vector3(0, 0.9, 0)), '#ffe3a0');
    };
    excitePetRef.current = excitePet;
    let wasTreasureOpen = treasureRef.current;
    updateTreasureRef.current = (opened) => {
      if (opened && !wasTreasureOpen) emitBurst(chest.position.clone().add(new THREE.Vector3(0, 0.9, 0)), '#ffe28a');
      wasTreasureOpen = opened;
    };
    const petTarget = mesh(keep(new THREE.SphereGeometry(1, 8, 8)), basic('#ffffff', { visible: false }), petAnchor, [0, 0.95, 0.05], [0.72, 1.05, 0.76]);
    petTarget.userData.pet = true;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downX = 0;
    let downY = 0;
    let previousX = 0;
    let dragging = false;
    let moved = false;
    let hovered: Zone | null = null;
    let hoveredCrystal: number | null = null;
    type Hit = { type: 'crystal'; id: number } | { type: 'pet' } | { type: 'zone'; zone: Zone };
    const findHit = (event: PointerEvent): Hit | null => {
      const bounds = canvas.getBoundingClientRect();
      pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      // Collectibles win over the larger, invisible landmark hit areas behind them.
      const crystalHit = raycaster.intersectObjects(collectibles.filter((group) => group.visible), true)[0];
      if (crystalHit) {
        let object: THREE.Object3D | null = crystalHit.object;
        while (object) {
          if (typeof object.userData.crystalId === 'number') return { type: 'crystal', id: object.userData.crystalId };
          object = object.parent;
        }
      }
      if (raycaster.intersectObject(petAnchor, true).length) return { type: 'pet' };
      const intersections = raycaster.intersectObjects([ruins, grove, shore], true);
      for (const intersection of intersections) {
        let object: THREE.Object3D | null = intersection.object;
        while (object) {
          if (object.userData.zone) return { type: 'zone', zone: object.userData.zone as Zone };
          object = object.parent;
        }
      }
      return null;
    };
    const pointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      dragging = true;
      moved = false;
      downX = previousX = event.clientX;
      downY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = 'grabbing';
    };
    const pointerMove = (event: PointerEvent) => {
      if (dragging) {
        yaw -= (event.clientX - previousX) * 0.005;
        yaw = Math.max(-0.72, Math.min(0.9, yaw));
        previousX = event.clientX;
        moved ||= Math.hypot(event.clientX - downX, event.clientY - downY) > 7;
      } else {
        const hit = findHit(event);
        hovered = hit?.type === 'zone' ? hit.zone : null;
        hoveredCrystal = hit?.type === 'crystal' ? hit.id : null;
        canvas.style.cursor = hit ? 'pointer' : 'grab';
      }
    };
    const pointerUp = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      canvas.style.cursor = 'grab';
      if (!moved) {
        const hit = findHit(event);
        if (hit?.type === 'crystal' && !collectedRef.current.has(hit.id)) {
          // Hide immediately, before React updates, to prevent duplicate click rewards.
          collectedRef.current.add(hit.id);
          collectibles[hit.id].visible = false;
          emitBurst(collectibles[hit.id].position, collectibleLocations[hit.id].color);
          collectRef.current?.(hit.id);
          hoveredCrystal = null;
        } else if (hit?.type === 'pet') {
          excitePet();
          interactPetRef.current?.();
        } else if (hit?.type === 'zone') {
          exploreRef.current(hit.zone);
        }
      }
    };
    const pointerCancel = () => { dragging = false; canvas.style.cursor = 'grab'; };
    const pointerLeave = () => { hovered = null; hoveredCrystal = null; };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      zoom = Math.max(0.84, Math.min(1.26, zoom + event.deltaY * 0.0006));
    };
    canvas.addEventListener('pointerdown', pointerDown);
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('pointerup', pointerUp);
    canvas.addEventListener('pointercancel', pointerCancel);
    canvas.addEventListener('pointerleave', pointerLeave);
    canvas.addEventListener('wheel', wheel, { passive: false });

    let aspect = 1;
    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      if (!width || !height) return;
      aspect = width / height;
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    const started = performance.now();
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const now = performance.now();
      const t = reducedMotion ? 0 : (now - started) / 1000;
      const distance = (aspect < 1.25 ? 16.6 / Math.max(aspect, 0.67) * 1.25 : 16.6) * zoom;
      camera.position.set(Math.sin(yaw) * distance, distance * 0.61, Math.cos(yaw) * distance);
      camera.lookAt(cameraTarget);
      const excitementProgress = Math.min(1, (now - excitementStarted) / 1250);
      const excitement = reducedMotion ? 0 : Math.sin(excitementProgress * Math.PI);
      if (pet) {
        pet.position.y = Math.sin(t * 2) * (stageRef.current === 0 ? 0.07 : 0.022) + excitement * 0.8;
        pet.rotation.y = Math.sin(t * 0.7) * 0.055 + (!reducedMotion && excitementProgress < 1 ? excitementProgress * Math.PI * 2 : 0);
        pet.rotation.z = excitement * Math.sin(excitementProgress * Math.PI * 3) * 0.08;
      }
      if (tail) tail.rotation.z = Math.sin(t * (1.8 + excitement * 4)) * (0.16 + excitement * 0.12);
      if (eyeGroup) eyeGroup.scale.y = Math.sin(t * 0.82) > 0.997 ? 0.12 : 1;
      wings.forEach((wing, index) => { wing.rotation.z = (index === 0 ? 1 : -1) * (0.16 + Math.sin(t * 1.7) * 0.08); });
      innerRing.rotation.z = t * 0.035;
      outerRing.rotation.z = -t * 0.06;
      portalSwirl.rotation.z = -t * 0.15;
      veilMaterial.opacity = 0.13 + Math.sin(t * 1.5) * 0.025;
      portalLight.intensity = 10 + Math.sin(t * 1.5) * 1.2;
      collectibles.forEach((group, id) => {
        group.position.y = collectibleLocations[id].y + Math.sin(t * 1.7 + id * 2) * 0.13;
        group.rotation.y = t * 0.65 + id;
        group.scale.setScalar(hoveredCrystal === id ? 1.18 : 1);
      });
      const chestTarget = treasureRef.current ? 1 : 0;
      chestOpenAmount = reducedMotion ? chestTarget : THREE.MathUtils.lerp(chestOpenAmount, chestTarget, 0.09);
      chestLid.rotation.x = -chestOpenAmount * 1.28;
      chestContents.visible = chestOpenAmount > 0.12;
      treasureBeamMaterial.opacity = chestOpenAmount * (0.11 + Math.sin(t * 2) * 0.025);
      if (burst.visible) {
        const age = (now - burstStarted) / 1000;
        burst.visible = age < 1.4;
        burstMaterial.opacity = Math.max(0, 1 - age / 1.4);
        const travel = reducedMotion ? 0.16 : age;
        for (let i = 0; i < burstCount; i++) {
          burstCoordinates[i * 3] = burstVelocities[i * 3] * travel;
          burstCoordinates[i * 3 + 1] = burstVelocities[i * 3 + 1] * travel - travel * travel * 0.85;
          burstCoordinates[i * 3 + 2] = burstVelocities[i * 3 + 2] * travel;
        }
        burstGeometry.attributes.position.needsUpdate = true;
      }
      markerRings.forEach(({ zone, ring, material: mat }) => {
        const selected = zoneRef.current === zone || hovered === zone;
        mat.opacity = selected ? 0.8 + Math.sin(t * 2.5) * 0.15 : 0.25;
        ring.scale.setScalar(selected ? 1.03 + Math.sin(t * 2.5) * 0.02 : 1);
      });
      for (let i = 0; i < particleCount; i++) {
        particleCoordinates[i * 3] = particleOriginals[i * 3] + Math.sin(t * 0.24 + i) * 0.16;
        particleCoordinates[i * 3 + 1] = particleOriginals[i * 3 + 1] + Math.sin(t * 0.35 + i * 1.7) * 0.25;
      }
      particleGeometry.attributes.position.needsUpdate = true;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      changePetRef.current = null;
      updateCrystalsRef.current = null;
      excitePetRef.current = null;
      updateTreasureRef.current = null;
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', pointerUp);
      canvas.removeEventListener('pointercancel', pointerCancel);
      canvas.removeEventListener('pointerleave', pointerLeave);
      canvas.removeEventListener('wheel', wheel);
      petGeometries.forEach((geometry) => geometry.dispose());
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((mat) => mat.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    };
  }, []);

  return (
    <div ref={mountRef} style={{ width: '100%', height: '100%', minHeight: 280, position: 'relative', background: 'radial-gradient(ellipse at 50% 37%, #244643 0%, #142d31 46%, #102228 100%)' }}>
      {unavailable && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', textAlign: 'center', color: '#d9f4e6', padding: 28, gap: 12 }}>
          <span style={{ fontSize: 48 }}>✧</span>
          <strong>小岛正在等待你的到来</strong>
          <span style={{ fontSize: 14, lineHeight: 1.8 }}>当前浏览器无法显示 3D 场景。<br />仍然可以使用页面按钮打卡、探索和陪伴宠物。<br />试试开启浏览器硬件加速后刷新。</span>
        </div>
      )}
    </div>
  );
}
