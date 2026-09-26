import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { REGION_IDS } from '../src/game/adventure';
import { findLandingSpot, getFlightFloor, moveFlight } from '../src/game/flight';
import { REGION_PLACES, REGION_VOLUMES } from '../src/game/landmarks';
import {
  CRYSTAL_POSITIONS,
  SPAWN_POSITION,
  clampToWorld,
  getNavigationPath,
  getTerrainHeight,
  getWorldBounds,
  getWorldTrees,
  isWalkable,
  resolveMovement,
  type WorldPoint,
} from '../src/game/world';
import {
  createMeadowWildlife,
  createWildlifeSimulation,
} from '../src/rendering/scenery/meadow/wildlife';
import { createRegionScenery } from '../src/rendering/scenery/regions/meadow';

const extendedPlaces = REGION_PLACES.meadow.filter((place) =>
  ['deer-camp', 'flower-sea', 'bell-hill'].includes(place.id),
);
const distance = (a: WorldPoint, b: WorldPoint) => Math.hypot(a.x - b.x, a.z - b.z);

test('only the meadow expands: walking, clamping, flight and landing share each region boundary', () => {
  for (const region of REGION_IDS) {
    const extent = region === 'meadow' ? 108 : 72;
    assert.deepEqual(getWorldBounds(region), {
      minX: -extent,
      maxX: extent,
      minZ: -extent,
      maxZ: extent,
    });
    assert.deepEqual(clampToWorld({ x: 1000, z: -1000 }, region), { x: extent, z: -extent });
    const flight = moveFlight({ x: 1000, z: -1000, y: 60 }, { x: 1, z: -1 }, 0, 0.1, region);
    assert.equal(flight.x, extent - 1.5);
    assert.equal(flight.z, -extent + 1.5);
    const landing = findLandingSpot(flight, region);
    assert(isWalkable(landing.x, landing.z, 1.1, region));
    assert(Math.abs(landing.x) <= extent - 1.5 && Math.abs(landing.z) <= extent - 1.5);
    if (region !== 'meadow') {
      assert.deepEqual(getNavigationPath(SPAWN_POSITION, { x: 90, z: 45 }, region), []);
      assert(getWorldTrees(region).every((tree) => Math.abs(tree.x) < 80 && Math.abs(tree.z) < 80));
    }
  }
  assert.equal((216 * 216) / (144 * 144), 2.25);
  assert(getWorldTrees('meadow').some((tree) => Math.abs(tree.x) > 80 || Math.abs(tree.z) > 80));
  assert(getWorldTrees('meadow').length < 500);
});

test('new destinations and the old temple and seals remain mutually reachable across the expanded map', () => {
  assert.equal(extendedPlaces.length, 3);
  const points = [SPAWN_POSITION, ...CRYSTAL_POSITIONS, ...extendedPlaces];
  for (const from of extendedPlaces)
    for (const destination of points) {
      if (from === destination) continue;
      const path = getNavigationPath(from, destination);
      assert(path.length, `No route from ${from.id} to ${JSON.stringify(destination)}`);
      assert.deepEqual(path.at(-1), destination);
      let previous: WorldPoint = from;
      for (const point of path) {
        const count = Math.ceil(distance(previous, point) / 0.09);
        for (let i = 0; i <= count; i++) {
          const x = previous.x + ((point.x - previous.x) * i) / Math.max(1, count);
          const z = previous.z + ((point.z - previous.z) * i) / Math.max(1, count);
          assert(isWalkable(x, z), `Unsafe route sample ${x}, ${z}`);
        }
        assert(distance(resolveMovement(previous, point), point) < 0.001);
        previous = point;
      }
    }
});

test('expanded structures are solid and their roof footprints participate in flight clearance', () => {
  const volumes = REGION_VOLUMES.meadow.filter((volume) => /^(camp|flower|hill)-/.test(volume.id));
  assert(volumes.length >= 12);
  for (const volume of volumes) {
    if ((volume.minY ?? 0) < 2.6) assert.equal(isWalkable(volume.x, volume.z), false, volume.id);
    for (const dx of [-volume.halfX, volume.halfX])
      for (const dz of [-volume.halfZ, volume.halfZ]) {
        assert(
          getFlightFloor(volume.x + dx, volume.z + dz) >=
            getTerrainHeight(volume.x, volume.z) + volume.height + 3 - 1e-8,
          volume.id,
        );
      }
  }
  assert(isWalkable(-4, -90), 'The hill gateway must remain open at ground level');
  assert(isWalkable(70, 50), 'The garden arch must remain open at ground level');
});

test('all five species remain discoverable in sparse distinct habitats, with a quiet arrival', () => {
  const { animals } = createWildlifeSimulation();
  assert.equal(animals.length, 7);
  for (const kind of ['deer', 'rabbit', 'bird', 'fox', 'butterfly']) {
    assert(animals.some((animal) => animal.kind === kind));
  }
  assert.deepEqual(
    animals.filter((animal) => distance(animal, SPAWN_POSITION) < 18).map((animal) => animal.kind),
    ['bird'],
  );
  assert(animals.filter((animal) => animal.kind === 'deer').every((animal) => animal.x > 15));
  assert(
    animals
      .filter((animal) => !['bird', 'deer'].includes(animal.kind))
      .every((animal) => distance(animal, SPAWN_POSITION) > 35),
  );
  assert(animals.every((animal) => isWalkable(animal.x, animal.z)));
});

test('animals notice walking visitors, flee runners and birds rise from the ground', () => {
  const simulation = createWildlifeSimulation();
  const deer = simulation.animals[0];
  const observer = { x: deer.x + 6, z: deer.z };
  for (let i = 0; i < 60; i++)
    simulation.update(i / 60, { position: observer, running: false, delta: 1 / 60 });
  assert(deer.alert > 0.9);
  assert(deer.speed < 0.1);
  const previous = distance(deer, observer);
  for (let i = 0; i < 90; i++)
    simulation.update(i / 60 + 1, { position: observer, running: true, delta: 1 / 60 });
  assert(distance(deer, observer) > previous + 1.5);
  assert(deer.speed > 2);
  const bird = simulation.animals.find((animal) => animal.kind === 'bird')!;
  const runner = { x: bird.x + 6, z: bird.z };
  for (let i = 0; i < 60; i++)
    simulation.update(i / 60 + 3, { position: runner, running: true, delta: 1 / 60 });
  assert(bird.flight > 0.8);
  assert(simulation.animals.every((animal) => isWalkable(animal.x, animal.z)));
});

test('animal gait follows distance without a phase jump when startled, and pauses freeze the simulation', () => {
  const simulation = createWildlifeSimulation();
  const deer = simulation.animals[0];
  let previous = deer.gait;
  for (let i = 0; i < 180; i++) {
    const before = { x: deer.x, z: deer.z };
    simulation.update(i * 100, {
      position: i < 60 ? { x: 1000, z: 1000 } : { x: deer.x + 5, z: deer.z },
      running: i >= 60,
      delta: 1 / 60,
    });
    assert(deer.gait >= previous, 'Stopping or accelerating never reverses the gait');
    assert(Math.abs(deer.gait - previous - (distance(before, deer) * Math.PI * 2) / 2.6) < 1e-8);
    assert(
      deer.gait - previous < 0.25,
      'Switching to a run cannot jump to an unrelated animation phase',
    );
    previous = deer.gait;
  }
  const paused = structuredClone(simulation.animals);
  simulation.update(1e8, { position: { ...deer }, running: true, delta: 0 });
  assert.deepEqual(simulation.animals, paused);
});

test('animal feeding and rest cycles stay local and traversable over a long quiet visit', () => {
  const simulation = createWildlifeSimulation();
  const activities = new Map(simulation.animals.map((animal) => [animal.id, new Set<number>()]));
  const travelled = new Map(simulation.animals.map((animal) => [animal.id, 0]));
  for (let i = 0; i < 1800; i++) {
    simulation.update(i / 20, { position: { x: 1000, z: 1000 }, running: false, delta: 0.05 });
    for (const animal of simulation.animals) {
      activities.get(animal.id)!.add(animal.activity);
      travelled.set(animal.id, travelled.get(animal.id)! + animal.speed * 0.05);
      assert(isWalkable(animal.x, animal.z), animal.id);
      assert(
        distance(animal, animal.home) <= animal.homeRadius,
        `${animal.id} must remain in its habitat`,
      );
    }
  }
  for (const animal of simulation.animals) {
    if (animal.kind === 'bird') {
      assert.equal(animal.behavior, 'perch', 'The guide bird rests when no traveller is nearby');
      assert.equal(travelled.get(animal.id), 0);
      continue;
    }
    assert.equal(activities.get(animal.id)!.size, 3, `${animal.id} feeds, rests and wanders`);
    assert(travelled.get(animal.id)! > 1, `${animal.id} can reach another feeding patch`);
  }
});

test('observation reports stable identities and distinguishes curiosity from fleeing', () => {
  const wildlife = createMeadowWildlife();
  try {
    const observation = wildlife.observe();
    assert.equal(new Set(observation.map((animal) => animal.id)).size, observation.length);
    const fox = observation.find((animal) => animal.kind === 'fox')!;
    const visitor = { x: fox.x + 6, z: fox.z };
    for (let i = 0; i < 60; i++)
      wildlife.update(i / 60, { position: visitor, running: false, delta: 1 / 60 });
    assert(fox.alert > 0.9);
    assert.equal(fox.startled, false, 'A quiet observer can study an attentive animal');
    wildlife.update(2, { position: visitor, running: true, delta: 1 / 60 });
    assert.equal(fox.startled, true);
    assert.equal(wildlife.observe(), observation, 'A frame read does not allocate new snapshots');
  } finally {
    wildlife.dispose();
  }
});

test('the observation ring follows the selected animal, switches and clears, and disposes once', () => {
  const wildlife = createMeadowWildlife();
  const marker = wildlife.group.getObjectByName('wildlife-observation-marker') as THREE.Mesh;
  const animals = wildlife.observe();
  const fox = animals.find((animal) => animal.kind === 'fox')!;
  const butterfly = animals.find((animal) => animal.kind === 'butterfly')!;
  let geometryDisposals = 0;
  let materialDisposals = 0;
  marker.geometry.addEventListener('dispose', () => geometryDisposals++);
  (marker.material as THREE.Material).addEventListener('dispose', () => materialDisposals++);
  const frame = { position: { x: 1000, z: 1000 }, running: false, delta: 0.05 };
  try {
    assert.equal(marker.visible, false);
    const before = { x: fox.x, z: fox.z };
    for (let i = 0; i < 260; i++) {
      wildlife.update(i * 0.05, { ...frame, observingId: fox.id });
      assert.equal(marker.visible, true);
      assert.equal(marker.position.x, fox.x);
      assert.equal(marker.position.z, fox.z);
    }
    assert(distance(before, fox) > 0.1, 'The selected animal moves while its marker follows');
    wildlife.update(7, { ...frame, observingId: butterfly.id });
    assert.equal(marker.position.x, butterfly.x);
    assert.equal(marker.position.z, butterfly.z);
    assert.equal(marker.position.y, getTerrainHeight(butterfly.x, butterfly.z) + 0.08);
    wildlife.update(8, { ...frame, observingId: 'unknown' });
    assert.equal(marker.visible, false);
    wildlife.update(9, { ...frame, observingId: fox.id });
    assert.equal(marker.visible, true);
    wildlife.update(10, frame);
    assert.equal(marker.visible, false);
  } finally {
    wildlife.dispose();
    wildlife.dispose();
  }
  assert.equal(geometryDisposals, 1);
  assert.equal(materialDisposals, 1);
});

test('wildlife uses three shared draw batches, freezes poses while paused and releases resources once', () => {
  const wildlife = createMeadowWildlife();
  const meshes: THREE.InstancedMesh[] = [];
  wildlife.group.traverse((object) => {
    if (object instanceof THREE.InstancedMesh) meshes.push(object);
  });
  assert.equal(meshes.length, 3);
  assert.equal(new Set(meshes.map((mesh) => mesh.material)).size, 1);
  assert(meshes.reduce((sum, mesh) => sum + mesh.count, 0) < 220);
  wildlife.update(1, { position: { x: -5, z: 20 }, running: true, delta: 1 / 60 });
  const paused = meshes.map((mesh) => Array.from(mesh.instanceMatrix.array));
  wildlife.update(10000, { position: { x: 0, z: 0 }, running: true, delta: 0 });
  assert.deepEqual(
    meshes.map((mesh) => Array.from(mesh.instanceMatrix.array)),
    paused,
  );
  assert(paused.flat().every(Number.isFinite));
  const resources = new Set<THREE.BufferGeometry | THREE.Material>(
    meshes.flatMap((mesh) => [mesh.geometry, mesh.material as THREE.Material]),
  );
  const counts = new Map([...resources].map((resource) => [resource, 0]));
  for (const resource of resources)
    resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource)! + 1));
  wildlife.dispose();
  wildlife.dispose();
  assert([...counts.values()].every((count) => count === 1));
  assert.equal(wildlife.group.children.length, 0);
});

test('the expanded meadow factory owns the animal instance and all architectural resources', () => {
  const original = globalThis.document;
  globalThis.document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({ fillStyle: '', fillRect() {} }),
    }),
  } as unknown as Document;
  try {
    const scenery = createRegionScenery();
    assert(scenery.group.getObjectByName('meadow-wildlife'));
    scenery.update(1, true, { position: SPAWN_POSITION, delta: 1 / 60, running: false });
    const resources = new Set<THREE.BufferGeometry | THREE.Material>();
    scenery.group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        resources.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material])
          resources.add(material);
      }
    });
    const counts = new Map([...resources].map((resource) => [resource, 0]));
    for (const resource of resources)
      resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource)! + 1));
    scenery.dispose();
    scenery.dispose();
    assert([...counts.values()].every((count) => count === 1));
    assert.equal(scenery.group.children.length, 0);
  } finally {
    globalThis.document = original;
  }
});
