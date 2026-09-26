import * as THREE from 'three';
import type { RegionId } from '../../game/adventure';
import { TEMPLE_COLUMNS, TEMPLE_SEALS } from '../../game/templeWorld';
const palettes: Record<
  RegionId,
  {
    stone: string;
    floor: string;
    trim: string;
    glow: string;
    sky: string;
  }
> = {
  meadow: { stone: '#b6bb9c', floor: '#84958a', trim: '#ead399', glow: '#f9dc8c', sky: '#dce6c7' },
  water: { stone: '#a1c7ce', floor: '#4e7e91', trim: '#dae8d9', glow: '#8de7f2', sky: '#bfe9ee' },
  fire: { stone: '#776d79', floor: '#514d63', trim: '#eac0a0', glow: '#ffae73', sky: '#e2cfe6' },
  earth: { stone: '#bc9b71', floor: '#7e7861', trim: '#f0d398', glow: '#d8e896', sky: '#e9d9b4' },
  steel: { stone: '#8c9baa', floor: '#53677e', trim: '#d7bb83', glow: '#a8e8fc', sky: '#d4e3ed' },
  fairy: { stone: '#baa8c7', floor: '#756889', trim: '#edc4cc', glow: '#edb5ff', sky: '#e9d5f3' },
};
/** Owns the temple's geometry, lighting and visual animation, independently of input or progress. */
export function createTempleEnvironment(region: RegionId) {
  const scene = new THREE.Scene();
  const resourcesG = new Set<THREE.BufferGeometry>();
  const resourcesM = new Set<THREE.Material>();
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    scene.traverse((object) => {
      if (object instanceof THREE.InstancedMesh) object.dispose();
      if (
        object instanceof THREE.DirectionalLight ||
        object instanceof THREE.PointLight ||
        object instanceof THREE.SpotLight
      )
        object.shadow.dispose();
    });
    resourcesG.forEach((geometry) => geometry.dispose());
    resourcesM.forEach((material) => material.dispose());
    scene.clear();
  };
  try {
    const palette = palettes[region];
    scene.background = new THREE.Color(palette.sky);
    scene.fog = new THREE.Fog(palette.sky, 35, 65);
    scene.add(new THREE.HemisphereLight(palette.sky, '#414653', 2.8));
    const sun = new THREE.DirectionalLight('#fff0d4', 3.4);
    sun.position.set(-7, 20, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, {
      left: -18,
      right: 18,
      top: 22,
      bottom: -22,
      near: 1,
      far: 65,
    });
    sun.shadow.bias = -0.001;
    scene.add(sun);
    const mat = (color: string, options: THREE.MeshStandardMaterialParameters = {}) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: 0.78, ...options });
      resourcesM.add(m);
      return m;
    };
    const stone = mat(palette.stone),
      floorMat = mat(palette.floor),
      trim = mat(palette.trim, { metalness: 0.35, roughness: 0.42 }),
      dark = mat('#354052'),
      light = mat(palette.glow, { emissive: palette.glow, emissiveIntensity: 1.5 }),
      glass = mat(palette.glow, {
        transparent: true,
        opacity: 0.13,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      plant = mat(region === 'fairy' ? '#a290b2' : '#6c957f');
    const add = (
      geometry: THREE.BufferGeometry,
      material: THREE.Material,
      x: number,
      y: number,
      z: number,
      parent: THREE.Object3D = scene,
    ) => {
      resourcesG.add(geometry);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const box = (
      w: number,
      h: number,
      d: number,
      m: THREE.Material,
      x: number,
      y: number,
      z: number,
      parent?: THREE.Object3D,
    ) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z, parent);
    const cylinder = (
      r: number,
      h: number,
      m: THREE.Material,
      x: number,
      y: number,
      z: number,
      rt = r,
      segments = 12,
      parent?: THREE.Object3D,
    ) => add(new THREE.CylinderGeometry(rt, r, h, segments), m, x, y, z, parent);
    const ring = (
      r: number,
      t: number,
      m: THREE.Material,
      x: number,
      y: number,
      z: number,
      parent?: THREE.Object3D,
    ) => add(new THREE.TorusGeometry(r, t, 6, 44), m, x, y, z, parent);
    box(26, 0.45, 34, stone, 0, -0.25, 0);
    box(26, 0.7, 2, stone, 0, -0.45, 16);
    const tilesGeometry = new THREE.BoxGeometry(1.93, 0.05, 1.93);
    resourcesG.add(tilesGeometry);
    const tiles = new THREE.InstancedMesh(tilesGeometry, floorMat, 13 * 17);
    let tileId = 0;
    const dummy = new THREE.Object3D();
    for (let x = -12; x <= 12; x += 2)
      for (let z = -16; z <= 16; z += 2) {
        dummy.position.set(x, 0.01, z);
        dummy.updateMatrix();
        tiles.setMatrixAt(tileId, dummy.matrix);
        tiles.setColorAt(
          tileId++,
          new THREE.Color(palette.floor).multiplyScalar(0.88 + ((x * z + x + z + 100) % 7) * 0.026),
        );
      }
    tiles.receiveShadow = true;
    scene.add(tiles);
    box(3.1, 0.06, 25, trim, 0, 0.05, -0.5);
    box(2.85, 0.08, 25, floorMat, 0, 0.07, -0.5);
    for (let z = -12; z <= 10; z += 2) {
      const mosaic = box(0.75, 0.02, 0.75, trim, 0, 0.12, z);
      mosaic.rotation.y = Math.PI / 4;
    }
    // Open clerestories keep the camera inside the architecture without hiding the adventurer.
    for (const side of [-1, 1]) {
      box(0.9, 3, 33, stone, side * 12.1, 1.5, 0);
      box(1.1, 0.18, 33, trim, side * 12.1, 3.1, 0);
      for (let z = -13; z <= 12; z += 5) {
        box(0.7, 5, 0.7, stone, side * 12.1, 5.6, z);
        box(0.9, 0.18, 4.8, trim, side * 12.1, 7.9, z + 2.3);
        const pane = box(0.04, 3, 3.2, glass, side * 12.1, 5.4, z + 2.3);
        pane.castShadow = false;
      }
      box(0.8, 0.12, 27, light, side * 11.25, 0.15, -0.5);
    }
    box(26, 7, 0.8, stone, 0, 3.5, -16.7);
    box(6, 5, 0.1, dark, 0, 3, -16.22);
    const windowRing = ring(3, 0.18, trim, 0, 7, -16.25);
    windowRing.scale.y = 1.2;
    const windowDisc = add(new THREE.CircleGeometry(2.8, 40), glass, 0, 7, -16.3);
    windowDisc.scale.y = 1.2;
    for (let i = 0; i < 8; i++) {
      const spoke = box(0.11, 5.6, 0.12, trim, 0, 7, -16.15);
      spoke.rotation.z = (i * Math.PI) / 8;
    }
    for (const c of TEMPLE_COLUMNS) {
      cylinder(1.25, 0.3, stone, c.x, 0.15, c.z);
      cylinder(1.05, 0.3, trim, c.x, 0.4, c.z);
      cylinder(0.72, 6.7, stone, c.x, 3.9, c.z, 0.64);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        cylinder(0.065, 6, trim, c.x + Math.cos(a) * 0.71, 3.8, c.z + Math.sin(a) * 0.71, 0.065, 5);
      }
      cylinder(1.1, 0.25, trim, c.x, 7.25, c.z);
      box(2.3, 0.6, 2.3, stone, c.x, 7.65, c.z);
      const curve = new THREE.EllipseCurve(0, 0, 9, 4, 0, Math.PI, false, 0);
      const points = curve.getPoints(35).map((p) => new THREE.Vector3(p.x, p.y + 7.9, c.z));
      if (c.x < 0) {
        add(
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 36, 0.18, 6, false),
          stone,
          0,
          0,
          0,
        );
        box(1.7, 0.18, 1.7, trim, 0, 11.75, c.z);
      }
    }
    // Entry portal, side alcoves and themed gardens.
    for (const x of [-4, 4]) {
      box(1, 6, 1.2, stone, x, 3, 15.6);
      box(1.4, 0.25, 1.6, trim, x, 6.1, 15.6);
    }
    box(9, 0.65, 1.4, stone, 0, 6.6, 15.6);
    const entryGlow = box(6, 4.8, 0.05, glass, 0, 2.5, 15.8);
    entryGlow.castShadow = false;
    for (const x of [-10.7, 10.7])
      for (const z of [-12, 4, 12]) {
        cylinder(0.65, 0.8, stone, x, 0.4, z);
        const bowl = cylinder(0.8, 0.3, trim, x, 0.95, z, 0.95);
        if (region === 'fire' || region === 'steel') {
          add(new THREE.OctahedronGeometry(0.65, 0), light, x, 1.5, z);
          const torch = new THREE.PointLight(palette.glow, 7, 7);
          torch.position.set(x, 2, z);
          scene.add(torch);
        } else {
          for (let i = 0; i < 5; i++) {
            const leaf = add(
              new THREE.SphereGeometry(1, 7, 5),
              plant,
              x + Math.sin(i * 2.4) * 0.4,
              1.5 + Math.cos(i) * 0.2,
              z + Math.cos(i * 2.4) * 0.4,
            );
            leaf.scale.set(0.25, 0.9, 0.2);
            leaf.rotation.z = Math.sin(i) * 0.5;
          }
        }
        bowl.receiveShadow = true;
      }
    const lampOrbs: THREE.Mesh[] = [],
      lampRings: THREE.Mesh[] = [],
      lampLights: THREE.PointLight[] = [];
    TEMPLE_SEALS.forEach((p, i) => {
      cylinder(1.1, 0.25, stone, p.x, 0.18, p.z);
      cylinder(0.8, 0.2, trim, p.x, 0.4, p.z);
      cylinder(0.55, 1.5, stone, p.x, 1.1, p.z, 0.72);
      const halo = ring(0.77, 0.035, trim, p.x, 2.6, p.z);
      lampRings.push(halo);
      const orbMaterial = mat(palette.glow, {
        emissive: palette.glow,
        emissiveIntensity: 0.15,
        metalness: 0.3,
        roughness: 0.28,
      });
      const orb = add(new THREE.OctahedronGeometry(0.45, 1), orbMaterial, p.x, 2.5, p.z);
      lampOrbs.push(orb);
      const lampLight = new THREE.PointLight(palette.glow, 0, 7);
      lampLight.position.set(p.x, 3, p.z);
      scene.add(lampLight);
      lampLights.push(lampLight);
      // Distinct silhouettes make the three glyphs recognizable from a distance.
      for (let j = 0; j <= i; j++) {
        const rune = box(0.17, 0.7, 0.14, trim, p.x + (j - i / 2) * 0.28, 1.3, p.z + 0.65);
        rune.rotation.z = 0.15 * (j - i / 2);
      }
    });
    cylinder(1.9, 0.2, stone, 0, 0.18, -13);
    cylinder(1.55, 0.4, trim, 0, 0.48, -13);
    cylinder(1.1, 1, stone, 0, 1.1, -13, 1.25);
    const artifact = new THREE.Group();
    artifact.position.set(0, 2.8, -13);
    scene.add(artifact);
    add(new THREE.IcosahedronGeometry(0.62, 0), light, 0, 0, 0, artifact);
    for (let i = 0; i < 3; i++) {
      const r = ring(0.95, 0.045, trim, 0, 0, 0, artifact);
      r.rotation.x = (i * Math.PI) / 3;
      r.rotation.y = i * 0.8;
    }
    const aura = add(new THREE.CylinderGeometry(1.8, 1.8, 4.6, 40, 1, true), glass, 0, 2.5, -13);
    aura.castShadow = false;
    const gate = new THREE.Group();
    gate.position.set(0, 3.6, -10.9);
    scene.add(gate);
    const gateMaterial = mat(palette.glow, {
      transparent: true,
      opacity: 0.25,
      emissive: palette.glow,
      emissiveIntensity: 0.5,
      depthWrite: false,
    });
    const curtain = box(5.4, 6.8, 0.04, gateMaterial, 0, 0, 0, gate);
    curtain.castShadow = false;
    for (let x = -2.4; x <= 2.5; x += 0.8) {
      const line = box(0.03, 6.7, 0.03, light, x, 0, 0, gate);
      line.castShadow = false;
    }
    const beam = add(new THREE.ConeGeometry(4, 13, 32, 1, true), glass, 0, 6.8, -13);
    beam.castShadow = false;
    const particlesGeometry = new THREE.BufferGeometry(),
      particlesArray = new Float32Array(90 * 3);
    for (let i = 0; i < 90; i++) {
      particlesArray[i * 3] = Math.sin(i * 7.31) * 11;
      particlesArray[i * 3 + 1] = 0.6 + (i % 17) * 0.45;
      particlesArray[i * 3 + 2] = Math.cos(i * 3.82) * 15;
    }
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(particlesArray, 3));
    resourcesG.add(particlesGeometry);
    const particlesMaterial = new THREE.PointsMaterial({
      color: palette.glow,
      size: 0.055,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });
    resourcesM.add(particlesMaterial);
    scene.add(new THREE.Points(particlesGeometry, particlesMaterial));
    const cameraBlockers: THREE.Object3D[] = [];
    scene.traverse((node) => {
      if (node instanceof THREE.Mesh && !(node.material as THREE.Material).transparent)
        cameraBlockers.push(node);
    });
    const clickTarget = ring(0.6, 0.035, light, 0, 0.16, 0);
    clickTarget.rotation.x = -Math.PI / 2;
    clickTarget.visible = false;
    return {
      scene,
      cameraBlockers,
      clickTarget,
      dispose,
      update(time: number, sequence: readonly number[], completed: boolean, dt: number) {
        if (disposed) return;
        lampOrbs.forEach((orb, i) => {
          const lit = sequence.includes(i);
          const m = orb.material as THREE.MeshStandardMaterial;
          m.emissiveIntensity = lit ? 2 : 0.08;
          orb.position.y = 2.5 + Math.sin(time * 1.5 + i) * 0.13;
          orb.rotation.y = time * 0.5;
          lampRings[i].rotation.y = Math.sin(time * 0.5 + i) * 0.4;
          lampLights[i].intensity = lit ? 8 : 0;
        });
        gate.scale.y = THREE.MathUtils.lerp(
          gate.scale.y,
          sequence.length === 3 ? 0.001 : 1,
          Math.min(1, dt * 2),
        );
        gate.position.y = 6.9 - gate.scale.y * 3.3;
        gate.visible = gate.scale.y > 0.01;
        artifact.rotation.y = time * 0.4;
        artifact.position.y = 2.8 + Math.sin(time * 1.3) * 0.16;
        artifact.visible = !completed;
        aura.visible = !completed;
        beam.visible = sequence.length === 3;
      },
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
