import * as THREE from 'three';
import type { WorldRenderContext } from './context';
export function createAtmosphere(context: WorldRenderContext) {
  const {
    region,
    theme,
    scene,
    materialResources,
    textures,
    keep,
    mat,
    basic,
    random,
    mesh,
    matrixDummy,
  } = context;
  scene.add(
    new THREE.HemisphereLight(theme.sky[1], theme.ambient, region === 'fire' ? 1.38 : 1.18),
  );
  const sunlight = new THREE.DirectionalLight(theme.sun, region === 'fairy' ? 2.6 : 3.0);
  sunlight.position.set(-32, 61, 25);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(2048, 2048);
  Object.assign(sunlight.shadow.camera, {
    left: -42,
    right: 42,
    top: 42,
    bottom: -42,
    near: 1,
    far: 160,
  });
  sunlight.shadow.normalBias = 0.065;
  sunlight.shadow.bias = -0.00008;
  sunlight.shadow.radius = 2;
  scene.add(sunlight, sunlight.target);
  // A shaded sky dome, rather than a flat backdrop or dark void.
  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      zenith: { value: new THREE.Color(theme.sky[0]) },
      horizon: { value: new THREE.Color(theme.sky[1]) },
    },
    vertexShader:
      'varying vec3 vDirection; void main(){ vDirection=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader:
      'varying vec3 vDirection; uniform vec3 zenith; uniform vec3 horizon; void main(){ float h=pow(max(normalize(vDirection).y,0.0),0.65); vec3 color=mix(horizon,zenith,h); gl_FragColor=vec4(color,1.0);\n#include <colorspace_fragment>\n}',
  });
  materialResources.push(skyMaterial);
  const sky = mesh(
    keep(new THREE.SphereGeometry(360, 24, 16)),
    skyMaterial,
    scene,
    [0, 0, 0],
    [1, 1, 1],
    false,
  );
  sky.renderOrder = -1000;
  sky.frustumCulled = false;
  const sunCanvas = document.createElement('canvas');
  sunCanvas.width = sunCanvas.height = 128;
  const sunContext = sunCanvas.getContext('2d');
  if (sunContext) {
    const gradient = sunContext.createRadialGradient(64, 64, 1, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,250,215,1)');
    gradient.addColorStop(0.13, 'rgba(255,247,206,.9)');
    gradient.addColorStop(0.4, 'rgba(255,242,190,.18)');
    gradient.addColorStop(1, 'rgba(255,242,190,0)');
    sunContext.fillStyle = gradient;
    sunContext.fillRect(0, 0, 128, 128);
    const texture = new THREE.CanvasTexture(sunCanvas);
    textures.push(texture);
    const sunMat = new THREE.SpriteMaterial({
      map: texture,
      color: '#fff7d6',
      transparent: true,
      depthWrite: false,
      fog: false,
    });
    materialResources.push(sunMat);
    const disk = new THREE.Sprite(sunMat);
    disk.position.set(-95, 108, -180);
    disk.scale.set(67, 67, 1);
    scene.add(disk);
  }
  // Layered ridgelines create a landscape that extends far beyond the playable land.
  for (let layer = 0; layer < 3; layer++) {
    const ridge = keep(new THREE.PlaneGeometry(360, 65, 100, 10));
    ridge.rotateX(-Math.PI / 2);
    const positions = ridge.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i),
        localZ = positions.getZ(i);
      const peak =
        14 + 18 * Math.sin(x * 0.021 + layer) ** 2 + 14 * Math.sin(x * 0.056 + layer * 2.3) ** 2;
      const edge = Math.max(0, 1 - (localZ / 35) ** 2);
      positions.setXYZ(
        i,
        x,
        peak * edge + Math.sin(x * 0.22 + localZ * 0.09) * edge * 2,
        localZ - 109 - layer * 37,
      );
    }
    ridge.computeVertexNormals();
    mesh(
      ridge,
      mat(theme.ridges[layer], { roughness: 1 }),
      scene,
      [0, layer * 4, 0],
      [1, 1, 1],
      false,
    );
  }
  const cloudGeometry = keep(new THREE.SphereGeometry(1, 10, 7));
  const cloudMaterial = basic(theme.cloud, {
    transparent: true,
    opacity: region === 'fire' ? 0.52 : 0.82,
  });
  const clouds = new THREE.InstancedMesh(cloudGeometry, cloudMaterial, 90);
  for (let i = 0; i < 90; i++) {
    const group = Math.floor(i / 5),
      lobe = i % 5;
    const angle = group * 2.399;
    matrixDummy.position.set(
      Math.cos(angle) * (75 + group * 2) + (lobe - 2) * 4.5,
      37 + (group % 4) * 4 + Math.sin(lobe) * 1.7,
      Math.sin(angle) * (95 + group * 2) - 15,
    );
    matrixDummy.scale.set(6 + random() * 5, 2.3 + random() * 2.5, 3.5 + random() * 4);
    matrixDummy.rotation.set(0, random(), 0);
    matrixDummy.updateMatrix();
    clouds.setMatrixAt(i, matrixDummy.matrix);
  }
  scene.add(clouds);
  return { sunlight };
}
