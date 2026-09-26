import * as THREE from 'three';
import { getTerrainHeight, lakeDistance } from '../../game/world';
import type { WorldRenderContext } from './context';
export function createTerrain(context: WorldRenderContext) {
  const { region, theme, scene, TRAILS, keep, mat, mesh } = context;
  // Leave a broad apron beyond the playable edge so distant views never reveal a void.
  const terrainSize = region === 'meadow' ? 286 : 224;
  const terrainGeometry = keep(new THREE.PlaneGeometry(terrainSize, terrainSize, 224, 224));
  terrainGeometry.rotateX(-Math.PI / 2);
  const terrainPositions = terrainGeometry.attributes.position;
  const groundColors: number[] = [];
  const darkGrass = new THREE.Color(theme.ground[0]),
    lightGrass = new THREE.Color(theme.ground[1]),
    sand = new THREE.Color(theme.path);
  for (let i = 0; i < terrainPositions.count; i++) {
    const x = terrainPositions.getX(i),
      z = terrainPositions.getZ(i);
    const height = getTerrainHeight(x, z);
    terrainPositions.setY(i, height);
    const patch =
      Math.sin(x * 0.19) * Math.cos(z * 0.16) * 0.2 + Math.sin(x * 0.43 + z * 0.23) * 0.07 + 0.49;
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
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n meadowPosition=position;',
    );
    shader.fragmentShader = 'varying vec3 meadowPosition;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      '#include <color_fragment>\n float flecks=sin(meadowPosition.x*31.0+sin(meadowPosition.z*23.0))*sin(meadowPosition.z*35.0); float patches=sin(meadowPosition.x*1.3+meadowPosition.z*.7)*cos(meadowPosition.z*1.8); diffuseColor.rgb*=.97+flecks*.035+patches*.025;',
    );
  };
  const terrain = mesh(terrainGeometry, terrainMaterial, scene);
  terrain.castShadow = false;
  // Curved trails follow every rise of the terrain, all the way to each landmark.
  const trailMaterial = mat(theme.path, {
    roughness: region === 'steel' ? 0.65 : 1,
    metalness: region === 'steel' ? 0.2 : 0,
  });
  for (const trail of TRAILS) {
    const curve = new THREE.CatmullRomCurve3(
      trail.map((point) => new THREE.Vector3(point.x, 0, point.z)),
    );
    const vertices: number[] = [],
      indices: number[] = [],
      colors: number[] = [];
    const steps = 130;
    for (let i = 0; i <= steps; i++) {
      const point = curve.getPoint(i / steps),
        tangent = curve.getTangent(i / steps);
      const width = 1.55 + Math.sin(i * 0.11) * 0.15;
      for (const side of [-1, 1]) {
        const x = point.x + tangent.z * width * side,
          z = point.z - tangent.x * width * side;
        vertices.push(x, getTerrainHeight(x, z) + 0.035, z);
        const color = new THREE.Color('#ffffff').multiplyScalar(0.93 + Math.sin(i * 0.7) * 0.035);
        colors.push(color.r, color.g, color.b);
      }
      if (i < steps) {
        const index = i * 2;
        indices.push(index, index + 2, index + 1, index + 1, index + 2, index + 3);
      }
    }
    const geometry = keep(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    mesh(geometry, trailMaterial, scene, [0, 0, 0], [1, 1, 1], false);
  }
  return terrain;
}
