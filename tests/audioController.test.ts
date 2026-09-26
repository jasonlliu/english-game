import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGameAudioController } from '../src/audio/controller';
import {
  AUDIO_PREFERENCES_KEY,
  DEFAULT_AUDIO_PREFERENCES,
  loadAudioPreferences,
  sanitizeAudioPreferences,
} from '../src/audio/preferences';
import type { AudioPreferences, AudioScene, GameAudioEngine, SoundCue } from '../src/audio/types';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
class FakePage extends EventTarget {
  hidden = false;
  change(hidden: boolean) {
    this.hidden = hidden;
    this.dispatchEvent(new Event('visibilitychange'));
  }
}
class FakeContext extends EventTarget {
  state: AudioContextState = 'suspended';
  resumes = 0;
  suspends = 0;
  closes = 0;
  resumeFailure = false;
  staySuspended = false;
  resumeGate?: ReturnType<typeof deferred<void>>;
  suspendGate?: ReturnType<typeof deferred<void>>;
  constructor(readonly log: string[]) {
    super();
  }
  async resume() {
    this.log.push('resume');
    this.resumes++;
    if (this.resumeFailure) throw new Error('Gesture denied');
    if (this.resumeGate) await this.resumeGate.promise;
    if (!this.staySuspended) this.state = 'running';
  }
  async suspend() {
    this.log.push('suspend');
    this.suspends++;
    if (this.suspendGate) await this.suspendGate.promise;
    this.state = 'suspended';
  }
  async close() {
    this.log.push('close');
    this.closes++;
    this.state = 'closed';
  }
}
class FakeEngine implements GameAudioEngine {
  active = false;
  disposed = 0;
  cues: SoundCue[] = [];
  constructor(
    public preferences: AudioPreferences,
    public scene: AudioScene,
  ) {}
  setScene(scene: AudioScene) {
    this.scene = scene;
  }
  setPreferences(preferences: AudioPreferences) {
    this.preferences = preferences;
  }
  setActive(active: boolean) {
    this.active = active;
  }
  play(cue: SoundCue) {
    this.cues.push(cue);
  }
  dispose() {
    this.disposed++;
    this.active = false;
  }
}
function fixture() {
  const events = new EventTarget(),
    page = new FakePage(),
    log: string[] = [];
  const contexts: FakeContext[] = [],
    engines: FakeEngine[] = [],
    failures: Array<() => void> = [];
  const saved = new Map<string, string>();
  let writes = 0,
    loadFailure = false,
    writeFailure = false;
  let loadGate: ReturnType<typeof deferred<void>> | undefined;
  const module = {
    createGameAudioEngine(
      _context: AudioContext,
      prefs: AudioPreferences,
      scene: AudioScene,
      onFailure?: () => void,
    ) {
      log.push('engine');
      const engine = new FakeEngine(prefs, scene);
      engines.push(engine);
      failures.push(onFailure ?? (() => {}));
      return engine;
    },
  };
  const controller = createGameAudioController({
    events,
    page,
    storage: {
      getItem: (key) => saved.get(key) ?? null,
      setItem(key, value) {
        if (writeFailure) throw new Error('Quota');
        writes++;
        saved.set(key, value);
      },
    },
    createContext() {
      log.push('context');
      const ctx = new FakeContext(log);
      contexts.push(ctx);
      return ctx as unknown as AudioContext;
    },
    async loadEngine() {
      log.push('import');
      if (loadGate) await loadGate.promise;
      if (loadFailure) throw new Error('Offline');
      return module;
    },
  });
  return {
    controller,
    events,
    page,
    log,
    contexts,
    engines,
    failures,
    saved,
    get writes() {
      return writes;
    },
    failLoad(value: boolean) {
      loadFailure = value;
    },
    failWrite(value: boolean) {
      writeFailure = value;
    },
    delayLoad() {
      loadGate = deferred<void>();
      return loadGate;
    },
  };
}

test('construction and start are silent; a gesture synchronously constructs and resumes before import', async () => {
  const f = fixture();
  const before = f.controller.getSnapshot();
  assert.deepEqual(before, { preferences: DEFAULT_AUDIO_PREFERENCES, status: 'locked' });
  f.controller.play('collect');
  const stop = f.controller.start();
  assert.strictEqual(f.controller.getSnapshot(), before);
  assert.deepEqual(f.log, []);
  f.events.dispatchEvent(new Event('pointerdown'));
  assert.deepEqual(f.log, ['context', 'resume']);
  assert.equal(f.controller.getSnapshot().status, 'loading');
  await f.controller.unlock();
  assert.deepEqual(f.log, ['context', 'resume', 'import', 'engine']);
  assert.equal(f.controller.getSnapshot().status, 'playing');
  assert.equal(f.contexts.length, 1);
  assert.deepEqual(f.engines[0].cues, []);
  f.controller.play('collect');
  assert.deepEqual(f.engines[0].cues, ['collect']);
  stop();
});

test('explicit unlock and non-repeating ordinary keys work; modifier and secondary pointer events do not', async () => {
  const f = fixture(),
    stop = f.controller.start();
  const key = new Event('keydown');
  Object.assign(key, { key: 'Shift' });
  f.events.dispatchEvent(key);
  const repeat = new Event('keydown');
  Object.assign(repeat, { key: 'w', repeat: true });
  f.events.dispatchEvent(repeat);
  const right = new Event('pointerdown');
  Object.assign(right, { button: 2 });
  f.events.dispatchEvent(right);
  assert.deepEqual(f.log, []);
  const ordinary = new Event('keydown');
  Object.assign(ordinary, { key: 'w' });
  f.events.dispatchEvent(ordinary);
  assert.deepEqual(f.log, ['context', 'resume']);
  await f.controller.unlock();
  stop();
  const restart = f.controller.start();
  const unlock = f.controller.unlock();
  assert.deepEqual(f.log.slice(-2), ['context', 'resume']);
  await unlock;
  restart();
});

test('mute and hidden page stop voices and cues; restore respects user mute and latest scene', async () => {
  const f = fixture(),
    stop = f.controller.start();
  await f.controller.unlock();
  f.page.change(true);
  assert.equal(f.engines[0].active, false);
  assert.equal(f.controller.getSnapshot().status, 'paused');
  f.controller.play('reward');
  f.controller.setPreferences({ muted: true });
  f.controller.setScene({ region: 'water', temple: true, flying: false, ducked: true });
  await tick();
  f.page.change(false);
  assert.equal(f.controller.getSnapshot().status, 'muted');
  assert.equal(f.contexts[0].resumes, 1);
  f.controller.setPreferences({ muted: false });
  await f.controller.unlock();
  assert.equal(f.controller.getSnapshot().status, 'playing');
  assert.equal(f.engines[0].scene.region, 'water');
  assert.deepEqual(f.engines[0].cues, []);
  f.page.change(true);
  await tick();
  f.page.change(false);
  await f.controller.unlock();
  assert.equal(f.controller.getSnapshot().status, 'playing');
  assert.equal(f.contexts.length, 1);
  stop();
});

test('muted and hidden first interactions never construct or import; unmute requires a gesture', async () => {
  const f = fixture(),
    stop = f.controller.start();
  f.controller.setPreferences({ muted: true });
  await f.controller.unlock();
  f.events.dispatchEvent(new Event('pointerdown'));
  f.controller.setPreferences({ muted: false });
  assert.deepEqual(f.log, []);
  f.page.change(true);
  await f.controller.unlock();
  f.page.change(false);
  assert.deepEqual(f.log, []);
  await f.controller.unlock();
  assert.equal(f.controller.getSnapshot().status, 'playing');
  stop();
});

test('load failures are unavailable, retry on a new gesture, and concurrent unlocks share one context/import', async () => {
  const f = fixture(),
    stop = f.controller.start();
  f.failLoad(true);
  const first = f.controller.unlock(),
    duplicate = f.controller.unlock();
  assert.strictEqual(first, duplicate);
  await first;
  assert.equal(f.controller.getSnapshot().status, 'unavailable');
  f.controller.play('reward');
  f.failLoad(false);
  await f.controller.unlock();
  assert.equal(f.controller.getSnapshot().status, 'playing');
  assert.equal(f.contexts.length, 1);
  assert.equal(f.log.filter((v) => v === 'import').length, 2);
  assert.deepEqual(f.engines[0].cues, []);
  stop();
});

test('resume rejection or a resolved-but-suspended context never reports playing and can retry', async () => {
  for (const variant of ['resumeFailure', 'staySuspended'] as const) {
    const f = fixture(),
      stop = f.controller.start();
    await f.controller.unlock();
    f.page.change(true);
    await tick();
    f.contexts[0][variant] = true;
    f.page.change(false);
    await tick();
    assert.equal(f.controller.getSnapshot().status, 'unavailable');
    assert.equal(f.engines[0].active, false);
    f.contexts[0][variant] = false;
    await f.controller.unlock();
    assert.equal(f.controller.getSnapshot().status, 'playing');
    stop();
  }
});

test('cleanup cancels an in-flight import; StrictMode restart ignores old results and removes listeners', async () => {
  const f = fixture(),
    gate = f.delayLoad(),
    stop = f.controller.start();
  const old = f.controller.unlock();
  await tick();
  stop();
  stop();
  assert.equal(f.contexts[0].closes, 1);
  assert.equal(f.controller.getSnapshot().status, 'locked');
  f.events.dispatchEvent(new Event('pointerdown'));
  assert.equal(f.contexts.length, 1);
  const restart = f.controller.start(),
    current = f.controller.unlock();
  gate.resolve();
  await Promise.all([old, current]);
  assert.equal(f.engines.length, 1);
  assert.equal(f.contexts.length, 2);
  assert.equal(f.controller.getSnapshot().status, 'playing');
  restart();
  assert.equal(f.engines[0].disposed, 1);
  assert.equal(f.contexts[1].closes, 1);
});

test('muting during load does not start an engine or replay cues when unmuted', async () => {
  const f = fixture(),
    gate = f.delayLoad(),
    stop = f.controller.start();
  const loading = f.controller.unlock();
  await tick();
  f.controller.play('capture');
  f.controller.setPreferences({ muted: true });
  gate.resolve();
  await loading;
  assert.equal(f.engines.length, 0);
  assert.equal(f.controller.getSnapshot().status, 'muted');
  f.controller.setPreferences({ muted: false });
  await f.controller.unlock();
  assert.equal(f.engines.length, 1);
  assert.deepEqual(f.engines[0].cues, []);
  stop();
});

test('rapid mute/unmute waits for an outstanding suspend and resumes the same context', async () => {
  const f = fixture(),
    stop = f.controller.start();
  await f.controller.unlock();
  const gate = (f.contexts[0].suspendGate = deferred<void>());
  f.controller.setPreferences({ muted: true });
  f.controller.setPreferences({ muted: false });
  const pending = f.controller.unlock();
  gate.resolve();
  await pending;
  await tick();
  assert.equal(f.controller.getSnapshot().status, 'playing');
  assert.equal(f.contexts.length, 1);
  stop();
});

test('preferences clamp finite numbers, reject other values, recover corruption and retain changes when storage fails', async () => {
  assert.deepEqual(
    sanitizeAudioPreferences({ muted: 'false', musicVolume: 3, effectsVolume: -2 }),
    { muted: false, musicVolume: 1, effectsVolume: 0 },
  );
  for (const value of [
    null,
    [],
    'bad',
    { musicVolume: '0.2', effectsVolume: Infinity },
    { musicVolume: NaN },
  ])
    assert.deepEqual(sanitizeAudioPreferences(value), DEFAULT_AUDIO_PREFERENCES);
  assert.deepEqual(
    loadAudioPreferences({
      getItem() {
        throw new Error('Blocked');
      },
      setItem() {},
    }),
    DEFAULT_AUDIO_PREFERENCES,
  );
  assert.deepEqual(
    loadAudioPreferences({ getItem: () => '{bad', setItem() {} }),
    DEFAULT_AUDIO_PREFERENCES,
  );
  const f = fixture(),
    stop = f.controller.start();
  const before = f.controller.getSnapshot();
  let notifications = 0;
  const unsubscribe = f.controller.subscribe(() => notifications++);
  f.controller.setPreferences({ musicVolume: NaN });
  assert.strictEqual(f.controller.getSnapshot(), before);
  assert.equal(f.writes, 0);
  f.failWrite(true);
  f.controller.setPreferences({ musicVolume: 0.8, effectsVolume: 0.4 });
  assert.equal(f.controller.getSnapshot().preferences.musicVolume, 0.8);
  assert.equal(notifications, 1);
  f.failWrite(false);
  f.controller.setPreferences({ effectsVolume: 0.5 });
  assert.deepEqual([...f.saved.keys()], [AUDIO_PREFERENCES_KEY]);
  assert.deepEqual(JSON.parse(f.saved.get(AUDIO_PREFERENCES_KEY)!), {
    muted: false,
    musicVolume: 0.8,
    effectsVolume: 0.5,
  });
  unsubscribe();
  stop();
});

test('without a browser or supported context the controller stays safe and truthfully unavailable', async () => {
  const controller = createGameAudioController({
    storage: null,
    events: null,
    page: null,
    createContext: () => null,
    loadEngine: async () => {
      throw new Error('Must not load');
    },
  });
  assert.equal(controller.getSnapshot().status, 'locked');
  const stop = controller.start();
  await controller.unlock();
  assert.equal(controller.getSnapshot().status, 'unavailable');
  stop();
});

test('engine exceptions never interrupt game actions or preference saves, and a gesture can rebuild the engine', async () => {
  for (const method of ['play', 'setScene', 'setPreferences'] as const) {
    const f = fixture(),
      stop = f.controller.start();
    await f.controller.unlock();
    f.engines[0][method] = () => {
      throw new Error('Node disconnected');
    };
    assert.doesNotThrow(() => {
      if (method === 'play') f.controller.play('collect');
      else if (method === 'setScene')
        f.controller.setScene({ region: 'fire', temple: false, flying: false, ducked: false });
      else f.controller.setPreferences({ musicVolume: 0.7 });
    });
    assert.equal(f.controller.getSnapshot().status, 'unavailable');
    assert.equal(f.engines[0].disposed, 1);
    if (method === 'setPreferences')
      assert.equal(JSON.parse(f.saved.get(AUDIO_PREFERENCES_KEY)!).musicVolume, 0.7);
    await f.controller.unlock();
    assert.equal(f.controller.getSnapshot().status, 'playing');
    assert.equal(f.engines.length, 2);
    stop();
  }
});

test('activation and disposal exceptions do not escape lifecycle cleanup', async () => {
  const f = fixture(),
    stop = f.controller.start();
  await f.controller.unlock();
  f.engines[0].setActive = () => {
    throw new Error('Context lost');
  };
  f.engines[0].dispose = () => {
    throw new Error('Already disconnected');
  };
  assert.doesNotThrow(() => f.controller.setPreferences({ muted: true }));
  assert.equal(f.controller.getSnapshot().status, 'muted');
  f.controller.setPreferences({ muted: false });
  await f.controller.unlock();
  assert.equal(f.controller.getSnapshot().status, 'playing');
  f.engines[1].dispose = () => {
    throw new Error('Already disconnected');
  };
  assert.doesNotThrow(stop);
  assert.equal(f.contexts[0].closes, 1);
  assert.equal(f.controller.getSnapshot().status, 'locked');
});

test('an externally closed context reports unavailable and the next gesture creates a fresh context', async () => {
  const f = fixture(),
    stop = f.controller.start();
  await f.controller.unlock();
  await f.contexts[0].close();
  f.contexts[0].dispatchEvent(new Event('statechange'));
  assert.equal(f.controller.getSnapshot().status, 'unavailable');
  assert.equal(f.engines[0].active, false);
  const retry = f.controller.unlock();
  assert.deepEqual(f.log.slice(-2), ['context', 'resume']);
  await retry;
  assert.equal(f.contexts.length, 2);
  assert.equal(f.engines[0].disposed, 1);
  assert.equal(f.controller.getSnapshot().status, 'playing');
  stop();
});

test('an internal engine failure reports unavailable and retries; callbacks from retired engines are ignored', async () => {
  const f = fixture(),
    stop = f.controller.start();
  await f.controller.unlock();
  f.failures[0]();
  assert.equal(f.controller.getSnapshot().status, 'unavailable');
  assert.equal(f.engines[0].disposed, 1);
  assert.equal(f.engines[0].active, false);
  await f.controller.unlock();
  assert.equal(f.controller.getSnapshot().status, 'playing');
  assert.equal(f.engines.length, 2);
  const restored = f.controller.getSnapshot();
  f.failures[0]();
  assert.strictEqual(
    f.controller.getSnapshot(),
    restored,
    'A retired engine cannot stop its same-context replacement',
  );
  stop();
  const restart = f.controller.start();
  await f.controller.unlock();
  const restarted = f.controller.getSnapshot();
  f.failures[1]();
  assert.strictEqual(
    f.controller.getSnapshot(),
    restarted,
    'A prior generation cannot stop a restarted controller',
  );
  assert.equal(f.engines[2].active, true);
  restart();
});
