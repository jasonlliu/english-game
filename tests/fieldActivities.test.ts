import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FIELD_SPECIES,
  GOLD_RACE_TIME,
  MIN_RACE_SECONDS,
  OBSERVATION_DURATION,
  RACE_DURATION,
  RACE_GATES,
  RACE_START,
  SILVER_RACE_TIME,
  createFieldProgress,
  createObservationRun,
  createRaceRun,
  getRaceRating,
  recordMeadowRace,
  recordWildlife,
  sanitizeFieldProgress,
  stepObservation,
  stepRaceRun,
  type ObservationFrame,
  type RaceRun,
} from '../src/game/fieldActivities';
import { getNavigationPath, isWalkable } from '../src/game/world';
import { SPAWN_POSITION, type WorldPoint } from '../src/game/worldLayout';

test('the windmill course is walkable, direct between gates and reachable from arrival', () => {
  const points = [SPAWN_POSITION, RACE_START, ...RACE_GATES];
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    assert.ok(isWalkable(point.x, point.z), JSON.stringify(point));
    if (i) assert.deepEqual(getNavigationPath(points[i - 1], point), [point]);
  }
});

test('race start gives no gate and only accepts finite nearby positions', () => {
  assert.equal(createRaceRun().nextGate, 0);
  assert.equal(createRaceRun(SPAWN_POSITION).status, 'running');
  const insideFirst = createRaceRun(RACE_GATES[0]);
  const stayed = stepRaceRun(insideFirst, {
    position: RACE_GATES[0],
    delta: 0.1,
    paused: false,
    flying: false,
  });
  assert.equal(stayed.state.nextGate, 0);
  assert.equal(createRaceRun({ x: 100, z: 100 }).status, 'cancelled');
  assert.equal(createRaceRun({ x: NaN, z: 22 }).status, 'cancelled');
});

function driveTo(initial: RaceRun, destination: WorldPoint, speed = 8.4) {
  let state = initial;
  const start = state.previousPosition;
  const distance = Math.hypot(destination.x - start.x, destination.z - start.z);
  const frames = Math.max(1, Math.ceil(distance / (speed / 60)));
  const events: ReturnType<typeof stepRaceRun>[] = [];
  for (let frame = 1; frame <= frames; frame++) {
    const result = stepRaceRun(state, {
      position: {
        x: start.x + ((destination.x - start.x) * frame) / frames,
        z: start.z + ((destination.z - start.z) * frame) / frames,
      },
      delta: 1 / 60,
      paused: false,
      flying: false,
    });
    state = result.state;
    if (result.event) events.push(result);
  }
  return { state, events };
}

test('running the complete ordered course finishes once and earns a reachable gold time', () => {
  let state = createRaceRun(SPAWN_POSITION);
  const events: ReturnType<typeof stepRaceRun>[] = [];
  for (const gate of RACE_GATES) {
    const result = driveTo(state, gate);
    state = result.state;
    events.push(...result.events);
  }
  assert.equal(state.status, 'finished');
  assert.equal(state.nextGate, RACE_GATES.length);
  assert.equal(events.filter((event) => event.event === 'gate').length, 5);
  assert.equal(events.at(-1)?.event, 'finished');
  const finish = events.at(-1)!.completed!;
  assert.ok(finish.seconds >= MIN_RACE_SECONDS);
  assert.ok(finish.seconds <= GOLD_RACE_TIME);
  assert.equal(finish.rating, 'gold');
  assert.deepEqual(
    stepRaceRun(state, {
      position: RACE_GATES.at(-1)!,
      delta: 1,
      paused: false,
      flying: false,
    }),
    { state },
  );
});

test('later gates cannot skip the current gate and a grazing frame crossing is detected', () => {
  const waiting: RaceRun = {
    ...createRaceRun(),
    elapsed: 10,
    previousPosition: { x: RACE_GATES[1].x, z: RACE_GATES[1].z + 3 },
  };
  assert.equal(driveTo(waiting, RACE_GATES[1]).state.nextGate, 0);
  const crossing = stepRaceRun(
    {
      ...waiting,
      previousPosition: { x: 10.1, z: 11.3 },
    },
    { position: { x: 11.9, z: 11.3 }, delta: 0.1, paused: false, flying: false },
  );
  assert.equal(crossing.state.nextGate, 1);
  assert.equal(crossing.event, 'gate');
});

test('pause freezes time and excludes paused motion; flight, teleport and invalid positions cancel', () => {
  const state = createRaceRun();
  const paused = stepRaceRun(state, {
    position: RACE_GATES[0],
    delta: 8,
    paused: true,
    flying: false,
  });
  assert.equal(paused.state.elapsed, 0);
  assert.equal(paused.state.nextGate, 0);
  assert.equal(
    stepRaceRun(paused.state, {
      position: RACE_GATES[0],
      delta: 0.1,
      paused: false,
      flying: false,
    }).state.nextGate,
    0,
  );
  for (const frame of [
    { position: RACE_START, delta: 0.1, flying: true },
    { position: RACE_GATES[3], delta: 0.1, flying: false },
    { position: { x: Infinity, z: 0 }, delta: 0.1, flying: false },
  ]) {
    const result = stepRaceRun(state, { ...frame, paused: false });
    assert.equal(result.event, 'cancelled');
    assert.equal(stepRaceRun(result.state, { ...frame, paused: false }).event, undefined);
  }
});

test('frame time is finite and bounded; the timer expires once and cannot finish after the limit', () => {
  const state = createRaceRun();
  for (const delta of [NaN, Infinity, -1, 0])
    assert.strictEqual(
      stepRaceRun(state, {
        position: RACE_START,
        delta,
        paused: false,
        flying: false,
      }).state,
      state,
    );
  assert.equal(
    stepRaceRun(state, {
      position: RACE_START,
      delta: 200,
      paused: false,
      flying: false,
    }).state.elapsed,
    0.1,
  );
  const nearEnd = { ...state, elapsed: 59.99, nextGate: 5, previousPosition: { x: 1, z: 12.9 } };
  const result = stepRaceRun(nearEnd, {
    position: { x: 1, z: 13.5 },
    delta: 0.1,
    paused: false,
    flying: false,
  });
  assert.equal(result.event, 'timed-out');
  assert.equal(result.state.elapsed, RACE_DURATION);
  assert.equal(result.completed, undefined);
});

const observing: ObservationFrame = {
  candidateId: 'deer-1',
  speed: 0,
  delta: 0.1,
  paused: false,
  startled: false,
  requested: true,
};
function holdObservation(frames: number) {
  let state = createObservationRun();
  const completed: string[] = [];
  for (let frame = 0; frame < frames; frame++) {
    const result = stepObservation(state, observing);
    state = result.state;
    if (result.completedId) completed.push(result.completedId);
  }
  return { state, completed };
}

test('observation requires three seconds holding still and only completes once per hold', () => {
  assert.equal(holdObservation(29).completed.length, 0);
  const result = holdObservation(60);
  assert.deepEqual(result.completed, ['deer-1']);
  assert.equal(result.state.elapsed, OBSERVATION_DURATION);
});

test('observation resets on movement, target loss, release, pause, startled animals or invalid time', () => {
  const partial = holdObservation(20).state;
  for (const interruption of [
    { speed: 1 },
    { speed: NaN },
    { speed: -1 },
    { candidateId: null },
    { requested: false },
    { paused: true },
    { startled: true },
    { delta: NaN },
    { delta: Infinity },
    { delta: -1 },
  ]) {
    const result = stepObservation(partial, { ...observing, ...interruption });
    assert.deepEqual(result.state, createObservationRun());
    assert.equal(result.completedId, undefined);
  }
  const switched = stepObservation(partial, { ...observing, candidateId: 'deer-2' });
  assert.equal(switched.state.targetId, 'deer-2');
  assert.equal(switched.state.elapsed, 0.1);
  assert.equal(
    stepObservation(partial, { ...observing, delta: 100 }).state.elapsed,
    partial.elapsed + 0.1,
  );
});

test('field guide awards its completion once, saves species once and validates regions', () => {
  let state = createFieldProgress('real');
  for (const [index, species] of FIELD_SPECIES.entries()) {
    const result = recordWildlife(state, species, 'meadow');
    state = result.state;
    assert.equal(result.changed, true);
    assert.equal(result.completed, index === FIELD_SPECIES.length - 1);
  }
  for (const species of [...FIELD_SPECIES, 'dragon', '__proto__'])
    assert.deepEqual(recordWildlife(state, species, 'meadow'), {
      state,
      changed: false,
      completed: false,
    });
  assert.equal(recordWildlife(createFieldProgress('real'), 'deer', 'water').changed, false);
});

test('race records only improve at hundredth precision and ratings have stable boundaries', () => {
  let state = createFieldProgress('demo');
  for (const seconds of [NaN, Infinity, -1, 0, MIN_RACE_SECONDS - 0.1, RACE_DURATION + 0.1])
    assert.equal(recordMeadowRace(state, seconds, 'meadow').changed, false);
  assert.equal(recordMeadowRace(state, 12, 'fire').changed, false);
  state = recordMeadowRace(state, 20.004, 'meadow').state;
  assert.equal(state.raceBest, 20);
  assert.equal(recordMeadowRace(state, 20.003, 'meadow').changed, false);
  assert.equal(recordMeadowRace(state, 25, 'meadow').changed, false);
  assert.equal(recordMeadowRace(state, 12.125, 'meadow').state.raceBest, 12.13);
  assert.equal(getRaceRating(GOLD_RACE_TIME), 'gold');
  assert.equal(getRaceRating(GOLD_RACE_TIME + 0.01), 'silver');
  assert.equal(getRaceRating(SILVER_RACE_TIME), 'silver');
  assert.equal(getRaceRating(SILVER_RACE_TIME + 0.01), 'bronze');
});

test('field saves recover malformed data and cannot import another mode or impossible records', () => {
  const initial = createFieldProgress('real');
  for (const value of [
    null,
    2,
    'save',
    {},
    { ...initial, version: 2 },
    { ...initial, mode: 'demo' },
  ])
    assert.deepEqual(sanitizeFieldProgress(value, 'real'), initial);
  assert.deepEqual(
    sanitizeFieldProgress(
      {
        ...initial,
        observed: ['bird', 'deer', 'bird', '__proto__', null, 'fox'],
        raceBest: NaN,
      },
      'real',
    ),
    { ...initial, observed: ['deer', 'bird', 'fox'] },
  );
  assert.equal(sanitizeFieldProgress({ ...initial, raceBest: 7.127 }, 'real').raceBest, 7.13);
  assert.equal(sanitizeFieldProgress({ ...initial, raceBest: 2 }, 'real').raceBest, null);
});
