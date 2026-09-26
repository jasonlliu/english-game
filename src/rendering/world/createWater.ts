import * as THREE from 'three';
import { getTerrainHeight, LAKE, lakeDistance } from '../../game/world';
import type { WorldRenderContext } from './context';
export function createWater(context: WorldRenderContext, regionCrowns: THREE.BufferGeometry[]) {
  const {
    region,
    theme,
    scene,
    materialResources,
    keep,
    mat,
    basic,
    random,
    mesh,
    cube,
    sphere,
    cylinder,
    stone,
    stoneLight,
    stoneDark,
    gold,
    glowing,
    matrixDummy,
  } = context;
  // A lake with a real shoreline, a playable sandy peninsula, ripples and reeds.
  const waterVertices: number[] = [LAKE.x, LAKE.waterLevel, LAKE.z],
    waterIndices: number[] = [];
  const shorePoints: THREE.Vector3[] = [];
  for (let i = 0; i <= 128; i++) {
    const angle = (i / 128) * Math.PI * 2;
    let low = 0,
      high = 1.35;
    for (let n = 0; n < 14; n++) {
      const r = (low + high) / 2;
      if (
        lakeDistance(
          LAKE.x + Math.cos(angle) * LAKE.radiusX * r,
          LAKE.z + Math.sin(angle) * LAKE.radiusZ * r,
        ) < 1.045
      )
        low = r;
      else high = r;
    }
    const x = LAKE.x + Math.cos(angle) * LAKE.radiusX * low,
      z = LAKE.z + Math.sin(angle) * LAKE.radiusZ * low;
    waterVertices.push(x, LAKE.waterLevel, z);
    shorePoints.push(new THREE.Vector3(x, LAKE.waterLevel + 0.015, z));
    if (i < 128) waterIndices.push(0, i + 2, i + 1);
  }
  const waterGeometry = keep(new THREE.BufferGeometry());
  waterGeometry.setAttribute('position', new THREE.Float32BufferAttribute(waterVertices, 3));
  waterGeometry.setIndex(waterIndices);
  waterGeometry.computeVertexNormals();
  const waterMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      time: { value: 0 },
      deep: { value: new THREE.Color(theme.water[0]) },
      shallow: { value: new THREE.Color(theme.water[1]) },
      lava: { value: region === 'fire' ? 1 : 0 },
    },
    vertexShader:
      'varying vec3 vWorld; void main(){vWorld=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:
      'varying vec3 vWorld; uniform float time; uniform vec3 deep; uniform vec3 shallow; uniform float lava; void main(){float lines=sin(vWorld.x*2.1+vWorld.z*.5+time*.6)*sin(vWorld.z*2.6-time*.45); float glint=pow(max(0.,lines),16.); float swirls=sin(vWorld.x*.34+time*.12)*cos(vWorld.z*.25+time*.1)*.5+.5; vec3 color=mix(deep,shallow,swirls*(.35+lava*.65)); color+=glint*(.24+lava*.2)+lava*vec3(.18,.035,.0); gl_FragColor=vec4(color,.94);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
  });
  materialResources.push(waterMaterial);
  mesh(waterGeometry, waterMaterial, scene, [0, 0, 0], [1, 1, 1], false);
  const shoreCurve = new THREE.CatmullRomCurve3(shorePoints, true);
  mesh(
    keep(new THREE.TubeGeometry(shoreCurve, 128, 0.065, 3, true)),
    basic(theme.glow, { transparent: true, opacity: 0.58 }),
    scene,
    [0, 0, 0],
    [1, 1, 1],
    false,
  );
  const reeds = new THREE.InstancedMesh(
    keep(new THREE.CylinderGeometry(0.018, 0.038, 1.4, 4)),
    mat(theme.grass[1]),
    130,
  );
  for (let i = 0; i < 130; i++) {
    const point = shorePoints[(i * 7) % 128];
    const x = point.x + (random() - 0.5) * 1.6,
      z = point.z + (random() - 0.5) * 1.6;
    matrixDummy.position.set(x, Math.max(LAKE.waterLevel, getTerrainHeight(x, z)) + 0.4, z);
    matrixDummy.scale.setScalar(0.5 + random() * 0.6);
    matrixDummy.rotation.set(0.08, random(), 0.12);
    matrixDummy.updateMatrix();
    reeds.setMatrixAt(i, matrixDummy.matrix);
  }
  scene.add(reeds);
  // Large regional silhouettes stay inside the lake's non-walkable footprint.
  // Their geometry changes as well as their palette, so each realm reads at spawn.
  const regionAnimations: {
    object: THREE.Object3D;
    axis: 'x' | 'y' | 'z';
    speed: number;
  }[] = [];
  const landmark = new THREE.Group();
  landmark.position.set(LAKE.x, LAKE.waterLevel, LAKE.z);
  scene.add(landmark);
  if (region === 'water') {
    const coralMaterials = [mat('#e9a9a3', { roughness: 0.6 }), mat('#8bced2', { roughness: 0.5 })];
    for (const side of [-1, 1]) {
      mesh(cylinder, stoneLight, landmark, [side * 5.6, 3.0, 0], [0.42, 6, 0.42]);
      mesh(
        regionCrowns[1],
        coralMaterials[side === -1 ? 0 : 1],
        landmark,
        [side * 5.6, -0.4, 0],
        [1.4, 1.5, 1.4],
      );
      mesh(
        keep(new THREE.OctahedronGeometry(1, 0)),
        glowing,
        landmark,
        [side * 5.6, 9.05, 0],
        [0.48, 1.2, 0.48],
      );
    }
    const pearlArch = mesh(
      keep(new THREE.TorusGeometry(5.7, 0.28, 8, 48, Math.PI)),
      stoneLight,
      landmark,
      [0, 5.2, 0],
      [1, 0.86, 1],
    );
    pearlArch.rotation.y = 0.04;
    const pearl = mesh(
      sphere,
      mat('#e7fcf6', {
        emissive: '#8fbebc',
        emissiveIntensity: 0.25,
        metalness: 0.3,
        roughness: 0.16,
      }),
      landmark,
      [0, 7.8, 0],
      [0.75, 0.75, 0.75],
    );
    regionAnimations.push({ object: pearl, axis: 'y', speed: 0.2 });
  } else if (region === 'fire') {
    const volcanoProfile = [
      new THREE.Vector2(8.0, 0),
      new THREE.Vector2(7.3, 2),
      new THREE.Vector2(6.1, 4.7),
      new THREE.Vector2(5.2, 7),
      new THREE.Vector2(4.0, 10.2),
      new THREE.Vector2(3.1, 12.2),
      new THREE.Vector2(2.8, 12.8),
      new THREE.Vector2(2.42, 11.8),
      new THREE.Vector2(0.8, 10.9),
    ];
    const volcanoGeometry = keep(new THREE.LatheGeometry(volcanoProfile, 24));
    const vertices = volcanoGeometry.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i),
        z = vertices.getZ(i),
        y = vertices.getY(i);
      const rough = 1 + Math.sin(Math.atan2(z, x) * 9 + y * 0.8) * 0.055;
      vertices.setXYZ(i, x * rough, y, z * rough);
    }
    volcanoGeometry.computeVertexNormals();
    mesh(volcanoGeometry, stoneDark, landmark);
    mesh(
      keep(new THREE.TorusGeometry(2.65, 0.15, 7, 42)),
      glowing,
      landmark,
      [0, 12.3, 0],
    ).rotation.x = -Math.PI / 2;
    mesh(
      keep(new THREE.CircleGeometry(2.65, 42)),
      basic('#ffb952'),
      landmark,
      [0, 11.95, 0],
      [1, 1, 1],
      false,
    ).rotation.x = -Math.PI / 2;
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const shard = mesh(
        keep(new THREE.OctahedronGeometry(1, 0)),
        glowing,
        landmark,
        [Math.cos(angle) * 6.5, 1.3, Math.sin(angle) * 6.5],
        [0.4, 1.7, 0.4],
      );
      shard.rotation.z = 0.15 * Math.sin(angle);
    }
    const heatLight = new THREE.PointLight('#ff8c44', 34, 28, 2);
    heatLight.position.set(0, 12.5, 0);
    landmark.add(heatLight);
  } else if (region === 'earth') {
    for (const side of [-1, 1]) {
      mesh(keep(new THREE.CylinderGeometry(1.0, 1.75, 6.4, 9)), stone, landmark, [
        side * 5.4,
        3.2,
        0,
      ]);
      for (let i = 0; i < 4; i++)
        mesh(
          cylinder,
          i % 2 ? stoneLight : stoneDark,
          landmark,
          [side * 5.4, 1.2 + i * 1.5, 0],
          [1.5 - i * 0.08, 0.15, 1.45 - i * 0.08],
        );
    }
    mesh(
      keep(new THREE.TorusGeometry(5.4, 0.92, 7, 24, Math.PI)),
      stoneLight,
      landmark,
      [0, 6.2, 0],
      [1, 0.82, 1],
    );
    for (const [x, z, size] of [
      [-3, -5, 1.45],
      [4, 4, 1.3],
    ])
      mesh(regionCrowns[0], stone, landmark, [x, -0.2, z], [size, size, size]);
    const amber = mesh(
      keep(new THREE.OctahedronGeometry(1, 0)),
      glowing,
      landmark,
      [0, 7.0, 0],
      [0.62, 1.18, 0.62],
    );
    regionAnimations.push({ object: amber, axis: 'y', speed: 0.23 });
  } else if (region === 'steel') {
    const gearShape = new THREE.Shape();
    for (let i = 0; i < 80; i++) {
      const angle = (i / 80) * Math.PI * 2,
        r = i % 4 < 2 ? 1 : 1.15;
      const x = Math.cos(angle) * r,
        y = Math.sin(angle) * r;
      if (i === 0) gearShape.moveTo(x, y);
      else gearShape.lineTo(x, y);
    }
    gearShape.closePath();
    const hole = new THREE.Path();
    hole.absarc(0, 0, 0.68, 0, Math.PI * 2, true);
    gearShape.holes.push(hole);
    const gearGeometry = keep(
      new THREE.ExtrudeGeometry(gearShape, {
        depth: 0.12,
        bevelEnabled: true,
        bevelSize: 0.025,
        bevelThickness: 0.025,
        bevelSegments: 1,
        steps: 1,
      }),
    );
    mesh(cube, stoneDark, landmark, [0, 4, 0], [1.35, 8, 1.35]);
    const primaryGear = mesh(gearGeometry, stoneLight, landmark, [0, 7.3, 0], [5.7, 5.7, 4]);
    const secondaryGear = mesh(gearGeometry, gold, landmark, [6.8, 4.3, 0.4], [2.5, 2.5, 3]);
    regionAnimations.push(
      { object: primaryGear, axis: 'z', speed: 0.09 },
      { object: secondaryGear, axis: 'z', speed: -0.2 },
    );
    mesh(keep(new THREE.TorusGeometry(3.7, 0.08, 6, 64)), glowing, landmark, [0, 7.3, 0.65]);
    mesh(
      keep(new THREE.OctahedronGeometry(1, 0)),
      glowing,
      landmark,
      [0, 7.3, 0.45],
      [1.0, 1.7, 1.0],
    );
    for (const side of [-1, 1]) mesh(cube, stone, landmark, [side * 4.9, 1.1, 0], [1.1, 2.2, 1.5]);
  } else if (region === 'fairy') {
    const mushroomStem = mat('#dfccd7', { emissive: '#705b7d', emissiveIntensity: 0.13 });
    mesh(keep(new THREE.CylinderGeometry(0.9, 1.6, 11.5, 14)), mushroomStem, landmark, [0, 5.5, 0]);
    mesh(
      regionCrowns[0],
      mat('#cda6d7', { emissive: '#a162b2', emissiveIntensity: 0.2 }),
      landmark,
      [0, 0, 0],
      [2.55, 2.55, 2.55],
    );
    for (let i = 0; i < 17; i++) {
      const angle = i * 2.4,
        r = 1 + ((i * 1.9) % 4.1);
      mesh(
        sphere,
        basic('#ffead8'),
        landmark,
        [Math.cos(angle) * r, 14.8 - r * 0.38, Math.sin(angle) * r],
        [0.25 + random() * 0.16, 0.1, 0.3 + random() * 0.17],
        false,
      );
    }
    for (const side of [-1, 1]) {
      mesh(cylinder, mushroomStem, landmark, [side * 6.1, 2.15, 2.3], [0.38, 4.3, 0.38]);
      mesh(
        regionCrowns[0],
        mat(side < 0 ? '#a7bce2' : '#efbed2', { emissive: '#906cb5', emissiveIntensity: 0.2 }),
        landmark,
        [side * 6.1, 0.35, 2.3],
        [0.9, 0.9, 0.9],
      );
    }
    mesh(
      keep(new THREE.TorusGeometry(2.4, 0.065, 5, 64)),
      glowing,
      landmark,
      [0, 7.5, 0],
    ).rotation.x = -Math.PI / 2;
  }
  return {
    update(time: number) {
      waterMaterial.uniforms.time.value = time;
      regionAnimations.forEach(({ object, axis, speed }) => {
        object.rotation[axis] = time * speed;
      });
    },
  };
}
