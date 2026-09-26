import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createFieldActivityRuntime,
  type FieldActivityView,
} from '../src/components/fieldActivityRuntime';
import {
  createFieldProgress,
  recordWildlife,
  type FieldSpecies,
} from '../src/game/fieldActivities';
import { RACE_GATES, RACE_START } from '../src/game/fieldActivityRules';
import { SPAWN_POSITION, type WorldPoint } from '../src/game/worldLayout';
import type { WildlifeObservation } from '../src/rendering/scenery/types';
import type { SoundCue } from '../src/audio/types';

type Context = ReturnType<Parameters<typeof createFieldActivityRuntime>[0]['read']>;
const animal = (
  id = 'deer-0',
  kind: FieldSpecies = 'deer',
  point: WorldPoint = { x: 0, z: 27 },
): WildlifeObservation => ({ id, kind, ...point, alert: 0, speed: 0, startled: false });

function setup(patch: Partial<Context> = {}, persistObservations = true) {
  const context: Context = {
    position: { ...SPAWN_POSITION },
    speed: 0,
    viewYaw: 0,
    paused: false,
    flying: false,
    jumping: false,
    field: createFieldProgress('demo'),
    wildlife: [animal()],
    ...patch,
  };
  const calls = {
    views: [] as FieldActivityView[],
    sounds: [] as SoundCue[],
    observed: [] as FieldSpecies[],
    finished: [] as number[],
    stops: 0,
  };
  const runtime = createFieldActivityRuntime({
    read: () => context,
    publish: (view) => calls.views.push(view),
    stopMovement: () => calls.stops++,
    sound: (cue) => calls.sounds.push(cue),
    observed: (kind) => {
      calls.observed.push(kind);
      if (persistObservations && context.field)
        context.field = recordWildlife(context.field, kind, 'meadow').state;
    },
    finished: (seconds) => calls.finished.push(seconds),
  });
  const tick = (count = 1, delta = 0.1) => {
    for (let i = 0; i < count; i++) runtime.update(delta);
  };
  const latest = () => calls.views.at(-1)!;
  return { runtime, context, calls, tick, latest };
}

test('observation completes only after an active three-second hold and does not repeat', () => {
  const h = setup();
  h.tick(50);
  assert.deepEqual(h.calls.observed, []);
  h.runtime.holdObservation(true);
  assert.equal(h.calls.stops, 1);
  h.tick(29);
  assert.deepEqual(h.calls.observed, []);
  assert.ok(h.latest().animal!.progress >= 2.8);
  h.tick(2);
  assert.deepEqual(h.calls.observed, ['deer']);
  assert.deepEqual(h.context.field!.observed, ['deer']);
  assert.equal(h.runtime.subject(), null);
  h.tick(100);
  h.runtime.holdObservation(true);
  h.tick(50);
  assert.deepEqual(h.calls.observed, ['deer']);
  assert.equal(h.latest().animal!.recorded, true);
});

test('a completed observation emits once even before persistence returns a new field snapshot', () => {
  const h = setup({}, false);
  h.runtime.holdObservation(true);
  h.tick(120);
  assert.deepEqual(h.calls.observed, ['deer']);
  assert.deepEqual(h.context.field!.observed, []);
});

test('observation retains its subject while a closer animal enters the view', () => {
  const h = setup();
  h.runtime.holdObservation(true);
  h.tick(15);
  h.context.wildlife = [animal('rabbit-0', 'rabbit', { x: 0, z: 25 }), animal()];
  h.tick(16);
  assert.deepEqual(h.calls.observed, ['deer']);
  h.tick();
  assert.equal(h.latest().animal!.kind, 'rabbit');
  assert.equal(h.latest().animal!.progress, 0);
});

test('moving, fleeing, losing the subject, jumping and releasing reset partial observation', () => {
  for (const interrupt of ['move', 'flee', 'leave', 'jump', 'release'] as const) {
    const h = setup();
    h.runtime.holdObservation(true);
    h.tick(20);
    if (interrupt === 'move') h.context.speed = 2;
    if (interrupt === 'flee') h.context.wildlife = [{ ...animal(), startled: true }];
    if (interrupt === 'leave') h.context.wildlife = [];
    if (interrupt === 'jump') h.context.jumping = true;
    if (interrupt === 'release') h.runtime.holdObservation(false);
    h.tick();
    assert.equal(h.latest().animal?.progress ?? 0, 0, interrupt);
    h.context.speed = 0;
    h.context.jumping = false;
    h.context.wildlife = [animal()];
    if (interrupt === 'release') h.runtime.holdObservation(true);
    h.tick(20);
    assert.deepEqual(h.calls.observed, [], interrupt);
    h.tick(11);
    assert.deepEqual(h.calls.observed, ['deer'], interrupt);
  }
});

test('pausing clears an observation hold and resuming needs a new intentional hold', () => {
  const h = setup();
  h.runtime.holdObservation(true);
  h.tick(20);
  h.context.paused = true;
  h.tick(50);
  assert.deepEqual(h.calls.observed, []);
  assert.equal(h.latest().animal, null);
  h.context.paused = false;
  h.tick(50);
  assert.deepEqual(h.calls.observed, []);
  h.runtime.holdObservation(true);
  h.tick(31);
  assert.deepEqual(h.calls.observed, ['deer']);
});

test('release and repress between render frames still interrupts observation progress', () => {
  const h = setup();
  h.runtime.holdObservation(true);
  h.tick(29);
  h.runtime.holdObservation(false);
  h.runtime.holdObservation(true);
  h.tick(2);
  assert.deepEqual(h.calls.observed, []);
  assert.ok(h.latest().animal!.progress <= 0.2);
  h.tick(29);
  assert.deepEqual(h.calls.observed, ['deer']);
});

test('a newly seen species takes precedence within nine metres and out-of-range animals are excluded', () => {
  const h = setup({
    field: { ...createFieldProgress('demo'), observed: ['deer'] },
    wildlife: [
      animal('deer-0', 'deer', { x: 0, z: 25 }),
      animal('fox-0', 'fox', { x: 0, z: 27 }),
      animal('bird-0', 'bird', { x: 0, z: 33.01 }),
    ],
  });
  h.tick();
  assert.equal(h.latest().animal?.kind, 'fox');
  h.context.wildlife = [animal('bird-0', 'bird', { x: 0, z: 33.01 })];
  h.tick();
  assert.equal(h.latest().animal, null);
  h.context.wildlife = [animal('deer-0', 'deer', { x: 0, z: 32 })];
  h.tick();
  assert.equal(
    h.latest().animal?.recorded,
    true,
    'Recorded animals remain visible at eight metres',
  );
});

test('old scene contexts without field progress never publish, stop movement or emit activity events', () => {
  const h = setup({ field: undefined });
  h.runtime.start();
  h.runtime.holdObservation(true);
  h.tick(50);
  h.runtime.cancel();
  h.runtime.holdObservation(false);
  assert.deepEqual(h.calls, { views: [], sounds: [], observed: [], finished: [], stops: 0 });
  assert.equal(h.runtime.getRace(), null);
  assert.equal(h.runtime.subject(), null);
});

test('removing field support clears in-flight activity state and restores it without a hidden race', () => {
  const h = setup();
  h.runtime.start();
  h.tick(20);
  assert.equal(h.latest().race?.status, 'running');
  h.context.field = undefined;
  h.tick();
  assert.equal(h.runtime.getRace(), null);
  assert.equal(h.runtime.subject(), null);
  assert.deepEqual(h.latest(), { nearStart: false, race: null, animal: null });
  const publications = h.calls.views.length;
  h.tick(50);
  assert.equal(h.calls.views.length, publications);
  assert.deepEqual(h.calls.finished, []);
  h.context.field = createFieldProgress('demo');
  h.tick();
  assert.equal(h.latest().race, null);
  assert.equal(h.latest().nearStart, true);
});

test('race starts from arrival and rejects a distant, paused, airborne or jumping player', () => {
  const h = setup();
  h.runtime.start();
  assert.equal(h.runtime.getRace()?.status, 'running');
  assert.equal(h.runtime.getRace()?.nextGate, 0);
  assert.equal(h.calls.stops, 1);
  assert.deepEqual(h.calls.sounds, ['ui']);
  for (const context of [
    { position: { x: 100, z: 100 } },
    { paused: true },
    { flying: true },
    { jumping: true },
  ]) {
    const blocked = setup(context);
    blocked.runtime.start();
    assert.equal(blocked.runtime.getRace(), null);
    assert.equal(blocked.calls.stops, 0);
    assert.deepEqual(blocked.calls.sounds, []);
  }
});

test('race pause freezes time; racing prevents animal holds and cancellation restores free play', () => {
  const h = setup();
  h.runtime.start();
  h.tick(10);
  const elapsed = h.runtime.getRace()!.elapsed;
  h.context.paused = true;
  h.tick(50);
  assert.equal(h.runtime.getRace()!.elapsed, elapsed);
  h.context.paused = false;
  h.runtime.holdObservation(true);
  assert.equal(h.calls.stops, 1);
  h.tick(31);
  assert.equal(h.latest().animal, null);
  assert.deepEqual(h.calls.observed, []);
  h.runtime.cancel();
  h.tick();
  assert.equal(h.runtime.getRace(), null);
  assert.equal(h.latest().race, null);
  h.runtime.holdObservation(true);
  h.tick(31);
  assert.deepEqual(h.calls.observed, ['deer']);
});

function completeRace(h: ReturnType<typeof setup>) {
  h.context.position = { ...RACE_START };
  h.runtime.start();
  for (const gate of RACE_GATES) {
    const from = { ...h.context.position };
    const steps = Math.ceil(Math.hypot(gate.x - from.x, gate.z - from.z) / (8.4 / 60));
    for (let step = 1; step <= steps; step++) {
      h.context.position = {
        x: from.x + ((gate.x - from.x) * step) / steps,
        z: from.z + ((gate.z - from.z) * step) / steps,
      };
      h.tick(1, 1 / 60);
    }
  }
}

test('the full race emits one finish, five intermediate cues, and a stable result that can be retried', () => {
  const h = setup({ wildlife: [] });
  completeRace(h);
  assert.equal(h.runtime.getRace()?.status, 'finished');
  assert.equal(h.calls.finished.length, 1);
  assert.ok(h.calls.finished[0] > 5 && h.calls.finished[0] < 15);
  assert.equal(h.calls.sounds.filter((cue) => cue === 'collect').length, 5);
  h.tick(30);
  assert.equal(h.calls.finished.length, 1);
  const viewCount = h.calls.views.length;
  h.tick(30);
  assert.equal(h.calls.views.length, viewCount, 'Unchanged result must not rerender every frame');
  assert.equal(h.latest().nearStart, true);
  h.runtime.start();
  assert.equal(h.runtime.getRace()?.status, 'running');
  assert.equal(h.runtime.getRace()?.elapsed, 0);
  assert.equal(h.runtime.getRace()?.nextGate, 0);
});

test('flight cancels an active race once and emits no completed record', () => {
  const h = setup();
  h.runtime.start();
  h.tick(10);
  h.context.flying = true;
  h.tick(50);
  assert.equal(h.runtime.getRace()?.status, 'cancelled');
  assert.deepEqual(h.calls.finished, []);
  assert.equal(h.calls.sounds.filter((cue) => cue === 'mistake').length, 1);
  assert.equal(h.latest().nearStart, false);
  assert.equal(h.latest().animal, null);
});

test('an expired race reports no finish and its result clears after eight unpaused seconds', () => {
  const h = setup();
  h.runtime.start();
  h.tick(601);
  assert.equal(h.runtime.getRace()?.status, 'timed-out');
  assert.deepEqual(h.calls.finished, []);
  assert.equal(h.calls.sounds.filter((cue) => cue === 'mistake').length, 1);
  h.context.paused = true;
  h.tick(500);
  assert.equal(h.runtime.getRace()?.status, 'timed-out');
  h.context.paused = false;
  h.tick(200, 0.05);
  assert.equal(h.runtime.getRace(), null);
  assert.equal(h.latest().race, null);
});
