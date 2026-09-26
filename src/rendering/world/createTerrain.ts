import * as THREE from 'three';
import {
  getTerrainHeight as terrainHeight,
  lakeDistance as distanceToLake,
} from '../../game/world';
import type { WorldRenderContext } from './context';
import { SURFACE_NOISE } from './surfaceNoise';
export function createTerrain(context: WorldRenderContext) {
  const { region, theme, scene, TRAILS, keep, mat, mesh } = context;
  const getTerrainHeight = (x: number, z: number) => terrainHeight(x, z, region);
  const lakeDistance = (x: number, z: number) => distanceToLake(x, z, region);
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
    if (region === 'water') color.lerp(sand, Math.max(0, Math.min(1, (1.65 - lakeEdge) * 2)));
    else if (lakeEdge < 1.22) color.lerp(sand, Math.max(0, 1 - Math.abs(lakeEdge - 1.04) * 5));
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
    shader.fragmentShader =
      'varying vec3 meadowPosition;\n' + SURFACE_NOISE + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      region === 'meadow'
        ? `#include <color_fragment>
          vec2 ground = meadowPosition.xz;
          float broad = fieldLayers(ground * 0.19);
          float turf = fieldNoise(ground * 2.6);
          float blade = fieldNoise(ground * vec2(23.0, 11.0));
          float fleck = smoothstep(0.72, 0.88, blade) * smoothstep(0.3, 0.7, turf);
          diffuseColor.rgb *= 0.77 + broad * 0.36 + turf * 0.18;
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.13, 1.08, 0.76), fleck * 0.34);
          diffuseColor.rgb *= 0.97 + blade * 0.07;`
        : '#include <color_fragment>\n float flecks=sin(meadowPosition.x*31.0+sin(meadowPosition.z*23.0))*sin(meadowPosition.z*35.0); float patches=sin(meadowPosition.x*1.3+meadowPosition.z*.7)*cos(meadowPosition.z*1.8); diffuseColor.rgb*=.97+flecks*.035+patches*.025;',
    );
  };
  terrainMaterial.customProgramCacheKey = () => `terrain-surface-${region}-2`;
  const terrain = mesh(terrainGeometry, terrainMaterial, scene);
  terrain.castShadow = false;
  // Curved trails follow every rise of the terrain, all the way to each landmark.
  const trailMaterial = mat(theme.path, {
    roughness: region === 'steel' ? 0.65 : 1,
    metalness: region === 'steel' ? 0.2 : 0,
    ...(region === 'meadow' ? { transparent: true, depthWrite: false } : {}),
  });
  if (region === 'meadow') {
    trailMaterial.onBeforeCompile = (shader) => {
      shader.vertexShader =
        'varying vec3 pathPosition; varying vec2 pathUv;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\npathPosition=position; pathUv=uv;',
      );
      shader.fragmentShader =
        'varying vec3 pathPosition; varying vec2 pathUv;\n' + SURFACE_NOISE + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float edge = abs(pathUv.x * 2.0 - 1.0);
        float grain = fieldNoise(pathPosition.xz * 8.0);
        float earth = fieldLayers(pathPosition.xz * 1.3);
        float border = fieldNoise(pathPosition.xz * 2.2);
        float worn = 1.0 - smoothstep(0.25, 0.82, edge);
        diffuseColor.rgb *= 0.82 + earth * 0.24 + grain * 0.1 + worn * 0.08;
        diffuseColor.a *= 1.0 - smoothstep(0.68 + border * 0.15, 1.0, edge);
      `,
      );
    };
    trailMaterial.customProgramCacheKey = () => 'soft-earth-trail-1';
  }
  for (const trail of TRAILS) {
    const curve = new THREE.CatmullRomCurve3(
      trail.map((point) => new THREE.Vector3(point.x, 0, point.z)),
    );
    const vertices: number[] = [],
      indices: number[] = [],
      uvs: number[] = [];
    const steps = 130;
    for (let i = 0; i <= steps; i++) {
      const point = curve.getPoint(i / steps),
        tangent = curve.getTangent(i / steps);
      const width = (region === 'meadow' ? 2.1 : 1.55) + Math.sin(i * 0.11) * 0.15;
      for (const side of [-1, 1]) {
        const x = point.x + tangent.z * width * side,
          z = point.z - tangent.x * width * side;
        vertices.push(x, getTerrainHeight(x, z) + 0.035, z);
        uvs.push((side + 1) / 2, i / steps);
      }
      if (i < steps) {
        const index = i * 2;
        indices.push(index, index + 2, index + 1, index + 1, index + 2, index + 3);
      }
    }
    const geometry = keep(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    mesh(geometry, trailMaterial, scene, [0, 0, 0], [1, 1, 1], false);
  }
  return terrain;
}
