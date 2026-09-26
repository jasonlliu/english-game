import * as THREE from 'three';
import { getTerrainHeight } from '../../game/world';
import type { WorldRenderContext } from './context';
export function createAmbientLife(context: WorldRenderContext) {
  const { region, theme, scene, materialResources, keep, basic, random, mesh } = context;
  // Bird silhouettes and butterfly wings add small, quiet movement to the vista.
  const birdGeometry = keep(new THREE.BufferGeometry());
  birdGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [-0.7, 0.16, 0, 0, 0, 0, -0.16, 0.04, 0.12, 0.7, 0.16, 0, 0.16, 0.04, 0.12, 0, 0, 0],
      3,
    ),
  );
  birdGeometry.computeVertexNormals();
  const birdMaterial = basic('#4b6e73', { side: THREE.DoubleSide });
  const birds: THREE.Mesh[] = [];
  for (let i = 0; i < (region === 'water' ? 0 : 9); i++)
    birds.push(mesh(birdGeometry, birdMaterial, scene, [0, 0, 0], [1, 1, 1], false));
  const butterflyMaterial = basic(theme.flowers[0], { side: THREE.DoubleSide });
  const butterflyGeometry = keep(new THREE.CircleGeometry(0.105, 6));
  const butterflies: {
    group: THREE.Group;
    wings: THREE.Mesh[];
    x: number;
    z: number;
  }[] = [];
  for (let i = 0; i < (region === 'water' ? 0 : 13); i++) {
    const group = new THREE.Group();
    scene.add(group);
    const wings = [-1, 1].map((side) =>
      mesh(butterflyGeometry, butterflyMaterial, group, [side * 0.08, 0, 0], [1, 1.55, 1], false),
    );
    butterflies.push({ group, wings, x: -7 + random() * 20, z: 10 + random() * 22 });
  }
  const dustGeometry = keep(new THREE.BufferGeometry());
  const dustPositions = new Float32Array(70 * 3);
  for (let i = 0; i < 70; i++) {
    dustPositions[i * 3] = (random() - 0.5) * 24;
    dustPositions[i * 3 + 1] = random() * 6;
    dustPositions[i * 3 + 2] = (random() - 0.5) * 24;
  }
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dustMaterial = new THREE.PointsMaterial({
    color: theme.dust,
    size: region === 'fairy' || region === 'fire' ? 0.095 : 0.045,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    blending:
      region === 'fairy' || region === 'fire' ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  materialResources.push(dustMaterial);
  const dust = new THREE.Points(dustGeometry, dustMaterial);
  scene.add(dust);
  const dustOriginals = dustPositions.slice();
  return {
    update(
      time: number,
      position: {
        x: number;
        z: number;
      },
      height: number,
    ) {
      birds.forEach((bird, i) => {
        const angle = time * 0.08 + i * 0.7;
        bird.position.set(
          Math.cos(angle) * 24 - 4,
          19 + Math.sin(angle * 0.6 + i) * 3,
          -33 + Math.sin(angle) * 13,
        );
        bird.rotation.set(Math.sin(time * 2 + i) * 0.15, -angle, Math.sin(time * 3 + i) * 0.12);
        bird.scale.y = 0.65 + Math.sin(time * 5 + i) * 0.3;
      });
      butterflies.forEach((butterfly, i) => {
        const x = butterfly.x + Math.sin(time * 0.4 + i) * 1.5,
          z = butterfly.z + Math.cos(time * 0.5 + i) * 1.4;
        butterfly.group.position.set(
          x,
          getTerrainHeight(x, z) + 1.2 + Math.sin(time * 0.9 + i) * 0.45,
          z,
        );
        butterfly.group.rotation.y = time * 0.4 + i;
        butterfly.wings.forEach((wing, side) => {
          wing.rotation.y = (side ? 1 : -1) * (0.4 + Math.sin(time * 11 + i) * 0.6);
        });
      });
      dust.position.set(position.x, height, position.z);
      dust.rotation.y = time * 0.015;
      if (region === 'fire' || region === 'fairy') {
        for (let i = 0; i < 70; i++)
          dustPositions[i * 3 + 1] =
            region === 'fire'
              ? (dustOriginals[i * 3 + 1] + time * 0.8) % 6
              : dustOriginals[i * 3 + 1] + Math.sin(time * 1.2 + i) * 0.3;
        dustGeometry.attributes.position.needsUpdate = true;
      }
    },
  };
}
