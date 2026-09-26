import * as THREE from 'three';
import {
  getTerrainHeight,
  isWalkable,
  resolveMovement,
  type WorldPoint,
} from '../../../game/world';
import type { SceneryFrame } from '../types';

export type WildlifeKind = 'deer' | 'rabbit' | 'bird';
export interface MeadowAnimal extends WorldPoint {
  readonly kind: WildlifeKind;
  readonly home: WorldPoint;
  readonly phase: number;
  heading: number;
  speed: number;
  alert: number;
  flight: number;
  alarm: number;
  gait: number;
}
const SPAWNS: ReadonlyArray<readonly [WildlifeKind, number, number]> = [
  ['deer', -6, 13],
  ['deer', 17, 12],
  ['deer', -69, 44],
  ['deer', -73, 49],
  ['deer', 46, -69],
  ['rabbit', -3, 18],
  ['rabbit', 10, 14],
  ['rabbit', 60, 56],
  ['rabbit', 67, 67],
  ['rabbit', -46, 51],
  ['rabbit', 4, -78],
  ['bird', 4, 17],
  ['bird', 17, 4],
  ['bird', 66, 47],
  ['bird', -77, 42],
  ['bird', -74, 44],
  ['bird', -6, -84],
  ['bird', 43, 56],
];
const approachAngle = (from: number, to: number, amount: number) =>
  from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * amount;

/** Bounded local simulation, shared with tests. Animals never become navigation obstacles. */
export function createWildlifeSimulation() {
  const animals: MeadowAnimal[] = SPAWNS.map(([kind, x, z], index) => {
    let home = { x, z };
    for (let i = 0; i < 24 && !isWalkable(home.x, home.z); i++) {
      const angle = i * 2.4;
      home = { x: x + Math.cos(angle) * (1 + i * 0.22), z: z + Math.sin(angle) * (1 + i * 0.22) };
    }
    return {
      kind,
      ...home,
      home,
      phase: index * 2.39,
      heading: index * 1.3,
      speed: 0,
      alert: 0,
      flight: 0,
      alarm: 0,
      gait: 0,
    };
  });
  let elapsed = 0;
  return {
    animals,
    update(_time: number, frame: SceneryFrame) {
      const dt = Number.isFinite(frame.delta) ? Math.max(0, Math.min(0.05, frame.delta)) : 0;
      if (!dt) return;
      elapsed += dt;
      for (const animal of animals) {
        const distance = Math.hypot(frame.position.x - animal.x, frame.position.z - animal.z);
        const startled = distance < (frame.running ? 11 : animal.kind === 'bird' ? 4.2 : 3.2);
        if (startled) animal.alarm = animal.kind === 'bird' ? 3.2 : 2.2;
        else animal.alarm = Math.max(0, animal.alarm - dt);
        const aware = distance < (frame.running ? 16 : 7) || animal.alarm > 0;
        animal.alert += ((aware ? 1 : 0) - animal.alert) * (1 - Math.exp(-dt * 6));
        const escaping = animal.alarm > 0;
        const wander = {
          x: animal.home.x + Math.sin(elapsed * 0.17 + animal.phase) * 4.5,
          z: animal.home.z + Math.cos(elapsed * 0.13 + animal.phase) * 3.7,
        };
        let dx = escaping ? animal.x - frame.position.x : wander.x - animal.x;
        let dz = escaping ? animal.z - frame.position.z : wander.z - animal.z;
        if (Math.hypot(dx, dz) < 0.05) {
          dx = Math.sin(animal.phase);
          dz = Math.cos(animal.phase);
        }
        const targetSpeed = escaping
          ? animal.kind === 'deer'
            ? 4.7
            : animal.kind === 'rabbit'
              ? 4.2
              : 5.1
          : aware
            ? 0
            : Math.sin(elapsed * 0.65 + animal.phase) > -0.05
              ? animal.kind === 'deer'
                ? 0.65
                : 0.45
              : 0;
        const speed = animal.speed + (targetSpeed - animal.speed) * (1 - Math.exp(-dt * 5));
        const angle = Math.atan2(-dx, -dz);
        animal.heading = approachAngle(
          animal.heading,
          angle,
          1 - Math.exp(-dt * (escaping ? 9 : 3)),
        );
        const before = { x: animal.x, z: animal.z };
        let next = resolveMovement(before, {
          x: animal.x - Math.sin(animal.heading) * speed * dt,
          z: animal.z - Math.cos(animal.heading) * speed * dt,
        });
        if (speed > 0 && Math.hypot(next.x - animal.x, next.z - animal.z) < speed * dt * 0.3) {
          animal.heading += dt * 4;
          next = resolveMovement(before, {
            x: animal.x - Math.sin(animal.heading + 0.8) * speed * dt,
            z: animal.z - Math.cos(animal.heading + 0.8) * speed * dt,
          });
        }
        animal.x = next.x;
        animal.z = next.z;
        animal.speed = Math.hypot(next.x - before.x, next.z - before.z) / dt;
        animal.gait +=
          (animal.speed * dt * Math.PI * 2) /
          (animal.kind === 'deer' ? 2.6 : animal.kind === 'rabbit' ? 1.25 : 0.75);
        animal.flight +=
          ((animal.kind === 'bird' && escaping ? 1 : 0) - animal.flight) * (1 - Math.exp(-dt * 3));
      }
    },
  };
}

/** Three dynamic instance batches render all articulated animals in three draw calls. */
export function createMeadowWildlife() {
  const group = new THREE.Group();
  group.name = 'meadow-wildlife';
  const simulation = createWildlifeSimulation();
  const sphere = new THREE.SphereGeometry(1, 10, 7);
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
  const rigs = simulation.animals.map((animal, index) => {
    const root = new THREE.Group();
    group.add(root);
    const fur =
      animal.kind === 'deer'
        ? index % 2
          ? '#bd9265'
          : '#a8774c'
        : animal.kind === 'rabbit'
          ? index % 3
            ? '#d5c6ab'
            : '#e6e1d2'
          : '#4d91a0';
    const head = pivot(
      root,
      0,
      animal.kind === 'deer' ? 1.85 : animal.kind === 'rabbit' ? 0.62 : 0.49,
      animal.kind === 'deer' ? -0.74 : animal.kind === 'rabbit' ? -0.33 : -0.2,
    );
    const legs: THREE.Object3D[] = [],
      wings: THREE.Object3D[] = [];
    if (animal.kind === 'deer') {
      part(root, 'sphere', fur, [0, 1.27, 0], [0.43, 0.54, 0.88]);
      part(root, 'sphere', '#dfc9a5', [0, 1.0, -0.16], [0.32, 0.31, 0.59]);
      part(root, 'sphere', fur, [0, 1.63, -0.56], [0.24, 0.49, 0.32], [-0.36, 0, 0]);
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
          part(leg, 'cylinder', fur, [0, -0.43, 0], [0.095, 0.88, 0.105]);
          part(leg, 'sphere', '#514838', [0, -0.95, -0.045], [0.1, 0.11, 0.15]);
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
          [-0.14, 0, side * -0.15],
        );
        part(
          head,
          'sphere',
          '#c9a89d',
          [side * 0.1, 0.35, -0.051],
          [0.037, 0.24, 0.014],
          [-0.14, 0, side * -0.15],
        );
        part(head, 'sphere', '#333b38', [side * 0.184, 0.045, -0.17], [0.031, 0.041, 0.036]);
        for (const fore of [-1, 1]) {
          const leg = pivot(root, side * 0.18, 0.18, fore * 0.26);
          legs.push(leg);
          part(leg, 'sphere', fur, [0, -0.06, -0.065], [0.105, fore === 1 ? 0.16 : 0.09, 0.19]);
        }
      }
    } else {
      part(root, 'sphere', fur, [0, 0.28, 0], [0.18, 0.19, 0.3]);
      part(root, 'sphere', '#e5c795', [0, 0.24, -0.15], [0.15, 0.14, 0.14]);
      part(root, 'sphere', '#326f82', [0, 0.3, 0.32], [0.11, 0.04, 0.22], [0.25, 0, 0]);
      part(head, 'sphere', fur, [0, 0, 0], [0.15, 0.15, 0.16]);
      part(head, 'cone', '#dba05c', [0, -0.02, -0.18], [0.06, 0.18, 0.055], [-Math.PI / 2, 0, 0]);
      for (const side of [-1, 1]) {
        part(head, 'sphere', '#233e3c', [side * 0.12, 0.026, -0.078], [0.021, 0.026, 0.025]);
        const wing = pivot(root, side * 0.14, 0.34, 0);
        wings.push(wing);
        part(wing, 'sphere', '#437c8e', [side * 0.11, 0, 0.04], [0.17, 0.052, 0.29]);
        part(root, 'cylinder', '#af9470', [side * 0.06, 0.075, 0], [0.018, 0.15, 0.018]);
      }
    }
    return { root, head, legs, wings };
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
          animal.flight * (2.6 + Math.sin(animationTime * 3 + animal.phase) * 0.2),
        animal.z,
      );
      rig.root.rotation.y = animal.heading;
      const relaxedHead =
        animal.kind === 'deer'
          ? -0.48 + Math.sin(animationTime * 0.7 + animal.phase) * 0.22
          : Math.sin(animationTime * 1.1 + animal.phase) * 0.12;
      rig.head.rotation.x +=
        (THREE.MathUtils.lerp(relaxedHead, 0.1, animal.alert) - rig.head.rotation.x) *
        (1 - Math.exp(-dt * 6));
      rig.head.rotation.y +=
        (Math.sin(animationTime * 1.5 + animal.phase) * 0.2 * animal.alert - rig.head.rotation.y) *
        (1 - Math.exp(-dt * 6));
      rig.legs.forEach((leg, j) => {
        leg.rotation.x = Math.sin(stride + (j === 0 || j === 3 ? 0 : Math.PI)) * moving * 0.75;
      });
      rig.wings.forEach((wing, j) => {
        wing.rotation.z =
          (j === 0 ? -1 : 1) *
          THREE.MathUtils.lerp(
            -0.18,
            Math.sin(animationTime * 17 + animal.phase) * 1.08,
            animal.flight,
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
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const { batch } of batches) batch.dispose();
      sphere.dispose();
      cylinder.dispose();
      cone.dispose();
      material.dispose();
      group.removeFromParent();
      group.clear();
    },
  };
}
