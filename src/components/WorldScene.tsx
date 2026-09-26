import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { SoundCue } from '../audio/types';
import type { PetId, RegionId } from '../game/adventure';
import {
  FLIGHT_CEILING,
  FLIGHT_SPEED,
  canPetFly,
  getFlightFloor as worldFlightFloor,
  findLandingSpot as worldLandingSpot,
  moveFlight as worldMoveFlight,
  type FlightPosition,
  type FlightStatus,
} from '../game/flight';
import { REGION_VOLUMES, TEMPLE_ENTRANCE } from '../game/landmarks';
import {
  CRYSTAL_POSITIONS,
  SPAWN_POSITION,
  WORLD_ZONES,
  getTerrainHeight,
  getWorldTrees,
  isWalkable as worldIsWalkable,
  getNavigationPath as worldNavigationPath,
  resolveMovement as worldResolveMovement,
  type WorldPoint,
  type WorldZone,
} from '../game/world';
import { createHero } from '../rendering/models/hero';
import { createPet } from '../rendering/models/pets';
import type { SceneryFactory } from '../rendering/scenery/types';
import { createCleanupScope } from '../rendering/world/cleanupScope';
import { createWorldEnvironment } from '../rendering/world/createWorldEnvironment';
import { WORLD_THEMES } from '../rendering/world/themes';

export interface WorldSceneProps {
  sceneryFactory: SceneryFactory;
  onReady?: (ready: boolean) => void;
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
  onSound?: (cue: SoundCue) => void;
  onFlightMessage?: (message: string) => void;
  onNearTemple?: (near: boolean) => void;
  onEnterTemple?: () => void;
  templeVisited?: boolean;
  travelPoint?: WorldPoint | null;
  spawnPoint?: WorldPoint;
}

const lerpAngle = (from: number, to: number, amount: number) =>
  from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * amount;

/** A locally generated continuous world. No downloaded textures, models, or services. */
export default function WorldScene(props: WorldSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef(props);
  const replaceCompanionRef = useRef<(() => void) | null>(null);
  const replaceWildRef = useRef<(() => void) | null>(null);
  const captureRef = useRef<(() => void) | null>(null);
  const enterTempleRef = useRef<(() => void) | null>(null);
  const navigateRef = useRef<((zone: WorldZone | null, point?: WorldPoint | null) => void) | null>(
    null,
  );
  const excitementRef = useRef<(() => void) | null>(null);
  const collectedRef = useRef(new Set(props.collectedCrystals));
  const joystickRef = useRef({ x: 0, y: 0 });
  const jumpRef = useRef<(() => void) | null>(null);
  const toggleFlightRef = useRef<(() => void) | null>(null);
  const flightHoldRef = useRef({ rise: false, descend: false });
  const lastFlightRequest = useRef(props.flightRequest ?? 0);
  const lastExcitement = useRef(props.petExcited);
  const [contextLost, setContextLost] = useState(false);
  const [stick, setStick] = useState({ x: 0, y: 0 });
  const [movingTo, setMovingTo] = useState(false);
  const [nearWild, setNearWild] = useState(false);
  const [nearTemple, setNearTemple] = useState(false);
  const [flightControls, setFlightControls] = useState({ flying: false, landing: false });

  useEffect(() => {
    propsRef.current = props;
  });
  useEffect(() => {
    collectedRef.current = new Set(props.collectedCrystals);
  }, [props.collectedCrystals]);
  useEffect(() => {
    replaceCompanionRef.current?.();
  }, [props.stage, props.companionId]);
  useEffect(() => {
    replaceWildRef.current?.();
  }, [props.wildPetId]);
  useEffect(() => {
    if (props.travelPoint || props.travelTarget)
      navigateRef.current?.(props.travelTarget ?? null, props.travelPoint);
  }, [props.travelRequest]);
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
    const WORLD_TREES = getWorldTrees(region);
    const isWalkable = (x: number, z: number, radius = 0.6) =>
      worldIsWalkable(x, z, radius, region);
    const getNavigationPath = (from: WorldPoint, to: WorldPoint) =>
      worldNavigationPath(from, to, region);
    const resolveMovement = (from: WorldPoint, to: WorldPoint) =>
      worldResolveMovement(from, to, region);
    const getFlightFloor = (x: number, z: number) => worldFlightFloor(x, z, region);
    const findLandingSpot = (from: WorldPoint) => worldLandingSpot(from, region);
    const moveFlight = (
      position: FlightPosition,
      direction: WorldPoint,
      vertical: number,
      dt: number,
    ) => worldMoveFlight(position, direction, vertical, dt, region);
    const theme = WORLD_THEMES[region];
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    const lifetime = createCleanupScope();
    lifetime.add(() => propsRef.current.onReady?.(false));
    const canvas = renderer.domElement;
    const onContextLost = (event: Event) => {
      event.preventDefault();
      lifetime.dispose();
      setContextLost(true);
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
    // Remove this listener before forceContextLoss during normal teardown.

    lifetime.add(() => {
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    });
    lifetime.add(() => canvas.removeEventListener('webglcontextlost', onContextLost));
    lifetime.add(() => {
      propsRef.current.onFlightState?.({ flying: false, landing: false, altitude: 0 });
      flightHoldRef.current = { rise: false, descend: false };
      joystickRef.current = { x: 0, y: 0 };
      replaceCompanionRef.current = null;
      replaceWildRef.current = null;
      captureRef.current = null;
      enterTempleRef.current = null;
      navigateRef.current = null;
      excitementRef.current = null;
      jumpRef.current = null;
      toggleFlightRef.current = null;
    });
    try {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = region === 'fire' ? 1.02 : 0.97;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      canvas.style.cssText =
        'display:block;width:100%;height:100%;touch-action:none;cursor:grab;outline:none';
      canvas.tabIndex = 0;
      canvas.setAttribute('role', 'application');
      canvas.setAttribute(
        'aria-label',
        '操控人类探险家自由探索，宠物会跟随你。WASD 或方向键移动，空格跳跃，拖拽转动视角，点击地面前往。靠近野生伙伴按 E 建立羁绊。可飞行伙伴随行时按 F 骑乘起飞或安全降落，飞行时空格上升，Shift 或 Control 下降。',
      );
      mount.appendChild(canvas);
      const scene = new THREE.Scene();
      lifetime.add(() => scene.clear());
      scene.background = new THREE.Color(theme.fog);
      scene.fog = new THREE.Fog(theme.fog, region === 'fire' ? 36 : 43, 168);
      const camera = new THREE.PerspectiveCamera(51, 1, 0.12, 480);
      const environment = createWorldEnvironment(region, propsRef.current.treasureOpened);
      lifetime.add(environment.dispose);
      scene.add(environment.group);
      const { terrain, crystals, waypoint, sunlight } = environment;
      const regionalScenery = propsRef.current.sceneryFactory();
      lifetime.add(regionalScenery.dispose);
      scene.add(regionalScenery.group);
      const requestedSpawn = propsRef.current.spawnPoint;
      const player: WorldPoint =
        requestedSpawn && isWalkable(requestedSpawn.x, requestedSpawn.z)
          ? { ...requestedSpawn }
          : { ...SPAWN_POSITION };
      const heroAnchor = new THREE.Group();
      scene.add(heroAnchor);
      const hero = createHero();
      lifetime.add(() => hero.dispose());
      heroAnchor.add(hero.group);
      const companionAnchor = new THREE.Group();
      scene.add(companionAnchor);
      const follower: WorldPoint = { x: player.x + 1.3, z: player.z + 1.8 };
      let companion: ReturnType<typeof createPet> | null = null;
      lifetime.add(() => companion?.dispose());
      type FlightPhase = 'ground' | 'takeoff' | 'cruise' | 'landing';
      let flightPhase: FlightPhase = 'ground';
      let airPosition: FlightPosition = { ...player, y: getTerrainHeight(player.x, player.z) };
      let takeoffHeight = 0,
        mountScale = 1,
        desiredMountScale = 1.6;
      let landingSpot: WorldPoint | null = null,
        landingDescending = false,
        pendingCompanion = false;
      let requestLanding = () => {};
      let followerHeading = 0,
        followerPath: WorldPoint[] = [],
        lastFollowerRepath = 0;
      const heroTrail: WorldPoint[] = [{ ...player }];
      const installCompanion = () => {
        // Keep the existing mount until its rider has reached safe ground, including storage updates.
        if (flightPhase !== 'ground') {
          pendingCompanion = true;
          requestLanding();
          return;
        }
        if (companion) {
          companionAnchor.remove(companion.group);
          companion.dispose();
        }
        const id =
          propsRef.current.companionId === undefined ? 'ember' : propsRef.current.companionId;
        companion = id
          ? createPet(id, id === 'ember' ? (Math.max(1, propsRef.current.stage) as 1 | 2 | 3) : 1)
          : null;
        companionAnchor.visible = !!companion;
        if (companion) companionAnchor.add(companion.group);
        followerPath = [];
      };
      replaceCompanionRef.current = installCompanion;
      installCompanion();
      const wildPosition = { x: -10.8, z: -21.7 };
      const wildAnchor = new THREE.Group();
      wildAnchor.position.set(
        wildPosition.x,
        getTerrainHeight(wildPosition.x, wildPosition.z),
        wildPosition.z,
      );
      scene.add(wildAnchor);
      wildAnchor.rotation.y = Math.PI;
      let wildPet: ReturnType<typeof createPet> | null = null;
      lifetime.add(() => wildPet?.dispose());
      let currentlyNearWild = false,
        lastCaptureRequest = -Infinity;
      let currentlyNearTemple = false,
        lastTempleRequest = -Infinity;
      lifetime.add(() => {
        if (currentlyNearWild) propsRef.current.onNearWild?.(false);
        if (currentlyNearTemple) propsRef.current.onNearTemple?.(false);
      });
      enterTempleRef.current = () => {
        const now = performance.now();
        if (
          propsRef.current.paused ||
          flightPhase !== 'ground' ||
          !currentlyNearTemple ||
          now - lastTempleRequest < 500
        )
          return;
        lastTempleRequest = now;
        propsRef.current.onEnterTemple?.();
      };
      const { halo: wildHalo, mark: wildMark } = environment.createWildMarkers(wildAnchor);
      const installWildPet = () => {
        if (wildPet) {
          wildAnchor.remove(wildPet.group);
          wildPet.dispose();
        }
        wildPet = propsRef.current.wildPetId ? createPet(propsRef.current.wildPetId, 1) : null;
        if (wildPet) wildAnchor.add(wildPet.group);
        wildAnchor.visible = !!wildPet;
        if (currentlyNearWild) {
          currentlyNearWild = false;
          setNearWild(false);
          propsRef.current.onNearWild?.(false);
        }
      };
      replaceWildRef.current = installWildPet;
      installWildPet();
      propsRef.current.onNearWild?.(false);
      captureRef.current = () => {
        const now = performance.now();
        if (
          propsRef.current.paused ||
          flightPhase !== 'ground' ||
          !wildPet ||
          !currentlyNearWild ||
          !propsRef.current.canCapture ||
          now - lastCaptureRequest < 450
        )
          return;
        lastCaptureRequest = now;
        propsRef.current.onCaptureRequest?.();
      };
      const arrivalYaw = {
        meadow: 0.55,
        water: -0.65,
        fire: 0.6,
        earth: 0.55,
        steel: 0.5,
        fairy: 0.5,
      }[region];
      let heading = 0,
        yaw = requestedSpawn ? -0.08 : arrivalYaw,
        pitch = 0.22,
        cameraDistance = 14;
      let jumpHeight = 0,
        verticalVelocity = 0,
        excitementStarted = -100;
      let navigation: WorldPoint[] = [];
      let navigationZone: WorldZone | null = null;
      const keys = new Set<string>();
      const jump = () => {
        if (!propsRef.current.paused && flightPhase === 'ground' && jumpHeight <= 0.001)
          verticalVelocity = 6.8;
      };
      jumpRef.current = jump;
      excitementRef.current = () => {
        if (companion && flightPhase === 'ground') excitementStarted = elapsed;
      };
      navigateRef.current = (zone, point) => {
        if (propsRef.current.paused || flightPhase !== 'ground') return;
        const destination = point ?? (zone ? WORLD_ZONES[zone] : null);
        if (!destination) return;
        canvas.focus({ preventScroll: true });
        navigation = getNavigationPath(player, destination);
        navigationZone = point ? null : zone;
        setMovingTo(navigation.length > 0);
        waypoint.visible = navigation.length > 0;
        waypoint.position.set(
          destination.x,
          getTerrainHeight(destination.x, destination.z) + 0.12,
          destination.z,
        );
      };
      if (propsRef.current.travelPoint || propsRef.current.travelTarget)
        navigateRef.current(propsRef.current.travelTarget ?? null, propsRef.current.travelPoint);

      const raycaster = new THREE.Raycaster(),
        pointer = new THREE.Vector2();
      let dragging = false,
        pointerId = -1,
        startX = 0,
        startY = 0,
        lastX = 0,
        lastY = 0,
        dragged = false;
      const stopNavigation = () => {
        navigation = [];
        navigationZone = null;
        setMovingTo(false);
        waypoint.visible = false;
      };
      let lastFlightReportTime = 0,
        lastFlightStatus: FlightStatus | null = null;
      const publishFlightState = (force = false) => {
        const now = performance.now() / 1000;
        if (!force && now - lastFlightReportTime < 0.1) return;
        const status = {
          flying: flightPhase !== 'ground',
          landing: flightPhase === 'landing',
          altitude:
            flightPhase === 'ground'
              ? 0
              : Math.max(0, airPosition.y - getTerrainHeight(player.x, player.z)),
        };
        lastFlightReportTime = now;
        if (
          force ||
          !lastFlightStatus ||
          status.flying !== lastFlightStatus.flying ||
          status.landing !== lastFlightStatus.landing ||
          Math.abs(status.altitude - lastFlightStatus.altitude) > 0.03
        ) {
          propsRef.current.onFlightState?.(status);
          setFlightControls((previous) =>
            previous.flying === status.flying && previous.landing === status.landing
              ? previous
              : { flying: status.flying, landing: status.landing },
          );
          lastFlightStatus = status;
        }
      };
      requestLanding = () => {
        if (flightPhase === 'ground' || flightPhase === 'landing') return;
        landingSpot = findLandingSpot(player);
        landingDescending = false;
        flightPhase = 'landing';
        keys.clear();
        flightHoldRef.current = { rise: false, descend: false };
        joystickRef.current = { x: 0, y: 0 };
        setStick({ x: 0, y: 0 });
        propsRef.current.onFlightMessage?.('正在寻找开阔陆地，准备安全降落');
        publishFlightState(true);
      };
      const finishLanding = () => {
        flightPhase = 'ground';
        landingSpot = null;
        landingDescending = false;
        jumpHeight = 0;
        verticalVelocity = 0;
        mountScale = 1;
        hero.setRiding?.(false);
        companion?.setFlying?.(false);
        companionAnchor.scale.setScalar(1);
        follower.x = player.x;
        follower.z = player.z;
        followerHeading = heading;
        followerPath = [];
        heroTrail.splice(0, heroTrail.length, { ...player });
        keys.clear();
        flightHoldRef.current = { rise: false, descend: false };
        joystickRef.current = { x: 0, y: 0 };
        setStick({ x: 0, y: 0 });
        if (pendingCompanion) {
          pendingCompanion = false;
          installCompanion();
        }
        propsRef.current.onSound?.('land');
        propsRef.current.onFlightMessage?.('已安全降落，继续一起探索吧');
        publishFlightState(true);
      };
      toggleFlightRef.current = () => {
        if (propsRef.current.paused) return;
        if (flightPhase !== 'ground') {
          requestLanding();
          return;
        }
        const id =
          propsRef.current.companionId === undefined ? 'ember' : propsRef.current.companionId;
        if (!companion || !canPetFly(id, propsRef.current.stage)) {
          propsRef.current.onFlightMessage?.('让星翼烁牙或绮露随行，就能骑乘飞行');
          return;
        }
        const clearLaunch = findLandingSpot(player);
        if (Math.hypot(clearLaunch.x - player.x, clearLaunch.z - player.z) > 0.3) {
          propsRef.current.onFlightMessage?.('这里不够开阔，请到平坦的空地再起飞');
          return;
        }
        stopNavigation();
        keys.clear();
        flightHoldRef.current = { rise: false, descend: false };
        joystickRef.current = { x: 0, y: 0 };
        setStick({ x: 0, y: 0 });
        airPosition = { ...player, y: getTerrainHeight(player.x, player.z) + jumpHeight };
        takeoffHeight = Math.min(FLIGHT_CEILING, getFlightFloor(player.x, player.z) + 4);
        desiredMountScale = id === 'lumi' ? 1.75 : 1.6;
        flightPhase = 'takeoff';
        jumpHeight = 0;
        verticalVelocity = 0;
        followerPath = [];
        hero.setRiding?.(true);
        companion.setFlying?.(true);
        if (currentlyNearWild) {
          currentlyNearWild = false;
          setNearWild(false);
          propsRef.current.onNearWild?.(false);
        }
        if (currentlyNearTemple) {
          currentlyNearTemple = false;
          setNearTemple(false);
          propsRef.current.onNearTemple?.(false);
        }
        canvas.focus({ preventScroll: true });
        propsRef.current.onSound?.('takeoff');
        propsRef.current.onFlightMessage?.('一起飞上天空！空格上升，Shift 下降，F 安全降落');
        publishFlightState(true);
      };
      publishFlightState(true);
      const pointerDown = (event: PointerEvent) => {
        if (propsRef.current.paused || event.button !== 0) return;
        canvas.focus({ preventScroll: true });
        dragging = true;
        pointerId = event.pointerId;
        startX = lastX = event.clientX;
        startY = lastY = event.clientY;
        dragged = false;
        canvas.setPointerCapture(pointerId);
        canvas.style.cursor = 'grabbing';
      };
      const pointerMove = (event: PointerEvent) => {
        if (!dragging || event.pointerId !== pointerId || propsRef.current.paused) return;
        yaw -= (event.clientX - lastX) * 0.005;
        pitch = THREE.MathUtils.clamp(pitch + (event.clientY - lastY) * 0.0035, 0.12, 0.69);
        lastX = event.clientX;
        lastY = event.clientY;
        dragged ||= Math.hypot(event.clientX - startX, event.clientY - startY) > 6;
      };
      const pointerUp = (event: PointerEvent) => {
        if (!dragging || event.pointerId !== pointerId) return;
        dragging = false;
        canvas.style.cursor = 'grab';
        if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
        if (dragged || propsRef.current.paused || flightPhase !== 'ground') return;
        const bounds = canvas.getBoundingClientRect();
        pointer.set(
          ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
          (-(event.clientY - bounds.top) / bounds.height) * 2 + 1,
        );
        raycaster.setFromCamera(pointer, camera);
        if (companion && raycaster.intersectObject(companionAnchor, true).length) {
          excitementRef.current?.();
          propsRef.current.onPetInteract();
          return;
        }
        if (wildPet && raycaster.intersectObject(wildAnchor, true).length) {
          if (currentlyNearWild && propsRef.current.canCapture) captureRef.current?.();
          else {
            navigation = getNavigationPath(player, wildPosition);
            navigationZone = 'ruins';
            setMovingTo(navigation.length > 0);
            waypoint.visible = navigation.length > 0;
            waypoint.position.set(
              wildPosition.x,
              getTerrainHeight(wildPosition.x, wildPosition.z) + 0.12,
              wildPosition.z,
            );
          }
          return;
        }
        if (raycaster.intersectObject(heroAnchor, true).length) {
          jump();
          return;
        }
        const hit = raycaster.intersectObject(terrain)[0];
        if (hit && isWalkable(hit.point.x, hit.point.z)) {
          navigation = getNavigationPath(player, { x: hit.point.x, z: hit.point.z });
          navigationZone = null;
          setMovingTo(navigation.length > 0);
          waypoint.visible = navigation.length > 0;
          waypoint.position.copy(hit.point).add(new THREE.Vector3(0, 0.11, 0));
        }
      };
      const pointerCancel = () => {
        dragging = false;
        canvas.style.cursor = 'grab';
      };
      const wheel = (event: WheelEvent) => {
        if (propsRef.current.paused) return;
        event.preventDefault();
        cameraDistance = THREE.MathUtils.clamp(cameraDistance + event.deltaY * 0.008, 5.7, 14.5);
      };
      const isEditable = (target: EventTarget | null) =>
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          !!target.closest('input,textarea,select,[contenteditable="true"]'));
      const keyDown = (event: KeyboardEvent) => {
        if (propsRef.current.paused || isEditable(event.target)) return;
        if (event.code === 'KeyF') {
          event.preventDefault();
          if (!event.repeat) toggleFlightRef.current?.();
          return;
        }
        if (event.code === 'KeyE' && !event.repeat) {
          event.preventDefault();
          if (currentlyNearWild && propsRef.current.canCapture) captureRef.current?.();
          else enterTempleRef.current?.();
          return;
        }
        if (
          event.code === 'Space' &&
          event.target instanceof HTMLElement &&
          event.target.closest('button,a')
        )
          return;
        if (
          [
            'KeyW',
            'KeyA',
            'KeyS',
            'KeyD',
            'ArrowUp',
            'ArrowDown',
            'ArrowLeft',
            'ArrowRight',
            'Space',
            ...(flightPhase !== 'ground'
              ? ['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight']
              : []),
          ].includes(event.code)
        ) {
          event.preventDefault();
          keys.add(event.code);
          if (event.code === 'Space' && !event.repeat) jump();
          else if (event.code !== 'Space') stopNavigation();
        }
      };
      const keyUp = (event: KeyboardEvent) => {
        keys.delete(event.code);
      };
      const blur = () => {
        keys.clear();
        joystickRef.current = { x: 0, y: 0 };
        flightHoldRef.current = { rise: false, descend: false };
        setStick({ x: 0, y: 0 });
        dragging = false;
        canvas.style.cursor = 'grab';
      };
      const visibilityChange = () => {
        if (document.hidden) blur();
      };
      lifetime.add(() => {
        canvas.removeEventListener('pointerdown', pointerDown);
        canvas.removeEventListener('pointermove', pointerMove);
        canvas.removeEventListener('pointerup', pointerUp);
        canvas.removeEventListener('pointercancel', pointerCancel);
        canvas.removeEventListener('wheel', wheel);
        window.removeEventListener('keydown', keyDown);
        window.removeEventListener('keyup', keyUp);
        window.removeEventListener('blur', blur);
        document.removeEventListener('visibilitychange', visibilityChange);
      });
      canvas.addEventListener('pointerdown', pointerDown);
      canvas.addEventListener('pointermove', pointerMove);
      canvas.addEventListener('pointerup', pointerUp);
      canvas.addEventListener('pointercancel', pointerCancel);
      canvas.addEventListener('wheel', wheel, { passive: false });
      window.addEventListener('keydown', keyDown);
      window.addEventListener('keyup', keyUp);
      window.addEventListener('blur', blur);
      document.addEventListener('visibilitychange', visibilityChange);
      const resize = () => {
        const width = mount.clientWidth,
          height = mount.clientHeight;
        if (!width || !height) return;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      const observer = new ResizeObserver(resize);
      lifetime.add(() => observer.disconnect());
      observer.observe(mount);
      resize();
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      let frame = 0,
        previousTime = performance.now() / 1000,
        lastPositionTime = 0,
        lastShadowTime = 0,
        elapsed = 0;
      lifetime.add(() => cancelAnimationFrame(frame));
      let lastZone: WorldZone | null = null,
        lastReported: { x: number; z: number; heading: number } | null = null;
      let wasPaused = propsRef.current.paused;
      const desiredCamera = new THREE.Vector3(),
        lookTarget = new THREE.Vector3(),
        cameraDirection = new THREE.Vector3(),
        crownOffset = new THREE.Vector3();
      const seatPosition = new THREE.Vector3(),
        riderHipPosition = new THREE.Vector3(),
        fallbackSeat = new THREE.Vector3(0, 1.1, 0.2),
        fallbackHip = new THREE.Vector3(0, 1.1, 0);
      const cameraCrowns = WORLD_TREES.map((tree) => ({
        center: new THREE.Vector3(
          tree.x,
          getTerrainHeight(tree.x, tree.z) + tree.size * 4.5,
          tree.z,
        ),
        radius: tree.size * (tree.variant === 0 ? 1.65 : 2.3),
      }));
      const cameraBuildings = REGION_VOLUMES[region].map(
        (volume) =>
          new THREE.Box3(
            new THREE.Vector3(
              volume.x - volume.halfX - 0.15,
              getTerrainHeight(volume.x, volume.z) + (volume.minY ?? 0),
              volume.z - volume.halfZ - 0.15,
            ),
            new THREE.Vector3(
              volume.x + volume.halfX + 0.15,
              getTerrainHeight(volume.x, volume.z) + volume.height,
              volume.z + volume.halfZ + 0.15,
            ),
          ),
      );
      const cameraRay = new THREE.Ray(),
        cameraHit = new THREE.Vector3();
      heroAnchor.position.set(player.x, getTerrainHeight(player.x, player.z), player.z);
      companionAnchor.position.set(
        follower.x,
        getTerrainHeight(follower.x, follower.z),
        follower.z,
      );
      camera.position.set(
        player.x + Math.sin(yaw) * 14,
        heroAnchor.position.y + 4.86,
        player.z + Math.cos(yaw) * 14,
      );
      const animate = () => {
        frame = requestAnimationFrame(animate);
        const now = performance.now() / 1000,
          delta = Math.min(0.045, Math.max(0, now - previousTime));
        previousTime = now;
        const paused = propsRef.current.paused;
        if (paused && !wasPaused) blur();
        wasPaused = paused;
        if (!paused) elapsed += delta;
        const visualTime = reducedMotion ? 0 : elapsed;
        let dx = 0,
          dz = 0,
          movingSpeed = 0;
        if (!paused) {
          let horizontal =
            (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) -
            (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) +
            joystickRef.current.x;
          let vertical =
            (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) -
            (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) +
            joystickRef.current.y;
          const magnitude = Math.hypot(horizontal, vertical);
          if (magnitude > 0.05 && flightPhase !== 'landing' && flightPhase !== 'takeoff') {
            stopNavigation();
            horizontal /= Math.max(1, magnitude);
            vertical /= Math.max(1, magnitude);
            dx = horizontal * Math.cos(yaw) + vertical * Math.sin(yaw);
            dz = -horizontal * Math.sin(yaw) + vertical * Math.cos(yaw);
          } else if (navigation.length && flightPhase === 'ground') {
            const target = navigation[0],
              distance = Math.hypot(target.x - player.x, target.z - player.z);
            if (distance < 0.48) {
              navigation.shift();
              if (!navigation.length) {
                setMovingTo(false);
                waypoint.visible = false;
                if (navigationZone) propsRef.current.onExplore(navigationZone);
                navigationZone = null;
              }
            } else {
              dx = (target.x - player.x) / distance;
              dz = (target.z - player.z) / distance;
              if (!dragging) yaw = lerpAngle(yaw, Math.atan2(-dx, -dz), 1 - Math.exp(-delta * 1.4));
            }
          }
          if (flightPhase === 'takeoff') {
            const remaining = takeoffHeight - airPosition.y;
            airPosition.y = Math.min(
              takeoffHeight,
              airPosition.y + Math.max(1.2, Math.min(8, remaining * 2.2)) * delta,
            );
            if (takeoffHeight - airPosition.y < 0.015) {
              airPosition.y = takeoffHeight;
              flightPhase = 'cruise';
            }
          } else if (flightPhase === 'cruise') {
            const ascent =
              (keys.has('Space') || flightHoldRef.current.rise ? 1 : 0) -
              (keys.has('ShiftLeft') ||
              keys.has('ShiftRight') ||
              keys.has('ControlLeft') ||
              keys.has('ControlRight') ||
              flightHoldRef.current.descend
                ? 1
                : 0);
            const next = moveFlight(airPosition, { x: dx, z: dz }, ascent, delta);
            movingSpeed = Math.min(
              1,
              Math.hypot(next.x - player.x, next.z - player.z) / (FLIGHT_SPEED * delta || 1),
            );
            airPosition = next;
            player.x = next.x;
            player.z = next.z;
            if (Math.hypot(dx, dz) > 0.01)
              heading = lerpAngle(heading, Math.atan2(-dx, -dz), 1 - Math.exp(-delta * 4));
          } else if (flightPhase === 'landing' && landingSpot) {
            const distance = Math.hypot(landingSpot.x - player.x, landingSpot.z - player.z);
            if (!landingDescending && distance > 0.025) {
              // Gain safe clearance first if landing was requested halfway through takeoff.
              const safeHeight = getFlightFloor(player.x, player.z) + 1;
              if (airPosition.y < safeHeight - 0.03)
                airPosition.y = Math.min(safeHeight, airPosition.y + 8 * delta);
              else {
                const speed = Math.min(8, distance / Math.max(delta, 0.001));
                const direction = {
                  x: (((landingSpot.x - player.x) / distance) * speed) / FLIGHT_SPEED,
                  z: (((landingSpot.z - player.z) / distance) * speed) / FLIGHT_SPEED,
                };
                airPosition = moveFlight(airPosition, direction, 0, delta);
                player.x = airPosition.x;
                player.z = airPosition.z;
                movingSpeed = speed / FLIGHT_SPEED;
                heading = lerpAngle(
                  heading,
                  Math.atan2(-direction.x, -direction.z),
                  1 - Math.exp(-delta * 4),
                );
              }
            } else {
              landingDescending = true;
              player.x = landingSpot.x;
              player.z = landingSpot.z;
              airPosition.x = player.x;
              airPosition.z = player.z;
              const landingHeight = getTerrainHeight(player.x, player.z);
              airPosition.y = Math.max(
                landingHeight,
                airPosition.y -
                  Math.max(1.25, Math.min(7, (airPosition.y - landingHeight) * 2)) * delta,
              );
              if (airPosition.y <= landingHeight + 0.015) finishLanding();
            }
          } else if (Math.hypot(dx, dz) > 0.01) {
            const next = resolveMovement(player, {
              x: player.x + dx * 6.4 * delta,
              z: player.z + dz * 6.4 * delta,
            });
            movingSpeed = Math.min(
              1,
              Math.hypot(next.x - player.x, next.z - player.z) / (delta * 6.4 || 1),
            );
            player.x = next.x;
            player.z = next.z;
            heading = lerpAngle(heading, Math.atan2(-dx, -dz), 1 - Math.exp(-delta * 10));
          }
          if (flightPhase === 'ground') {
            if (jumpHeight > 0 || verticalVelocity > 0) {
              verticalVelocity -= 17 * delta;
              jumpHeight = Math.max(0, jumpHeight + verticalVelocity * delta);
              if (jumpHeight === 0) verticalVelocity = 0;
            }
            crystals.forEach((crystal, id) => {
              if (
                !collectedRef.current.has(id) &&
                Math.hypot(player.x - CRYSTAL_POSITIONS[id].x, player.z - CRYSTAL_POSITIONS[id].z) <
                  3.5
              ) {
                collectedRef.current.add(id);
                crystal.visible = false;
                propsRef.current.onCollectCrystal(id);
              }
            });
            const trailTail = heroTrail[heroTrail.length - 1];
            if (Math.hypot(player.x - trailTail.x, player.z - trailTail.z) > 0.3) {
              heroTrail.push({ ...player });
              if (heroTrail.length > 100) heroTrail.shift();
            }
          }
          let nearestZone: WorldZone | null = null;
          for (const zone of ['ruins', 'grove', 'shore'] as WorldZone[])
            if (Math.hypot(player.x - WORLD_ZONES[zone].x, player.z - WORLD_ZONES[zone].z) < 8)
              nearestZone = zone;
          if (nearestZone && nearestZone !== lastZone) propsRef.current.onExplore(nearestZone);
          lastZone = nearestZone;
          const near =
            flightPhase === 'ground' &&
            !!wildPet &&
            Math.hypot(player.x - wildPosition.x, player.z - wildPosition.z) < 5;
          if (near !== currentlyNearWild) {
            currentlyNearWild = near;
            setNearWild(near);
            propsRef.current.onNearWild?.(near);
          }
          const templeNear =
            flightPhase === 'ground' &&
            Math.hypot(player.x - TEMPLE_ENTRANCE.x, player.z - TEMPLE_ENTRANCE.z) < 5;
          if (templeNear !== currentlyNearTemple) {
            currentlyNearTemple = templeNear;
            setNearTemple(templeNear);
            propsRef.current.onNearTemple?.(templeNear);
          }
        }
        const ground = getTerrainHeight(player.x, player.z);
        const airborne = flightPhase !== 'ground';
        const excitementAge = elapsed - excitementStarted;
        heroAnchor.position.set(player.x, ground + jumpHeight, player.z);
        heroAnchor.rotation.y = heading;
        hero.animate(visualTime, airborne ? 0 : movingSpeed, airborne ? 0 : jumpHeight / 1.5);
        let followerSpeed = 0;
        if (companion && !paused && !airborne) {
          let behind: WorldPoint = {
            x: player.x + Math.sin(heading) * 1.8,
            z: player.z + Math.cos(heading) * 1.8,
          };
          let remaining = 1.8,
            previous: WorldPoint = player;
          for (let i = heroTrail.length - 1; i >= 0; i--) {
            const point = heroTrail[i],
              distance = Math.hypot(point.x - previous.x, point.z - previous.z);
            if (distance >= remaining && distance > 0.001) {
              behind = {
                x: previous.x + ((point.x - previous.x) * remaining) / distance,
                z: previous.z + ((point.z - previous.z) * remaining) / distance,
              };
              break;
            }
            remaining -= distance;
            previous = point;
          }
          const side = {
            x: behind.x + Math.cos(heading) * 1.05,
            z: behind.z - Math.sin(heading) * 1.05,
          };
          const goal = isWalkable(side.x, side.z)
            ? side
            : isWalkable(behind.x, behind.z)
              ? behind
              : { ...player };
          if (
            followerPath.length &&
            Math.hypot(follower.x - followerPath[0].x, follower.z - followerPath[0].z) < 0.38
          )
            followerPath.shift();
          const target = followerPath[0] ?? goal;
          const distance = Math.hypot(target.x - follower.x, target.z - follower.z);
          if (distance > 0.12) {
            const step = Math.min(distance, delta * (movingSpeed > 0.1 ? 8.0 : 4.8));
            const next = resolveMovement(follower, {
              x: follower.x + ((target.x - follower.x) / distance) * step,
              z: follower.z + ((target.z - follower.z) / distance) * step,
            });
            const covered = Math.hypot(next.x - follower.x, next.z - follower.z);
            if (covered > 0.002)
              followerHeading = lerpAngle(
                followerHeading,
                Math.atan2(follower.x - next.x, follower.z - next.z),
                1 - Math.exp(-delta * 8),
              );
            followerSpeed = Math.min(1, covered / (delta * 7 || 1));
            follower.x = next.x;
            follower.z = next.z;
            if (covered < step * 0.25 && now - lastFollowerRepath > 0.7) {
              followerPath = getNavigationPath(follower, goal);
              lastFollowerRepath = now;
            }
          } else followerHeading = lerpAngle(followerHeading, heading, 1 - Math.exp(-delta * 2.5));
          if (
            Math.hypot(player.x - follower.x, player.z - follower.z) > 17 &&
            isWalkable(behind.x, behind.z)
          ) {
            follower.x = behind.x;
            follower.z = behind.z;
            followerPath = [];
          }
        }
        const petBounce =
          !reducedMotion && excitementAge >= 0 && excitementAge < 1.1
            ? Math.sin((excitementAge / 1.1) * Math.PI) * 0.72
            : 0;
        if (airborne && companion) {
          if (!paused)
            mountScale = THREE.MathUtils.lerp(
              mountScale,
              desiredMountScale,
              1 - Math.exp(-delta * 6),
            );
          companionAnchor.scale.setScalar(mountScale);
          companionAnchor.position.set(player.x, airPosition.y, player.z);
          companionAnchor.rotation.y = heading;
          companion.animate(visualTime, movingSpeed, 0);
          // Animated local anchors keep the rider seated through every wingbeat and turn.
          companion.group.updateWorldMatrix(true, false);
          companion.group.localToWorld(seatPosition.copy(companion.rideSeat ?? fallbackSeat));
          hero.group.updateWorldMatrix(true, false);
          hero.group.localToWorld(riderHipPosition.copy(hero.riderHip ?? fallbackHip));
          heroAnchor.position.add(seatPosition.sub(riderHipPosition));
        } else {
          companionAnchor.position.set(
            follower.x,
            getTerrainHeight(follower.x, follower.z) + petBounce,
            follower.z,
          );
          companionAnchor.rotation.y =
            followerHeading +
            (!reducedMotion && excitementAge >= 0 && excitementAge < 1.1
              ? (excitementAge / 1.1) * Math.PI * 2
              : 0);
          companion?.animate(visualTime, followerSpeed, petBounce);
        }
        if (wildPet) {
          wildPet.animate(visualTime, 0, 0);
          if (!paused && Math.hypot(player.x - wildPosition.x, player.z - wildPosition.z) < 12)
            wildAnchor.rotation.y = lerpAngle(
              wildAnchor.rotation.y,
              Math.atan2(wildPosition.x - player.x, wildPosition.z - player.z),
              1 - Math.exp(-delta * 2),
            );
          wildMark.position.y = 2.6 + Math.sin(visualTime * 1.4) * 0.16;
          wildMark.rotation.y = visualTime * 0.6;
          wildHalo.scale.setScalar(1 + Math.sin(visualTime * 1.8) * 0.05);
        }
        const viewDistance = cameraDistance + (airborne ? 3 : 0),
          viewHeight = airborne ? airPosition.y : ground;
        const heightOffset = viewDistance * Math.sin(pitch) + (airborne ? 2.8 : 1.8);
        desiredCamera.set(
          player.x + Math.sin(yaw) * viewDistance,
          viewHeight + heightOffset,
          player.z + Math.cos(yaw) * viewDistance,
        );
        desiredCamera.y = Math.max(
          desiredCamera.y,
          getTerrainHeight(desiredCamera.x, desiredCamera.z) + 1.5,
        );
        lookTarget.set(player.x, viewHeight + (airborne ? 3.1 : 2.5), player.z);
        // Pull forward gently if a tree crown would sit between the pet and camera.
        cameraDirection.copy(desiredCamera).sub(lookTarget);
        const requestedDistance = cameraDirection.length();
        cameraDirection.normalize();
        let clearDistance = requestedDistance;
        for (const crown of cameraCrowns) {
          if (
            Math.hypot(crown.center.x - player.x, crown.center.z - player.z) >
            requestedDistance + crown.radius
          )
            continue;
          crownOffset.copy(crown.center).sub(lookTarget);
          const projection = crownOffset.dot(cameraDirection);
          if (projection < 1.5 || projection > clearDistance + crown.radius) continue;
          const perpendicularSquared = crownOffset.lengthSq() - projection * projection,
            radius = crown.radius + 0.28;
          if (perpendicularSquared < radius * radius) {
            const entry = projection - Math.sqrt(radius * radius - perpendicularSquared);
            if (entry > 2.6) clearDistance = Math.min(clearDistance, Math.max(3.0, entry - 0.5));
          }
        }
        cameraRay.set(lookTarget, cameraDirection);
        for (const building of cameraBuildings) {
          if (cameraRay.intersectBox(building, cameraHit)) {
            const entry = cameraHit.distanceTo(lookTarget);
            if (entry > 0.2 && entry < clearDistance) clearDistance = Math.max(0.35, entry - 0.25);
          }
        }
        if (clearDistance < requestedDistance)
          desiredCamera.copy(lookTarget).addScaledVector(cameraDirection, clearDistance);
        desiredCamera.y = Math.max(
          desiredCamera.y,
          getTerrainHeight(desiredCamera.x, desiredCamera.z) + 1.3,
        );
        // Lift the camera above intervening ridges rather than looking through terrain.
        for (let i = 1; i < 8; i++) {
          const f = i / 8;
          const x = THREE.MathUtils.lerp(player.x, desiredCamera.x, f),
            z = THREE.MathUtils.lerp(player.z, desiredCamera.z, f);
          const lineY = THREE.MathUtils.lerp(lookTarget.y, desiredCamera.y, f);
          desiredCamera.y += Math.max(0, getTerrainHeight(x, z) + 0.65 - lineY) / Math.max(f, 0.2);
        }
        if (!paused) {
          camera.position.lerp(desiredCamera, 1 - Math.exp(-delta * 7));
          camera.lookAt(lookTarget);
        }
        environment.update({
          time: visualTime,
          delta,
          position: player,
          height: viewHeight,
          collected: collectedRef.current,
          treasureOpened: propsRef.current.treasureOpened,
        });
        regionalScenery.update(visualTime, propsRef.current.templeVisited);
        if (now - lastPositionTime > 0.125) {
          lastPositionTime = now;
          const current = { x: player.x, z: player.z, heading };
          if (
            !lastReported ||
            Math.hypot(current.x - lastReported.x, current.z - lastReported.z) > 0.07 ||
            Math.abs(current.heading - lastReported.heading) > 0.06
          ) {
            propsRef.current.onPosition?.(current);
            lastReported = current;
          }
        }
        publishFlightState();
        if (now - lastShadowTime > 0.4) {
          lastShadowTime = now;
          sunlight.position.set(player.x - 32, 61, player.z + 25);
          sunlight.target.position.set(player.x, 0, player.z);
        }
        renderer.render(scene, camera);
      };
      animate();
      propsRef.current.onReady?.(true);
      return lifetime.dispose;
    } catch (error) {
      lifetime.dispose();
      // SceneHost owns the retry UI; rethrow only after partial resources are gone.
      throw error;
    }
  }, []);

  if (contextLost) throw new Error('The outdoor WebGL context was lost');

  const moveJoystick = (event: React.PointerEvent<HTMLDivElement>) => {
    if (props.paused) return;
    if (event.type === 'pointerdown') {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (event.type === 'pointermove' && !event.currentTarget.hasPointerCapture(event.pointerId))
      return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const dx = event.clientX - bounds.left - bounds.width / 2,
      dy = event.clientY - bounds.top - bounds.height / 2;
    const limit = 34;
    const length = Math.hypot(dx, dy);
    const factor = length > limit ? limit / length : 1;
    const value = { x: (dx * factor) / limit, y: (dy * factor) / limit };
    joystickRef.current = value;
    setStick(value);
  };
  const releaseJoystick = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    joystickRef.current = { x: 0, y: 0 };
    setStick({ x: 0, y: 0 });
  };
  const holdFlight = (
    event: React.PointerEvent<HTMLButtonElement>,
    direction: 'rise' | 'descend',
  ) => {
    if (props.paused || !flightControls.flying || flightControls.landing) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    flightHoldRef.current[direction] = true;
  };
  const releaseFlight = (direction: 'rise' | 'descend') => {
    flightHoldRef.current[direction] = false;
  };
  const flightButtonKey = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    direction: 'rise' | 'descend',
    pressed: boolean,
  ) => {
    if (event.code !== 'Space' && event.code !== 'Enter') return;
    event.preventDefault();
    event.stopPropagation();
    flightHoldRef.current[direction] =
      pressed && !props.paused && flightControls.flying && !flightControls.landing;
  };
  return (
    <div
      className="world-scene"
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#b9dce3' }}
    >
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      {movingTo && !props.paused && (
        <div
          className="world-auto-walk"
          style={{
            position: 'absolute',
            bottom: 100,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '8px 14px',
            borderRadius: 20,
            background: '#163c3988',
            color: '#fffbe8',
            fontSize: 12,
            pointerEvents: 'none',
          }}
        >
          正在前往 · 移动方向键可取消
        </div>
      )}
      {nearWild && props.wildPetId && !props.paused && !flightControls.flying && (
        <div className="wild-bond-prompt">
          {props.canCapture ? (
            <button className="wild-bond-button" onClick={() => captureRef.current?.()}>
              <span>与伙伴建立羁绊</span>
              <kbd>E</kbd>
            </button>
          ) : (
            <span>收集三枚符印后，可以与这里的伙伴建立羁绊</span>
          )}
        </div>
      )}
      {nearTemple && !props.paused && !flightControls.flying && (
        <div className="temple-enter-prompt">
          <button onClick={() => enterTempleRef.current?.()}>
            进入神庙 <kbd>{nearWild && props.canCapture ? '↗' : 'E'}</kbd>
          </button>
        </div>
      )}
      <div
        className="world-touch-controls"
        style={{ pointerEvents: props.paused ? 'none' : 'auto', opacity: props.paused ? 0 : 1 }}
      >
        <div
          className="world-joystick"
          aria-label="拖动摇杆移动"
          onPointerDown={moveJoystick}
          onPointerMove={moveJoystick}
          onPointerUp={releaseJoystick}
          onPointerCancel={releaseJoystick}
          onLostPointerCapture={releaseJoystick}
          style={{ touchAction: 'none' }}
        >
          <span style={{ transform: `translate(${stick.x * 30}px,${stick.y * 30}px)` }} />
        </div>
        {!flightControls.flying && (
          <button className="world-jump" onClick={() => jumpRef.current?.()} aria-label="跳跃">
            ↑<span>跳跃</span>
          </button>
        )}
        {flightControls.flying && (
          <div className="mobile-flight-controls" aria-label="飞行高度控制">
            {(['rise', 'descend'] as const).map((direction) => (
              <button
                key={direction}
                className={`flight-${direction}`}
                disabled={flightControls.landing || props.paused}
                style={{ touchAction: 'none' }}
                aria-label={direction === 'rise' ? '按住上升' : '按住下降'}
                onPointerDown={(event) => holdFlight(event, direction)}
                onPointerUp={() => releaseFlight(direction)}
                onPointerCancel={() => releaseFlight(direction)}
                onLostPointerCapture={() => releaseFlight(direction)}
                onBlur={() => releaseFlight(direction)}
                onKeyDown={(event) => flightButtonKey(event, direction, true)}
                onKeyUp={(event) => flightButtonKey(event, direction, false)}
              >
                <span aria-hidden="true">{direction === 'rise' ? '↑' : '↓'}</span>
                <span>{direction === 'rise' ? '上升' : '下降'}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <style>{`.world-touch-controls{display:none;position:absolute;inset:0;pointer-events:none!important}.world-joystick{position:absolute;left:24px;bottom:60px;width:104px;height:104px;border:1px solid #fff8;border-radius:50%;background:#294f4038;backdrop-filter:blur(6px);pointer-events:auto;display:grid;place-items:center}.world-joystick:before{content:'';position:absolute;width:66px;height:66px;border:1px solid #fff3;border-radius:50%}.world-joystick>span{width:43px;height:43px;border:1px solid #fff9;background:#ffffff69;border-radius:50%;box-shadow:0 4px 18px #23442a28}.world-jump{position:absolute;right:27px;bottom:43px;width:68px;height:68px;display:grid;place-content:center;gap:2px;border:1px solid #fff9;border-radius:50%;color:#fff9e1;background:#244f4266;backdrop-filter:blur(6px);font-size:25px;pointer-events:auto}.world-jump>span{font-size:10px}@media(pointer:coarse),(max-width:760px){.world-touch-controls{display:block}}`}</style>
    </div>
  );
}
