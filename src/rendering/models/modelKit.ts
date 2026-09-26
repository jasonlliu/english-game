import * as THREE from 'three';
import type { Point } from './types';
export function modelKit() {
  const group = new THREE.Group();
  const rig = new THREE.Group();
  group.add(rig);
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const sphere = new THREE.SphereGeometry(1, 24, 18);
  const detailSphere = new THREE.SphereGeometry(1, 16, 12);
  geometries.add(sphere);
  geometries.add(detailSphere);
  const material = (color: string, options: THREE.MeshStandardMaterialParameters = {}) => {
    const result = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.7,
      metalness: 0.03,
      ...options,
    });
    materials.add(result);
    return result;
  };
  function mesh(
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    mat: THREE.Material,
    position: Point = [0, 0, 0],
    scale: Point = [1, 1, 1],
  ) {
    geometries.add(geometry);
    const result = new THREE.Mesh(geometry, mat);
    result.position.set(...position);
    result.scale.set(...scale);
    result.castShadow = true;
    result.receiveShadow = true;
    parent.add(result);
    return result;
  }
  const soft = (parent: THREE.Object3D, mat: THREE.Material, p: Point, s: Point, detail = false) =>
    mesh(parent, detail ? detailSphere : sphere, mat, p, s);
  const pivot = (parent: THREE.Object3D, p: Point) => {
    const result = new THREE.Group();
    result.position.set(...p);
    parent.add(result);
    return result;
  };
  function tube(parent: THREE.Object3D, mat: THREE.Material, points: Point[], radius: number) {
    return mesh(
      parent,
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))),
        24,
        radius,
        8,
        false,
      ),
      mat,
    );
  }
  function tapered(
    parent: THREE.Object3D,
    mat: THREE.Material,
    points: Point[],
    widths: number[],
    flatten = 1,
  ) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    const frames = curve.computeFrenetFrames(24, false);
    const vertices: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i <= 24; i += 1) {
      const t = i / 24;
      const c = curve.getPointAt(t);
      const at = t * (widths.length - 1);
      const lower = Math.min(Math.floor(at), widths.length - 2);
      const width = THREE.MathUtils.lerp(widths[lower], widths[lower + 1], at - lower);
      for (let j = 0; j <= 12; j += 1) {
        const a = (j / 12) * Math.PI * 2;
        const v = c
          .clone()
          .addScaledVector(frames.normals[i], Math.cos(a) * width)
          .addScaledVector(frames.binormals[i], Math.sin(a) * width * flatten);
        vertices.push(v.x, v.y, v.z);
        if (i < 24 && j < 12) {
          const a = i * 13 + j;
          indices.push(a, a + 1, a + 13, a + 1, a + 14, a + 13);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return mesh(parent, geometry, mat);
  }
  function leaf(
    parent: THREE.Object3D,
    mat: THREE.Material,
    p: Point,
    width: number,
    height: number,
    depth = 0.025,
  ) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(-width * 0.68, height * 0.25, -width * 0.47, height * 0.72, 0, height);
    shape.bezierCurveTo(width * 0.47, height * 0.72, width * 0.68, height * 0.25, 0, 0);
    return mesh(
      parent,
      new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: true,
        bevelSize: 0.018,
        bevelThickness: 0.014,
        bevelSegments: 3,
        curveSegments: 16,
      }),
      mat,
      p,
    );
  }
  function eyes(
    parent: THREE.Object3D,
    y: number,
    z: number,
    separation: number,
    size: number,
    irisColor = '#694b2c',
  ) {
    const eyeMaterial = material(irisColor, { roughness: 0.19 });
    const pupil = material('#172930', { roughness: 0.13 });
    const white = material('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.25 });
    const groups: THREE.Group[] = [];
    for (const side of [-1, 1]) {
      const eye = pivot(parent, [side * separation, y, z]);
      soft(eye, eyeMaterial, [0, 0, 0], [size, size * 1.12, size * 0.35], true);
      soft(eye, pupil, [0, 0, -size * 0.26], [size * 0.62, size * 0.78, size * 0.23], true);
      soft(
        eye,
        white,
        [-size * 0.28, size * 0.38, -size * 0.49],
        [size * 0.25, size * 0.25, size * 0.12],
        true,
      );
      groups.push(eye);
    }
    return groups;
  }
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    group.clear();
  };
  return { group, rig, material, mesh, soft, pivot, tube, tapered, leaf, eyes, dispose };
}
