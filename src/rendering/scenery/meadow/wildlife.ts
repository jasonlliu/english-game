import * as THREE from 'three';
import {
  getTerrainHeight,
  isWalkable,
  resolveMovement,
  type WorldPoint,
} from '../../../game/world';
import type { SceneryFrame, WildlifeObservation } from '../types';

export type WildlifeKind = WildlifeObservation['kind'];
export type WildlifeBehavior =
  | 'graze'
  | 'drink'
  | 'rest'
  | 'wander'
  | 'alert'
  | 'flee'
  | 'perch'
  | 'guide'
  | 'flutter'
  | 'groom'
  | 'stalk';
export interface MeadowAnimal extends WorldPoint {
  readonly id: string;
  readonly kind: WildlifeKind;
  readonly home: WorldPoint;
  readonly homeRadius: number;
  readonly phase: number;
  heading: number;
  speed: number;
  alert: number;
  flight: number;
  alarm: number;
  gait: number;
  startled: boolean;
  activity: number;
  behavior: WildlifeBehavior;
  timer: number;
  cycle: number;
  target: WorldPoint;
  returning: boolean;
  perchIndex: number;
}
/** Sparse, authored habitats: one encounter per place, rather than a spawn-point menagerie. */
const SPAWNS: ReadonlyArray<readonly [WildlifeKind, number, number, number]> = [
  ['deer', 22, 11, 8],
  ['deer', 19, 13, 7],
  ['bird', -6, 18, 9],
  ['rabbit', -71, 44, 5],
  ['fox', -38, -12, 6],
  ['butterfly', 66, 58, 2.8],
  ['butterfly', 69, 64, 2.8],
];
export const MEADOW_BIRD_PERCHES: readonly WorldPoint[] = [
  { x: -6, z: 18 },
  { x: -9, z: 15 },
  { x: -12, z: 12 },
];
const DRINKING_BANK = { x: 26, z: 7 };
const approachAngle = (from: number, to: number, amount: number) =>
  from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * amount;
const homeDistance = (animal: MeadowAnimal) =>
  Math.hypot(animal.x - animal.home.x, animal.z - animal.home.z);
function boundedPoint(point: WorldPoint, home: WorldPoint, radius: number): WorldPoint {
  const dx = point.x - home.x,
    dz = point.z - home.z;
  const factor = Math.min(1, radius / (Math.hypot(dx, dz) || 1));
  return { x: home.x + dx * factor, z: home.z + dz * factor };
}
function feedingPatch(animal: MeadowAnimal): WorldPoint {
  for (let attempt = 0; attempt < 8; attempt++) {
    const angle = animal.phase + animal.cycle * 2.4 + attempt * 0.7;
    const radius = animal.homeRadius * (animal.kind === 'butterfly' ? 0.68 : 0.45);
    const point = {
      x: animal.home.x + Math.cos(angle) * radius,
      z: animal.home.z + Math.sin(angle) * radius,
    };
    if (isWalkable(point.x, point.z)) return point;
  }
  return { ...animal.home };
}

/** All movement, including prolonged flight from a visitor, stays inside the authored habitat. */
export function createWildlifeSimulation() {
  const animals: MeadowAnimal[] = SPAWNS.map(([kind, x, z, homeRadius], index) => {
    let home = { x, z };
    for (let i = 0; i < 24 && !isWalkable(home.x, home.z); i++) {
      const angle = i * 2.4;
      home = { x: x + Math.cos(angle) * (1 + i * 0.22), z: z + Math.sin(angle) * (1 + i * 0.22) };
    }
    return {
      id: `meadow-${kind}-${index}`,
      kind,
      ...home,
      home,
      homeRadius,
      phase: index * 2.39,
      heading: kind === 'deer' ? -0.5 : index * 1.3,
      speed: 0,
      alert: 0,
      flight: kind === 'butterfly' ? 0.4 : 0,
      alarm: 0,
      gait: 0,
      startled: false,
      activity: 0,
      behavior: kind === 'bird' ? 'perch' : kind === 'butterfly' ? 'flutter' : 'graze',
      timer: kind === 'bird' ? 4 : 3 + (index % 4),
      cycle: 0,
      target: { ...home },
      returning: false,
      perchIndex: 0,
    };
  });
  return {
    animals,
    update(_time: number, frame: SceneryFrame) {
      const dt = Number.isFinite(frame.delta) ? Math.max(0, Math.min(0.05, frame.delta)) : 0;
      if (!dt) return;
      for (const animal of animals) {
        const distance = Math.hypot(frame.position.x - animal.x, frame.position.z - animal.z);
        const alarmed = distance < (frame.running ? 10 : animal.kind === 'bird' ? 2.8 : 2.6);
        const previouslyStartled = animal.startled;
        if (alarmed) animal.alarm = animal.kind === 'bird' ? 2.8 : 2.2;
        else animal.alarm = Math.max(0, animal.alarm - dt);
        const escaping = (animal.startled = animal.alarm > 0);
        const aware = distance < (frame.running ? 15 : 7) || escaping;
        animal.alert += ((aware ? 1 : 0) - animal.alert) * (1 - Math.exp(-dt * 6));
        if (previouslyStartled && !escaping) {
          animal.returning = true;
          animal.target =
            animal.kind === 'bird' ? { ...MEADOW_BIRD_PERCHES[0] } : { ...animal.home };
          animal.perchIndex = 0;
        }
        animal.timer -= dt;
        if (animal.timer <= 0 && !escaping && !animal.returning) {
          animal.cycle++;
          if (animal.kind === 'bird') {
            // The same blue bird leads a quiet visitor between three low branches.
            const lead = distance < 8 && !frame.running && frame.observingId !== animal.id;
            if (lead) {
              animal.perchIndex = (animal.perchIndex + 1) % MEADOW_BIRD_PERCHES.length;
              animal.target = { ...MEADOW_BIRD_PERCHES[animal.perchIndex] };
              animal.activity = 2;
            }
            animal.timer = 6;
          } else {
            animal.activity = animal.cycle % 3;
            animal.timer =
              animal.kind === 'deer'
                ? 8
                : 4 + (Math.sin(animal.phase + animal.cycle * 4.3) + 1) * 2;
            animal.target =
              animal.kind === 'deer' && animal.activity === 1
                ? boundedPoint(DRINKING_BANK, animal.home, animal.homeRadius * 0.85)
                : feedingPatch(animal);
            if (!isWalkable(animal.target.x, animal.target.z)) animal.target = feedingPatch(animal);
          }
        }
        let dx = animal.target.x - animal.x,
          dz = animal.target.z - animal.z;
        const remaining = Math.hypot(dx, dz);
        if (animal.returning && remaining < 0.4) {
          animal.returning = false;
          animal.activity = 0;
          animal.timer = 4;
        }
        const guiding =
          animal.kind === 'bird' && (animal.activity === 2 || animal.returning) && remaining > 0.18;
        if (animal.kind === 'bird' && !guiding && !escaping) animal.activity = 0;
        if (escaping) {
          dx = animal.x - frame.position.x;
          dz = animal.z - frame.position.z;
          const away = Math.hypot(dx, dz) || 1;
          dx /= away;
          dz /= away;
          // Turn back or along the perimeter before reaching the hard habitat boundary.
          const radial = homeDistance(animal) / animal.homeRadius;
          const homePull = Math.max(0, (radial - 0.45) * 4);
          dx += ((animal.home.x - animal.x) / animal.homeRadius) * homePull;
          dz += ((animal.home.z - animal.z) / animal.homeRadius) * homePull;
          if (Math.hypot(dx, dz) < 0.3) {
            dx += (animal.z - animal.home.z) / animal.homeRadius;
            dz -= (animal.x - animal.home.x) / animal.homeRadius;
          }
        }
        const movingToPatch =
          animal.returning ||
          animal.activity === 2 ||
          (animal.kind === 'deer' && animal.activity === 1) ||
          animal.kind === 'butterfly';
        const targetSpeed = escaping
          ? animal.kind === 'deer'
            ? 4.7
            : animal.kind === 'rabbit'
              ? 4.2
              : 4.8
          : guiding
            ? 1.7
            : aware && animal.kind !== 'butterfly'
              ? 0
              : movingToPatch && remaining > 0.35
                ? animal.kind === 'deer'
                  ? 0.8
                  : animal.kind === 'fox'
                    ? 0.7
                    : 0.48
                : 0;
        const speed = animal.speed + (targetSpeed - animal.speed) * (1 - Math.exp(-dt * 5));
        if (targetSpeed > 0)
          animal.heading = approachAngle(
            animal.heading,
            Math.atan2(-dx, -dz),
            1 - Math.exp(-dt * (escaping ? 9 : 4)),
          );
        const before = { x: animal.x, z: animal.z };
        const destination = boundedPoint(
          {
            x: animal.x - Math.sin(animal.heading) * speed * dt,
            z: animal.z - Math.cos(animal.heading) * speed * dt,
          },
          animal.home,
          animal.homeRadius,
        );
        let next = resolveMovement(before, destination);
        if (speed > 0 && Math.hypot(next.x - animal.x, next.z - animal.z) < speed * dt * 0.3) {
          animal.heading += dt * 4;
          next = resolveMovement(
            before,
            boundedPoint(
              {
                x: animal.x - Math.sin(animal.heading + 0.8) * speed * dt,
                z: animal.z - Math.cos(animal.heading + 0.8) * speed * dt,
              },
              animal.home,
              animal.homeRadius,
            ),
          );
        }
        if (animal.kind === 'bird' && !escaping && remaining < 0.6) {
          const settle = 1 - Math.exp(-dt * 8);
          next = resolveMovement(before, {
            x: animal.x + dx * settle,
            z: animal.z + dz * settle,
          });
        }
        // Sliding around an obstacle must not escape a circular home range either.
        if (Math.hypot(next.x - animal.home.x, next.z - animal.home.z) > animal.homeRadius + 1e-8)
          next = before;
        animal.x = next.x;
        animal.z = next.z;
        animal.speed = Math.hypot(next.x - before.x, next.z - before.z) / dt;
        animal.gait +=
          (animal.speed * dt * Math.PI * 2) /
          (animal.kind === 'deer' ? 2.6 : animal.kind === 'rabbit' ? 1.25 : 0.75);
        animal.behavior = escaping
          ? 'flee'
          : guiding
            ? 'guide'
            : animal.kind === 'bird'
              ? 'perch'
              : aware && animal.kind !== 'butterfly'
                ? 'alert'
                : animal.speed > 0.15
                  ? animal.kind === 'fox'
                    ? 'stalk'
                    : animal.kind === 'butterfly'
                      ? 'flutter'
                      : 'wander'
                  : animal.kind === 'deer'
                    ? animal.activity === 1 && remaining < 0.6
                      ? 'drink'
                      : 'graze'
                    : animal.kind === 'rabbit'
                      ? animal.activity === 1
                        ? 'groom'
                        : 'graze'
                      : animal.kind === 'butterfly'
                        ? 'flutter'
                        : 'rest';
        const desiredFlight =
          animal.kind === 'butterfly'
            ? 0.4
            : animal.kind === 'bird' && (escaping || guiding)
              ? 1
              : 0;
        animal.flight += (desiredFlight - animal.flight) * (1 - Math.exp(-dt * 3));
      }
    },
  };
}

/** Three dynamic instance batches render all articulated animals in three draw calls. */
export function createMeadowWildlife() {
  const group = new THREE.Group();
  group.name = 'meadow-wildlife';
  const simulation = createWildlifeSimulation();
  const sphere = new THREE.SphereGeometry(1, 16, 10);
  const cylinder = new THREE.CylinderGeometry(0.65, 1, 1, 7);
  const cone = new THREE.ConeGeometry(1, 1, 7);
  const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 });
  type Shape = 'sphere' | 'cylinder' | 'cone';
  const parts: Record<Shape, Array<{ object: THREE.Object3D; color: THREE.Color }>> = {
    sphere: [],
    cylinder: [],
    cone: [],
  };
  const part = (
    parent: THREE.Object3D,
    shape: Shape,
    color: string,
    p: number[],
    s: number[],
    rotation = [0, 0, 0],
  ) => {
    const object = new THREE.Object3D();
    object.position.set(p[0], p[1], p[2]);
    object.scale.set(s[0], s[1], s[2]);
    object.rotation.set(rotation[0], rotation[1], rotation[2]);
    parent.add(object);
    parts[shape].push({ object, color: new THREE.Color(color) });
    return object;
  };
  const pivot = (parent: THREE.Object3D, x: number, y: number, z: number) => {
    const object = new THREE.Group();
    object.position.set(x, y, z);
    parent.add(object);
    return object;
  };
  // Authored low perches make landing readable; these share the animal draw batches.
  for (const [index, perch] of MEADOW_BIRD_PERCHES.entries()) {
    const branch = pivot(group, perch.x, getTerrainHeight(perch.x, perch.z), perch.z);
    branch.name = `meadow-bird-perch-${index}`;
    part(branch, 'cylinder', '#78634c', [0, 0.4, 0], [0.07, 0.82, 0.07], [0.12, 0, -0.16]);
    part(branch, 'cylinder', '#8f7859', [0.04, 0.73, 0], [0.047, 1.1, 0.047], [0, 0, 1.44]);
    part(branch, 'cone', '#a49170', [-0.39, 0.86, 0], [0.038, 0.32, 0.038], [0, 0, -0.4]);
    branch.updateMatrixWorld(true);
  }
  const rigs = simulation.animals.map((animal, index) => {
    const root = new THREE.Group();
    group.add(root);
    root.name = animal.id;
    if (animal.kind === 'deer') root.scale.setScalar(index % 2 ? 0.63 : 1.08);
    const fur =
      animal.kind === 'deer'
        ? index % 2
          ? '#bd9265'
          : '#a8774c'
        : animal.kind === 'rabbit'
          ? index % 3
            ? '#d5c6ab'
            : '#e6e1d2'
          : animal.kind === 'fox'
            ? '#c96b32'
            : '#4c91b0';
    const neck = animal.kind === 'deer' ? pivot(root, 0, 1.44, -0.58) : null;
    const head = pivot(
      neck ?? root,
      0,
      animal.kind === 'deer'
        ? 0.41
        : animal.kind === 'rabbit'
          ? 0.62
          : animal.kind === 'fox'
            ? 0.82
            : 0.49,
      animal.kind === 'deer'
        ? -0.16
        : animal.kind === 'rabbit'
          ? -0.33
          : animal.kind === 'fox'
            ? -0.56
            : -0.2,
    );
    const legs: THREE.Object3D[] = [],
      wings: THREE.Object3D[] = [],
      knees: THREE.Object3D[] = [];
    const tail = pivot(root, 0, animal.kind === 'fox' ? 0.62 : 0.25, 0.42);
    if (animal.kind === 'deer') {
      part(root, 'sphere', fur, [0, 1.27, 0], [0.43, 0.54, 0.88]);
      part(root, 'sphere', '#dfc9a5', [0, 1.0, -0.16], [0.32, 0.31, 0.59]);
      part(neck!, 'sphere', fur, [0, 0.19, 0.02], [0.24, 0.49, 0.32], [-0.36, 0, 0]);
      part(neck!, 'sphere', '#ddc09a', [0, 0.13, -0.2], [0.14, 0.35, 0.1], [-0.36, 0, 0]);
      part(root, 'sphere', '#e6d6b4', [0, 1.48, 0.87], [0.15, 0.19, 0.24], [0.4, 0, 0]);
      part(head, 'sphere', fur, [0, 0, -0.12], [0.24, 0.26, 0.36]);
      part(head, 'sphere', '#d7bb92', [0, -0.12, -0.41], [0.17, 0.13, 0.23]);
      part(head, 'sphere', '#493c32', [0, -0.07, -0.6], [0.105, 0.075, 0.045]);
      for (const side of [-1, 1]) {
        part(
          head,
          'sphere',
          fur,
          [side * 0.24, 0.28, 0.03],
          [0.13, 0.31, 0.08],
          [0, 0, side * -0.57],
        );
        part(head, 'sphere', '#34382f', [side * 0.218, 0.045, -0.22], [0.035, 0.047, 0.045]);
        for (const fore of [-1, 1]) {
          const leg = pivot(root, side * 0.27, 1.04, fore * 0.53);
          legs.push(leg);
          part(leg, 'sphere', fur, [0, -0.2, 0], [0.11, 0.29, 0.14]);
          const knee = pivot(leg, 0, -0.48, 0);
          knees.push(knee);
          part(knee, 'sphere', '#936744', [0, 0, 0], [0.08, 0.095, 0.09]);
          part(knee, 'cylinder', fur, [0, -0.2, 0], [0.062, 0.43, 0.073]);
          part(knee, 'sphere', '#514838', [0, -0.47, -0.045], [0.08, 0.085, 0.13]);
        }
        if (index % 2 === 0)
          for (let branch = 0; branch < 3; branch++) {
            part(
              head,
              'cylinder',
              '#bdb393',
              [side * (0.18 + branch * 0.075), 0.4 + branch * 0.2, 0.08 + branch * 0.02],
              [0.045, 0.36, 0.045],
              [branch * 0.3, 0, side * -0.3],
            );
            if (branch < 2)
              part(
                head,
                'cone',
                '#d9ccb0',
                [side * (0.28 + branch * 0.075), 0.52 + branch * 0.2, -0.04],
                [0.038, 0.3, 0.038],
                [-0.75, 0, side * -0.8],
              );
          }
        for (let spot = 0; spot < 4; spot++)
          part(
            root,
            'sphere',
            '#e6cfaa',
            [side * 0.408, 1.42 + (spot % 2) * 0.13, -0.3 + spot * 0.22],
            [0.019, 0.055, 0.07],
          );
      }
    } else if (animal.kind === 'rabbit') {
      part(root, 'sphere', fur, [0, 0.36, 0.08], [0.28, 0.31, 0.44]);
      part(root, 'sphere', '#eee7d8', [0, 0.38, 0.49], [0.14, 0.15, 0.13]);
      part(head, 'sphere', fur, [0, 0, -0.07], [0.21, 0.22, 0.25]);
      part(head, 'sphere', '#b5978c', [0, -0.035, -0.295], [0.045, 0.04, 0.03]);
      for (const side of [-1, 1]) {
        part(
          head,
          'sphere',
          fur,
          [side * 0.1, 0.33, 0.02],
          [0.072, 0.34, 0.08],
          [-0.14, 0, side * (index % 2 && side === 1 ? -0.8 : -0.15)],
        );
        part(
          head,
          'sphere',
          '#c9a89d',
          [side * 0.1, 0.35, -0.051],
          [0.037, 0.24, 0.014],
          [-0.14, 0, side * (index % 2 && side === 1 ? -0.8 : -0.15)],
        );
        part(head, 'sphere', '#333b38', [side * 0.184, 0.045, -0.17], [0.031, 0.041, 0.036]);
        for (const fore of [-1, 1]) {
          const leg = pivot(root, side * 0.18, 0.18, fore * 0.26);
          legs.push(leg);
          part(leg, 'sphere', fur, [0, -0.06, -0.065], [0.105, fore === 1 ? 0.16 : 0.09, 0.19]);
        }
      }
    } else if (animal.kind === 'fox') {
      part(root, 'sphere', fur, [0, 0.65, 0], [0.28, 0.29, 0.64]);
      part(root, 'sphere', '#efe3c7', [0, 0.51, -0.37], [0.24, 0.25, 0.29]);
      part(head, 'sphere', fur, [0, 0, 0], [0.27, 0.27, 0.3]);
      part(head, 'cone', '#eee3ce', [0, -0.06, -0.31], [0.2, 0.47, 0.16], [-Math.PI / 2, 0, 0]);
      part(head, 'sphere', '#322e32', [0, -0.06, -0.56], [0.055, 0.047, 0.055]);
      part(tail, 'sphere', fur, [0, 0.07, 0.43], [0.24, 0.26, 0.63], [0.3, 0, 0]);
      part(tail, 'sphere', '#f3e9d3', [0, -0.12, 0.96], [0.16, 0.17, 0.26], [0.3, 0, 0]);
      for (const side of [-1, 1]) {
        part(
          head,
          'cone',
          fur,
          [side * 0.17, 0.34, 0.04],
          [0.15, 0.41, 0.12],
          [0, 0, side * -0.16],
        );
        part(head, 'cone', '#4e3534', [side * 0.17, 0.34, -0.055], [0.08, 0.27, 0.025]);
        part(head, 'sphere', '#332d2b', [side * 0.235, 0.035, -0.14], [0.033, 0.038, 0.04]);
        for (const fore of [-1, 1]) {
          const leg = pivot(root, side * 0.2, 0.51, fore * 0.4);
          legs.push(leg);
          part(leg, 'cylinder', '#5b3a30', [0, -0.22, 0], [0.07, 0.47, 0.08]);
          part(leg, 'sphere', '#42332e', [0, -0.46, -0.045], [0.08, 0.065, 0.12]);
        }
      }
    } else if (animal.kind === 'butterfly') {
      part(root, 'sphere', '#403d49', [0, 0, 0], [0.036, 0.045, 0.16]);
      for (const side of [-1, 1]) {
        const wing = pivot(root, side * 0.02, 0, 0);
        wings.push(wing);
        part(
          wing,
          'sphere',
          index % 2 ? '#eeb761' : '#92bdeb',
          [side * 0.2, 0, -0.05],
          [0.24, 0.019, 0.23],
        );
        part(wing, 'sphere', '#695a8f', [side * 0.14, 0, 0.18], [0.16, 0.018, 0.16]);
        part(wing, 'sphere', '#ffedc5', [side * 0.23, 0.024, -0.08], [0.057, 0.012, 0.065]);
      }
    } else {
      part(root, 'sphere', fur, [0, 0.28, 0], [0.18, 0.19, 0.3]);
      part(root, 'sphere', '#e5c795', [0, 0.24, -0.15], [0.15, 0.14, 0.14]);
      for (const feather of [-1, 0, 1])
        part(
          root,
          'sphere',
          '#326f82',
          [feather * 0.06, 0.3, 0.35],
          [0.046, 0.027, 0.28],
          [0.25, feather * 0.18, 0],
        );
      part(head, 'sphere', fur, [0, 0, 0], [0.15, 0.15, 0.16]);
      part(head, 'sphere', '#e4e6d5', [0, -0.065, -0.115], [0.12, 0.073, 0.082]);
      part(head, 'cone', '#315c78', [0, 0.17, 0.035], [0.068, 0.23, 0.1], [-0.55, 0, 0]);
      part(head, 'cone', '#dba05c', [0, -0.02, -0.18], [0.06, 0.18, 0.055], [-Math.PI / 2, 0, 0]);
      for (const side of [-1, 1]) {
        part(head, 'sphere', '#233e3c', [side * 0.12, 0.026, -0.078], [0.021, 0.026, 0.025]);
        const wing = pivot(root, side * 0.14, 0.34, 0);
        wings.push(wing);
        part(wing, 'sphere', '#437c8e', [side * 0.11, 0, 0.04], [0.17, 0.052, 0.29]);
        part(root, 'cylinder', '#af9470', [side * 0.06, 0.075, 0], [0.018, 0.15, 0.018]);
      }
    }
    return { root, head, neck, legs, knees, wings, tail };
  });
  const batches = (['sphere', 'cylinder', 'cone'] as const).map((shape) => {
    const batch = new THREE.InstancedMesh(
      shape === 'sphere' ? sphere : shape === 'cylinder' ? cylinder : cone,
      material,
      parts[shape].length,
    );
    batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    batch.castShadow = true;
    batch.receiveShadow = true;
    batch.frustumCulled = false;
    parts[shape].forEach((entry, index) => batch.setColorAt(index, entry.color));
    group.add(batch);
    return { shape, batch };
  });
  const markerGeometry = new THREE.RingGeometry(0.72, 0.81, 48);
  const markerMaterial = new THREE.MeshBasicMaterial({
    color: '#ffdf91',
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const marker = new THREE.Mesh(markerGeometry, markerMaterial);
  marker.name = 'wildlife-observation-marker';
  marker.rotation.x = -Math.PI / 2;
  marker.visible = false;
  group.add(marker);
  let disposed = false,
    lastTime = 0,
    animationTime = 0;
  const update = (time: number, frame?: SceneryFrame) => {
    if (disposed) return;
    const currentFrame = frame ?? {
      position: { x: 1000, z: 1000 },
      running: false,
      delta: Math.max(0, Math.min(0.05, time - lastTime)),
    };
    const dt = Number.isFinite(currentFrame.delta)
      ? Math.max(0, Math.min(0.05, currentFrame.delta))
      : 0;
    animationTime += dt;
    simulation.update(time, currentFrame);
    lastTime = time;
    const subject = simulation.animals.find((animal) => animal.id === frame?.observingId);
    marker.visible = !!subject && !subject.startled;
    if (subject) {
      marker.position.set(subject.x, getTerrainHeight(subject.x, subject.z) + 0.08, subject.z);
      marker.scale.setScalar(subject.kind === 'deer' ? 1.45 : subject.kind === 'fox' ? 1.1 : 0.8);
    }
    simulation.animals.forEach((animal, index) => {
      const rig = rigs[index],
        moving = Math.min(1, animal.speed / 3.5),
        stride = animal.gait + animal.phase;
      const hop =
        animal.kind === 'rabbit'
          ? Math.max(0, Math.sin(stride)) * moving * 0.29
          : Math.abs(Math.sin(stride)) * moving * 0.06;
      rig.root.position.set(
        animal.x,
        getTerrainHeight(animal.x, animal.z) +
          hop +
          (animal.kind === 'bird' ? 0.78 : 0) +
          animal.flight * (animal.kind === 'bird' ? 1.7 : 2.6) +
          animal.flight * Math.sin(animationTime * 3 + animal.phase) * 0.12,
        animal.z,
      );
      rig.root.rotation.y = animal.heading;
      const grazing = animal.behavior === 'graze' || animal.behavior === 'drink';
      const relaxedHead = grazing
        ? (animal.kind === 'deer' ? 0.1 : -0.4) + Math.sin(animationTime * 3 + animal.phase) * 0.06
        : Math.sin(animationTime * 1.1 + animal.phase) * 0.12;
      const grooming = animal.behavior === 'groom';
      if (rig.neck) {
        const neckPose =
          animal.behavior === 'drink'
            ? -1.85
            : grazing
              ? -1.55
              : animal.behavior === 'alert'
                ? 0.12
                : 0;
        rig.neck.rotation.x += (neckPose - rig.neck.rotation.x) * (1 - Math.exp(-dt * 2.6));
      }
      rig.root.rotation.x +=
        ((grooming ? 0.33 : 0) - rig.root.rotation.x) * (1 - Math.exp(-dt * 4));
      rig.tail.rotation.y = Math.sin(animationTime * 2 + animal.phase) * 0.26;
      rig.head.rotation.x +=
        (THREE.MathUtils.lerp(relaxedHead, 0.1, animal.alert) - rig.head.rotation.x) *
        (1 - Math.exp(-dt * 6));
      rig.head.rotation.y +=
        (Math.sin(animationTime * 1.5 + animal.phase) * 0.2 * animal.alert - rig.head.rotation.y) *
        (1 - Math.exp(-dt * 6));
      rig.legs.forEach((leg, j) => {
        leg.rotation.x = Math.sin(stride + (j === 0 || j === 3 ? 0 : Math.PI)) * moving * 0.75;
      });
      rig.knees.forEach((knee, j) => {
        knee.rotation.x =
          Math.max(0, -Math.sin(stride + (j === 0 || j === 3 ? 0 : Math.PI))) * moving * 0.65;
      });
      rig.wings.forEach((wing, j) => {
        wing.rotation.z =
          (j === 0 ? -1 : 1) *
          THREE.MathUtils.lerp(
            -0.18,
            Math.sin(animationTime * 17 + animal.phase) * 1.08,
            animal.kind === 'butterfly' ? 1 : animal.flight,
          );
      });
      rig.root.updateMatrixWorld(true);
    });
    for (const { shape, batch } of batches) {
      parts[shape].forEach((entry, index) => batch.setMatrixAt(index, entry.object.matrixWorld));
      batch.instanceMatrix.needsUpdate = true;
    }
  };
  update(0);
  return {
    group,
    update,
    observe: (): readonly WildlifeObservation[] => simulation.animals,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const { batch } of batches) batch.dispose();
      sphere.dispose();
      cylinder.dispose();
      cone.dispose();
      material.dispose();
      markerGeometry.dispose();
      markerMaterial.dispose();
      group.removeFromParent();
      group.clear();
    },
  };
}
