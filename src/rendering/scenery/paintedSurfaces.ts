import type * as THREE from 'three';
import type { SceneryKit } from './kit';
import { SURFACE_NOISE } from '../world/surfaceNoise';

/** Quiet surface detail at walking distance, without per-building texture copies. */
function paintSurface(
  material: THREE.MeshStandardMaterial,
  kind: 'stone' | 'plaster' | 'roof' | 'wood',
) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader =
      'varying vec3 surfacePoint; varying vec3 surfaceNormal;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      surfacePoint = (modelMatrix * vec4(position, 1.0)).xyz;
      surfaceNormal = normalize(mat3(modelMatrix) * normal);`,
    );
    shader.fragmentShader =
      'varying vec3 surfacePoint; varying vec3 surfaceNormal;\n' +
      SURFACE_NOISE +
      shader.fragmentShader;
    const detail = {
      stone: `
        vec2 blocks = vec2(s.x + mod(floor(s.y * 1.6), 2.0) * 0.53, s.y) * vec2(0.9, 1.6);
        vec2 edge = min(fract(blocks), 1.0 - fract(blocks));
        float mortar = 1.0 - smoothstep(0.014, 0.037, min(edge.x, edge.y));
        float blockTone = fieldHash(floor(blocks));
        diffuseColor.rgb *= 0.88 + blockTone * 0.18 + textureGrain * 0.08;
        diffuseColor.rgb *= 1.0 - mortar * 0.16;
      `,
      plaster: 'diffuseColor.rgb *= 0.94 + textureGrain * 0.12;',
      wood: `float grain = fieldNoise(s * vec2(15.0, 0.8));
        diffuseColor.rgb *= 0.87 + grain * 0.2 + textureGrain * 0.06;`,
      roof: `vec2 tiles = surfacePoint.xz * 1.35;
        vec2 tileEdge = min(fract(tiles), 1.0 - fract(tiles));
        float seam = 1.0 - smoothstep(0.02, 0.065, min(tileEdge.x, tileEdge.y));
        diffuseColor.rgb *= 0.9 + fieldHash(floor(tiles)) * 0.16 - seam * 0.17;`,
    }[kind];
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      vec3 n = abs(surfaceNormal);
      vec2 s = n.x > n.z ? surfacePoint.zy : surfacePoint.xy;
      if (n.y > 0.8) s = surfacePoint.xz;
      float textureGrain = fieldNoise(s * 19.0);
      ${detail}`,
    );
  };
  material.customProgramCacheKey = () => `painted-surface-${kind}-1`;
}

export function paintArchitecture(kit: SceneryKit) {
  paintSurface(kit.stone, 'stone');
  paintSurface(kit.trim, 'stone');
  paintSurface(kit.plaster, 'plaster');
  paintSurface(kit.roofMat, 'roof');
  paintSurface(kit.wood, 'wood');
}
