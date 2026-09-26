import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { DAILY_DISCOVERY_POSITIONS, DISCOVERY_SITES } from '../src/game/discovery';
import { getFlightFloor } from '../src/game/flight';
import { CRYSTAL_POSITIONS, SPAWN_POSITION, getTerrainHeight, isWalkable } from '../src/game/world';
import { createWorldRenderContext } from '../src/rendering/world/context';
import { createVegetation } from '../src/rendering/world/createVegetation';
import {
  createGrassTuft,
  createLeafCrown,
  applyPlantWind,
} from '../src/rendering/world/meadowPlants';

function instances(context: ReturnType<typeof createWorldRenderContext>, name: string) {
  const object = context.scene.getObjectByName(name);
  assert(object instanceof THREE.InstancedMesh, `Missing ${name}`);
  return object;
}

test('human scale shrub thickets preserve paths, spawn, destinations and clue access', () => {
  const context = createWorldRenderContext('meadow');
  try {
    createVegetation(context);
    const shrubTiers = ['meadow-shrub-thickets', 'meadow-shrub-thickets-distant'].map((name) =>
      instances(context, name),
    );
    const shrubCount = shrubTiers.reduce((count, shrubs) => count + shrubs.count, 0);
    assert(shrubCount >= 250 && shrubCount <= 440);
    const matrix = new THREE.Matrix4(),
      position = new THREE.Vector3(),
      scale = new THREE.Vector3(),
      rotation = new THREE.Quaternion();
    const clearings = [
      ...Object.values(DISCOVERY_SITES).map((site) => site.position),
      ...DAILY_DISCOVERY_POSITIONS,
      ...CRYSTAL_POSITIONS,
    ];
    let taller = 0,
      nearArrival = 0;
    for (const shrubs of shrubTiers)
      for (let i = 0; i < shrubs.count; i++) {
        shrubs.getMatrixAt(i, matrix);
        matrix.decompose(position, rotation, scale);
        const height = shrubs.geometry.boundingBox!.max.y * scale.y;
        assert(height >= 1.09 && height <= 2.301, `Shrub height ${height} must remain human scale`);
        taller += Number(height > 2.1);
        const spawnDistance = Math.hypot(
          position.x - SPAWN_POSITION.x,
          position.z - SPAWN_POSITION.z,
        );
        nearArrival += Number(spawnDistance < 19);
        assert(spawnDistance > 8.49, 'Shrubs must not engulf the arrival character');
        assert(context.distanceToTrail(position.x, position.z) > 3.54);
        assert(
          isWalkable(position.x, position.z, 1.49, 'meadow'),
          'Shrubs must not grow through solid buildings or water',
        );
        assert(
          clearings.every((point) => Math.hypot(position.x - point.x, position.z - point.z) > 4.19),
        );
        assert(
          getFlightFloor(position.x, position.z) > position.y + height,
          'Foliage stays beneath the existing flight clearance',
        );
      }
    assert(
      taller >= 10 && nearArrival >= 6,
      'Tall shrubs must be visible near arrival, not only on distant edges',
    );
  } finally {
    context.dispose();
  }
});

test('compound crowns fit existing flight envelopes and grass contains multiple bent blade heights', () => {
  for (const variant of [0, 1])
    for (const distant of [false, true]) {
      const geometry = createLeafCrown(false, variant, distant);
      try {
        const positions = geometry.attributes.position;
        assert(geometry.getAttribute('color'));
        assert(positions.count < 5500);
        const normals = geometry.attributes.normal;
        const first = new THREE.Vector3().fromBufferAttribute(normals, 0);
        const second = new THREE.Vector3().fromBufferAttribute(normals, 1);
        assert(
          first.distanceTo(second) > 0.01,
          'Crown cores must retain curved lighting across triangles, including distant detail',
        );
        for (let i = 0; i < positions.count; i++) {
          assert(Number.isFinite(positions.getY(i)));
          assert(positions.getY(i) < 7.4);
          assert(Math.hypot(positions.getX(i), positions.getZ(i)) < 2.7);
        }
      } finally {
        geometry.dispose();
      }
    }
  const grass = createGrassTuft();
  try {
    const positions = grass.attributes.position;
    const tips = Array.from({ length: 11 }, (_, i) => positions.getY(i * 9 + 8));
    assert(Math.max(...tips) - Math.min(...tips) > 0.3);
    assert(grass.boundingBox!.max.y <= 1.01);
    assert(Array.from(positions.array).every(Number.isFinite));
    const normals = grass.attributes.normal;
    assert(
      Array.from({ length: normals.count }, (_, i) => normals.getY(i)).every((y) => y > 0.9),
      'Grass normals gather skylight instead of shading like upright dark fins',
    );
  } finally {
    grass.dispose();
  }
});

test('grass beds avoid the road and water and vegetation remains bounded and completely disposable', () => {
  const context = createWorldRenderContext('meadow');
  createVegetation(context);
  const grass = instances(context, 'meadow-grass-beds');
  assert(grass.userData.totalPlants >= 12000 && grass.userData.totalPlants <= 17000);
  assert(grass.count > 500 && grass.count < grass.userData.totalPlants);
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < grass.count; i += 37) {
    grass.getMatrixAt(i, matrix);
    const x = matrix.elements[12],
      z = matrix.elements[14];
    assert(context.distanceToTrail(x, z) > 2.04);
    assert(Math.abs(matrix.elements[13] - getTerrainHeight(x, z) + 0.015) < 0.00002);
  }
  let draws = 0,
    triangles = 0;
  context.scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    draws++;
    triangles +=
      ((object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3) *
      (object instanceof THREE.InstancedMesh ? object.count : 1);
  });
  assert(draws <= 20 && triangles < 600_000);
  const resources = [...context.geometryResources, ...context.materialResources];
  const counts = new Map(resources.map((resource) => [resource, 0]));
  resources.forEach((resource) =>
    resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource)! + 1)),
  );
  let instanceDisposals = 0;
  context.scene.traverse((object) => {
    if (object instanceof THREE.InstancedMesh)
      object.addEventListener('dispose', () => instanceDisposals++);
  });
  context.dispose();
  context.dispose();
  assert([...counts.values()].every((count) => count === 1));
  assert.equal(instanceDisposals, 14);
  assert.equal(context.scene.children.length, 0);
});

test('wind uses a shared continuous clock and distinct shader programs for tree, bush and grass roots', () => {
  const wind = { value: 0 };
  const materials = [new THREE.MeshStandardMaterial(), new THREE.MeshStandardMaterial()];
  try {
    applyPlantWind(materials[0], wind, 0.025, 3.1);
    applyPlantWind(materials[1], wind, 0.11, 0);
    const shader = {
      uniforms: {},
      vertexShader: '#include <begin_vertex>',
      fragmentShader: '#include <normal_fragment_begin>',
    };
    materials[0].onBeforeCompile(
      shader as unknown as THREE.WebGLProgramParametersWithUniforms,
      {} as THREE.WebGLRenderer,
    );
    assert.equal((shader.uniforms as Record<string, unknown>).plantWindTime, wind);
    wind.value = 12;
    assert.equal((shader.uniforms as Record<string, { value: number }>).plantWindTime.value, 12);
    assert(shader.vertexShader.includes('position.y - 3.10'));
    assert(
      shader.fragmentShader.includes('normal *= faceDirection'),
      'Back faces retain the soft upward foliage normal',
    );
    assert.notEqual(materials[0].customProgramCacheKey(), materials[1].customProgramCacheKey());
  } finally {
    materials.forEach((material) => material.dispose());
  }
});

test('view distance detail updates follow travel and keep the entire meadow within its triangle budget', () => {
  const context = createWorldRenderContext('meadow');
  try {
    const vegetation = createVegetation(context);
    assert(vegetation.update);
    const grass = instances(context, 'meadow-grass-beds');
    const initialMatrixVersion = grass.instanceMatrix.version;
    vegetation.update(SPAWN_POSITION);
    assert.equal(
      grass.instanceMatrix.version,
      initialMatrixVersion,
      'Standing still must not reupload thousands of instances',
    );
    const point = new THREE.Vector3(),
      matrix = new THREE.Matrix4();
    for (let x = -96; x <= 96; x += 24)
      for (let z = -96; z <= 96; z += 24) {
        vegetation.update({ x, z });
        let triangles = 0;
        context.scene.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          triangles +=
            ((object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3) *
            (object instanceof THREE.InstancedMesh ? object.count : 1);
        });
        assert(triangles < 600_000, `Too much foliage detail near ${x}, ${z}: ${triangles}`);
        for (let i = 0; i < grass.count; i += 47) {
          grass.getMatrixAt(i, matrix);
          point.setFromMatrixPosition(matrix);
          assert(Math.hypot(point.x - x, point.z - z) <= 28.01);
        }
        const shrubs = instances(context, 'meadow-shrub-thickets');
        const farShrubs = instances(context, 'meadow-shrub-thickets-distant');
        assert.equal(
          shrubs.count + farShrubs.count,
          shrubs.userData.totalPlants,
          'Distance never removes whole hedges',
        );
      }
    assert(grass.instanceMatrix.version > initialMatrixVersion);
  } finally {
    context.dispose();
  }
});

test('other regions retain their original vegetation rather than meadow thickets', () => {
  for (const region of ['fire', 'earth', 'steel', 'fairy'] as const) {
    const context = createWorldRenderContext(region);
    try {
      createVegetation(context);
      assert.equal(context.scene.getObjectByName('meadow-shrub-thickets'), undefined);
      assert.equal(context.scene.children.length, 12);
    } finally {
      context.dispose();
    }
  }
});
