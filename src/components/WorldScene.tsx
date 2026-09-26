import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createHero, createPet } from './adventureModels';
import { createRegionScenery } from './regionScenery';
import type { PetId, RegionId } from '../game/adventure';
import { canPetFly, findLandingSpot as worldLandingSpot, getFlightFloor as worldFlightFloor, moveFlight as worldMoveFlight, FLIGHT_CEILING, FLIGHT_SPEED, type FlightPosition, type FlightStatus } from '../game/flight';
import { REGION_VOLUMES, TEMPLE_ENTRANCE } from '../game/landmarks';
import { CRYSTAL_POSITIONS, LAKE, SPAWN_POSITION, WORLD_ZONES, getWorldTrees, getRegionTrails, distanceToTrail as worldDistanceToTrail, getNavigationPath as worldNavigationPath, getTerrainHeight, isWalkable as worldIsWalkable, lakeDistance, resolveMovement as worldResolveMovement, type WorldPoint, type WorldZone } from '../game/world';

interface WorldSceneProps {
  stage: 0 | 1 | 2 | 3;
  collectedCrystals: number[];
  onCollectCrystal: (id: number) => void;
  onPetInteract: () => void;
  petExcited: number;
  treasureOpened: boolean;
  onExplore: (zone: WorldZone) => void;
  travelTarget?: WorldZone | null;
  travelRequest: number;
  onPosition?: (position: { x: number; z: number; heading: number }) => void;
  paused: boolean;
  region?: RegionId;
  companionId?: PetId | null;
  wildPetId?: PetId | null;
  onNearWild?: (near: boolean) => void;
  onCaptureRequest?: () => void;
  canCapture?: boolean;
  flightRequest?: number;
  onFlightState?: (state: FlightStatus) => void;
  onFlightMessage?: (message: string) => void;
  onNearTemple?: (near: boolean) => void;
  onEnterTemple?: () => void;
  templeVisited?: boolean;
  travelPoint?: WorldPoint | null;
  spawnPoint?: WorldPoint;
}

const REGION_STYLES = {
  meadow: { ground: ['#3d784a','#759a53'], path: '#c9ae7e', foliage: ['#24614e','#42874f','#85a957'], trunk: '#756d50', sky: ['#71bfea','#d2eee3'], fog:'#b9d9d9', cloud:'#fff9ea', stone:['#98a78f','#c0c6a7','#71857d'], moss:'#77935b', glow:'#79ffe0', water:['#208fab','#8adcc5'], grass:['#42753d','#91ad5a'], flowers:['#fff4d6','#e4bd78','#abbfe5','#deacbd'], dust:'#fff4ca', ridges:['#7aaca3','#83b6b5','#9bbfc0'], sun:'#fff2cf', ambient:'#527e4d' },
  water: { ground: ['#9dac80','#d3cba0'], path: '#e3d6b2', foliage: ['#477f91','#77b4a9','#e7a49d'], trunk: '#b8b5a0', sky: ['#4aafd9','#cef3ed'], fog:'#b6e1df', cloud:'#f8fffa', stone:['#91b9b4','#d6e4ce','#608f98'], moss:'#8fd2bb', glow:'#8bfff0', water:['#126da7','#76e3df'], grass:['#557f87','#a3c8ab'], flowers:['#fff1d4','#f2bfa8','#e8d4ee','#b4e0e6'], dust:'#d8ffff', ridges:['#6bafbd','#8ec5cb','#acd7d7'], sun:'#fff3dd', ambient:'#5a8997' },
  fire: { ground: ['#393b42','#67605a'], path: '#958474', foliage: ['#34383e','#494247','#865555'], trunk: '#484049', sky: ['#756b89','#e4b59d'], fog:'#bb9d94', cloud:'#dfbfb0', stone:['#585059','#8e7872','#403d48'], moss:'#63544f', glow:'#ff9c54', water:['#a73722','#ffb642'], grass:['#4e484c','#9a6750'], flowers:['#e47e49','#ffb363','#8f7777','#b45b4a'], dust:'#ffb258', ridges:['#706172','#987e80','#b79990'], sun:'#ffe0b4', ambient:'#544b61' },
  earth: { ground: ['#ad7950','#ceaa6c'], path: '#e0c692', foliage: ['#a17048','#c28c58','#e7bd7a'], trunk: '#a6744b', sky: ['#8fbfd4','#f1dec0'], fog:'#dcc5a1', cloud:'#fff0d9', stone:['#b78653','#e4c58c','#946445'], moss:'#bea36b', glow:'#ffe2a0', water:['#8c733d','#d3b363'], grass:['#967744','#c3b375'], flowers:['#d1a65f','#eccd8c','#ad8768','#9dac7a'], dust:'#ffe5b2', ridges:['#be9166','#d2af86','#e3cdb0'], sun:'#fff0c9', ambient:'#997747' },
  steel: { ground: ['#627782','#92a5a6'], path: '#b5c2bd', foliage: ['#536d82','#8fa6b0','#c3d2cf'], trunk: '#6f8294', sky: ['#7896c4','#d4e4e9'], fog:'#bbced7', cloud:'#eef4fb', stone:['#8a9faa','#cad8d7','#536d84'], moss:'#7a9d9f', glow:'#86e8ff', water:['#234b82','#76d0e7'], grass:['#62838b','#a2b8b6'], flowers:['#c5d8d8','#9fbdcd','#d3b777','#8eabba'], dust:'#a9f0ff', ridges:['#738da7','#99b1c4','#bccbd7'], sun:'#edf4ff', ambient:'#64748c' },
  fairy: { ground: ['#688073','#aaa2a2'], path: '#d9c5bb', foliage: ['#8a76a6','#bba3b3','#ecc6ce'], trunk: '#a59aac', sky: ['#919bd5','#f0d9e5'], fog:'#d6c4db', cloud:'#fff0f8', stone:['#b0a4bc','#e4d5da','#7b849d'], moss:'#9d97b7', glow:'#ffc6ff', water:['#8274b3','#e0bfe9'], grass:['#78847f','#bab1cb'], flowers:['#f2c6ee','#ffe7c1','#ceb7f2','#d6e1ed'], dust:'#ffdcff', ridges:['#9999bd','#b8adce','#d5c5dc'], sun:'#fff0f7', ambient:'#9a819f' },
} satisfies Record<RegionId, unknown>;

const lerpAngle = (from: number, to: number, amount: number) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * amount;

/** A locally generated continuous world. No downloaded textures, models, or services. */
export default function WorldScene(props: WorldSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef(props);
  const replaceCompanionRef = useRef<(() => void) | null>(null);
  const replaceWildRef = useRef<(() => void) | null>(null);
  const captureRef = useRef<(() => void) | null>(null);
  const enterTempleRef = useRef<(() => void) | null>(null);
  const navigateRef = useRef<((zone: WorldZone | null, point?: WorldPoint | null) => void) | null>(null);
  const excitementRef = useRef<(() => void) | null>(null);
  const collectedRef = useRef(new Set(props.collectedCrystals));
  const joystickRef = useRef({ x: 0, y: 0 });
  const jumpRef = useRef<(() => void) | null>(null);
  const toggleFlightRef = useRef<(() => void) | null>(null);
  const flightHoldRef = useRef({ rise: false, descend: false });
  const lastFlightRequest = useRef(props.flightRequest ?? 0);
  const lastExcitement = useRef(props.petExcited);
  const [unavailable, setUnavailable] = useState(false);
  const [stick, setStick] = useState({ x: 0, y: 0 });
  const [movingTo, setMovingTo] = useState(false);
  const [nearWild, setNearWild] = useState(false);
  const [nearTemple, setNearTemple] = useState(false);
  const [flightControls, setFlightControls] = useState({ flying: false, landing: false });

  useEffect(() => { propsRef.current = props; });
  useEffect(() => { collectedRef.current = new Set(props.collectedCrystals); }, [props.collectedCrystals]);
  useEffect(() => { replaceCompanionRef.current?.(); }, [props.stage, props.companionId]);
  useEffect(() => { replaceWildRef.current?.(); }, [props.wildPetId]);
  useEffect(() => { if (props.travelPoint || props.travelTarget) navigateRef.current?.(props.travelTarget ?? null,props.travelPoint); }, [props.travelRequest]);
  useEffect(() => {
    const request = props.flightRequest ?? 0;
    if (lastFlightRequest.current !== request) toggleFlightRef.current?.();
    lastFlightRequest.current = request;
  }, [props.flightRequest]);
  useEffect(() => {
    if (lastExcitement.current !== props.petExcited) excitementRef.current?.();
    lastExcitement.current = props.petExcited;
  }, [props.petExcited]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const region = propsRef.current.region ?? 'meadow';
    const WORLD_TREES = getWorldTrees(region), TRAILS = getRegionTrails(region);
    const distanceToTrail = (x:number,z:number) => worldDistanceToTrail(x,z,region);
    const isWalkable = (x:number,z:number,radius=.6) => worldIsWalkable(x,z,radius,region);
    const getNavigationPath = (from:WorldPoint,to:WorldPoint) => worldNavigationPath(from,to,region);
    const resolveMovement = (from:WorldPoint,to:WorldPoint) => worldResolveMovement(from,to,region);
    const getFlightFloor = (x:number,z:number) => worldFlightFloor(x,z,region);
    const findLandingSpot = (from:WorldPoint) => worldLandingSpot(from,region);
    const moveFlight = (position:FlightPosition,direction:WorldPoint,vertical:number,dt:number) => worldMoveFlight(position,direction,vertical,dt,region);
    const theme = REGION_STYLES[region];
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); }
    catch { setUnavailable(true); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = region === 'fire' ? 1.02 : 0.97;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const canvas = renderer.domElement;
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab;outline:none';
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'application');
    canvas.setAttribute('aria-label', '操控人类探险家自由探索，宠物会跟随你。WASD 或方向键移动，空格跳跃，拖拽转动视角，点击地面前往。靠近野生伙伴按 E 建立羁绊。可飞行伙伴随行时按 F 骑乘起飞或安全降落，飞行时空格上升，Shift 或 Control 下降。');
    mount.appendChild(canvas);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(theme.fog);
    scene.fog = new THREE.Fog(theme.fog, region === 'fire' ? 36 : 43, 168);
    const camera = new THREE.PerspectiveCamera(51, 1, 0.12, 480);
    const geometryResources: THREE.BufferGeometry[] = [];
    const materialResources: THREE.Material[] = [];
    const textures: THREE.Texture[] = [];
    const keep = <T extends THREE.BufferGeometry>(geometry: T): T => { geometryResources.push(geometry); return geometry; };
    const mat = (color: string, options: THREE.MeshStandardMaterialParameters = {}) => {
      const material = new THREE.MeshStandardMaterial({ color, roughness: 0.87, ...options });
      materialResources.push(material); return material;
    };
    const basic = (color: string, options: THREE.MeshBasicMaterialParameters = {}) => {
      const material = new THREE.MeshBasicMaterial({ color, ...options });
      materialResources.push(material); return material;
    };
    let seed = 853729;
    const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D, position: number[] = [0, 0, 0], scale: number[] = [1, 1, 1], shadows = true) => {
      const result = new THREE.Mesh(geometry, material);
      result.position.set(position[0], position[1], position[2]);
      result.scale.set(scale[0], scale[1], scale[2]);
      result.castShadow = shadows; result.receiveShadow = true;
      parent.add(result); return result;
    };
    const cube = keep(new THREE.BoxGeometry(1, 1, 1));
    const sphere = keep(new THREE.SphereGeometry(1, 12, 8));
    const pebbleGeometry = keep(new THREE.IcosahedronGeometry(1, 1));
    const cylinder = keep(new THREE.CylinderGeometry(1, 1, 1, 12));
    const stone = mat(theme.stone[0], { metalness: region === 'steel' ? 0.62 : 0.03 });
    const stoneLight = mat(theme.stone[1], { metalness: region === 'steel' ? 0.7 : 0.03 });
    const stoneDark = mat(theme.stone[2], { metalness: region === 'steel' ? 0.5 : 0.03 });
    const gold = mat('#dfb66a', { metalness: 0.45, roughness: 0.35 });
    const glowing = mat(theme.glow, { emissive: theme.glow, emissiveIntensity: 1.1, roughness: 0.22 });
    const moss = mat(theme.moss);

    scene.add(new THREE.HemisphereLight(theme.sky[1], theme.ambient, region === 'fire' ? 1.38 : 1.18));
    const sunlight = new THREE.DirectionalLight(theme.sun, region === 'fairy' ? 2.6 : 3.0);
    sunlight.position.set(-32, 61, 25);
    sunlight.castShadow = true;
    sunlight.shadow.mapSize.set(2048, 2048);
    Object.assign(sunlight.shadow.camera, { left: -42, right: 42, top: 42, bottom: -42, near: 1, far: 160 });
    sunlight.shadow.normalBias = 0.065;
    sunlight.shadow.bias = -0.00008;
    sunlight.shadow.radius = 2;
    scene.add(sunlight, sunlight.target);

    // A shaded sky dome, rather than a flat backdrop or dark void.
    const skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, depthTest: false,
      uniforms: { zenith: { value: new THREE.Color(theme.sky[0]) }, horizon: { value: new THREE.Color(theme.sky[1]) } },
      vertexShader: 'varying vec3 vDirection; void main(){ vDirection=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'varying vec3 vDirection; uniform vec3 zenith; uniform vec3 horizon; void main(){ float h=pow(max(normalize(vDirection).y,0.0),0.65); vec3 color=mix(horizon,zenith,h); gl_FragColor=vec4(color,1.0);\n#include <colorspace_fragment>\n}',
    });
    materialResources.push(skyMaterial);
    const sky = mesh(keep(new THREE.SphereGeometry(360, 24, 16)), skyMaterial, scene, [0, 0, 0], [1, 1, 1], false);
    sky.renderOrder = -1000; sky.frustumCulled = false;
    const sunCanvas = document.createElement('canvas'); sunCanvas.width = sunCanvas.height = 128;
    const sunContext = sunCanvas.getContext('2d');
    if (sunContext) {
      const gradient = sunContext.createRadialGradient(64, 64, 1, 64, 64, 64);
      gradient.addColorStop(0, 'rgba(255,250,215,1)'); gradient.addColorStop(0.13, 'rgba(255,247,206,.9)'); gradient.addColorStop(0.4, 'rgba(255,242,190,.18)'); gradient.addColorStop(1, 'rgba(255,242,190,0)');
      sunContext.fillStyle = gradient; sunContext.fillRect(0, 0, 128, 128);
      const texture = new THREE.CanvasTexture(sunCanvas); textures.push(texture);
      const sunMat = new THREE.SpriteMaterial({ map: texture, color: '#fff7d6', transparent: true, depthWrite: false, fog: false }); materialResources.push(sunMat);
      const disk = new THREE.Sprite(sunMat); disk.position.set(-95, 108, -180); disk.scale.set(67, 67, 1); scene.add(disk);
    }

    // Layered ridgelines create a landscape that extends far beyond the playable land.
    for (let layer = 0; layer < 3; layer++) {
      const ridge = keep(new THREE.PlaneGeometry(360, 65, 100, 10));
      ridge.rotateX(-Math.PI / 2);
      const positions = ridge.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i), localZ = positions.getZ(i);
        const peak = 14 + 18 * Math.sin(x * 0.021 + layer) ** 2 + 14 * Math.sin(x * 0.056 + layer * 2.3) ** 2;
        const edge = Math.max(0, 1 - (localZ / 35) ** 2);
        positions.setXYZ(i, x, peak * edge + Math.sin(x * 0.22 + localZ * 0.09) * edge * 2, localZ - 109 - layer * 37);
      }
      ridge.computeVertexNormals();
      mesh(ridge, mat(theme.ridges[layer], { roughness: 1 }), scene, [0, layer * 4, 0], [1, 1, 1], false);
    }
    const cloudGeometry = keep(new THREE.SphereGeometry(1, 10, 7));
    const cloudMaterial = basic(theme.cloud, { transparent: true, opacity: region === 'fire' ? 0.52 : 0.82 });
    const clouds = new THREE.InstancedMesh(cloudGeometry, cloudMaterial, 90);
    const matrixDummy = new THREE.Object3D();
    for (let i = 0; i < 90; i++) {
      const group = Math.floor(i / 5), lobe = i % 5;
      const angle = group * 2.399;
      matrixDummy.position.set(Math.cos(angle) * (75 + group * 2) + (lobe - 2) * 4.5, 37 + group % 4 * 4 + Math.sin(lobe) * 1.7, Math.sin(angle) * (95 + group * 2) - 15);
      matrixDummy.scale.set(6 + random() * 5, 2.3 + random() * 2.5, 3.5 + random() * 4);
      matrixDummy.rotation.set(0, random(), 0); matrixDummy.updateMatrix(); clouds.setMatrixAt(i, matrixDummy.matrix);
    }
    scene.add(clouds);

    const terrainGeometry = keep(new THREE.PlaneGeometry(224, 224, 224, 224));
    terrainGeometry.rotateX(-Math.PI / 2);
    const terrainPositions = terrainGeometry.attributes.position;
    const groundColors: number[] = [];
    const darkGrass = new THREE.Color(theme.ground[0]), lightGrass = new THREE.Color(theme.ground[1]), sand = new THREE.Color(theme.path);
    for (let i = 0; i < terrainPositions.count; i++) {
      const x = terrainPositions.getX(i), z = terrainPositions.getZ(i);
      const height = getTerrainHeight(x, z);
      terrainPositions.setY(i, height);
      const patch = Math.sin(x * 0.19) * Math.cos(z * 0.16) * 0.2 + Math.sin(x * 0.43 + z * 0.23) * 0.07 + 0.49;
      const color = darkGrass.clone().lerp(lightGrass, patch);
      const lakeEdge = lakeDistance(x, z);
      if (lakeEdge < 1.22) color.lerp(sand, Math.max(0, 1 - Math.abs(lakeEdge - 1.04) * 5));
      groundColors.push(color.r, color.g, color.b);
    }
    terrainGeometry.setAttribute('color', new THREE.Float32BufferAttribute(groundColors, 3));
    terrainGeometry.computeVertexNormals();
    const terrainMaterial = mat('#ffffff', { vertexColors: true });
    terrainMaterial.onBeforeCompile = (shader) => {
      shader.vertexShader = 'varying vec3 meadowPosition;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n meadowPosition=position;');
      shader.fragmentShader = 'varying vec3 meadowPosition;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n float flecks=sin(meadowPosition.x*31.0+sin(meadowPosition.z*23.0))*sin(meadowPosition.z*35.0); float patches=sin(meadowPosition.x*1.3+meadowPosition.z*.7)*cos(meadowPosition.z*1.8); diffuseColor.rgb*=.97+flecks*.035+patches*.025;');
    };
    const terrain = mesh(terrainGeometry, terrainMaterial, scene);
    terrain.castShadow = false;

    // Curved trails follow every rise of the terrain, all the way to each landmark.
    const trailMaterial = mat(theme.path, { roughness: region === 'steel' ? 0.65 : 1, metalness: region === 'steel' ? 0.2 : 0 });
    for (const trail of TRAILS) {
      const curve = new THREE.CatmullRomCurve3(trail.map((point) => new THREE.Vector3(point.x, 0, point.z)));
      const vertices: number[] = [], indices: number[] = [], colors: number[] = [];
      const steps = 130;
      for (let i = 0; i <= steps; i++) {
        const point = curve.getPoint(i / steps), tangent = curve.getTangent(i / steps);
        const width = 1.55 + Math.sin(i * 0.11) * 0.15;
        for (const side of [-1, 1]) {
          const x = point.x + tangent.z * width * side, z = point.z - tangent.x * width * side;
          vertices.push(x, getTerrainHeight(x, z) + 0.035, z);
          const color = new THREE.Color('#ffffff').multiplyScalar(0.93 + Math.sin(i * 0.7) * 0.035);
          colors.push(color.r, color.g, color.b);
        }
        if (i < steps) { const index = i * 2; indices.push(index, index + 2, index + 1, index + 1, index + 2, index + 3); }
      }
      const geometry = keep(new THREE.BufferGeometry());
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
      mesh(geometry, trailMaterial, scene, [0, 0, 0], [1, 1, 1], false);
    }

    // Smooth, varied silhouettes: merged leafy crowns and layered, curved firs.
    const merge = (parts: THREE.BufferGeometry[]) => {
      const geometry = mergeGeometries(parts, false)!;
      parts.forEach((part) => part.dispose()); return keep(geometry);
    };
    const leafyParts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 6; i++) {
      const geometry = new THREE.SphereGeometry(1, 16, 12);
      const leafVertices = geometry.attributes.position;
      for (let j = 0; j < leafVertices.count; j++) {
        const x = leafVertices.getX(j), y = leafVertices.getY(j), z = leafVertices.getZ(j);
        const noise = 1 + Math.sin(x * 7.1 + i) * Math.cos(y * 5.8 - i) * Math.sin(z * 6.6 + 2) * 0.13;
        leafVertices.setXYZ(j, x * noise, y * noise, z * noise);
      }
      geometry.computeVertexNormals();
      const angle = i * 2.4;
      geometry.scale(i === 0 ? 1.65 : 1.1 + i % 3 * 0.12, 1.0 + i % 2 * 0.4, 1.2);
      geometry.translate(i === 0 ? 0 : Math.cos(angle) * 1.1, 4.3 + Math.sin(i * 1.3) * 0.72, i === 0 ? 0 : Math.sin(angle) * 1.1);
      leafyParts.push(geometry);
    }
    const broadleafGeometry = merge(leafyParts);
    const pinePoints: THREE.Vector2[] = [];
    for (let i = 0; i <= 22; i++) {
      const t = i / 22;
      const radius = (1 - t) * (1.55 + Math.sin(t * Math.PI * 9) * 0.24);
      pinePoints.push(new THREE.Vector2(Math.max(0.015, radius), 1.65 + t * 5.7));
    }
    const pineGeometry = keep(new THREE.LatheGeometry(pinePoints, 10));
    const branchPart = (from: THREE.Vector3, to: THREE.Vector3, baseRadius: number, tipRadius: number) => {
      const direction = to.clone().sub(from);
      const geometry = new THREE.CylinderGeometry(tipRadius, baseRadius, direction.length(), 7);
      geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
      geometry.translate((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
      return geometry;
    };
    const regionCrowns: THREE.BufferGeometry[] = [pineGeometry, broadleafGeometry];
    if (region === 'water' || region === 'fire') {
      for (let variant = 0; variant < 2; variant++) {
        if(region==='fire'&&variant===0){regionCrowns[variant]=pineGeometry;continue;}
        const branches: THREE.BufferGeometry[] = [];
        for (let i = 0; i < 7; i++) {
          const angle = i * 2.39 + variant;
          const start = new THREE.Vector3(0, 2.8 + (i % 3) * 0.48, 0);
          const elbow = new THREE.Vector3(Math.cos(angle) * (1.1 + i % 2 * 0.4), 4.1 + (i % 3) * 0.42, Math.sin(angle) * (1.1 + i % 2 * 0.4));
          const tip = elbow.clone().add(new THREE.Vector3(Math.cos(angle) * 0.17, region === 'water' ? 1.12 : 0.48, Math.sin(angle) * 0.17));
          branches.push(branchPart(start, elbow, 0.16, 0.09), branchPart(elbow, tip, 0.09, 0.035));
          if (region === 'water') {
            const bulb = new THREE.SphereGeometry(0.2, 8, 6); bulb.scale(1, 1.5, 1); bulb.translate(tip.x, tip.y, tip.z); branches.push(bulb);
          }
        }
        regionCrowns[variant] = merge(branches);
      }
    } else if (region === 'earth') {
      for (let variant = 0; variant < 2; variant++) {
        const rings: THREE.Vector2[] = [];
        for (let i = 0; i < 20; i++) {
          const height = 1.1 + i * 0.29;
          const radius = (height < 2.7 ? 0.27 : 0.57) + Math.sin(i * 1.2 + variant) * (height < 2.7 ? 0.025 : 0.11) + (i > 13 ? Math.sin((i - 13) / 6 * Math.PI) * 0.75 : 0);
          rings.push(new THREE.Vector2(radius, height));
        }
        rings.push(new THREE.Vector2(0, 6.8));
        regionCrowns[variant] = keep(new THREE.LatheGeometry(rings, 9));
      }
    } else if (region === 'steel') {
      for (let variant = 0; variant < 2; variant++) {
        const panels: THREE.BufferGeometry[] = [];
        for (let i = 0; i < 4; i++) {
          const panel = new THREE.BoxGeometry(2.25 - i * 0.28, 0.14, 1.18 - i * 0.11);
          panel.rotateY(i * 0.8 + variant); panel.translate(0, 3.3 + i * 0.7, 0); panels.push(panel);
          const collar = new THREE.TorusGeometry(0.47 + i * 0.06, 0.09, 5, 12); collar.rotateX(Math.PI / 2); collar.translate(0, 3.15 + i * 0.7, 0); panels.push(collar);
        }
        regionCrowns[variant] = merge(panels);
      }
    } else if (region === 'fairy') {
      regionCrowns[0] = keep(new THREE.LatheGeometry([
        new THREE.Vector2(0, 4.0), new THREE.Vector2(0.8, 3.92), new THREE.Vector2(1.8, 3.99), new THREE.Vector2(2.35, 4.22), new THREE.Vector2(2.3, 4.47), new THREE.Vector2(1.94, 4.82), new THREE.Vector2(1.43, 5.22), new THREE.Vector2(0.7, 5.58), new THREE.Vector2(0, 5.72),
      ], 20));
    }
    const trunkGeometry = keep(new THREE.CylinderGeometry(0.16, 0.34, 4.9, 7)); trunkGeometry.translate(0, 2.45, 0);
    const treeMaterial = mat('#ffffff', { roughness: region === 'steel' ? 0.35 : 0.92, metalness: region === 'steel' ? 0.75 : 0 });
    const trunkMaterial = mat(theme.trunk, { metalness: region === 'steel' ? 0.68 : 0, roughness: region === 'steel' ? 0.35 : 0.9 });
    const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, WORLD_TREES.length);
    trunks.castShadow = true; trunks.receiveShadow = true;
    WORLD_TREES.forEach((tree, index) => {
      matrixDummy.position.set(tree.x, getTerrainHeight(tree.x, tree.z) - 0.05, tree.z);
      matrixDummy.rotation.set(0, tree.rotation, Math.sin(index) * 0.025); matrixDummy.scale.setScalar(tree.size); matrixDummy.updateMatrix(); trunks.setMatrixAt(index, matrixDummy.matrix);
    }); scene.add(trunks);
    for (const variant of [0, 1]) {
      const trees = WORLD_TREES.filter((tree) => tree.variant === variant);
      const crowns = new THREE.InstancedMesh(regionCrowns[variant], treeMaterial, trees.length);
      crowns.castShadow = true; crowns.receiveShadow = true;
      trees.forEach((tree, index) => {
        matrixDummy.position.set(tree.x, getTerrainHeight(tree.x, tree.z), tree.z);
        matrixDummy.rotation.set(0, tree.rotation, Math.sin(index) * 0.025); matrixDummy.scale.setScalar(tree.size); matrixDummy.updateMatrix(); crowns.setMatrixAt(index, matrixDummy.matrix);
        crowns.setColorAt(index, region==='fire'&&variant===0?new THREE.Color('#cbd8d8').lerp(new THREE.Color('#708e92'),random()*.33):new THREE.Color(theme.foliage[variant]).lerp(new THREE.Color(theme.foliage[2]), random() * 0.32));
      }); scene.add(crowns);
    }

    // Instancing keeps thousands of grass blades, blossoms, and stones inexpensive.
    const grassVertices: number[] = [];
    for (let i = 0; i < 3; i++) {
      const angle = i * Math.PI / 3, dx = Math.cos(angle) * 0.018, dz = Math.sin(angle) * 0.018;
      const bendX = Math.sin(angle + 0.7) * 0.065, bendZ = Math.cos(angle + 0.7) * 0.065;
      const midY = 0.2 + i * 0.025, tipY = 0.34 + i * 0.025;
      grassVertices.push(-dx,0,-dz,dx,0,dz,bendX+dx*.7,midY,bendZ+dz*.7);
      grassVertices.push(-dx,0,-dz,bendX+dx*.7,midY,bendZ+dz*.7,bendX-dx*.7,midY,bendZ-dz*.7);
      grassVertices.push(bendX-dx*.7,midY,bendZ-dz*.7,bendX+dx*.7,midY,bendZ+dz*.7,bendX*1.8,tipY,bendZ*1.8);
    }
    const grassGeometry = keep(new THREE.BufferGeometry()); grassGeometry.setAttribute('position', new THREE.Float32BufferAttribute(grassVertices, 3)); grassGeometry.computeVertexNormals();
    const grassMaterial = mat('#ffffff', { side: THREE.DoubleSide, roughness: 1 });
    const wind = { value: 0 };
    grassMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.windTime = wind;
      shader.vertexShader = 'uniform float windTime;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed.x += sin(windTime*1.3+instanceMatrix[3].x*.25+instanceMatrix[3].z*.18)*position.y*position.y*.24;');
    };
    const grassInstances = new THREE.InstancedMesh(grassGeometry, grassMaterial, 14000);
    grassInstances.receiveShadow = true;
    let grassCount = 0;
    for (let i = 0; i < 20000 && grassCount < 14000; i++) {
      const x = (random() - 0.5) * 140, z = (random() - 0.5) * 140;
      if (lakeDistance(x, z) < 1.19 || distanceToTrail(x, z) < 1.9 || Math.hypot(x + 8, z + 26) < 5.1) continue;
      matrixDummy.position.set(x, getTerrainHeight(x, z) + 0.025, z); matrixDummy.rotation.set(0, random() * 6.28, 0); matrixDummy.scale.setScalar(0.68 + random() * 1.15); matrixDummy.updateMatrix(); grassInstances.setMatrixAt(grassCount, matrixDummy.matrix);
      grassInstances.setColorAt(grassCount++, new THREE.Color(theme.grass[0]).lerp(new THREE.Color(theme.grass[1]), random() * 0.65));
    }
    grassInstances.count = Math.min(grassCount, region === 'steel' ? 3800 : region === 'fire' ? 4800 : region === 'earth' ? 8000 : grassCount); scene.add(grassInstances);
    const flowerParts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 5; i++) {
      const petal = new THREE.SphereGeometry(0.09, 5, 4); petal.scale(1, 0.4, 1.45); petal.rotateY(i * Math.PI * 0.4); petal.translate(Math.sin(i * Math.PI * 0.4) * 0.105, 0.31, Math.cos(i * Math.PI * 0.4) * 0.105); flowerParts.push(petal);
    }
    const originalFlowerGeometry = merge(flowerParts);
    let flowerGeometry: THREE.BufferGeometry = originalFlowerGeometry;
    if (region === 'water') {
      const shellVertices: number[] = [0, 0.08, 0], shellIndices: number[] = [];
      for (let i = 0; i <= 12; i++) {
        const angle = -Math.PI * 0.48 + i / 12 * Math.PI * 0.96;
        shellVertices.push(Math.sin(angle) * 0.29, 0.08 + (i % 2 ? 0.07 : 0.03), Math.cos(angle) * 0.32);
        if (i < 12) shellIndices.push(0, i + 2, i + 1);
      }
      flowerGeometry = keep(new THREE.BufferGeometry()); flowerGeometry.setAttribute('position', new THREE.Float32BufferAttribute(shellVertices, 3)); flowerGeometry.setIndex(shellIndices); flowerGeometry.computeVertexNormals();
    } else if (region === 'fire' || region === 'earth') {
      flowerGeometry = keep(new THREE.OctahedronGeometry(0.2, 0)); flowerGeometry.scale(0.85, region === 'fire' ? 1.65 : 0.7, 0.85); flowerGeometry.translate(0, region === 'fire' ? 0.2 : 0.09, 0);
    } else if (region === 'steel') {
      flowerGeometry = keep(new THREE.TorusGeometry(0.16, 0.04, 4, 8)); flowerGeometry.rotateX(-Math.PI / 2); flowerGeometry.translate(0, 0.08, 0);
    }
    const flowerMaterial = mat('#ffffff', { emissive: region === 'fairy' ? '#ba86bf' : '#000000', emissiveIntensity: region === 'fairy' ? 0.42 : 0, metalness: region === 'steel' ? 0.6 : 0 });
    const flowers = new THREE.InstancedMesh(flowerGeometry, flowerMaterial, 1500);
    const flowerCenters = [[-5, 25], [7, 18], [-14, 7], [10, 10], [-22, -1], [19, 12], [1, 34], [-8, -15]];
    let flowerCount = 0;
    for (let i = 0; i < 750 && flowerCount < 650; i++) {
      const center = flowerCenters[i % flowerCenters.length];
      const angle = random() * Math.PI * 2, radius = Math.sqrt(random()) * 7;
      const x = center[0] + Math.cos(angle) * radius, z = center[1] + Math.sin(angle) * radius;
      if (distanceToTrail(x, z) < 1.85 || lakeDistance(x, z) < 1.17) continue;
      matrixDummy.position.set(x, getTerrainHeight(x, z) + 0.04, z); matrixDummy.rotation.set(0, random() * 6.28, 0); matrixDummy.scale.setScalar(0.32 + random() * 0.5); matrixDummy.updateMatrix(); flowers.setMatrixAt(flowerCount, matrixDummy.matrix);
      flowers.setColorAt(flowerCount++, new THREE.Color(theme.flowers[i % 4]));
    }
    flowers.count = flowerCount; scene.add(flowers);
    const rocks = new THREE.InstancedMesh(pebbleGeometry, stoneDark, 240);
    rocks.castShadow = true; rocks.receiveShadow = true;
    for (let i = 0; i < 240; i++) {
      const x = (random() - 0.5) * 135, z = (random() - 0.5) * 135;
      const size = distanceToTrail(x, z) < 2 ? 0.08 : 0.22 + random() * 0.65;
      matrixDummy.position.set(x, getTerrainHeight(x, z) + size * 0.12, z); matrixDummy.rotation.set(random(), random(), random()); matrixDummy.scale.set(size * 1.5, size * 0.75, size); matrixDummy.updateMatrix(); rocks.setMatrixAt(i, matrixDummy.matrix);
    } scene.add(rocks);

    for (const [x, z, size] of [[-57, -28, 8], [-60, -45, 10], [47, -39, 7]]) {
      const cliff = mesh(pebbleGeometry, stoneDark, scene, [x, getTerrainHeight(x, z) + size * 0.65, z], [size, size * 1.7, size * 0.83]);
      cliff.rotation.z = 0.1; cliff.rotation.y = 0.4;
      mesh(pebbleGeometry, moss, scene, [x - size * 0.22, getTerrainHeight(x, z) + size * 1.7, z + size * 0.1], [size * 0.59, size * 0.28, size * 0.5]);
    }

    // A lake with a real shoreline, a playable sandy peninsula, ripples and reeds.
    const waterVertices: number[] = [LAKE.x, LAKE.waterLevel, LAKE.z], waterIndices: number[] = [];
    const shorePoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 128; i++) {
      const angle = i / 128 * Math.PI * 2;
      let low = 0, high = 1.35;
      for (let n = 0; n < 14; n++) {
        const r = (low + high) / 2;
        if (lakeDistance(LAKE.x + Math.cos(angle) * LAKE.radiusX * r, LAKE.z + Math.sin(angle) * LAKE.radiusZ * r) < 1.045) low = r; else high = r;
      }
      const x = LAKE.x + Math.cos(angle) * LAKE.radiusX * low, z = LAKE.z + Math.sin(angle) * LAKE.radiusZ * low;
      waterVertices.push(x, LAKE.waterLevel, z); shorePoints.push(new THREE.Vector3(x, LAKE.waterLevel + 0.015, z));
      if (i < 128) waterIndices.push(0, i + 2, i + 1);
    }
    const waterGeometry = keep(new THREE.BufferGeometry()); waterGeometry.setAttribute('position', new THREE.Float32BufferAttribute(waterVertices, 3)); waterGeometry.setIndex(waterIndices); waterGeometry.computeVertexNormals();
    const waterMaterial = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { time: { value: 0 }, deep: { value: new THREE.Color(theme.water[0]) }, shallow: { value: new THREE.Color(theme.water[1]) }, lava: { value: region === 'fire' ? 1 : 0 } },
      vertexShader: 'varying vec3 vWorld; void main(){vWorld=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'varying vec3 vWorld; uniform float time; uniform vec3 deep; uniform vec3 shallow; uniform float lava; void main(){float lines=sin(vWorld.x*2.1+vWorld.z*.5+time*.6)*sin(vWorld.z*2.6-time*.45); float glint=pow(max(0.,lines),16.); float swirls=sin(vWorld.x*.34+time*.12)*cos(vWorld.z*.25+time*.1)*.5+.5; vec3 color=mix(deep,shallow,swirls*(.35+lava*.65)); color+=glint*(.24+lava*.2)+lava*vec3(.18,.035,.0); gl_FragColor=vec4(color,.94);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
    }); materialResources.push(waterMaterial);
    mesh(waterGeometry, waterMaterial, scene, [0, 0, 0], [1, 1, 1], false);
    const shoreCurve = new THREE.CatmullRomCurve3(shorePoints, true);
    mesh(keep(new THREE.TubeGeometry(shoreCurve, 128, 0.065, 3, true)), basic(theme.glow, { transparent: true, opacity: 0.58 }), scene, [0, 0, 0], [1, 1, 1], false);
    const reeds = new THREE.InstancedMesh(keep(new THREE.CylinderGeometry(0.018, 0.038, 1.4, 4)), mat(theme.grass[1]), 130);
    for (let i = 0; i < 130; i++) {
      const point = shorePoints[(i * 7) % 128]; const x = point.x + (random() - 0.5) * 1.6, z = point.z + (random() - 0.5) * 1.6;
      matrixDummy.position.set(x, Math.max(LAKE.waterLevel, getTerrainHeight(x, z)) + 0.4, z); matrixDummy.scale.setScalar(0.5 + random() * 0.6); matrixDummy.rotation.set(0.08, random(), 0.12); matrixDummy.updateMatrix(); reeds.setMatrixAt(i, matrixDummy.matrix);
    } scene.add(reeds);

    // Large regional silhouettes stay inside the lake's non-walkable footprint.
    // Their geometry changes as well as their palette, so each realm reads at spawn.
    const regionAnimations: { object: THREE.Object3D; axis: 'x' | 'y' | 'z'; speed: number }[] = [];
    const landmark = new THREE.Group(); landmark.position.set(LAKE.x, LAKE.waterLevel, LAKE.z); scene.add(landmark);
    if (region === 'water') {
      const coralMaterials = [mat('#e9a9a3', { roughness: 0.6 }), mat('#8bced2', { roughness: 0.5 })];
      for (const side of [-1, 1]) {
        mesh(cylinder, stoneLight, landmark, [side * 5.6, 3.0, 0], [0.42, 6, 0.42]);
        mesh(regionCrowns[1], coralMaterials[side === -1 ? 0 : 1], landmark, [side * 5.6, -0.4, 0], [1.4, 1.5, 1.4]);
        mesh(keep(new THREE.OctahedronGeometry(1, 0)), glowing, landmark, [side * 5.6, 9.05, 0], [0.48, 1.2, 0.48]);
      }
      const pearlArch = mesh(keep(new THREE.TorusGeometry(5.7, 0.28, 8, 48, Math.PI)), stoneLight, landmark, [0, 5.2, 0], [1, 0.86, 1]);
      pearlArch.rotation.y = 0.04;
      const pearl = mesh(sphere, mat('#e7fcf6', { emissive:'#8fbebc',emissiveIntensity:.25,metalness:.3,roughness:.16 }), landmark, [0, 7.8, 0], [0.75, 0.75, 0.75]);
      regionAnimations.push({ object: pearl, axis: 'y', speed: 0.2 });
    } else if (region === 'fire') {
      const volcanoProfile = [new THREE.Vector2(8.0, 0), new THREE.Vector2(7.3, 2), new THREE.Vector2(6.1, 4.7), new THREE.Vector2(5.2, 7), new THREE.Vector2(4.0, 10.2), new THREE.Vector2(3.1, 12.2), new THREE.Vector2(2.8, 12.8), new THREE.Vector2(2.42, 11.8), new THREE.Vector2(0.8, 10.9)];
      const volcanoGeometry = keep(new THREE.LatheGeometry(volcanoProfile, 24));
      const vertices = volcanoGeometry.attributes.position;
      for (let i=0;i<vertices.count;i++) { const x=vertices.getX(i),z=vertices.getZ(i),y=vertices.getY(i);const rough=1+Math.sin(Math.atan2(z,x)*9+y*.8)*.055;vertices.setXYZ(i,x*rough,y,z*rough); } volcanoGeometry.computeVertexNormals();
      mesh(volcanoGeometry, stoneDark, landmark);
      mesh(keep(new THREE.TorusGeometry(2.65, 0.15, 7, 42)), glowing, landmark, [0, 12.3, 0]).rotation.x = -Math.PI / 2;
      mesh(keep(new THREE.CircleGeometry(2.65, 42)), basic('#ffb952'), landmark, [0, 11.95, 0], [1, 1, 1], false).rotation.x = -Math.PI / 2;
      for(let i=0;i<6;i++){const angle=i/6*Math.PI*2;const shard=mesh(keep(new THREE.OctahedronGeometry(1,0)),glowing,landmark,[Math.cos(angle)*6.5,1.3,Math.sin(angle)*6.5],[.4,1.7,.4]);shard.rotation.z=.15*Math.sin(angle);}
      const heatLight=new THREE.PointLight('#ff8c44',34,28,2);heatLight.position.set(0,12.5,0);landmark.add(heatLight);
    } else if (region === 'earth') {
      for(const side of [-1,1]) {
        mesh(keep(new THREE.CylinderGeometry(1.0,1.75,6.4,9)),stone,landmark,[side*5.4,3.2,0]);
        for(let i=0;i<4;i++)mesh(cylinder,i%2?stoneLight:stoneDark,landmark,[side*5.4,1.2+i*1.5,0],[1.5-i*.08,.15,1.45-i*.08]);
      }
      mesh(keep(new THREE.TorusGeometry(5.4,.92,7,24,Math.PI)),stoneLight,landmark,[0,6.2,0],[1,.82,1]);
      for(const [x,z,size] of [[-3,-5,1.45],[4,4,1.3]])mesh(regionCrowns[0],stone,landmark,[x,-.2,z],[size,size,size]);
      const amber=mesh(keep(new THREE.OctahedronGeometry(1,0)),glowing,landmark,[0,7.0,0],[.62,1.18,.62]);
      regionAnimations.push({object:amber,axis:'y',speed:.23});
    } else if (region === 'steel') {
      const gearShape=new THREE.Shape();
      for(let i=0;i<80;i++){const angle=i/80*Math.PI*2,r=i%4<2?1:1.15;const x=Math.cos(angle)*r,y=Math.sin(angle)*r;if(i===0)gearShape.moveTo(x,y);else gearShape.lineTo(x,y);}gearShape.closePath();
      const hole=new THREE.Path();hole.absarc(0,0,.68,0,Math.PI*2,true);gearShape.holes.push(hole);
      const gearGeometry=keep(new THREE.ExtrudeGeometry(gearShape,{depth:.12,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:1,steps:1}));
      mesh(cube,stoneDark,landmark,[0,4,0],[1.35,8,1.35]);
      const primaryGear=mesh(gearGeometry,stoneLight,landmark,[0,7.3,0],[5.7,5.7,4]);
      const secondaryGear=mesh(gearGeometry,gold,landmark,[6.8,4.3,.4],[2.5,2.5,3]);
      regionAnimations.push({object:primaryGear,axis:'z',speed:.09},{object:secondaryGear,axis:'z',speed:-.2});
      mesh(keep(new THREE.TorusGeometry(3.7,.08,6,64)),glowing,landmark,[0,7.3,.65]);
      mesh(keep(new THREE.OctahedronGeometry(1,0)),glowing,landmark,[0,7.3,.45],[1.0,1.7,1.0]);
      for(const side of [-1,1])mesh(cube,stone,landmark,[side*4.9,1.1,0],[1.1,2.2,1.5]);
    } else if (region === 'fairy') {
      const mushroomStem=mat('#dfccd7',{emissive:'#705b7d',emissiveIntensity:.13});
      mesh(keep(new THREE.CylinderGeometry(.9,1.6,11.5,14)),mushroomStem,landmark,[0,5.5,0]);
      mesh(regionCrowns[0],mat('#cda6d7',{emissive:'#a162b2',emissiveIntensity:.2}),landmark,[0,0,0],[2.55,2.55,2.55]);
      for(let i=0;i<17;i++){const angle=i*2.4,r=1+((i*1.9)%4.1);mesh(sphere,basic('#ffead8'),landmark,[Math.cos(angle)*r,14.8-r*.38,Math.sin(angle)*r],[.25+random()*.16,.1,.3+random()*.17],false);}
      for(const side of [-1,1]){mesh(cylinder,mushroomStem,landmark,[side*6.1,2.15,2.3],[.38,4.3,.38]);mesh(regionCrowns[0],mat(side<0?'#a7bce2':'#efbed2',{emissive:'#906cb5',emissiveIntensity:.2}),landmark,[side*6.1,.35,2.3],[.9,.9,.9]);}
      mesh(keep(new THREE.TorusGeometry(2.4,.065,5,64)),glowing,landmark,[0,7.5,0]).rotation.x=-Math.PI/2;
    }

    // Ancient stone architecture is on the far hill, visible from the first frame.
    const ruins = new THREE.Group(); ruins.position.set(-8, getTerrainHeight(-8, -27), -27); scene.add(ruins);
    mesh(cylinder, stoneDark, ruins, [0, 0.13, 0], [5.3, 0.22, 4.5]);
    mesh(cylinder, stone, ruins, [0, 0.27, 0], [4.7, 0.16, 4]);
    for (const side of [-1, 1]) {
      mesh(cube, stone, ruins, [side * 3.7, 3.35, 0], [1.25, 6.5, 1.5]);
      mesh(cube, stoneLight, ruins, [side * 3.7, 6.8, 0], [1.85, 0.4, 2]);
      mesh(cube, moss, ruins, [side * 3.7, 7.05, 0], [1.83, 0.1, 1.95]);
      mesh(cube, glowing, ruins, [side * 3.7, 3.8, 0.762], [0.085, 3.5, 0.025]);
    }
    const portal = new THREE.Group(); portal.position.set(0, 4.1, 0); ruins.add(portal);
    const stoneArch = keep(new THREE.TorusGeometry(3.15, 0.42, 5, 28, Math.PI));
    mesh(stoneArch, stoneLight, portal).rotation.z = 0;
    for (const side of [-1, 1]) mesh(cube, stoneLight, ruins, [side * 3.15, 2.15, 0], [0.82, 4, 0.84]);
    const portalRing = mesh(keep(new THREE.TorusGeometry(2.67, 0.045, 5, 72)), glowing, portal, [0, 0, 0.15]);
    const veil = mesh(keep(new THREE.CircleGeometry(2.62, 64)), basic(theme.glow, { transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }), portal, [0, 0, 0.11], [1, 1, 1], false);
    const swirl = new THREE.Group(); portal.add(swirl);
    for (let i = 0; i < 3; i++) mesh(keep(new THREE.TorusGeometry(0.8 + i * 0.65, 0.018, 3, 44, 3.8)), glowing, swirl, [0, 0, 0.16]).rotation.z = i * 2;
    for (let i = 0; i < 14; i++) {
      const angle = i / 14 * Math.PI * 2;
      const rune = mesh(cube, glowing, portal, [Math.cos(angle) * 2.83, Math.sin(angle) * 2.83, 0.3], [0.055, 0.18, 0.025]); rune.rotation.z = angle;
    }
    for (const [x, z, height] of [[-15.5, -24.2, 4], [-0.8, -24.8, 5.2]]) {
      const y = getTerrainHeight(x, z);
      mesh(cube, stoneDark, scene, [x, y + 0.2, z], [2, 0.4, 1.9]);
      mesh(cube, stone, scene, [x, y + height / 2, z], [1.35, height, 1.5]);
      mesh(cube, stoneLight, scene, [x, y + height, z], [1.9, 0.4, 2]);
    }
    const portalLight = new THREE.PointLight(theme.glow, 10, 13); portalLight.position.set(-8, ruins.position.y + 3, -24); scene.add(portalLight);
    for (const [x, z, height] of [[-31.6, -5, 3.5], [-27.8, -9.6, 2.8]]) {
      const rock = mesh(pebbleGeometry, stone, scene, [x, getTerrainHeight(x, z) + height * 0.45, z], [1.4, height, 1.15]); rock.rotation.z = 0.14;
      mesh(cube, glowing, scene, [x + 0.1, getTerrainHeight(x, z) + height, z + 0.96], [0.12, 1.05, 0.03]);
    }

    const crystalColors = region === 'meadow' ? ['#ffcc66', '#65f3d1', '#93bfff'] : [theme.glow, theme.flowers[0], theme.water[1]];
    const crystals = CRYSTAL_POSITIONS.map((point, id) => {
      const group = new THREE.Group(); group.position.set(point.x, getTerrainHeight(point.x, point.z) + 1.9, point.z); scene.add(group);
      const color = crystalColors[id];
      mesh(keep(new THREE.OctahedronGeometry(1, 0)), mat(color, { emissive: color, emissiveIntensity: 0.65, metalness: 0.23, roughness: 0.18 }), group, [0, 0, 0], [0.55, 1.04, 0.55]);
      mesh(keep(new THREE.TorusGeometry(0.98, 0.035, 4, 40)), basic(color), group).rotation.x = Math.PI / 2;
      const beam = mesh(keep(new THREE.CylinderGeometry(0.34, 0.6, 11, 12, 1, true)), basic(color, { transparent: true, opacity: 0.075, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }), group, [0, 4, 0], [1, 1, 1], false);
      beam.renderOrder = 1;
      return group;
    });

    const chest = new THREE.Group(); chest.position.set(-5.1, getTerrainHeight(-5.1, -20.2), -20.2); chest.rotation.y = 0.2; scene.add(chest);
    const chestWood = mat('#986b45');
    mesh(cube, chestWood, chest, [0, 0.48, 0], [1.65, 0.9, 1.2]);
    for (const side of [-1, 1]) mesh(cube, gold, chest, [side * 0.59, 0.47, 0], [0.18, 0.96, 1.26]);
    mesh(cube, gold, chest, [0, 0.7, 0.64], [0.27, 0.3, 0.07]);
    const chestLid = new THREE.Group(); chestLid.position.set(0, 0.93, -0.62); chest.add(chestLid);
    mesh(cube, chestWood, chestLid, [0, 0.16, 0.62], [1.73, 0.34, 1.27]);
    for (const side of [-1, 1]) mesh(cube, gold, chestLid, [side * 0.59, 0.17, 0.62], [0.18, 0.38, 1.33]);
    const chestGlow = mesh(keep(new THREE.OctahedronGeometry(0.45, 0)), glowing, chest, [0, 1.25, 0]);
    let chestOpenness = propsRef.current.treasureOpened ? 1 : 0;

    const waypoint = mesh(keep(new THREE.TorusGeometry(0.55, 0.035, 4, 32)), basic('#fff5c9', { transparent: true, opacity: 0.9, depthWrite: false }), scene, [0, 0, 0], [1, 1, 1], false);
    waypoint.rotation.x = -Math.PI / 2; waypoint.visible = false;
    const regionalScenery=createRegionScenery(region);scene.add(regionalScenery.group);
    const requestedSpawn=propsRef.current.spawnPoint;
    const player: WorldPoint = requestedSpawn && isWalkable(requestedSpawn.x,requestedSpawn.z) ? {...requestedSpawn} : { ...SPAWN_POSITION };
    const heroAnchor = new THREE.Group(); scene.add(heroAnchor);
    const hero = createHero(); heroAnchor.add(hero.group);
    const companionAnchor = new THREE.Group(); scene.add(companionAnchor);
    const follower: WorldPoint = { x: player.x + 1.3, z: player.z + 1.8 };
    let companion: ReturnType<typeof createPet> | null = null;
    type FlightPhase = 'ground' | 'takeoff' | 'cruise' | 'landing';
    let flightPhase: FlightPhase = 'ground';
    let airPosition: FlightPosition = { ...player, y: getTerrainHeight(player.x, player.z) };
    let takeoffHeight = 0, mountScale = 1, desiredMountScale = 1.6;
    let landingSpot: WorldPoint | null = null, landingDescending = false, pendingCompanion = false;
    let requestLanding = () => {};
    let followerHeading = 0, followerPath: WorldPoint[] = [], lastFollowerRepath = 0;
    const heroTrail: WorldPoint[] = [{ ...player }];
    const installCompanion = () => {
      // Keep the existing mount until its rider has reached safe ground, including storage updates.
      if (flightPhase !== 'ground') { pendingCompanion = true; requestLanding(); return; }
      if (companion) { companionAnchor.remove(companion.group); companion.dispose(); }
      const id = propsRef.current.companionId === undefined ? 'ember' : propsRef.current.companionId;
      companion = id ? createPet(id, id === 'ember' ? (Math.max(1, propsRef.current.stage) as 1 | 2 | 3) : 1) : null;
      companionAnchor.visible = !!companion;
      if (companion) companionAnchor.add(companion.group);
      followerPath = [];
    };
    replaceCompanionRef.current = installCompanion; installCompanion();
    const wildPosition = { x: -10.8, z: -21.7 };
    const wildAnchor = new THREE.Group(); wildAnchor.position.set(wildPosition.x, getTerrainHeight(wildPosition.x, wildPosition.z), wildPosition.z); scene.add(wildAnchor);
    wildAnchor.rotation.y = Math.PI;
    let wildPet: ReturnType<typeof createPet> | null = null;
    let currentlyNearWild = false, lastCaptureRequest = -Infinity;
    let currentlyNearTemple = false, lastTempleRequest = -Infinity;
    enterTempleRef.current=()=>{
      const now=performance.now();
      if(propsRef.current.paused||flightPhase!=='ground'||!currentlyNearTemple||now-lastTempleRequest<500)return;
      lastTempleRequest=now;propsRef.current.onEnterTemple?.();
    };
    const wildHalo = mesh(keep(new THREE.TorusGeometry(1.1, .04, 5, 48)), basic(theme.glow, { transparent:true,opacity:.75,depthWrite:false }), wildAnchor, [0,.1,0], [1,1,1], false); wildHalo.rotation.x = -Math.PI / 2;
    const wildMark = mesh(keep(new THREE.OctahedronGeometry(.16, 0)), glowing, wildAnchor, [0,2.6,0]);
    const installWildPet = () => {
      if(wildPet){wildAnchor.remove(wildPet.group);wildPet.dispose();}
      wildPet = propsRef.current.wildPetId ? createPet(propsRef.current.wildPetId, 1) : null;
      if(wildPet)wildAnchor.add(wildPet.group);
      wildAnchor.visible=!!wildPet;
      if(currentlyNearWild){currentlyNearWild=false;setNearWild(false);propsRef.current.onNearWild?.(false);}
    };
    replaceWildRef.current=installWildPet;installWildPet();propsRef.current.onNearWild?.(false);
    captureRef.current = () => {
      const now=performance.now();
      if(propsRef.current.paused||flightPhase!=='ground'||!wildPet||!currentlyNearWild||!propsRef.current.canCapture||now-lastCaptureRequest<450)return;
      lastCaptureRequest=now;propsRef.current.onCaptureRequest?.();
    };
    const arrivalYaw={meadow:.55,water:-.65,fire:.6,earth:.55,steel:.5,fairy:.5}[region];
    let heading = 0, yaw = requestedSpawn ? -.08 : arrivalYaw, pitch = 0.22, cameraDistance = 14;
    let jumpHeight = 0, verticalVelocity = 0, excitementStarted = -100;
    let navigation: WorldPoint[] = [];
    let navigationZone: WorldZone | null = null;
    const keys = new Set<string>();
    const jump = () => { if (!propsRef.current.paused && flightPhase === 'ground' && jumpHeight <= 0.001) verticalVelocity = 6.8; };
    jumpRef.current = jump;
    excitementRef.current = () => { if(companion && flightPhase === 'ground')excitementStarted = elapsed; };
    navigateRef.current = (zone, point) => {
      if (propsRef.current.paused || flightPhase !== 'ground') return;
      const destination=point??(zone?WORLD_ZONES[zone]:null);if(!destination)return;
      canvas.focus({ preventScroll: true });
      navigation = getNavigationPath(player, destination); navigationZone = point?null:zone;
      setMovingTo(navigation.length > 0); waypoint.visible = navigation.length > 0;
      waypoint.position.set(destination.x, getTerrainHeight(destination.x, destination.z) + 0.12, destination.z);
    };
    if(propsRef.current.travelPoint||propsRef.current.travelTarget)navigateRef.current(propsRef.current.travelTarget??null,propsRef.current.travelPoint);

    // Bird silhouettes and butterfly wings add small, quiet movement to the vista.
    const birdGeometry = keep(new THREE.BufferGeometry());
    birdGeometry.setAttribute('position', new THREE.Float32BufferAttribute([-0.7,0.16,0,0,0,0,-0.16,0.04,0.12,0.7,0.16,0,0.16,0.04,0.12,0,0,0],3)); birdGeometry.computeVertexNormals();
    const birdMaterial = basic('#4b6e73', { side: THREE.DoubleSide });
    const birds: THREE.Mesh[] = [];
    for (let i = 0; i < 9; i++) birds.push(mesh(birdGeometry, birdMaterial, scene, [0, 0, 0], [1, 1, 1], false));
    const butterflyMaterial = basic(theme.flowers[0], { side: THREE.DoubleSide });
    const butterflyGeometry = keep(new THREE.CircleGeometry(0.105, 6));
    const butterflies: { group: THREE.Group; wings: THREE.Mesh[]; x: number; z: number }[] = [];
    for (let i = 0; i < 13; i++) {
      const group = new THREE.Group(); scene.add(group);
      const wings = [-1,1].map((side) => mesh(butterflyGeometry, butterflyMaterial, group, [side * 0.08, 0, 0], [1, 1.55, 1], false));
      butterflies.push({ group, wings, x: -7 + random() * 20, z: 10 + random() * 22 });
    }

    const dustGeometry = keep(new THREE.BufferGeometry());
    const dustPositions = new Float32Array(70 * 3);
    for (let i = 0; i < 70; i++) { dustPositions[i*3] = (random()-.5)*24; dustPositions[i*3+1] = random()*6; dustPositions[i*3+2] = (random()-.5)*24; }
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustMaterial = new THREE.PointsMaterial({ color:theme.dust,size:region==='fairy'||region==='fire'?0.095:0.045,transparent:true,opacity:0.75,depthWrite:false,blending:region==='fairy'||region==='fire'?THREE.AdditiveBlending:THREE.NormalBlending }); materialResources.push(dustMaterial);
    const dust = new THREE.Points(dustGeometry, dustMaterial); scene.add(dust);
    const dustOriginals = dustPositions.slice();

    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
    let dragging = false, pointerId = -1, startX = 0, startY = 0, lastX = 0, lastY = 0, dragged = false;
    const stopNavigation = () => { navigation = []; navigationZone = null; setMovingTo(false); waypoint.visible = false; };
    let lastFlightReportTime = 0, lastFlightStatus: FlightStatus | null = null;
    const publishFlightState = (force = false) => {
      const now = performance.now() / 1000;
      if (!force && now - lastFlightReportTime < .1) return;
      const status = { flying: flightPhase !== 'ground', landing: flightPhase === 'landing', altitude: flightPhase === 'ground' ? 0 : Math.max(0, airPosition.y - getTerrainHeight(player.x, player.z)) };
      lastFlightReportTime = now;
      if (force || !lastFlightStatus || status.flying !== lastFlightStatus.flying || status.landing !== lastFlightStatus.landing || Math.abs(status.altitude - lastFlightStatus.altitude) > .03) {
        propsRef.current.onFlightState?.(status);
        setFlightControls(previous => previous.flying === status.flying && previous.landing === status.landing ? previous : { flying: status.flying, landing: status.landing });
        lastFlightStatus = status;
      }
    };
    requestLanding = () => {
      if (flightPhase === 'ground' || flightPhase === 'landing') return;
      landingSpot = findLandingSpot(player); landingDescending = false; flightPhase = 'landing';
      keys.clear(); flightHoldRef.current = { rise: false, descend: false };
      joystickRef.current = { x: 0, y: 0 }; setStick({ x: 0, y: 0 });
      propsRef.current.onFlightMessage?.('正在寻找开阔陆地，准备安全降落');
      publishFlightState(true);
    };
    const finishLanding = () => {
      flightPhase = 'ground'; landingSpot = null; landingDescending = false;
      jumpHeight = 0; verticalVelocity = 0; mountScale = 1;
      hero.setRiding?.(false); companion?.setFlying?.(false); companionAnchor.scale.setScalar(1);
      follower.x = player.x; follower.z = player.z; followerHeading = heading; followerPath = [];
      heroTrail.splice(0, heroTrail.length, { ...player });
      keys.clear(); flightHoldRef.current = { rise: false, descend: false };
      joystickRef.current = { x: 0, y: 0 }; setStick({ x: 0, y: 0 });
      if (pendingCompanion) { pendingCompanion = false; installCompanion(); }
      propsRef.current.onFlightMessage?.('已安全降落，继续一起探索吧'); publishFlightState(true);
    };
    toggleFlightRef.current = () => {
      if (propsRef.current.paused) return;
      if (flightPhase !== 'ground') { requestLanding(); return; }
      const id = propsRef.current.companionId === undefined ? 'ember' : propsRef.current.companionId;
      if (!companion || !canPetFly(id, propsRef.current.stage)) {
        propsRef.current.onFlightMessage?.('让星翼烁牙或绮露随行，就能骑乘飞行'); return;
      }
      const clearLaunch = findLandingSpot(player);
      if (Math.hypot(clearLaunch.x - player.x, clearLaunch.z - player.z) > .3) {
        propsRef.current.onFlightMessage?.('这里不够开阔，请到平坦的空地再起飞'); return;
      }
      stopNavigation(); keys.clear(); flightHoldRef.current = { rise: false, descend: false };
      joystickRef.current = { x: 0, y: 0 }; setStick({ x: 0, y: 0 });
      airPosition = { ...player, y: getTerrainHeight(player.x, player.z) + jumpHeight };
      takeoffHeight = Math.min(FLIGHT_CEILING, getFlightFloor(player.x, player.z) + 4);
      desiredMountScale = id === 'lumi' ? 1.75 : 1.6;
      flightPhase = 'takeoff'; jumpHeight = 0; verticalVelocity = 0; followerPath = [];
      hero.setRiding?.(true); companion.setFlying?.(true);
      if (currentlyNearWild) { currentlyNearWild = false; setNearWild(false); propsRef.current.onNearWild?.(false); }
      if (currentlyNearTemple) { currentlyNearTemple = false; setNearTemple(false); propsRef.current.onNearTemple?.(false); }
      canvas.focus({ preventScroll: true });
      propsRef.current.onFlightMessage?.('一起飞上天空！空格上升，Shift 下降，F 安全降落'); publishFlightState(true);
    };
    publishFlightState(true);
    const pointerDown = (event: PointerEvent) => {
      if (propsRef.current.paused || event.button !== 0) return;
      canvas.focus({ preventScroll: true }); dragging = true; pointerId = event.pointerId; startX = lastX = event.clientX; startY = lastY = event.clientY; dragged = false; canvas.setPointerCapture(pointerId); canvas.style.cursor = 'grabbing';
    };
    const pointerMove = (event: PointerEvent) => {
      if (!dragging || event.pointerId !== pointerId || propsRef.current.paused) return;
      yaw -= (event.clientX - lastX) * 0.005; pitch = THREE.MathUtils.clamp(pitch + (event.clientY - lastY) * 0.0035, 0.12, 0.69);
      lastX = event.clientX; lastY = event.clientY; dragged ||= Math.hypot(event.clientX-startX,event.clientY-startY) > 6;
    };
    const pointerUp = (event: PointerEvent) => {
      if (!dragging || event.pointerId !== pointerId) return;
      dragging = false; canvas.style.cursor = 'grab'; if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
      if (dragged || propsRef.current.paused || flightPhase !== 'ground') return;
      const bounds = canvas.getBoundingClientRect(); pointer.set((event.clientX-bounds.left)/bounds.width*2-1,-(event.clientY-bounds.top)/bounds.height*2+1); raycaster.setFromCamera(pointer,camera);
      if (companion && raycaster.intersectObject(companionAnchor,true).length) { excitementRef.current?.(); propsRef.current.onPetInteract(); return; }
      if(wildPet&&raycaster.intersectObject(wildAnchor,true).length){
        if(currentlyNearWild&&propsRef.current.canCapture)captureRef.current?.();
        else{navigation=getNavigationPath(player,wildPosition);navigationZone='ruins';setMovingTo(navigation.length>0);waypoint.visible=navigation.length>0;waypoint.position.set(wildPosition.x,getTerrainHeight(wildPosition.x,wildPosition.z)+.12,wildPosition.z);}
        return;
      }
      if(raycaster.intersectObject(heroAnchor,true).length){jump();return;}
      const hit = raycaster.intersectObject(terrain)[0];
      if (hit && isWalkable(hit.point.x,hit.point.z)) {
        navigation = getNavigationPath(player,{x:hit.point.x,z:hit.point.z}); navigationZone = null; setMovingTo(navigation.length > 0);
        waypoint.visible = navigation.length > 0; waypoint.position.copy(hit.point).add(new THREE.Vector3(0,.11,0));
      }
    };
    const pointerCancel = () => { dragging = false; canvas.style.cursor='grab'; };
    const wheel = (event: WheelEvent) => { if (propsRef.current.paused) return; event.preventDefault(); cameraDistance=THREE.MathUtils.clamp(cameraDistance+event.deltaY*.008,5.7,14.5); };
    const isEditable = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || !!target.closest('input,textarea,select,[contenteditable="true"]'));
    const keyDown = (event: KeyboardEvent) => {
      if (propsRef.current.paused || isEditable(event.target)) return;
      if (event.code === 'KeyF') { event.preventDefault(); if (!event.repeat) toggleFlightRef.current?.(); return; }
      if(event.code==='KeyE'&&!event.repeat){event.preventDefault();if(currentlyNearWild&&propsRef.current.canCapture)captureRef.current?.();else enterTempleRef.current?.();return;}
      if (event.code === 'Space' && event.target instanceof HTMLElement && event.target.closest('button,a')) return;
      if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space', ...(flightPhase !== 'ground' ? ['ShiftLeft','ShiftRight','ControlLeft','ControlRight'] : [])].includes(event.code)) {
        event.preventDefault(); keys.add(event.code); if (event.code==='Space' && !event.repeat) jump(); else if(event.code!=='Space') stopNavigation();
      }
    };
    const keyUp = (event: KeyboardEvent) => { keys.delete(event.code); };
    const blur = () => { keys.clear(); joystickRef.current={x:0,y:0}; flightHoldRef.current={rise:false,descend:false}; setStick({x:0,y:0}); dragging=false; canvas.style.cursor='grab'; };
    const visibilityChange = () => { if (document.hidden) blur(); };
    canvas.addEventListener('pointerdown',pointerDown); canvas.addEventListener('pointermove',pointerMove); canvas.addEventListener('pointerup',pointerUp); canvas.addEventListener('pointercancel',pointerCancel); canvas.addEventListener('wheel',wheel,{passive:false});
    window.addEventListener('keydown',keyDown); window.addEventListener('keyup',keyUp); window.addEventListener('blur',blur);
    document.addEventListener('visibilitychange',visibilityChange);
    const resize = () => { const width=mount.clientWidth,height=mount.clientHeight; if(!width||!height)return; renderer.setSize(width,height,false); camera.aspect=width/height; camera.updateProjectionMatrix(); };
    const observer = new ResizeObserver(resize); observer.observe(mount); resize();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0, previousTime=performance.now()/1000,lastPositionTime=0,lastShadowTime=0, elapsed=0;
    let lastZone: WorldZone | null = null, lastReported: {x:number;z:number;heading:number}|null=null;
    let wasPaused=propsRef.current.paused;
    const desiredCamera=new THREE.Vector3(),lookTarget=new THREE.Vector3(),cameraDirection=new THREE.Vector3(),crownOffset=new THREE.Vector3();
    const seatPosition=new THREE.Vector3(),riderHipPosition=new THREE.Vector3(),fallbackSeat=new THREE.Vector3(0,1.1,.2),fallbackHip=new THREE.Vector3(0,1.1,0);
    const cameraCrowns=WORLD_TREES.map(tree=>({center:new THREE.Vector3(tree.x,getTerrainHeight(tree.x,tree.z)+tree.size*4.5,tree.z),radius:tree.size*(tree.variant===0?1.65:2.3)}));
    const cameraBuildings=REGION_VOLUMES[region].map(volume=>new THREE.Box3(new THREE.Vector3(volume.x-volume.halfX-.15,getTerrainHeight(volume.x,volume.z)+(volume.minY??0),volume.z-volume.halfZ-.15),new THREE.Vector3(volume.x+volume.halfX+.15,getTerrainHeight(volume.x,volume.z)+volume.height,volume.z+volume.halfZ+.15)));
    const cameraRay=new THREE.Ray(),cameraHit=new THREE.Vector3();
    heroAnchor.position.set(player.x,getTerrainHeight(player.x,player.z),player.z);
    companionAnchor.position.set(follower.x,getTerrainHeight(follower.x,follower.z),follower.z);
    camera.position.set(player.x+Math.sin(yaw)*14,heroAnchor.position.y+4.86,player.z+Math.cos(yaw)*14);
    const animate = () => {
      frame=requestAnimationFrame(animate);
      const now=performance.now()/1000,delta=Math.min(.045,Math.max(0,now-previousTime)); previousTime=now;
      const paused=propsRef.current.paused;
      if(paused&&!wasPaused)blur(); wasPaused=paused;
      if(!paused)elapsed+=delta;
      const visualTime=reducedMotion?0:elapsed; wind.value=visualTime;
      let dx=0,dz=0, movingSpeed=0;
      if(!paused) {
        let horizontal=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+joystickRef.current.x;
        let vertical=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0)+joystickRef.current.y;
        const magnitude=Math.hypot(horizontal,vertical);
        if(magnitude>.05 && flightPhase !== 'landing' && flightPhase !== 'takeoff') {
          stopNavigation(); horizontal/=Math.max(1,magnitude); vertical/=Math.max(1,magnitude);
          dx=horizontal*Math.cos(yaw)+vertical*Math.sin(yaw); dz=-horizontal*Math.sin(yaw)+vertical*Math.cos(yaw);
        } else if(navigation.length && flightPhase === 'ground') {
          const target=navigation[0],distance=Math.hypot(target.x-player.x,target.z-player.z);
          if(distance<.48) { navigation.shift(); if(!navigation.length){setMovingTo(false);waypoint.visible=false;if(navigationZone)propsRef.current.onExplore(navigationZone);navigationZone=null;} }
          else { dx=(target.x-player.x)/distance;dz=(target.z-player.z)/distance;if(!dragging)yaw=lerpAngle(yaw,Math.atan2(-dx,-dz),1-Math.exp(-delta*1.4)); }
        }
        if(flightPhase === 'takeoff') {
          const remaining = takeoffHeight - airPosition.y;
          airPosition.y = Math.min(takeoffHeight, airPosition.y + Math.max(1.2, Math.min(8, remaining * 2.2)) * delta);
          if (takeoffHeight - airPosition.y < .015) { airPosition.y = takeoffHeight; flightPhase = 'cruise'; }
        } else if(flightPhase === 'cruise') {
          const ascent = (keys.has('Space') || flightHoldRef.current.rise ? 1 : 0) - (keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('ControlLeft') || keys.has('ControlRight') || flightHoldRef.current.descend ? 1 : 0);
          const next = moveFlight(airPosition, { x: dx, z: dz }, ascent, delta);
          movingSpeed = Math.min(1, Math.hypot(next.x - player.x, next.z - player.z) / (FLIGHT_SPEED * delta || 1));
          airPosition = next; player.x = next.x; player.z = next.z;
          if (Math.hypot(dx, dz) > .01) heading = lerpAngle(heading, Math.atan2(-dx, -dz), 1 - Math.exp(-delta * 4));
        } else if(flightPhase === 'landing' && landingSpot) {
          const distance = Math.hypot(landingSpot.x - player.x, landingSpot.z - player.z);
          if (!landingDescending && distance > .025) {
            // Gain safe clearance first if landing was requested halfway through takeoff.
            const safeHeight = getFlightFloor(player.x, player.z) + 1;
            if (airPosition.y < safeHeight - .03) airPosition.y = Math.min(safeHeight, airPosition.y + 8 * delta);
            else {
              const speed = Math.min(8, distance / Math.max(delta, .001));
              const direction = { x: (landingSpot.x - player.x) / distance * speed / FLIGHT_SPEED, z: (landingSpot.z - player.z) / distance * speed / FLIGHT_SPEED };
              airPosition = moveFlight(airPosition, direction, 0, delta);
              player.x = airPosition.x; player.z = airPosition.z; movingSpeed = speed / FLIGHT_SPEED;
              heading = lerpAngle(heading, Math.atan2(-direction.x, -direction.z), 1 - Math.exp(-delta * 4));
            }
          } else {
            landingDescending = true; player.x = landingSpot.x; player.z = landingSpot.z;
            airPosition.x = player.x; airPosition.z = player.z;
            const landingHeight = getTerrainHeight(player.x, player.z);
            airPosition.y = Math.max(landingHeight, airPosition.y - Math.max(1.25, Math.min(7, (airPosition.y - landingHeight) * 2)) * delta);
            if (airPosition.y <= landingHeight + .015) finishLanding();
          }
        } else if(Math.hypot(dx,dz)>.01) {
          const next=resolveMovement(player,{x:player.x+dx*6.4*delta,z:player.z+dz*6.4*delta});
          movingSpeed=Math.min(1,Math.hypot(next.x-player.x,next.z-player.z)/(delta*6.4||1));
          player.x=next.x;player.z=next.z; heading=lerpAngle(heading,Math.atan2(-dx,-dz),1-Math.exp(-delta*10));
        }
        if(flightPhase === 'ground') {
          if(jumpHeight>0||verticalVelocity>0){verticalVelocity-=17*delta;jumpHeight=Math.max(0,jumpHeight+verticalVelocity*delta);if(jumpHeight===0)verticalVelocity=0;}
          crystals.forEach((crystal,id)=>{
            if(!collectedRef.current.has(id)&&Math.hypot(player.x-CRYSTAL_POSITIONS[id].x,player.z-CRYSTAL_POSITIONS[id].z)<3.5){collectedRef.current.add(id);crystal.visible=false;propsRef.current.onCollectCrystal(id);}
          });
          const trailTail=heroTrail[heroTrail.length-1];
          if(Math.hypot(player.x-trailTail.x,player.z-trailTail.z)>.3){heroTrail.push({...player});if(heroTrail.length>100)heroTrail.shift();}
        }
        let nearestZone:WorldZone|null=null;
        for(const zone of ['ruins','grove','shore'] as WorldZone[])if(Math.hypot(player.x-WORLD_ZONES[zone].x,player.z-WORLD_ZONES[zone].z)<8)nearestZone=zone;
        if(nearestZone&&nearestZone!==lastZone)propsRef.current.onExplore(nearestZone);lastZone=nearestZone;
        const near=flightPhase === 'ground'&&!!wildPet&&Math.hypot(player.x-wildPosition.x,player.z-wildPosition.z)<5;
        if(near!==currentlyNearWild){currentlyNearWild=near;setNearWild(near);propsRef.current.onNearWild?.(near);}
        const templeNear=flightPhase==='ground'&&Math.hypot(player.x-TEMPLE_ENTRANCE.x,player.z-TEMPLE_ENTRANCE.z)<5;
        if(templeNear!==currentlyNearTemple){currentlyNearTemple=templeNear;setNearTemple(templeNear);propsRef.current.onNearTemple?.(templeNear);}
      }
      const ground=getTerrainHeight(player.x,player.z);
      const airborne=flightPhase !== 'ground';
      const excitementAge=elapsed-excitementStarted;
      heroAnchor.position.set(player.x,ground+jumpHeight,player.z);
      heroAnchor.rotation.y=heading;
      hero.animate(visualTime,airborne?0:movingSpeed,airborne?0:jumpHeight/1.5);
      let followerSpeed=0;
      if(companion&&!paused&&!airborne){
        let behind:WorldPoint={x:player.x+Math.sin(heading)*1.8,z:player.z+Math.cos(heading)*1.8};
        let remaining=1.8,previous:WorldPoint=player;
        for(let i=heroTrail.length-1;i>=0;i--){const point=heroTrail[i],distance=Math.hypot(point.x-previous.x,point.z-previous.z);if(distance>=remaining&&distance>.001){behind={x:previous.x+(point.x-previous.x)*remaining/distance,z:previous.z+(point.z-previous.z)*remaining/distance};break;}remaining-=distance;previous=point;}
        const side={x:behind.x+Math.cos(heading)*1.05,z:behind.z-Math.sin(heading)*1.05};
        const goal=isWalkable(side.x,side.z)?side:isWalkable(behind.x,behind.z)?behind:{...player};
        if(followerPath.length&&Math.hypot(follower.x-followerPath[0].x,follower.z-followerPath[0].z)<.38)followerPath.shift();
        const target=followerPath[0]??goal;
        const distance=Math.hypot(target.x-follower.x,target.z-follower.z);
        if(distance>.12){
          const step=Math.min(distance,delta*(movingSpeed>.1?8.0:4.8));
          const next=resolveMovement(follower,{x:follower.x+(target.x-follower.x)/distance*step,z:follower.z+(target.z-follower.z)/distance*step});
          const covered=Math.hypot(next.x-follower.x,next.z-follower.z);
          if(covered>.002)followerHeading=lerpAngle(followerHeading,Math.atan2(follower.x-next.x,follower.z-next.z),1-Math.exp(-delta*8));
          followerSpeed=Math.min(1,covered/(delta*7||1));follower.x=next.x;follower.z=next.z;
          if(covered<step*.25&&now-lastFollowerRepath>.7){followerPath=getNavigationPath(follower,goal);lastFollowerRepath=now;}
        } else followerHeading=lerpAngle(followerHeading,heading,1-Math.exp(-delta*2.5));
        if(Math.hypot(player.x-follower.x,player.z-follower.z)>17&&isWalkable(behind.x,behind.z)){follower.x=behind.x;follower.z=behind.z;followerPath=[];}
      }
      const petBounce=!reducedMotion&&excitementAge>=0&&excitementAge<1.1?Math.sin(excitementAge/1.1*Math.PI)*.72:0;
      if (airborne && companion) {
        if (!paused) mountScale = THREE.MathUtils.lerp(mountScale, desiredMountScale, 1 - Math.exp(-delta * 6));
        companionAnchor.scale.setScalar(mountScale);
        companionAnchor.position.set(player.x,airPosition.y,player.z); companionAnchor.rotation.y=heading;
        companion.animate(visualTime,movingSpeed,0);
        // Animated local anchors keep the rider seated through every wingbeat and turn.
        companion.group.updateWorldMatrix(true,false);
        companion.group.localToWorld(seatPosition.copy(companion.rideSeat ?? fallbackSeat));
        hero.group.updateWorldMatrix(true,false);
        hero.group.localToWorld(riderHipPosition.copy(hero.riderHip ?? fallbackHip));
        heroAnchor.position.add(seatPosition.sub(riderHipPosition));
      } else {
        companionAnchor.position.set(follower.x,getTerrainHeight(follower.x,follower.z)+petBounce,follower.z);
        companionAnchor.rotation.y=followerHeading+(!reducedMotion&&excitementAge>=0&&excitementAge<1.1?excitementAge/1.1*Math.PI*2:0);
        companion?.animate(visualTime,followerSpeed,petBounce);
      }
      if(wildPet){wildPet.animate(visualTime,0,0);if(!paused&&Math.hypot(player.x-wildPosition.x,player.z-wildPosition.z)<12)wildAnchor.rotation.y=lerpAngle(wildAnchor.rotation.y,Math.atan2(wildPosition.x-player.x,wildPosition.z-player.z),1-Math.exp(-delta*2));wildMark.position.y=2.6+Math.sin(visualTime*1.4)*.16;wildMark.rotation.y=visualTime*.6;wildHalo.scale.setScalar(1+Math.sin(visualTime*1.8)*.05);}
      const viewDistance=cameraDistance+(airborne?3:0), viewHeight=airborne?airPosition.y:ground;
      const heightOffset=viewDistance*Math.sin(pitch)+(airborne?2.8:1.8);
      desiredCamera.set(player.x+Math.sin(yaw)*viewDistance,viewHeight+heightOffset,player.z+Math.cos(yaw)*viewDistance);
      desiredCamera.y=Math.max(desiredCamera.y,getTerrainHeight(desiredCamera.x,desiredCamera.z)+1.5);
      lookTarget.set(player.x,viewHeight+(airborne?3.1:2.5),player.z);
      // Pull forward gently if a tree crown would sit between the pet and camera.
      cameraDirection.copy(desiredCamera).sub(lookTarget);const requestedDistance=cameraDirection.length();cameraDirection.normalize();let clearDistance=requestedDistance;
      for(const crown of cameraCrowns){
        if(Math.hypot(crown.center.x-player.x,crown.center.z-player.z)>requestedDistance+crown.radius)continue;
        crownOffset.copy(crown.center).sub(lookTarget);const projection=crownOffset.dot(cameraDirection);
        if(projection<1.5||projection>clearDistance+crown.radius)continue;
        const perpendicularSquared=crownOffset.lengthSq()-projection*projection, radius=crown.radius+.28;
        if(perpendicularSquared<radius*radius){const entry=projection-Math.sqrt(radius*radius-perpendicularSquared);if(entry>2.6)clearDistance=Math.min(clearDistance,Math.max(3.0,entry-.5));}
      }
      cameraRay.set(lookTarget,cameraDirection);
      for(const building of cameraBuildings){if(cameraRay.intersectBox(building,cameraHit)){const entry=cameraHit.distanceTo(lookTarget);if(entry>.2&&entry<clearDistance)clearDistance=Math.max(.35,entry-.25);}}
      if(clearDistance<requestedDistance)desiredCamera.copy(lookTarget).addScaledVector(cameraDirection,clearDistance);
      desiredCamera.y=Math.max(desiredCamera.y,getTerrainHeight(desiredCamera.x,desiredCamera.z)+1.3);
      // Lift the camera above intervening ridges rather than looking through terrain.
      for(let i=1;i<8;i++){const f=i/8;const x=THREE.MathUtils.lerp(player.x,desiredCamera.x,f),z=THREE.MathUtils.lerp(player.z,desiredCamera.z,f);const lineY=THREE.MathUtils.lerp(lookTarget.y,desiredCamera.y,f);desiredCamera.y+=Math.max(0,getTerrainHeight(x,z)+.65-lineY)/Math.max(f,.2);}
      if (!paused) { camera.position.lerp(desiredCamera,1-Math.exp(-delta*7)); camera.lookAt(lookTarget); }
      crystals.forEach((crystal,id)=>{crystal.visible=!collectedRef.current.has(id);crystal.position.y=getTerrainHeight(CRYSTAL_POSITIONS[id].x,CRYSTAL_POSITIONS[id].z)+1.9+Math.sin(visualTime*1.6+id)*.22;crystal.rotation.y=visualTime*.65;});
      waterMaterial.uniforms.time.value=visualTime;
      regionAnimations.forEach(({object,axis,speed})=>{object.rotation[axis]=visualTime*speed;});
      regionalScenery.update(visualTime,propsRef.current.templeVisited);
      portalRing.rotation.z=visualTime*.055;swirl.rotation.z=-visualTime*.13;veil.scale.setScalar(1+Math.sin(visualTime*.8)*.015);
      chestOpenness=THREE.MathUtils.lerp(chestOpenness,propsRef.current.treasureOpened?1:0,1-Math.exp(-delta*8));chestLid.rotation.x=-chestOpenness*1.3;chestGlow.visible=chestOpenness>.2;chestGlow.rotation.y=visualTime*.8;
      waypoint.scale.setScalar(1+Math.sin(visualTime*3)*.1);
      birds.forEach((bird,i)=>{const angle=visualTime*.08+i*.7;bird.position.set(Math.cos(angle)*24-4,19+Math.sin(angle*.6+i)*3,-33+Math.sin(angle)*13);bird.rotation.set(Math.sin(visualTime*2+i)*.15,-angle,Math.sin(visualTime*3+i)*.12);bird.scale.y=.65+Math.sin(visualTime*5+i)*.3;});
      butterflies.forEach((butterfly,i)=>{const x=butterfly.x+Math.sin(visualTime*.4+i)*1.5,z=butterfly.z+Math.cos(visualTime*.5+i)*1.4;butterfly.group.position.set(x,getTerrainHeight(x,z)+1.2+Math.sin(visualTime*.9+i)*.45,z);butterfly.group.rotation.y=visualTime*.4+i;butterfly.wings.forEach((wing,side)=>{wing.rotation.y=(side?1:-1)*(.4+Math.sin(visualTime*11+i)*.6);});});
      dust.position.set(player.x,viewHeight,player.z);dust.rotation.y=visualTime*.015;
      if(region==='fire'||region==='fairy'){for(let i=0;i<70;i++)dustPositions[i*3+1]=region==='fire'?(dustOriginals[i*3+1]+visualTime*.8)%6:dustOriginals[i*3+1]+Math.sin(visualTime*1.2+i)*.3;dustGeometry.attributes.position.needsUpdate=true;}
      if(now-lastPositionTime>.125){lastPositionTime=now;const current={x:player.x,z:player.z,heading};if(!lastReported||Math.hypot(current.x-lastReported.x,current.z-lastReported.z)>.07||Math.abs(current.heading-lastReported.heading)>.06){propsRef.current.onPosition?.(current);lastReported=current;}}
      publishFlightState();
      if(now-lastShadowTime>.4){lastShadowTime=now;sunlight.position.set(player.x-32,61,player.z+25);sunlight.target.position.set(player.x,0,player.z);}
      renderer.render(scene,camera);
    };
    animate();
    return () => {
      if(currentlyNearWild)propsRef.current.onNearWild?.(false);
      if(currentlyNearTemple)propsRef.current.onNearTemple?.(false);
      propsRef.current.onFlightState?.({flying:false,landing:false,altitude:0});
      flightHoldRef.current={rise:false,descend:false};joystickRef.current={x:0,y:0};
      cancelAnimationFrame(frame);observer.disconnect();replaceCompanionRef.current=null;replaceWildRef.current=null;captureRef.current=null;enterTempleRef.current=null;navigateRef.current=null;excitementRef.current=null;jumpRef.current=null;toggleFlightRef.current=null;
      canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointermove',pointerMove);canvas.removeEventListener('pointerup',pointerUp);canvas.removeEventListener('pointercancel',pointerCancel);canvas.removeEventListener('wheel',wheel);
      window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);window.removeEventListener('blur',blur);
      document.removeEventListener('visibilitychange',visibilityChange);
      hero.dispose();companion?.dispose();wildPet?.dispose();regionalScenery.dispose();geometryResources.forEach((geometry)=>geometry.dispose());materialResources.forEach((material)=>material.dispose());textures.forEach((texture)=>texture.dispose());sunlight.shadow.map?.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();
    };
  }, []);

  const moveJoystick = (event: React.PointerEvent<HTMLDivElement>) => {
    if(props.paused)return;
    if(event.type==='pointerdown'){event.currentTarget.setPointerCapture(event.pointerId);}
    if(event.type==='pointermove'&&!event.currentTarget.hasPointerCapture(event.pointerId))return;
    const bounds=event.currentTarget.getBoundingClientRect();const dx=event.clientX-bounds.left-bounds.width/2,dy=event.clientY-bounds.top-bounds.height/2;const limit=34;const length=Math.hypot(dx,dy);const factor=length>limit?limit/length:1;
    const value={x:dx*factor/limit,y:dy*factor/limit};joystickRef.current=value;setStick(value);
  };
  const releaseJoystick = (event: React.PointerEvent<HTMLDivElement>) => { if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);joystickRef.current={x:0,y:0};setStick({x:0,y:0}); };
  const holdFlight = (event: React.PointerEvent<HTMLButtonElement>, direction: 'rise' | 'descend') => {
    if (props.paused || !flightControls.flying || flightControls.landing) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    flightHoldRef.current[direction] = true;
  };
  const releaseFlight = (direction: 'rise' | 'descend') => { flightHoldRef.current[direction] = false; };
  const flightButtonKey = (event: React.KeyboardEvent<HTMLButtonElement>, direction: 'rise' | 'descend', pressed: boolean) => {
    if (event.code !== 'Space' && event.code !== 'Enter') return;
    event.preventDefault(); event.stopPropagation();
    flightHoldRef.current[direction] = pressed && !props.paused && flightControls.flying && !flightControls.landing;
  };
  return <div className="world-scene" style={{position:'absolute',inset:0,overflow:'hidden',background:'#b9dce3'}}>
    <div ref={mountRef} style={{width:'100%',height:'100%'}}/>
    {unavailable&&<div className="world-fallback" style={{position:'absolute',inset:0,display:'grid',placeContent:'center',textAlign:'center',padding:30,color:'#294d49'}}><strong>世界正在等你出发</strong><p>当前浏览器无法显示 3D 场景。请开启硬件加速后刷新。<br/>你仍可以使用页面中的打卡与伙伴功能。</p></div>}
    {movingTo&&!props.paused&&<div className="world-auto-walk" style={{position:'absolute',bottom:100,left:'50%',transform:'translateX(-50%)',padding:'8px 14px',borderRadius:20,background:'#163c3988',color:'#fffbe8',fontSize:12,pointerEvents:'none'}}>正在前往 · 移动方向键可取消</div>}
    {nearWild&&props.wildPetId&&!props.paused&&!flightControls.flying&&<div className="wild-bond-prompt">{props.canCapture?<button className="wild-bond-button" onClick={()=>captureRef.current?.()}><span>与伙伴建立羁绊</span><kbd>E</kbd></button>:<span>收集三枚符印后，可以与这里的伙伴建立羁绊</span>}</div>}
    {nearTemple&&!props.paused&&!flightControls.flying&&<div className="temple-enter-prompt"><button onClick={()=>enterTempleRef.current?.()}>进入神庙 <kbd>{nearWild&&props.canCapture?'↗':'E'}</kbd></button></div>}
    <div className="world-touch-controls" style={{pointerEvents:props.paused?'none':'auto',opacity:props.paused?0:1}}>
      <div className="world-joystick" aria-label="拖动摇杆移动" onPointerDown={moveJoystick} onPointerMove={moveJoystick} onPointerUp={releaseJoystick} onPointerCancel={releaseJoystick} onLostPointerCapture={releaseJoystick} style={{touchAction:'none'}}><span style={{transform:`translate(${stick.x*30}px,${stick.y*30}px)`}}/></div>
      {!flightControls.flying&&<button className="world-jump" onClick={()=>jumpRef.current?.()} aria-label="跳跃">↑<span>跳跃</span></button>}
      {flightControls.flying&&<div className="mobile-flight-controls" aria-label="飞行高度控制">{(['rise','descend'] as const).map(direction=><button key={direction} className={`flight-${direction}`} disabled={flightControls.landing||props.paused} style={{touchAction:'none'}} aria-label={direction==='rise'?'按住上升':'按住下降'} onPointerDown={event=>holdFlight(event,direction)} onPointerUp={()=>releaseFlight(direction)} onPointerCancel={()=>releaseFlight(direction)} onLostPointerCapture={()=>releaseFlight(direction)} onBlur={()=>releaseFlight(direction)} onKeyDown={event=>flightButtonKey(event,direction,true)} onKeyUp={event=>flightButtonKey(event,direction,false)}><span aria-hidden="true">{direction==='rise'?'↑':'↓'}</span><span>{direction==='rise'?'上升':'下降'}</span></button>)}</div>}
    </div>
    <style>{`.world-touch-controls{display:none;position:absolute;inset:0;pointer-events:none!important}.world-joystick{position:absolute;left:24px;bottom:60px;width:104px;height:104px;border:1px solid #fff8;border-radius:50%;background:#294f4038;backdrop-filter:blur(6px);pointer-events:auto;display:grid;place-items:center}.world-joystick:before{content:'';position:absolute;width:66px;height:66px;border:1px solid #fff3;border-radius:50%}.world-joystick>span{width:43px;height:43px;border:1px solid #fff9;background:#ffffff69;border-radius:50%;box-shadow:0 4px 18px #23442a28}.world-jump{position:absolute;right:27px;bottom:43px;width:68px;height:68px;display:grid;place-content:center;gap:2px;border:1px solid #fff9;border-radius:50%;color:#fff9e1;background:#244f4266;backdrop-filter:blur(6px);font-size:25px;pointer-events:auto}.world-jump>span{font-size:10px}@media(pointer:coarse),(max-width:760px){.world-touch-controls{display:block}}`}</style>
  </div>;
}
