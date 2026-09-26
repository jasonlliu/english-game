import * as THREE from 'three';
import { createCompanion } from './worldCompanion';

export type PetId = 'ember' | 'ripple' | 'cinder' | 'moss' | 'bolt' | 'lumi';
export interface ModelRig {
  group: THREE.Group;
  animate(time: number, speed: number, jump?: number): void;
  setRiding?(riding: boolean): void;
  setFlying?(flying: boolean): void;
  /** Animated anchor in group-local coordinates; transform with group.localToWorld. */
  rideSeat?: THREE.Vector3;
  /** Human hip anchor, also in group-local coordinates. */
  riderHip?: THREE.Vector3;
  dispose(): void;
}
type Point = [number, number, number];

function modelKit() {
  const group = new THREE.Group();
  const rig = new THREE.Group();
  group.add(rig);
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const sphere = new THREE.SphereGeometry(1, 24, 18);
  const detailSphere = new THREE.SphereGeometry(1, 16, 12);
  geometries.add(sphere); geometries.add(detailSphere);
  const material = (color: string, options: THREE.MeshStandardMaterialParameters = {}) => {
    const result = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.03, ...options });
    materials.add(result);
    return result;
  };
  function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, mat: THREE.Material, position: Point = [0, 0, 0], scale: Point = [1, 1, 1]) {
    geometries.add(geometry);
    const result = new THREE.Mesh(geometry, mat);
    result.position.set(...position); result.scale.set(...scale);
    result.castShadow = true; result.receiveShadow = true;
    parent.add(result);
    return result;
  }
  const soft = (parent: THREE.Object3D, mat: THREE.Material, p: Point, s: Point, detail = false) =>
    mesh(parent, detail ? detailSphere : sphere, mat, p, s);
  const pivot = (parent: THREE.Object3D, p: Point) => {
    const result = new THREE.Group(); result.position.set(...p); parent.add(result); return result;
  };
  function tube(parent: THREE.Object3D, mat: THREE.Material, points: Point[], radius: number) {
    return mesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), 24, radius, 8, false), mat);
  }
  function tapered(parent: THREE.Object3D, mat: THREE.Material, points: Point[], widths: number[], flatten = 1) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    const frames = curve.computeFrenetFrames(24, false);
    const vertices: number[] = []; const indices: number[] = [];
    for (let i = 0; i <= 24; i += 1) {
      const t = i / 24; const c = curve.getPointAt(t); const at = t * (widths.length - 1);
      const lower = Math.min(Math.floor(at), widths.length - 2);
      const width = THREE.MathUtils.lerp(widths[lower], widths[lower + 1], at - lower);
      for (let j = 0; j <= 12; j += 1) {
        const a = (j / 12) * Math.PI * 2;
        const v = c.clone().addScaledVector(frames.normals[i], Math.cos(a) * width)
          .addScaledVector(frames.binormals[i], Math.sin(a) * width * flatten);
        vertices.push(v.x, v.y, v.z);
        if (i < 24 && j < 12) { const a = i * 13 + j; indices.push(a, a + 1, a + 13, a + 1, a + 14, a + 13); }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    return mesh(parent, geometry, mat);
  }
  function leaf(parent: THREE.Object3D, mat: THREE.Material, p: Point, width: number, height: number, depth = 0.025) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.bezierCurveTo(-width * 0.68, height * 0.25, -width * 0.47, height * 0.72, 0, height);
    shape.bezierCurveTo(width * 0.47, height * 0.72, width * 0.68, height * 0.25, 0, 0);
    return mesh(parent, new THREE.ExtrudeGeometry(shape, {
      depth, bevelEnabled: true, bevelSize: 0.018, bevelThickness: 0.014, bevelSegments: 3, curveSegments: 16,
    }), mat, p);
  }
  function eyes(parent: THREE.Object3D, y: number, z: number, separation: number, size: number, irisColor = '#694b2c') {
    const eyeMaterial = material(irisColor, { roughness: 0.19 });
    const pupil = material('#172930', { roughness: 0.13 });
    const white = material('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.25 });
    const groups: THREE.Group[] = [];
    for (const side of [-1, 1]) {
      const eye = pivot(parent, [side * separation, y, z]);
      soft(eye, eyeMaterial, [0, 0, 0], [size, size * 1.12, size * 0.35], true);
      soft(eye, pupil, [0, 0, -size * 0.26], [size * 0.62, size * 0.78, size * 0.23], true);
      soft(eye, white, [-size * 0.28, size * 0.38, -size * 0.49], [size * 0.25, size * 0.25, size * 0.12], true);
      groups.push(eye);
    }
    return groups;
  }
  let disposed = false;
  const dispose = () => {
    if (disposed) return; disposed = true;
    geometries.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose()); group.clear();
  };
  return { group, rig, material, mesh, soft, pivot, tube, tapered, leaf, eyes, dispose };
}

/** Original six-head-tall sky ranger; the scene owns world position and rotation. */
export function createHero(): ModelRig {
  const k = modelKit();
  const { group, rig, soft, material, pivot, tube, tapered, mesh } = k;
  group.name = 'silver-tide-ranger';
  const skin = material('#d9ab8b', { roughness: 0.74 });
  const skinLight = material('#e4bea0', { roughness: 0.73 });
  const navy = material('#19354e');
  const blue = material('#315870');
  const dark = material('#1a2639', { roughness: 0.86 });
  const ivory = material('#e9e5d1', { side: THREE.DoubleSide, roughness: 0.84 });
  const gold = material('#c5a974', { roughness: 0.40, metalness: 0.57 });
  const leather = material('#4b4340', { roughness: 0.86 });
  const steel = material('#7594a2', { metalness: 0.43, roughness: 0.42 });
  const silverHair = material('#aebbc7', { roughness: 0.69 });
  const hairShade = material('#6d8196', { roughness: 0.76 });
  const hairLight = material('#d5dde1', { roughness: 0.68 });
  const teal = material('#69c8cc', { emissive: '#30868e', emissiveIntensity: 0.20, roughness: 0.34 });
  const cloakMaterial = material('#24465f', { side: THREE.DoubleSide, roughness: 0.88 });

  // Lofted anatomical and tailored cross-sections replace the old capsule stacks.
  type Section = [number, number, number, number]; // height, half-width, half-depth, depth offset
  function profile(parent: THREE.Object3D, mat: THREE.Material, sections: Section[], radial = 24) {
    const segments = Math.max(16, (sections.length - 1) * 4);
    const vertices: number[] = []; const indices: number[] = [];
    const cubic = (a: number, b: number, c: number, d: number, t: number) =>
      0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
    for (let i = 0; i <= segments; i += 1) {
      const at = (i / segments) * (sections.length - 1);
      const n = Math.min(Math.floor(at), sections.length - 2); const f = at - n;
      const a = sections[Math.max(0, n - 1)]; const b = sections[n];
      const c = sections[n + 1]; const d = sections[Math.min(sections.length - 1, n + 2)];
      const y = THREE.MathUtils.lerp(b[0], c[0], f);
      const w = Math.max(0.003, cubic(a[1], b[1], c[1], d[1], f));
      const depth = Math.max(0.003, cubic(a[2], b[2], c[2], d[2], f));
      const z = cubic(a[3], b[3], c[3], d[3], f);
      for (let j = 0; j <= radial; j += 1) {
        const angle = j / radial * Math.PI * 2;
        vertices.push(Math.sin(angle) * w, y, Math.cos(angle) * depth + z);
        if (i < segments && j < radial) {
          const v = i * (radial + 1) + j;
          indices.push(v, v + 1, v + radial + 1, v + 1, v + radial + 2, v + radial + 1);
        }
      }
    }
    for (const [row, section, reverse] of [[0, sections[0], true], [segments, sections[sections.length - 1], false]] as const) {
      const center = vertices.length / 3; vertices.push(0, section[0], section[3]);
      for (let j = 0; j < radial; j += 1) {
        const a = row * (radial + 1) + j;
        indices.push(center, reverse ? a + 1 : a, reverse ? a : a + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    return mesh(parent, geometry, mat);
  }
  function panel(parent: THREE.Object3D, mat: THREE.Material, points: Array<[number, number]>, z: number, depth = 0.012) {
    const shape = new THREE.Shape();
    points.forEach(([x, y], i) => i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)); shape.closePath();
    return mesh(parent, new THREE.ExtrudeGeometry(shape, {
      depth, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.009, bevelSegments: 2, curveSegments: 8,
    }), mat, [0, 0, z]);
  }

  profile(rig, dark, [[1.34, 0.23, 0.125, 0.015], [1.44, 0.26, 0.146, 0.012], [1.58, 0.235, 0.138, 0]]);
  profile(rig, navy, [[1.48, 0.265, 0.15, 0], [1.64, 0.238, 0.145, 0], [1.90, 0.295, 0.164, 0.002], [2.12, 0.351, 0.151, 0.004], [2.22, 0.285, 0.124, 0.008]]);
  profile(rig, skin, [[2.18, 0.078, 0.072, 0], [2.34, 0.074, 0.072, 0], [2.43, 0.081, 0.075, 0]]);
  panel(rig, ivory, [[-0.115, 2.19], [0.115, 2.19], [0.066, 1.78], [-0.067, 1.78]], -0.171);
  for (const side of [-1, 1]) {
    panel(rig, blue, [[side * 0.11, 2.21], [side * 0.27, 2.18], [side * 0.20, 1.97], [side * 0.105, 2.04]], -0.155);
    tube(rig, gold, [[side * 0.12, 2.22, -0.17], [side * 0.213, 2.07, -0.18], [side * 0.17, 1.82, -0.164], [side * 0.20, 1.55, -0.154]], 0.009);
    panel(rig, navy, [[side * 0.12, 1.59], [side * 0.27, 1.59], [side * 0.29, 1.32], [side * 0.17, 1.36]], -0.135);
  }
  // A slim cross-body strap and structured hip pouch remain readable from behind.
  tube(rig, leather, [[-0.23, 2.20, -0.085], [-0.13, 2.00, -0.192], [0.025, 1.78, -0.18], [0.18, 1.54, -0.157]], 0.027);
  tube(rig, leather, [[-0.23, 2.20, 0.09], [-0.07, 1.99, 0.181], [0.18, 1.54, 0.164]], 0.028);
  profile(rig, leather, [[1.465, 0.274, 0.158, 0], [1.527, 0.266, 0.157, 0]]);
  panel(rig, gold, [[-0.049, 1.54], [0.047, 1.54], [0.047, 1.462], [-0.049, 1.462]], -0.169);
  panel(rig, navy, [[-0.026, 1.522], [0.026, 1.522], [0.026, 1.479], [-0.026, 1.479]], -0.182);
  const pouch = pivot(rig, [-0.29, 1.43, 0.02]); pouch.rotation.z = 0.09;
  profile(pouch, leather, [[-0.17, 0.083, 0.068, 0], [-0.11, 0.10, 0.073, 0], [0.10, 0.098, 0.071, 0], [0.14, 0.074, 0.053, 0]]);
  panel(pouch, gold, [[-0.026, 0.079], [0.026, 0.079], [0.021, 0.02], [-0.021, 0.02]], -0.079, 0.006);

  const head = pivot(rig, [0, 2.585, -0.014]);
  profile(head, skinLight, [[-0.212, 0.047, 0.053, -0.026], [-0.166, 0.111, 0.088, -0.020], [-0.067, 0.165, 0.123, -0.009], [0.026, 0.185, 0.139, 0], [0.109, 0.18, 0.132, 0.012], [0.173, 0.144, 0.110, 0.018], [0.204, 0.072, 0.052, 0.020]], 28);
  const eyeWhite = material('#e1e5df', { side: THREE.DoubleSide, roughness: 0.28 });
  const eyeIris = material('#4f929c', { roughness: 0.19 });
  const ink = material('#263244', { roughness: 0.45 });
  const shine = material('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.28 });
  const eyes: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const eye = pivot(head, [side * 0.081, 0.029, -0.131]); eye.rotation.y = side * -0.19;
    const outline = new THREE.Shape(); outline.moveTo(-0.055, -0.002);
    outline.quadraticCurveTo(-0.003, 0.034, 0.055, 0.001); outline.quadraticCurveTo(0, -0.027, -0.055, -0.002);
    mesh(eye, new THREE.ShapeGeometry(outline, 12), eyeWhite);
    soft(eye, eyeIris, [0, 0, -0.006], [0.019, 0.022, 0.010], true);
    soft(eye, ink, [0, 0, -0.013], [0.009, 0.016, 0.008], true);
    soft(eye, shine, [-0.006, 0.011, -0.020], [0.005, 0.006, 0.004], true);
    tube(eye, ink, [[-0.057, 0.001, -0.006], [-0.011, 0.022, -0.005], [0.052, 0.005, -0.006]], 0.0045);
    eyes.push(eye);
    tapered(head, dark, [[side * 0.032, 0.077, -0.143], [side * 0.079, 0.084, -0.142], [side * 0.140, 0.078, -0.109]], [0.008, 0.010, 0.003], 0.60);
    soft(head, skin, [side * 0.185, -0.016, 0.015], [0.031, 0.060, 0.036], true);
    tapered(head, dark, [[side * 0.179, 0.117, 0.004], [side * 0.189, 0.04, 0.018], [side * 0.170, -0.047, -0.008]], [0.033, 0.021, 0.003], 0.45);
  }
  const noseGeometry = new THREE.BufferGeometry();
  noseGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0.064, -0.137, -0.022, -0.047, -0.136, 0.022, -0.047, -0.136,
    0, -0.045, -0.190, -0.018, -0.068, -0.155, 0.018, -0.068, -0.155, 0, -0.076, -0.161,
  ], 3));
  noseGeometry.setIndex([0, 3, 1, 0, 2, 3, 1, 3, 4, 3, 2, 5, 4, 3, 6, 3, 5, 6]);
  noseGeometry.computeVertexNormals(); mesh(head, noseGeometry, skin);
  tube(head, material('#ab7d68'), [[-0.042, -0.112, -0.133], [0, -0.116, -0.146], [0.041, -0.109, -0.132]], 0.0035);
  // Swept silver locks have a dark undercut and a deliberate asymmetric fringe.
  soft(head, dark, [0, 0.122, 0.044], [0.19, 0.139, 0.150]);
  for (let i = 0; i < 8; i += 1) {
    const x = -0.145 + i * 0.040;
    const tipY = i < 4 ? 0.10 - i * 0.027 : 0.055 + (i - 4) * 0.023;
    tapered(head, i === 2 || i === 6 ? hairShade : silverHair,
      [[x - 0.039, 0.232 - Math.abs(x) * 0.15, 0.047], [x + 0.005, 0.190, -0.065], [x + 0.040, tipY + 0.025, -0.147], [x + 0.030, tipY - 0.031, -0.145]],
      [0.046, 0.046, 0.030, 0.0025], 0.36);
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i += 1) {
      tapered(head, i === 0 ? hairLight : silverHair,
        [[side * (0.034 + i * 0.045), 0.218, 0.06], [side * (0.11 + i * 0.029), 0.12, 0.13], [side * (0.088 + i * 0.038), -0.045 - i * 0.02, 0.133]],
        [0.046, 0.043, 0.003], 0.36);
    }
  }
  tapered(head, hairLight, [[-0.10, 0.206, 0.087], [-0.032, 0.250, 0.024], [0.077, 0.216, -0.030]], [0.023, 0.033, 0.003], 0.40);
  const earring = mesh(head, new THREE.TorusGeometry(0.019, 0.004, 6, 16), gold, [-0.191, -0.066, 0.012]); earring.rotation.y = Math.PI / 2;

  // Layered high collar and two long scarf ribbons frame the head from the back.
  profile(rig, ivory, [[2.232, 0.132, 0.101, -0.008], [2.288, 0.146, 0.111, -0.014], [2.35, 0.105, 0.083, -0.005]]);
  panel(rig, gold, [[-0.153, 2.254], [-0.089, 2.274], [-0.070, 2.216], [-0.123, 2.199]], -0.111);
  mesh(rig, new THREE.OctahedronGeometry(0.035), teal, [-0.115, 2.238, -0.135], [0.76, 1.0, 0.35]);
  const scarf = pivot(rig, [-0.09, 2.29, 0.09]);
  function ribbon(offset: number, length: number, width: number) {
    const geometry = new THREE.PlaneGeometry(1, 1, 18, 2); const positions = geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i += 1) {
      const t = positions.getX(i) + 0.5; const w = positions.getY(i) * width * (1 - t * 0.36);
      positions.setXYZ(i, -t * length + offset, -t * 0.26 + Math.sin(t * Math.PI) * 0.085 + w,
        t * 0.39 + Math.sin(t * Math.PI * 1.3) * 0.043);
    }
    geometry.computeVertexNormals(); mesh(scarf, geometry, ivory);
  }
  ribbon(0, 0.59, 0.12); ribbon(0.06, 0.47, 0.075);

  const legPivots: THREE.Group[] = []; const knees: THREE.Group[] = [];
  const armPivots: THREE.Group[] = []; const elbows: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const leg = pivot(rig, [side * 0.145, 1.46, 0.010]);
    profile(leg, dark, [[-0.695, 0.087, 0.086, 0], [-0.55, 0.098, 0.102, 0.008], [-0.26, 0.124, 0.13, 0.012], [0.045, 0.124, 0.132, 0]]);
    tube(leg, blue, [[side * 0.122, -0.07, 0.014], [side * 0.122, -0.28, 0.010], [side * 0.091, -0.59, 0]], 0.010);
    const knee = pivot(leg, [0, -0.69, 0]);
    profile(knee, dark, [[-0.50, 0.065, 0.081, 0.018], [-0.30, 0.086, 0.091, 0.029], [-0.10, 0.094, 0.094, 0.020], [0.038, 0.091, 0.087, 0]]);
    profile(knee, leather, [[-0.705, 0.092, 0.140, -0.013], [-0.51, 0.082, 0.105, 0.012], [-0.27, 0.097, 0.108, 0.018], [-0.225, 0.103, 0.111, 0.018]]);
    profile(knee, navy, [[-0.739, 0.108, 0.211, -0.072], [-0.660, 0.108, 0.205, -0.072], [-0.576, 0.087, 0.126, -0.015]]);
    profile(knee, dark, [[-0.770, 0.112, 0.220, -0.070], [-0.732, 0.113, 0.220, -0.070]]);
    panel(knee, steel, [[-0.075, 0.035], [0.076, 0.035], [0.082, -0.092], [0, -0.15], [-0.080, -0.09]], -0.104);
    tube(knee, gold, [[-0.077, -0.248, -0.054], [0, -0.247, -0.096], [0.077, -0.248, -0.054]], 0.009);
    tube(knee, gold, [[-0.079, -0.54, -0.10], [0, -0.57, -0.15], [0.079, -0.54, -0.10]], 0.007);
    legPivots.push(leg); knees.push(knee);

    const arm = pivot(rig, [side * 0.342, 2.16, 0.006]);
    profile(arm, navy, [[-0.385, 0.081, 0.086, 0], [-0.26, 0.10, 0.105, 0.006], [-0.09, 0.127, 0.126, 0.005], [0.053, 0.113, 0.101, 0]]);
    const shoulder = panel(arm, gold, [[-0.112, 0.05], [0.098, 0.08], [0.143, -0.095], [0.091, -0.18], [-0.108, -0.145]], -0.107, 0.022);
    const inset = panel(arm, blue, [[-0.093, 0.032], [0.085, 0.053], [0.117, -0.091], [0.075, -0.147], [-0.09, -0.122]], -0.124, 0.013);
    shoulder.rotation.z = side * -0.14; inset.rotation.z = side * -0.14;
    const elbow = pivot(arm, [0, -0.36, 0]);
    profile(elbow, ivory, [[-0.13, 0.065, 0.069, 0], [0.029, 0.079, 0.080, 0]]);
    profile(elbow, navy, [[-0.31, 0.066, 0.068, 0], [-0.16, 0.083, 0.078, 0], [-0.095, 0.077, 0.075, 0]]);
    panel(elbow, steel, [[-0.055, -0.13], [0.055, -0.13], [0.064, -0.27], [0, -0.31], [-0.064, -0.27]], -0.075);
    tube(elbow, gold, [[-0.056, -0.286, -0.046], [0, -0.3, -0.079], [0.056, -0.286, -0.046]], 0.007);
    profile(elbow, leather, [[-0.389, 0.057, 0.037, -0.008], [-0.34, 0.066, 0.042, -0.006], [-0.303, 0.055, 0.041, 0]]);
    soft(elbow, skinLight, [0, -0.402, -0.007], [0.055, 0.043, 0.037], true);
    soft(elbow, skin, [-side * 0.052, -0.362, -0.032], [0.020, 0.044, 0.023], true);
    armPivots.push(arm); elbows.push(elbow);
  }

  // Flowing split half-cloak: a long left panel, shorter right panel, ivory piping.
  const capes: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const height = side < 0 ? 1.15 : 0.95;
    const cape = pivot(rig, [0, 2.19, 0.19]);
    const geometry = new THREE.PlaneGeometry(1, 1, 12, 18); const positions = geometry.getAttribute('position');
    const surface = (u: number, v: number): Point => [
      side * (THREE.MathUtils.lerp(0.005, 0.13, v * v) + u * (0.34 + v * 0.10)),
      -height * v + Math.sin(u * Math.PI) * 0.045 * v,
      0.045 + Math.sin(v * Math.PI) * 0.11 + v * 0.16 + Math.cos(u * Math.PI * 3) * v * 0.014,
    ];
    for (let i = 0; i < positions.count; i += 1) positions.setXYZ(i, ...surface(positions.getX(i) + 0.5, 0.5 - positions.getY(i)));
    geometry.computeVertexNormals(); mesh(cape, geometry, cloakMaterial);
    const edge: Point[] = []; const piping: Point[] = [];
    for (let i = 0; i <= 20; i += 1) { edge.push(surface(1, i / 20)); piping.push(surface(0.87, i / 20)); }
    tube(cape, gold, edge, 0.010); tube(cape, ivory, piping, 0.018);
    const hem: Point[] = []; for (let i = 0; i <= 12; i += 1) hem.push(surface(i / 12, 1));
    tube(cape, gold, hem, 0.009);
    capes.push(cape);
  }
  const backBadge = mesh(rig, new THREE.TorusGeometry(0.075, 0.009, 6, 4), gold, [0, 1.989, 0.285], [0.76, 1.1, 1]); backBadge.rotation.z = Math.PI / 4;
  tube(rig, gold, [[-0.15, 2.14, 0.222], [0, 1.90, 0.306], [0.15, 2.14, 0.222]], 0.008);
  // A slim ceremonial scabbard is decorative; no weapon/attack behaviour is added.
  const scabbard = pivot(rig, [0.275, 1.55, 0.245]); scabbard.rotation.z = 0.22;
  tapered(scabbard, navy, [[0, -0.025, 0], [0.025, -0.40, 0.006], [0.032, -0.88, 0.025]], [0.048, 0.043, 0.017], 0.55);
  tube(scabbard, gold, [[-0.030, -0.045, -0.03], [-0.010, -0.43, -0.024], [0.027, -0.84, 0]], 0.007);
  profile(scabbard, gold, [[-0.037, 0.059, 0.034, 0], [0.018, 0.059, 0.034, 0]]);
  tapered(scabbard, leather, [[0, 0.02, 0], [0, 0.19, 0], [0, 0.255, 0]], [0.028, 0.028, 0.023], 0.82);
  tube(scabbard, gold, [[-0.09, 0.032, 0], [0, 0.055, 0], [0.09, 0.032, 0]], 0.014);
  soft(scabbard, teal, [0, 0.26, 0], [0.025, 0.039, 0.022], true);

  let riding = false;
  const hipPoint = new THREE.Vector3(0, 1.46, 0.010);
  const riderHip = hipPoint.clone();
  return {
    group, riderHip,
    setRiding(value) { riding = value; },
    animate(time, speed, jump = 0) {
      const move = THREE.MathUtils.clamp(speed, 0, 1); const gait = time * (7 + move * 3.5);
      rig.position.y = riding ? Math.sin(time * 3.5) * 0.006 : Math.abs(Math.sin(gait)) * move * 0.047 + Math.sin(time * 1.9) * 0.005;
      rig.rotation.x = riding ? -0.025 : -move * 0.055 + jump * 0.035;
      rig.rotation.z = riding ? 0 : Math.sin(gait) * move * 0.010;
      legPivots.forEach((leg, index) => {
        const side = index === 0 ? -1 : 1;
        leg.position.x = side * (riding ? 0.22 : 0.145);
        leg.rotation.x = riding ? 1.10 : Math.sin(gait + index * Math.PI) * move * 0.56 - jump * 0.16;
        leg.rotation.z = riding ? side * 0.22 : 0;
        knees[index].rotation.x = riding ? -1.04 : -Math.max(0, -Math.sin(gait + index * Math.PI)) * move * 0.26;
      });
      armPivots.forEach((arm, index) => {
        const side = index === 0 ? -1 : 1;
        arm.rotation.x = riding ? 0.92 + Math.sin(time * 3.5) * 0.012 : -Math.sin(gait + index * Math.PI) * move * 0.53 - jump * 0.24;
        arm.rotation.z = side * (riding ? -0.17 : 0.06);
        elbows[index].rotation.x = riding ? 0.20 : 0.08 + move * 0.22;
      });
      capes.forEach((cape, index) => {
        cape.rotation.x = -0.018 - (riding ? 0.30 + Math.sin(time * 5 + index) * 0.040 : move * (0.15 + Math.sin(gait + index) * 0.045));
        cape.rotation.z = Math.sin(time * 1.8 + index) * (0.012 + move * 0.023);
      });
      scarf.rotation.x = Math.sin(time * 3.1) * 0.085 + (riding ? 0.20 : move * 0.11);
      scarf.rotation.z = Math.sin(time * 2.4) * 0.06;
      scabbard.rotation.x = riding ? -0.27 : Math.sin(gait) * move * 0.022;
      head.rotation.y = Math.sin(time * 0.62) * 0.055 * (1 - move);
      const blink = (time + 0.2) % 5.7;
      eyes.forEach((eye) => { eye.scale.y = blink < 0.12 ? Math.max(0.06, Math.abs(blink - 0.06) / 0.06) : 1; });
      rig.updateMatrix(); riderHip.copy(hipPoint).applyMatrix4(rig.matrix);
    },
    dispose: k.dispose,
  };
}

export function createPet(petId: PetId, stage: 0 | 1 | 2 | 3 = 1): ModelRig {
  if (petId === 'ember') {
    const model = createCompanion(stage);
    model.group.scale.setScalar(0.68);
    return model;
  }
  const k = modelKit(); const { group, rig, soft, material, pivot, tube, tapered, leaf, mesh } = k;
  group.name = `companion-${petId}-${stage}`;
  const cream = material('#f4e9c9'); const dark = material('#263b41');
  const gold = material('#d5b46a', { metalness: 0.55, roughness: 0.37 });
  const eyeGroups: THREE.Group[] = []; const legs: THREE.Group[] = []; const wings: THREE.Group[] = [];
  let head: THREE.Group | undefined; let tail: THREE.Group | undefined;
  let emissive: THREE.MeshStandardMaterial | undefined;
  let ridingTack: THREE.Group | undefined;

  const paws = (mat: THREE.Material, x: number, z: number, height = 0.28, width = 0.115) => {
    for (const side of [-1, 1]) {
      for (const front of [-1, 1]) {
        const leg = pivot(rig, [side * x, height, front * z]);
        soft(leg, mat, [0, -height * 0.35, 0], [width, height * 0.63, width * 1.12]);
        soft(leg, mat, [0, -height + 0.065, -0.05], [width * 1.14, 0.065, width * 1.48]);
        legs.push(leg);
      }
    }
  };
  if (petId === 'ripple') {
    const blue = material('#5aafc9', { roughness: 0.44 }); const light = material('#addde0', { roughness: 0.48 });
    const fin = material('#347f9f', { roughness: 0.43 });
    soft(rig, blue, [0, 0.51, 0.10], [0.31, 0.38, 0.49]);
    soft(rig, light, [0, 0.55, -0.237], [0.236, 0.31, 0.125]);
    paws(blue, 0.24, 0.24, 0.26, 0.10);
    head = pivot(rig, [0, 0.94, -0.30]);
    soft(head, blue, [0, 0, 0], [0.29, 0.266, 0.264]);
    soft(head, light, [0, -0.09, -0.195], [0.21, 0.13, 0.145]);
    soft(head, dark, [0, -0.016, -0.322], [0.056, 0.039, 0.041], true);
    eyeGroups.push(...k.eyes(head, 0.047, -0.235, 0.128, 0.061, '#564935'));
    for (const side of [-1, 1]) {
      const ear = leaf(head, fin, [side * 0.237, 0.105, 0.025], 0.26, 0.39);
      ear.rotation.z = side * -0.70; ear.rotation.y = side * 0.18;
      const inner = leaf(head, light, [side * 0.244, 0.125, -0.005], 0.14, 0.29);
      inner.rotation.z = side * -0.70;
      for (let dot = 0; dot < 3; dot += 1) soft(head, fin, [side * (0.078 + dot * 0.044), -0.066 + (dot % 2) * 0.026, -0.319 + dot * 0.018], [0.009, 0.009, 0.006], true);
    }
    tail = pivot(rig, [0, 0.37, 0.43]);
    tapered(tail, blue, [[0, 0, 0], [0.04, 0.035, 0.30], [0.11, 0.12, 0.63], [0.12, 0.20, 0.76]], [0.17, 0.16, 0.105, 0.012], 0.48);
    const tailFin = leaf(tail, fin, [0.08, 0.10, 0.48], 0.35, 0.37); tailFin.rotation.x = Math.PI / 2;
    tube(rig, gold, [[-0.2, 0.76, -0.30], [0, 0.65, -0.37], [0.2, 0.76, -0.30]], 0.015);
    emissive = material('#aaf7ec', { emissive: '#52c7c9', emissiveIntensity: 0.33 });
    soft(rig, emissive, [0, 0.655, -0.388], [0.057, 0.075, 0.038], true);
  } else if (petId === 'cinder') {
    const red = material('#c7613b'); const orange = material('#e99443'); const plate = material('#823f35');
    soft(rig, red, [0, 0.43, 0.09], [0.26, 0.28, 0.48]);
    soft(rig, orange, [0, 0.43, -0.24], [0.195, 0.215, 0.16]);
    paws(red, 0.275, 0.28, 0.22, 0.091);
    head = pivot(rig, [0, 0.69, -0.36]);
    soft(head, red, [0, 0, 0], [0.272, 0.22, 0.26]);
    soft(head, orange, [0, -0.065, -0.20], [0.22, 0.12, 0.19]);
    eyeGroups.push(...k.eyes(head, 0.055, -0.218, 0.153, 0.061, '#dcb454'));
    for (const side of [-1, 1]) {
      soft(head, plate, [side * 0.086, -0.028, -0.371], [0.016, 0.011, 0.008], true);
      tapered(head, plate, [[side * 0.17, 0.12, 0.08], [side * 0.22, 0.26, 0.14], [side * 0.25, 0.31, 0.26]], [0.072, 0.043, 0.006]);
    }
    for (let i = 0; i < 4; i += 1) {
      const crest = leaf(rig, orange, [0, 0.67 - i * 0.03, -0.01 + i * 0.15], 0.14, 0.20 - i * 0.02);
      crest.rotation.y = Math.PI / 2; crest.rotation.x = -0.22;
    }
    tail = pivot(rig, [0, 0.39, 0.43]);
    tapered(tail, red, [[0, 0, 0], [0.10, -0.07, 0.28], [0.23, 0.035, 0.59], [0.22, 0.21, 0.79]], [0.14, 0.10, 0.064, 0.018]);
    emissive = material('#f9b848', { emissive: '#e86e25', emissiveIntensity: 0.42 });
    const outerFlame = leaf(tail, orange, [0.22, 0.13, 0.74], 0.29, 0.41); outerFlame.rotation.z = -0.22;
    const innerFlame = leaf(tail, emissive, [0.22, 0.15, 0.701], 0.16, 0.28); innerFlame.rotation.z = -0.22;
  } else if (petId === 'moss') {
    const skin = material('#889576'); const shellMat = material('#536d60', { roughness: 0.96 });
    const seam = material('#364f44'); const leafMat = material('#9abb63');
    soft(rig, skin, [0, 0.30, 0.03], [0.52, 0.235, 0.58]);
    mesh(rig, new THREE.SphereGeometry(1, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2), shellMat, [0, 0.35, 0.05], [0.57, 0.44, 0.65]);
    const rim = mesh(rig, new THREE.TorusGeometry(1, 0.05, 8, 64), skin, [0, 0.355, 0.05], [0.57, 0.65, 0.7]); rim.rotation.x = Math.PI / 2;
    for (const angle of [0, Math.PI / 3, Math.PI * 2 / 3]) {
      const points: Point[] = [];
      for (let i = 0; i <= 20; i += 1) {
        const a = (i / 20) * Math.PI;
        points.push([Math.cos(a) * Math.cos(angle) * 0.573, 0.35 + Math.sin(a) * 0.442, 0.05 + Math.cos(a) * Math.sin(angle) * 0.653]);
      }
      tube(rig, seam, points, 0.012);
    }
    for (const radius of [0.45, 0.78]) {
      const points: Point[] = [];
      for (let i = 0; i <= 32; i += 1) { const a = i / 32 * Math.PI * 2; points.push([Math.cos(a) * radius * 0.573, 0.35 + Math.sqrt(1 - radius * radius) * 0.445, 0.05 + Math.sin(a) * radius * 0.653]); }
      tube(rig, seam, points, 0.011);
    }
    paws(skin, 0.405, 0.36, 0.185, 0.132);
    head = pivot(rig, [0, 0.40, -0.66]);
    soft(head, skin, [0, 0, 0], [0.235, 0.185, 0.245]);
    soft(head, cream, [0, -0.065, -0.15], [0.179, 0.085, 0.107]);
    eyeGroups.push(...k.eyes(head, 0.044, -0.211, 0.12, 0.045, '#664e39'));
    tapered(rig, leafMat, [[0, 0.77, 0.10], [0.025, 0.93, 0.11], [0.04, 1.10, 0.10]], [0.029, 0.022, 0.009]);
    const left = leaf(rig, leafMat, [0.015, 0.91, 0.10], 0.25, 0.30); left.rotation.z = 0.90;
    const right = leaf(rig, material('#75994c'), [0.036, 0.97, 0.13], 0.21, 0.26); right.rotation.z = -0.91;
    tail = pivot(rig, [0, 0.25, 0.58]);
    tapered(tail, skin, [[0, 0, 0], [0.03, 0.02, 0.19], [0.02, 0.025, 0.28]], [0.08, 0.042, 0.007]);
  } else if (petId === 'bolt') {
    const steel = material('#c7d0d0', { roughness: 0.31, metalness: 0.66 });
    const slate = material('#4e626a', { roughness: 0.40, metalness: 0.58 });
    emissive = material('#b0f6e4', { emissive: '#5ccdc0', emissiveIntensity: 0.42, roughness: 0.25 });
    soft(rig, steel, [0, 0.47, 0.09], [0.31, 0.30, 0.44]);
    paws(slate, 0.238, 0.255, 0.27, 0.101);
    for (const side of [-1, 1]) for (const z of [-0.255, 0.255]) {
      const joint = mesh(rig, new THREE.CylinderGeometry(0.095, 0.095, 0.048, 24), gold, [side * 0.30, 0.33, z]); joint.rotation.z = Math.PI / 2;
      soft(rig, slate, [side * 0.33, 0.33, z], [0.011, 0.048, 0.048], true);
    }
    head = pivot(rig, [0, 0.84, -0.32]);
    soft(head, steel, [0, 0, 0], [0.30, 0.255, 0.245]);
    soft(head, slate, [0, 0.007, -0.214], [0.244, 0.096, 0.051]);
    for (const side of [-1, 1]) {
      const ear = leaf(head, steel, [side * 0.178, 0.143, 0.002], 0.23, 0.28); ear.rotation.z = side * -0.27;
      const inset = leaf(head, slate, [side * 0.178, 0.161, -0.028], 0.13, 0.19); inset.rotation.z = side * -0.27;
      const eye = pivot(head, [side * 0.112, 0.015, -0.26]);
      soft(eye, emissive, [0, 0, 0], [0.068, 0.038, 0.012], true); eyeGroups.push(eye);
    }
    soft(head, gold, [0, -0.08, -0.261], [0.035, 0.027, 0.023], true);
    tube(head, slate, [[-0.06, -0.128, -0.222], [0, -0.138, -0.234], [0.06, -0.128, -0.222]], 0.008);
    soft(rig, slate, [0, 0.73, 0.19], [0.172, 0.08, 0.24]);
    for (let i = 0; i < 3; i += 1) soft(rig, emissive, [0, 0.799, 0.05 + i * 0.125], [0.10, 0.017, 0.032], true);
    tail = pivot(rig, [0, 0.44, 0.45]);
    tube(tail, slate, [[0, 0, 0], [0.07, 0.02, 0.24], [0.13, 0.22, 0.43], [0.12, 0.43, 0.43]], 0.046);
    const gearShape = new THREE.Shape();
    for (let i = 0; i < 48; i += 1) {
      const a = i / 48 * Math.PI * 2; const r = i % 4 < 2 ? 0.153 : 0.119;
      if (i === 0) gearShape.moveTo(Math.cos(a) * r, Math.sin(a) * r); else gearShape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    gearShape.closePath(); const hole = new THREE.Path(); hole.absarc(0, 0, 0.065, 0, Math.PI * 2, true); gearShape.holes.push(hole);
    mesh(tail, new THREE.ExtrudeGeometry(gearShape, { depth: 0.048, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.007, bevelSegments: 2, curveSegments: 24 }), gold, [0.12, 0.45, 0.409]);
  } else {
    const pink = material('#c899cc'); const pale = material('#edd6e8'); const violet = material('#a57fbc');
    soft(rig, pink, [0, 0.39, 0.055], [0.26, 0.32, 0.29]);
    soft(rig, pale, [0, 0.365, -0.20], [0.173, 0.22, 0.104]);
    for (const side of [-1, 1]) {
      const foot = pivot(rig, [side * 0.182, 0.13, -0.01]);
      soft(foot, pink, [0, 0, -0.07], [0.141, 0.13, 0.228]); legs.push(foot);
      soft(rig, pink, [side * 0.224, 0.414, -0.14], [0.070, 0.177, 0.093]);
    }
    head = pivot(rig, [0, 0.742, -0.21]);
    soft(head, pink, [0, 0, 0], [0.27, 0.235, 0.238]);
    soft(head, pale, [0, -0.087, -0.172], [0.166, 0.106, 0.106]);
    soft(head, violet, [0, -0.051, -0.27], [0.033, 0.025, 0.018], true);
    eyeGroups.push(...k.eyes(head, 0.026, -0.208, 0.123, 0.064, '#8163a8'));
    for (const side of [-1, 1]) {
      const ear = leaf(head, pink, [side * 0.135, 0.146, 0.028], 0.22, 0.58); ear.rotation.z = side * -0.19;
      const inset = leaf(head, pale, [side * 0.135, 0.184, -0.007], 0.117, 0.455); inset.rotation.z = side * -0.19;
    }
    soft(rig, pale, [0, 0.40, 0.335], [0.13, 0.13, 0.13]);
    emissive = material('#fce8b7', { emissive: '#dfbf81', emissiveIntensity: 0.30 });
    mesh(head, new THREE.OctahedronGeometry(0.059), emissive, [0, 0.148, -0.194], [0.7, 1.1, 0.25]);
    const membrane = material('#d2b9ed', { transparent: true, opacity: 0.62, side: THREE.DoubleSide, roughness: 0.3, emissive: '#9585ba', emissiveIntensity: 0.12, depthWrite: false });
    for (const side of [-1, 1]) {
      const wing = pivot(rig, [side * 0.14, 0.50, 0.19]); wing.scale.x = side;
      const upper = leaf(wing, membrane, [0, 0, 0], 0.43, 0.72, 0.008); upper.rotation.z = -0.63;
      const lower = leaf(wing, membrane, [0.04, -0.03, 0.019], 0.34, 0.46, 0.008); lower.rotation.z = -1.75;
      tube(wing, pale, [[0, 0, -0.013], [0.20, 0.29, -0.017], [0.405, 0.576, -0.013]], 0.010);
      tube(wing, pale, [[0, 0, -0.012], [0.24, -0.006, -0.012], [0.47, -0.105, -0.012]], 0.008);
      wings.push(wing);
    }
    const saddle = material('#96749b', { roughness: 0.86 });
    soft(rig, saddle, [0, 0.682, 0.19], [0.235, 0.044, 0.242]);
    soft(rig, pale, [0, 0.655, 0.19], [0.251, 0.025, 0.265]);
    soft(rig, saddle, [0, 0.733, 0.373], [0.215, 0.083, 0.046]);
    tube(rig, gold, [[-0.18, 0.719, 0.004], [0, 0.775, -0.03], [0.18, 0.719, 0.004]], 0.016);
    for (const side of [-1, 1]) tube(rig, saddle, [[side * 0.23, 0.655, 0.10], [side * 0.26, 0.43, 0.05], [side * 0.15, 0.245, 0.0]], 0.017);
    ridingTack = pivot(rig, [0, 0, 0]);
    ridingTack.visible = false;
    for (const side of [-1, 1]) {
      tube(ridingTack, gold, [[side * 0.125, 0.654, -0.407], [side * 0.18, 0.76, -0.27], [side * 0.17, 0.94, -0.20]], 0.010);
    }
  }

  if (stage >= 2) {
    const marking = material('#d0f5dd', { emissive: '#79baa2', emissiveIntensity: 0.20 });
    for (const side of [-1, 1]) mesh(rig, new THREE.OctahedronGeometry(0.045), marking, [side * 0.20, petId === 'moss' ? 0.72 : 0.59, petId === 'moss' ? 0.10 : -0.26], [0.68, 1.2, 0.5]);
  }
  const size = stage === 0 ? 0.88 : stage === 3 ? 1.13 : stage === 2 ? 1.065 : 1;
  rig.scale.setScalar(size);
  const seatPoint = new THREE.Vector3(0, 0.725, 0.19);
  const rideSeat = petId === 'lumi' ? seatPoint.clone().multiplyScalar(size) : undefined;
  let flying = false;
  return {
    group,
    rideSeat,
    setFlying(value) {
      flying = petId === 'lumi' && value;
      if (ridingTack) ridingTack.visible = flying;
    },
    animate(time, speed, jump = 0) {
      const move = THREE.MathUtils.clamp(speed, 0, 1); const gait = time * (7 + move * 3);
      rig.position.y = flying ? Math.sin(time * 5) * 0.027 : Math.sin(time * 2) * 0.01 + Math.abs(Math.sin(gait)) * move * 0.035;
      rig.rotation.z = flying ? Math.sin(time * 2.5) * 0.026 : Math.sin(gait) * move * 0.023;
      rig.rotation.x = flying ? 0.06 : 0;
      legs.forEach((leg, index) => {
        leg.rotation.x = flying ? -0.58 : Math.sin(gait + ((index === 0 || index === 3) ? 0 : Math.PI)) * move * 0.45 + jump * 0.08;
        if (petId === 'lumi') leg.position.y = flying ? 0.22 : 0.13;
      });
      if (head) { head.rotation.y = Math.sin(time * 0.8) * 0.08 * (1 - move * 0.5); head.rotation.x = Math.sin(time * 1.5) * 0.02; }
      if (tail) tail.rotation.y = Math.sin(time * 2.3) * (0.15 + move * 0.1);
      wings.forEach((wing, index) => {
        const side = index === 0 ? -1 : 1;
        wing.rotation.y = side * (0.22 + Math.sin(time * (flying ? 9 : 7)) * (flying ? 0.96 : 0.29));
        wing.rotation.z = flying ? side * (0.10 + Math.cos(time * 9) * 0.24) : 0;
      });
      const blink = (time + 0.5) % 5.3;
      eyeGroups.forEach((eye) => { eye.scale.y = blink < 0.13 ? Math.max(0.06, Math.abs(blink - 0.065) / 0.065) : 1; });
      if (emissive) emissive.emissiveIntensity = 0.32 + Math.sin(time * 2) * 0.08;
      if (rideSeat) { rig.updateMatrix(); rideSeat.copy(seatPoint).applyMatrix4(rig.matrix); }
    },
    dispose: k.dispose,
  };
}
