import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  DISCOVERY_SITES,
  createDiscoveryProgress,
  getAvailableDiscoverySites,
  getDailyDiscoverySite,
} from '../../../game/discovery';
import { getTerrainHeight } from '../../../game/world';
import type { SceneryFrame } from '../types';

const EMPTY = createDiscoveryProgress('real');

/** Small environmental clues. The domain owns eligibility, coordinates and progress. */
export function createMeadowSecrets() {
  const group = new THREE.Group();
  group.name = 'meadow-secrets';
  const geometries = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>();
  const geometry = <T extends THREE.BufferGeometry>(value: T) => {
    geometries.add(value);
    return value;
  };
  const material = (color: string, options: THREE.MeshStandardMaterialParameters = {}) => {
    const result = new THREE.MeshStandardMaterial({ color, roughness: 0.84, ...options });
    materials.add(result);
    return result;
  };
  const cube = geometry(new THREE.BoxGeometry(1, 1, 1));
  const sphere = geometry(new THREE.SphereGeometry(1, 10, 7));
  const cylinder = geometry(new THREE.CylinderGeometry(0.74, 1, 1, 10));
  const ring = geometry(new THREE.TorusGeometry(1, 0.07, 5, 24));
  const diamond = geometry(new THREE.OctahedronGeometry(1, 0));
  const wood = material('#79604a'),
    leather = material('#aa8660'),
    parchment = material('#f0ddaf');
  const dark = material('#394c45'),
    gold = material('#c8ad72', { metalness: 0.48, roughness: 0.42 });
  const stone = material('#899384'),
    moss = material('#5d836c'),
    cream = material('#edebca');
  const glow = new THREE.MeshBasicMaterial({
    color: '#bbe8b4',
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
  });
  materials.add(glow);
  const warmGlow = new THREE.MeshBasicMaterial({
    color: '#ffe7a8',
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });
  materials.add(warmGlow);
  const part = (
    parent: THREE.Object3D,
    shape: THREE.BufferGeometry,
    mat: THREE.Material,
    position: number[],
    scale: number[],
    rotation = [0, 0, 0],
  ) => {
    const mesh = new THREE.Mesh(shape, mat);
    mesh.position.set(position[0], position[1], position[2]);
    mesh.scale.set(scale[0], scale[1], scale[2]);
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const box = (
    p: THREE.Object3D,
    m: THREE.Material,
    position: number[],
    scale: number[],
    rotation?: number[],
  ) => part(p, cube, m, position, scale, rotation);
  const ball = (p: THREE.Object3D, m: THREE.Material, position: number[], scale: number[]) =>
    part(p, sphere, m, position, scale);
  const batch = (root: THREE.Group) => {
    root.updateWorldMatrix(true, true);
    const inverse = root.matrixWorld.clone().invert();
    const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const mat = object.material as THREE.Material;
      const copy = object.geometry
        .clone()
        .applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld));
      const list = batches.get(mat) ?? [];
      list.push(copy);
      batches.set(mat, list);
    });
    root.clear();
    for (const [mat, parts] of batches) {
      let merged: THREE.BufferGeometry | null = null;
      try {
        merged = mergeGeometries(parts, false);
      } finally {
        parts.forEach((item) => item.dispose());
      }
      if (!merged) throw new Error('Could not merge meadow clue geometry');
      const mesh = new THREE.Mesh(geometry(merged), mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);
    }
  };
  const siteGroups = new Map<string, THREE.Group>();
  const place = (id: string, position: { x: number; z: number }) => {
    const result = new THREE.Group();
    result.name = `discovery-${id}`;
    result.userData.discoveryId = id;
    result.position.set(position.x, getTerrainHeight(position.x, position.z) + 0.035, position.z);
    result.visible = false;
    group.add(result);
    siteGroups.set(id, result);
    return result;
  };
  const signals = new Map<string, THREE.Mesh>();
  const signal = (parent: THREE.Group, id: string, height: number) => {
    const point = part(parent, diamond, glow, [0, height, 0], [0.045, 0.075, 0.045]);
    point.castShadow = false;
    point.name = `${id}-glimmer`;
    signals.set(id, point);
    return point;
  };
  const lids = new Map<string, THREE.Group>();
  const chest = (parent: THREE.Group, id: string, daily = false) => {
    const body = new THREE.Group();
    parent.add(body);
    box(body, daily ? leather : dark, [0, 0.3, 0], [daily ? 0.68 : 1.06, 0.54, daily ? 0.46 : 0.7]);
    box(body, wood, [0, 0.08, 0], [daily ? 0.74 : 1.14, 0.12, daily ? 0.52 : 0.78]);
    for (const side of [-1, 1])
      box(body, gold, [side * (daily ? 0.23 : 0.36), 0.3, 0], [0.055, 0.56, daily ? 0.48 : 0.73]);
    box(body, gold, [0, 0.44, daily ? 0.246 : 0.368], [0.15, 0.2, 0.055]);
    batch(body);
    const lid = new THREE.Group();
    lid.name = `${id}-lid`;
    lid.position.set(0, 0.56, daily ? -0.23 : -0.35);
    parent.add(lid);
    box(
      lid,
      daily ? leather : wood,
      [0, 0.075, daily ? 0.23 : 0.35],
      [daily ? 0.7 : 1.1, 0.17, daily ? 0.5 : 0.76],
    );
    for (const side of [-1, 1])
      box(
        lid,
        gold,
        [side * (daily ? 0.23 : 0.36), 0.17, daily ? 0.23 : 0.35],
        [0.055, 0.03, daily ? 0.48 : 0.73],
      );
    batch(lid);
    lids.set(id, lid);
    const treasure = part(
      parent,
      diamond,
      daily ? glow : warmGlow,
      [0, 0.64, 0],
      [0.15, 0.25, 0.15],
    );
    treasure.name = `${id}-treasure`;
    treasure.visible = false;
    treasure.castShadow = false;
  };

  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    group.traverse((object) => {
      if (object instanceof THREE.InstancedMesh) object.dispose();
    });
    geometries.forEach((item) => item.dispose());
    materials.forEach((item) => item.dispose());
    geometries.clear();
    materials.clear();
    siteGroups.clear();
    signals.clear();
    lids.clear();
    group.removeFromParent();
    group.clear();
  };
  try {
    const letter = place('letter', DISCOVERY_SITES.letter.position);
    const pack = new THREE.Group();
    letter.add(pack);
    ball(pack, leather, [-0.17, 0.29, -0.05], [0.3, 0.32, 0.2]);
    part(pack, ring, wood, [-0.17, 0.47, -0.06], [0.18, 0.18, 0.17]);
    box(pack, wood, [-0.17, 0.33, 0.16], [0.09, 0.35, 0.04]);
    box(pack, parchment, [0.22, 0.095, 0.27], [0.36, 0.035, 0.27], [-0.14, 0.28, 0]);
    ball(pack, gold, [0.22, 0.122, 0.27], [0.045, 0.018, 0.045]);
    box(pack, wood, [0.22, 0.65, -0.21], [0.06, 1.3, 0.07], [0, 0, -0.08]);
    box(pack, wood, [0.22, 1.12, -0.18], [0.64, 0.34, 0.08], [0, 0, -0.08]);
    box(pack, parchment, [0.16, 1.1, -0.12], [0.31, 0.27, 0.018], [0, 0, -0.04]);
    ball(pack, gold, [0.17, 1.03, -0.101], [0.035, 0.035, 0.008]);
    batch(pack);
    signal(letter, 'letter', 1.5);

    const camp = place('camp', DISCOVERY_SITES.camp.position);
    const journal = new THREE.Group();
    camp.add(journal);
    box(journal, wood, [0, 0.25, 0], [0.85, 0.5, 0.56]);
    for (const side of [-1, 1])
      box(journal, parchment, [side * 0.14, 0.56, 0], [0.29, 0.035, 0.32], [0, 0, side * -0.12]);
    for (let i = 0; i < 3; i++)
      box(journal, dark, [0.14, 0.583, -0.09 + i * 0.08], [0.18, 0.005, 0.012]);
    part(journal, cylinder, gold, [-0.3, 0.68, 0.05], [0.06, 0.22, 0.06]);
    batch(journal);
    signal(camp, 'camp', 1.0);

    for (const id of ['track-1', 'track-2', 'track-3'] as const) {
      const site = place(id, DISCOVERY_SITES[id].position);
      const marks = new THREE.Group();
      site.add(marks);
      for (let i = 0; i < 3; i++)
        for (const side of [-1, 1]) {
          ball(
            marks,
            moss,
            [side * 0.14 + i * 0.13 - 0.15, 0.014, (i - 1) * 0.5],
            [0.065, 0.017, 0.13],
          );
          ball(
            marks,
            cream,
            [side * 0.14 + i * 0.13 - 0.15, 0.018, (i - 1) * 0.5 - 0.11],
            [0.04, 0.02, 0.045],
          );
        }
      batch(marks);
      signal(site, id, 0.27);
    }
    const cache = place('cache', DISCOVERY_SITES.cache.position);
    chest(cache, 'cache');
    signal(cache, 'cache', 1.08);

    const bellColors = ['#dcc37e', '#82cbbc', '#bda5df'];
    const bellMaterials = bellColors.map((color) =>
      material(color, {
        emissive: color,
        emissiveIntensity: 0.035,
        metalness: 0.3,
        roughness: 0.45,
      }),
    );
    const bells: THREE.Group[] = [],
      bellLights: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const id = `bell-${i}` as 'bell-0' | 'bell-1' | 'bell-2';
      const site = place(id, DISCOVERY_SITES[id].position);
      const stand = new THREE.Group();
      site.add(stand);
      for (const side of [-1, 1]) box(stand, wood, [side * 0.33, 0.77, 0], [0.055, 1.54, 0.07]);
      box(stand, wood, [0, 1.51, 0], [0.78, 0.085, 0.11]);
      part(stand, cylinder, stone, [0, 0.075, 0], [0.42, 0.15, 0.38]);
      batch(stand);
      const bell = new THREE.Group();
      bell.name = `${id}-swing`;
      bell.position.y = 1.48;
      site.add(bell);
      part(bell, cylinder, bellMaterials[i], [0, -0.29, 0], [0.23, 0.46, 0.21]);
      part(bell, ring, gold, [0, -0.52, 0], [0.24, 0.24, 0.22], [Math.PI / 2, 0, 0]);
      ball(bell, dark, [0, -0.5, 0], [0.06, 0.13, 0.06]);
      if (i === 0)
        for (const side of [-1, 1])
          part(
            bell,
            ring,
            cream,
            [side * 0.052, -0.24 + side * 0.045, 0.198],
            [0.074, 0.025, 0.035],
          );
      if (i === 1) ball(bell, cream, [0, -0.27, 0.195], [0.055, 0.11, 0.025]);
      if (i === 2) {
        const star = new THREE.Shape();
        for (let j = 0; j < 10; j++) {
          const angle = (j * Math.PI) / 5 + Math.PI / 2,
            radius = j % 2 ? 0.049 : 0.11;
          if (j === 0) star.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
          else star.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
        }
        star.closePath();
        part(bell, geometry(new THREE.ShapeGeometry(star)), cream, [0, -0.27, 0.2], [1, 1, 1]);
      }
      batch(bell);
      bells.push(bell);
      const light = part(
        site,
        ring,
        bellMaterials[i],
        [0, 0.03, 0],
        [0.47, 0.47, 0.47],
        [Math.PI / 2, 0, 0],
      );
      light.name = `${id}-light`;
      light.castShadow = false;
      bellLights.push(light);
    }

    const vault = place('vault', DISCOVERY_SITES.vault.position);
    const arch = new THREE.Group();
    vault.add(arch);
    for (const side of [-1, 1]) {
      box(arch, stone, [side * 1.12, 0.89, -0.18], [0.36, 1.78, 0.44]);
      for (let i = 0; i < 6; i++)
        box(
          arch,
          moss,
          [side * 1.12 + Math.sin(i * 2.2) * 0.17, 0.22 + i * 0.29, 0.07],
          [0.22, 0.075, 0.08],
          [0, 0, side * (i % 2 ? 0.65 : -0.65)],
        );
    }
    const archGeometry = geometry(new THREE.TorusGeometry(1.12, 0.21, 6, 24, Math.PI));
    part(arch, archGeometry, stone, [0, 1.78, -0.18], [1, 1, 1]);
    batch(arch);
    const sealMaterial = material('#9acdb1', {
      emissive: '#84b7a0',
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.36,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const seal = part(
      vault,
      geometry(new THREE.CircleGeometry(1, 40)),
      sealMaterial,
      [0, 1.3, 0.09],
      [0.9, 1.28, 1],
    );
    seal.name = 'vault-seal';
    seal.castShadow = false;
    const vaultBox = new THREE.Group();
    vaultBox.position.set(0, 0, -0.38);
    vault.add(vaultBox);
    chest(vaultBox, 'vault');
    const daily = place('daily-cache', getDailyDiscoverySite('2000-01-01').position);
    chest(daily, 'daily-cache', true);
    signal(daily, 'daily-cache', 0.91);

    const trail = new THREE.InstancedMesh(diamond, glow, 14);
    trail.name = 'discovery-nearby-trail';
    trail.frustumCulled = false;
    trail.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(trail);
    const firefly = new THREE.Group();
    firefly.name = 'discovery-reward-firefly';
    group.add(firefly);
    firefly.visible = false;
    ball(firefly, warmGlow, [0, 0, 0], [0.065, 0.065, 0.065]);
    const auraMaterial = new THREE.MeshBasicMaterial({
      color: '#ffedb3',
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    });
    materials.add(auraMaterial);
    ball(firefly, auraMaterial, [0, 0, 0], [0.22, 0.22, 0.22]);
    const dummy = new THREE.Object3D();
    let initialized = false,
      lastTime = 0,
      clock = 0,
      previousChimes = '',
      previousAction = -1,
      previousDay = '';
    const rungAt = [-100, -100, -100];
    const chestOpening = { cache: 0, vault: 0, 'daily-cache': 0 };
    let sealOpacity = 0.36;
    const update = (time: number, frame?: SceneryFrame) => {
      if (disposed) return;
      const state = frame?.discovery ?? EMPTY,
        today = frame?.today ?? '2000-01-01';
      const dt = Math.max(
        0,
        Math.min(0.1, frame ? (Number.isFinite(frame.delta) ? frame.delta : 0) : time - lastTime),
      );
      lastTime = time;
      clock += dt;
      const available = getAvailableDiscoverySites(state, today),
        ids = new Set<string>(available.map((site) => site.id)),
        found = new Set<string>(state.found);
      const dailySite = getDailyDiscoverySite(today);
      daily.position.set(
        dailySite.position.x,
        getTerrainHeight(dailySite.position.x, dailySite.position.z) + 0.035,
        dailySite.position.z,
      );
      for (const [id, object] of siteGroups) object.visible = ids.has(id);
      const chimes = state.chimes.join(',');
      if (initialized && chimes !== previousChimes && state.chimes.length)
        rungAt[state.chimes.at(-1)!] = clock;
      const action = frame?.discoveryInteraction;
      if (action && action.serial !== previousAction) {
        if (initialized && /^bell-[012]$/.test(action.id)) rungAt[Number(action.id.at(-1))] = clock;
        previousAction = action.serial;
      }
      previousChimes = chimes;
      for (let i = 0; i < bells.length; i++) {
        const age = clock - rungAt[i],
          correct = state.chimes.includes(i);
        bells[i].rotation.z = age < 2 ? Math.sin(age * 18) * Math.exp(-age * 2.3) * 0.28 : 0;
        bellMaterials[i].emissiveIntensity = correct ? 0.75 : 0.035;
        bellLights[i].scale.setScalar(correct ? 0.52 : 0.47);
      }
      const wanted = {
        cache: state.found.includes('cache') ? 1 : 0,
        vault: state.completed ? 1 : 0,
        'daily-cache': state.dailyFinds.includes(today) ? 1 : 0,
      };
      for (const id of ['cache', 'vault', 'daily-cache'] as const) {
        if (!initialized || (id === 'daily-cache' && today !== previousDay))
          chestOpening[id] = wanted[id];
        else chestOpening[id] += (wanted[id] - chestOpening[id]) * (1 - Math.exp(-dt * 3.8));
        lids.get(id)!.rotation.x = -chestOpening[id] * 1.23;
        const treasure = group.getObjectByName(`${id}-treasure`);
        if (treasure) treasure.visible = chestOpening[id] > 0.22;
      }
      previousDay = today;
      const sealed = state.chimes.length < 3 && !state.completed;
      sealOpacity = initialized
        ? sealOpacity + ((sealed ? 0.36 : 0) - sealOpacity) * (1 - Math.exp(-dt * 2.4))
        : sealed
          ? 0.36
          : 0;
      sealMaterial.opacity = sealOpacity;
      seal.visible = sealOpacity > 0.005;
      for (const [id, point] of signals) {
        const resolved = id === 'daily-cache' ? state.dailyFinds.includes(today) : found.has(id);
        point.visible = !resolved;
        point.rotation.y = clock * 0.7;
        const pulse = 0.9 + Math.sin(clock * 2.1) * 0.13;
        point.scale.set(0.045 * pulse, 0.075 * pulse, 0.045 * pulse);
      }
      const player = frame?.position;
      const target = player
        ? available
            .filter(
              (site) =>
                site.kind !== 'bell' &&
                site.id !== 'vault' &&
                !(site.id === 'daily-cache'
                  ? state.dailyFinds.includes(today)
                  : found.has(site.id)),
            )
            .sort(
              (a, b) =>
                Math.hypot(a.position.x - player.x, a.position.z - player.z) -
                Math.hypot(b.position.x - player.x, b.position.z - player.z),
            )[0]
        : undefined;
      const targetDistance =
        player && target
          ? Math.hypot(target.position.x - player.x, target.position.z - player.z)
          : Infinity;
      trail.visible =
        !!player &&
        !!target &&
        targetDistance > 2.3 &&
        targetDistance < (frame?.companion ? 20 : 13);
      if (trail.visible && player && target)
        for (let i = 0; i < 14; i++) {
          const t = (i / 14 + clock * 0.055) % 1,
            x = THREE.MathUtils.lerp(player.x, target.position.x, t),
            z = THREE.MathUtils.lerp(player.z, target.position.z, t);
          dummy.position.set(
            x + Math.sin(i * 2.4 + clock) * 0.16,
            getTerrainHeight(x, z) + 0.15 + Math.sin(t * Math.PI) * 0.2,
            z,
          );
          dummy.scale.setScalar((0.021 + Math.sin(t * Math.PI) * 0.014) * (0.7 + t * 0.3));
          dummy.rotation.set(0, clock + i, 0);
          dummy.updateMatrix();
          trail.setMatrixAt(i, dummy.matrix);
        }
      trail.instanceMatrix.needsUpdate = trail.visible;
      const fireflyWasVisible = firefly.visible;
      firefly.visible = state.completed && !!player;
      if (firefly.visible && player) {
        const destination = new THREE.Vector3(
          player.x + Math.cos(clock * 0.8) * 0.8,
          getTerrainHeight(player.x, player.z) + 2.4 + Math.sin(clock * 1.7) * 0.25,
          player.z + Math.sin(clock * 0.8) * 0.7,
        );
        if (!initialized || !fireflyWasVisible) firefly.position.copy(destination);
        else firefly.position.lerp(destination, 1 - Math.exp(-dt * 4));
      }
      initialized = true;
    };
    update(0);
    // The first real frame restores saved poses directly instead of replaying rewards.
    initialized = false;
    return { group, update, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
