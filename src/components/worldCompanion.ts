import * as THREE from 'three';

type Point = [number, number, number];
type Radius = [number, number];

/** An original copper-furred woodland companion. Forward is -Z; feet sit on Y=0. */
export function createCompanion(stage: 0 | 1 | 2 | 3): {
  group: THREE.Group;
  animate(time: number, speed: number, jump?: number): void;
  setFlying(flying: boolean): void;
  rideSeat?: THREE.Vector3;
  dispose(): void;
} {
  const group = new THREE.Group();
  group.name = `ember-companion-${stage}`;
  const rig = new THREE.Group();
  group.add(rig);
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const standard = (parameters: THREE.MeshStandardMaterialParameters) => {
    const material = new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0.02, ...parameters });
    materials.add(material);
    return material;
  };
  const physical = (parameters: THREE.MeshPhysicalMaterialParameters) => {
    const material = new THREE.MeshPhysicalMaterial(parameters);
    materials.add(material);
    return material;
  };
  const fur = standard({ color: stage === 0 ? '#e6d3a4' : '#b85f32' });
  const sunFur = standard({ color: stage === 0 ? '#f1e1ba' : '#d98548' });
  const darkFur = standard({ color: '#483328' });
  const cream = standard({ color: '#f7e7bd' });
  const innerEar = standard({ color: '#ac7062', roughness: 0.93 });
  const noseMat = physical({ color: '#292724', roughness: 0.34, clearcoat: 0.5 });
  const leather = standard({ color: '#523e2c', roughness: 0.9 });
  const leatherLight = standard({ color: '#956c40', roughness: 0.87 });
  const gold = standard({ color: '#d8b769', metalness: 0.52, roughness: 0.37 });
  const jade = standard({ color: '#367477', metalness: 0.28, roughness: 0.43 });
  const cyan = standard({ color: '#8ce5df', emissive: '#26baad', emissiveIntensity: 0.42, roughness: 0.28, metalness: 0.12 });
  const iris = physical({ color: '#dcac44', roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.06 });
  const pupil = physical({ color: '#14272a', roughness: 0.05, clearcoat: 1 });
  const glint = standard({ color: '#ffffff', emissive: '#f5fffa', emissiveIntensity: 0.6, roughness: 0.15 });
  const sphere = new THREE.SphereGeometry(1, 32, 24);
  geometries.add(sphere);

  function mesh(
    parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material,
    position: Point = [0, 0, 0], scale: Point = [1, 1, 1],
  ) {
    geometries.add(geometry);
    const object = new THREE.Mesh(geometry, material);
    object.position.set(...position);
    object.scale.set(...scale);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }
  const soft = (parent: THREE.Object3D, material: THREE.Material, position: Point, scale: Point) =>
    mesh(parent, sphere, material, position, scale);

  /** Smooth tapered volumes, used for curved fur locks, tail, limbs and horns. */
  function tapered(parent: THREE.Object3D, points: Point[], radii: Radius[], material: THREE.Material, resolution = 28) {
    const path = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
    const frames = path.computeFrenetFrames(resolution, false);
    const vertices: number[] = [];
    const indices: number[] = [];
    const sides = 16;
    for (let i = 0; i <= resolution; i += 1) {
      const t = i / resolution;
      const center = path.getPointAt(t);
      const at = t * (radii.length - 1);
      const lower = Math.min(Math.floor(at), radii.length - 2);
      const amount = at - lower;
      const rx = THREE.MathUtils.lerp(radii[lower][0], radii[lower + 1][0], amount);
      const ry = THREE.MathUtils.lerp(radii[lower][1], radii[lower + 1][1], amount);
      for (let j = 0; j <= sides; j += 1) {
        const angle = (j / sides) * Math.PI * 2;
        const vertex = center.clone()
          .addScaledVector(frames.normals[i], Math.cos(angle) * rx)
          .addScaledVector(frames.binormals[i], Math.sin(angle) * ry);
        vertices.push(vertex.x, vertex.y, vertex.z);
        if (i < resolution && j < sides) {
          const a = i * (sides + 1) + j;
          const b = a + sides + 1;
          indices.push(a, a + 1, b, a + 1, b + 1, b);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return mesh(parent, geometry, material);
  }
  function line(parent: THREE.Object3D, points: Point[], radius: number, material: THREE.Material) {
    return mesh(parent, new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point))), 28, radius, 8, false,
    ), material);
  }
  function leafGeometry(width: number, height: number, depth = 0.06) {
    const outline = new THREE.Shape();
    outline.moveTo(-width * 0.49, 0);
    outline.bezierCurveTo(-width * 0.65, height * 0.38, -width * 0.18, height * 0.82, width * 0.10, height);
    outline.bezierCurveTo(width * 0.39, height * 0.75, width * 0.60, height * 0.26, width * 0.44, 0);
    outline.quadraticCurveTo(0, -height * 0.12, -width * 0.49, 0);
    return new THREE.ExtrudeGeometry(outline, {
      depth, bevelEnabled: true, bevelSegments: 4, steps: 1, bevelSize: 0.023,
      bevelThickness: 0.025, curveSegments: 20,
    });
  }

  // The haunches, belly and high shoulder make one flowing quadruped silhouette.
  soft(rig, fur, [0, 0.82, 0.20], [0.46, 0.43, 0.76]);
  soft(rig, sunFur, [0, 1.00, -0.35], [0.43, 0.47, 0.42]);
  soft(rig, fur, [0, 0.84, 0.63], [0.43, 0.43, 0.42]);
  soft(rig, cream, [0, 0.94, -0.57], [0.35, 0.41, 0.24]);
  tapered(rig, [[0, 1.03, -0.59], [0, 0.75, -0.63], [0, 0.53, -0.48]], [[0.28, 0.14], [0.22, 0.12], [0.008, 0.008]], cream);

  // Layered mane locks sweep away from the face instead of forming a flat bib.
  for (const side of [-1, 1]) {
    for (let layer = 0; layer < 3; layer += 1) {
      const x = side * (0.22 + layer * 0.063);
      const y = 1.21 - layer * 0.17;
      tapered(rig,
        [[x, y, -0.45], [x + side * 0.17, y - 0.09, -0.29], [x + side * 0.12, y - 0.25, -0.16]],
        [[0.16 - layer * 0.02, 0.11], [0.13, 0.08], [0.008, 0.008]], cream,
      );
    }
  }

  const legs: Array<{ pivot: THREE.Group; offset: number; front: boolean }> = [];
  for (const side of [-1, 1]) {
    for (const front of [true, false]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.30, 0.86, front ? -0.43 : 0.54);
      rig.add(pivot);
      soft(pivot, fur, [0, -0.13, 0.035], [front ? 0.16 : 0.21, 0.30, front ? 0.18 : 0.26]);
      tapered(pivot,
        [[0, -0.16, 0], [0, -0.42, front ? 0.04 : 0.13], [0, -0.64, 0]],
        [[0.13, 0.14], [0.10, 0.115], [0.10, 0.11]], fur,
      );
      soft(pivot, darkFur, [0, -0.58, 0.005], [0.115, 0.18, 0.12]);
      soft(pivot, darkFur, [0, -0.735, -0.075], [0.17, 0.125, 0.225]);
      for (const toe of [-1, 0, 1]) {
        soft(pivot, darkFur, [toe * 0.086, -0.745, -0.19], [0.06, 0.084, 0.098]);
        soft(pivot, cream, [toe * 0.086, -0.751, -0.26], [0.023, 0.027, 0.045]);
      }
      legs.push({ pivot, offset: (front ? 0 : Math.PI) + (side === -1 ? 0 : Math.PI), front });
    }
  }

  const head = new THREE.Group();
  head.position.set(0, 1.24, -0.61);
  rig.add(head);
  soft(head, sunFur, [0, 0.025, -0.045], [0.405, 0.35, 0.36]);
  soft(head, fur, [0, 0.10, 0.11], [0.36, 0.31, 0.27]);
  // The narrow bridge and lifted cream cheeks create a foxlike face.
  soft(head, sunFur, [0, -0.065, -0.32], [0.23, 0.185, 0.29]);
  soft(head, cream, [0, -0.16, -0.36], [0.225, 0.13, 0.25]);
  for (const side of [-1, 1]) {
    soft(head, cream, [side * 0.20, -0.115, -0.235], [0.20, 0.155, 0.20]);
    tapered(head,
      [[side * 0.28, -0.02, -0.10], [side * 0.43, -0.025, -0.01], [side * 0.51, 0.045, 0.16]],
      [[0.135, 0.13], [0.095, 0.09], [0.007, 0.007]], cream,
    );
  }
  const nose = soft(head, noseMat, [0, -0.055, -0.60], [0.113, 0.074, 0.072]);
  nose.rotation.x = -0.18;
  line(head, [[0, -0.113, -0.592], [0, -0.155, -0.578], [-0.10, -0.176, -0.535]], 0.008, darkFur);
  line(head, [[0, -0.155, -0.578], [0.10, -0.176, -0.535]], 0.008, darkFur);

  const eyeGroups: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(side * 0.258, 0.106, -0.307);
    eye.rotation.y = side * -0.30;
    head.add(eye);
    soft(eye, darkFur, [0, 0, 0.005], [0.142, 0.143, 0.058]);
    soft(eye, iris, [0, 0, -0.023], [0.113, 0.115, 0.052]);
    soft(eye, pupil, [-side * 0.009, -0.002, -0.068], [0.063, 0.089, 0.026]);
    soft(eye, glint, [-0.032, 0.043, -0.086], [0.029, 0.031, 0.013]);
    soft(eye, glint, [0.034, -0.036, -0.088], [0.012, 0.013, 0.009]);
    eyeGroups.push(eye);
    line(head,
      [[side * 0.13, 0.23, -0.30], [side * 0.25, 0.256, -0.315], [side * 0.37, 0.215, -0.24]],
      0.033, fur,
    );
    soft(head, cream, [side * 0.236, 0.281, -0.254], [0.089, 0.043, 0.055]);
  }

  const ears: Array<{ group: THREE.Group; rest: number }> = [];
  for (const side of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(side * 0.25, 0.257, 0.025);
    ear.rotation.z = side * -0.19;
    ear.rotation.y = side * 0.12;
    head.add(ear);
    mesh(ear, leafGeometry(0.31, 0.44, 0.095), fur, [0, 0, -0.02]);
    mesh(ear, leafGeometry(0.19, 0.31, 0.012), innerEar, [0, 0.055, -0.066]);
    tapered(ear, [[-0.02, 0.01, -0.08], [0.03, 0.13, -0.08], [0.012, 0.22, -0.062]],
      [[0.073, 0.03], [0.047, 0.02], [0.004, 0.004]], cream);
    ears.push({ group: ear, rest: ear.rotation.z });
  }

  const tail = new THREE.Group();
  tail.position.set(0, 0.85, 0.81);
  rig.add(tail);
  tapered(tail,
    [[0, 0, 0], [0.075, 0.08, 0.31], [0.12, 0.24, 0.70], [0.075, 0.53, 1.03], [-0.03, 0.72, 1.10]],
    [[0.13, 0.13], [0.22, 0.24], [0.23, 0.27], [0.14, 0.16], [0.006, 0.006]], fur, 40,
  );
  tapered(tail,
    [[0.125, 0.285, 0.76], [0.09, 0.49, 1.00], [-0.03, 0.725, 1.11]],
    [[0.223, 0.231], [0.161, 0.17], [0.005, 0.005]], cream, 24,
  );

  // Fitted leather harness and a luminous compass talisman identify the explorer.
  for (const z of [-0.31, 0.30]) {
    const strap = mesh(rig, new THREE.TorusGeometry(0.38, 0.042, 10, 64), leather, [0, 0.92, z], [1.15, 1.06, 1]);
    strap.rotation.y = z > 0 ? -0.03 : 0.03;
  }
  for (const side of [-1, 1]) {
    line(rig, [[side * 0.44, 1.02, -0.33], [side * 0.48, 0.99, 0], [side * 0.46, 0.96, 0.33]], 0.041, leather);
    const buckle = mesh(rig, new THREE.TorusGeometry(0.065, 0.012, 8, 28), gold, [side * 0.471, 1.015, -0.02]);
    buckle.rotation.y = Math.PI / 2;
  }
  line(rig, [[-0.20, 1.12, -0.65], [0, 0.92, -0.786], [0.20, 1.12, -0.65]], 0.018, leather);
  const talisman = mesh(rig, new THREE.OctahedronGeometry(0.105, 0), cyan, [0, 0.92, -0.80], [0.72, 1.13, 0.41]);
  mesh(rig, new THREE.TorusGeometry(0.115, 0.012, 8, 4), gold, [0, 0.92, -0.793], [0.72, 1.13, 0.5]).rotation.z = Math.PI / 4;

  if (stage === 0) {
    soft(rig, leatherLight, [0.45, 0.85, 0.26], [0.20, 0.255, 0.29]);
    soft(rig, leather, [0.48, 0.82, 0.29], [0.202, 0.16, 0.294]);
    const egg = soft(rig, cream, [0.49, 1.14, 0.26], [0.16, 0.225, 0.155]);
    egg.rotation.z = -0.14;
    line(rig, [[0.41, 1.29, 0.136], [0.55, 1.20, 0.12], [0.42, 1.10, 0.124]], 0.011, cyan);
    line(rig, [[0.48, 0.93, -0.035], [0.65, 1.02, 0.18], [0.62, 0.96, 0.43]], 0.025, leatherLight);
    mesh(rig, new THREE.TorusGeometry(0.042, 0.009, 8, 24), gold, [0.656, 0.89, 0.23]).rotation.y = Math.PI / 2;
  }

  if (stage >= 2) {
    for (const side of [-1, 1]) {
      tapered(head,
        [[side * 0.31, 0.27, 0.17], [side * 0.42, 0.46, 0.23], [side * 0.43, 0.57, 0.45], [side * 0.35, 0.66, 0.57]],
        [[0.095, 0.09], [0.073, 0.065], [0.038, 0.033], [0.004, 0.004]], gold,
      );
      const shoulder = soft(rig, jade, [side * 0.397, 1.095, -0.32], [0.15, 0.245, 0.305]);
      shoulder.rotation.z = side * -0.20;
      line(rig, [[side * 0.45, 1.29, -0.37], [side * 0.53, 1.11, -0.48], [side * 0.49, 0.94, -0.37]], 0.016, gold);
      const crystal = mesh(rig, new THREE.OctahedronGeometry(0.15), cyan,
        [side * 0.465, 1.23, -0.18], [0.60, 1.45, 0.72]);
      crystal.rotation.z = side * -0.45;
    }
    for (let i = 0; i < 4; i += 1) {
      if (stage === 3 && i > 0) continue; // Leave a smooth back beneath the riding saddle.
      const spine = mesh(rig, new THREE.OctahedronGeometry(0.12), jade,
        [0, 1.25 - i * 0.025, -0.12 + i * 0.23], [0.54, 1.05 - i * 0.1, 1.0]);
      spine.rotation.x = -0.35;
      mesh(rig, new THREE.OctahedronGeometry(0.078), cyan,
        [0, 1.33 - i * 0.036, -0.10 + i * 0.23], [0.45, 1.1, 0.75]);
    }
  }

  const wings: Array<{ group: THREE.Group; side: number }> = [];
  const ridingTack = new THREE.Group();
  rig.add(ridingTack);
  ridingTack.visible = false;
  if (stage === 3) {
    soft(rig, cream, [0, 1.27, 0.38], [0.345, 0.036, 0.34]);
    soft(rig, leather, [0, 1.31, 0.38], [0.314, 0.045, 0.31]);
    soft(rig, leatherLight, [0, 1.355, 0.615], [0.292, 0.092, 0.052]);
    line(rig, [[-0.26, 1.32, 0.14], [0, 1.405, 0.095], [0.26, 1.32, 0.14]], 0.024, gold);
    for (const side of [-1, 1]) {
      line(rig, [[side * 0.29, 1.30, 0.37], [side * 0.43, 0.98, 0.38], [side * 0.39, 0.68, 0.31]], 0.024, leather);
      const stirrup = mesh(rig, new THREE.TorusGeometry(0.068, 0.012, 8, 24), gold, [side * 0.40, 0.67, 0.30]);
      stirrup.rotation.y = Math.PI / 2;
      line(ridingTack, [[side * 0.24, 1.13, -0.48], [side * 0.27, 1.30, -0.30], [side * 0.21, 1.60, -0.20]], 0.015, leatherLight);
    }
    const membrane = physical({
      color: '#65d4c7', emissive: '#1c7474', emissiveIntensity: 0.18,
      roughness: 0.42, metalness: 0.05, clearcoat: 0.15, side: THREE.DoubleSide,
      transparent: true, opacity: 0.93,
    });
    const outline = new THREE.Shape();
    outline.moveTo(0, 0);
    outline.bezierCurveTo(0.32, -0.19, 0.81, -0.10, 1.13, 0.13);
    outline.quadraticCurveTo(1.55, 0.37, 1.72, 0.61);
    outline.quadraticCurveTo(1.35, 0.54, 1.12, 0.96);
    outline.quadraticCurveTo(1.02, 0.62, 0.79, 1.19);
    outline.quadraticCurveTo(0.62, 0.76, 0.34, 1.05);
    outline.quadraticCurveTo(0.33, 0.52, 0, 0.34);
    outline.closePath();
    const height = (x: number, z: number) => Math.sin((x / 1.85) * Math.PI) * 0.73 + x * 0.06 - z * 0.24;
    const curvedPoint = (x: number, z: number): Point => [x, height(x, z), z];

    // Refine the membrane before curving it, so the large wings have soft normals.
    const flat = new THREE.ShapeGeometry(outline, 16);
    let coordinates: Array<[number, number]> = [];
    const positions = flat.getAttribute('position');
    for (let i = 0; i < positions.count; i += 1) coordinates.push([positions.getX(i), positions.getY(i)]);
    let triangles = Array.from(flat.getIndex()!.array);
    flat.dispose();
    for (let refinement = 0; refinement < 2; refinement += 1) {
      const mids = new Map<string, number>();
      const middle = (a: number, b: number) => {
        const key = a < b ? `${a}:${b}` : `${b}:${a}`;
        const previous = mids.get(key);
        if (previous !== undefined) return previous;
        const id = coordinates.length;
        coordinates.push([(coordinates[a][0] + coordinates[b][0]) / 2, (coordinates[a][1] + coordinates[b][1]) / 2]);
        mids.set(key, id);
        return id;
      };
      const refined: number[] = [];
      for (let i = 0; i < triangles.length; i += 3) {
        const [a, b, c] = triangles.slice(i, i + 3);
        const ab = middle(a, b); const bc = middle(b, c); const ca = middle(c, a);
        refined.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
      }
      triangles = refined;
    }
    const wingGeometry = new THREE.BufferGeometry();
    wingGeometry.setAttribute('position', new THREE.Float32BufferAttribute(coordinates.flatMap(([x, z]) => curvedPoint(x, z)), 3));
    wingGeometry.setIndex(triangles);
    wingGeometry.computeVertexNormals();

    for (const side of [-1, 1]) {
      const wing = new THREE.Group();
      wing.position.set(side * 0.33, 1.15, 0.05);
      wing.scale.x = side;
      rig.add(wing);
      mesh(wing, wingGeometry, membrane);
      line(wing, outline.getPoints(30).map(({ x, y }) => curvedPoint(x, y)), 0.017, gold);
      tapered(wing,
        [[0, 0, 0], curvedPoint(0.41, -0.11), curvedPoint(0.94, 0.045), curvedPoint(1.72, 0.61)],
        [[0.075, 0.067], [0.055, 0.048], [0.035, 0.030], [0.007, 0.007]], fur,
      );
      for (const tip of [[1.12, 0.96], [0.79, 1.19], [0.34, 1.05]]) {
        line(wing, [curvedPoint(0.40, -0.06), curvedPoint((tip[0] + 0.4) / 2, tip[1] * 0.45), curvedPoint(tip[0], tip[1])], 0.015, gold);
      }
      soft(wing, jade, [0.03, 0.015, 0.02], [0.15, 0.125, 0.19]);
      wings.push({ group: wing, side });
    }
  }

  const size = [0.82, 0.95, 1.04, 1.10][stage];
  rig.scale.setScalar(size);
  const saddlePoint = new THREE.Vector3(0, 1.355, 0.38);
  const rideSeat = stage === 3 ? saddlePoint.clone().multiplyScalar(size) : undefined;
  let flying = false;
  let disposed = false;
  return {
    group,
    rideSeat,
    setFlying(value) { flying = stage === 3 && value; ridingTack.visible = flying; },
    animate(time, speed, jump = 0) {
      if (disposed) return;
      const movement = THREE.MathUtils.clamp(speed, 0, 1);
      const stride = time * (7.5 + movement * 3);
      rig.position.y = flying ? Math.sin(time * 5) * 0.035 : Math.sin(time * 2.25) * 0.012 + Math.abs(Math.sin(stride)) * movement * 0.045;
      rig.rotation.z = flying ? Math.sin(time * 2.5) * 0.018 : Math.sin(stride) * movement * 0.025;
      rig.rotation.x = flying ? -0.04 : -Math.min(jump, 1) * 0.06;
      for (const { pivot, offset, front } of legs) {
        pivot.rotation.x = flying ? (front ? -1.03 : 1.12) : Math.sin(stride + offset) * movement * 0.53 + Math.min(jump, 1) * 0.16;
        pivot.position.y = flying ? 0.91 : 0.86 + Math.max(0, Math.cos(stride + offset)) * movement * 0.018;
      }
      tail.rotation.y = Math.sin(time * 2.1) * (0.18 + movement * 0.13);
      tail.rotation.x = Math.sin(time * 2.7) * 0.045 + movement * 0.13;
      head.rotation.y = Math.sin(time * 0.75) * 0.075 * (1 - movement * 0.75);
      head.rotation.x = Math.sin(time * 1.6) * 0.025 - movement * 0.04;
      for (const { group: ear, rest } of ears) ear.rotation.z = rest + Math.sin(time * 2.6 + rest * 4) * 0.035;
      const blinkAt = (time + 0.7) % 5.6;
      const openness = blinkAt < 0.14 ? Math.max(0.045, Math.abs(blinkAt - 0.07) / 0.07) : 1;
      for (const eye of eyeGroups) eye.scale.y = openness;
      for (const { group: wing, side } of wings) {
        wing.rotation.z = side * (0.10 + Math.sin(time * (flying ? 5.2 : 1.8 + movement * 2)) * (flying ? 0.58 : 0.045 + movement * 0.14));
        wing.rotation.x = flying ? -0.10 + Math.cos(time * 5.2) * 0.08 : Math.sin(time * 1.8) * 0.028 - 0.10;
      }
      cyan.emissiveIntensity = 0.39 + Math.sin(time * 2.5) * 0.11;
      talisman.rotation.y = Math.sin(time * 1.1) * 0.08;
      if (rideSeat) { rig.updateMatrix(); rideSeat.copy(saddlePoint).applyMatrix4(rig.matrix); }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      group.clear();
    },
  };
}
