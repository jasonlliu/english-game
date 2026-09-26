import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { createGameAudioEngine } from '../src/audio/engine.ts';
import type { AudioPreferences, AudioScene, SoundCue } from '../src/audio/types.ts';

class FakeParam {
  value = 0;
  events: Array<{ method: string; value: number; time: number }> = [];
  setValueAtTime(value: number, time: number) {
    return this.record('set', value, time);
  }
  setTargetAtTime(value: number, time: number) {
    return this.record('target', value, time);
  }
  linearRampToValueAtTime(value: number, time: number) {
    return this.record('linear', value, time);
  }
  exponentialRampToValueAtTime(value: number, time: number) {
    assert(value > 0);
    return this.record('exponential', value, time);
  }
  cancelScheduledValues(time: number) {
    this.events = this.events.filter((event) => event.time < time);
    return this;
  }
  private record(method: string, value: number, time: number) {
    assert(Number.isFinite(value) && Number.isFinite(time));
    this.value = value;
    this.events.push({ method, value, time });
    return this;
  }
}

class FakeNode {
  connections = new Set<FakeNode>();
  disconnects = 0;
  gain = new FakeParam();
  frequency = new FakeParam();
  pan = new FakeParam();
  Q = new FakeParam();
  threshold = new FakeParam();
  knee = new FakeParam();
  ratio = new FakeParam();
  attack = new FakeParam();
  release = new FakeParam();
  type = '';
  buffer: unknown = null;
  onended: (() => void) | null = null;
  startAt: number | undefined;
  stopAt: number | undefined;
  ended = false;
  constructor(readonly kind: string) {}
  connect(node: FakeNode) {
    this.connections.add(node);
    return node;
  }
  disconnect() {
    this.disconnects++;
    this.connections.clear();
  }
  start(time: number) {
    assert.equal(this.startAt, undefined);
    this.startAt = time;
  }
  stop(time: number) {
    this.stopAt = time;
  }
}

class FakeContext {
  state: AudioContextState = 'running';
  currentTime = 0;
  sampleRate = 1000;
  destination = new FakeNode('destination');
  nodes: FakeNode[] = [];
  listeners = new Set<() => void>();
  contextLifecycleCalls = 0;
  failMethod = '';
  failBufferNumber = 0;
  private buffers = 0;
  private node(kind: string) {
    if (this.failMethod === kind) throw new Error(`device failed creating ${kind}`);
    const node = new FakeNode(kind);
    this.nodes.push(node);
    return node;
  }
  createGain() {
    return this.node('gain');
  }
  createConvolver() {
    return this.node('convolver');
  }
  createDynamicsCompressor() {
    return this.node('compressor');
  }
  createBiquadFilter() {
    return this.node('filter');
  }
  createStereoPanner() {
    return this.node('panner');
  }
  createOscillator() {
    return this.node('oscillator');
  }
  createBufferSource() {
    return this.node('buffer-source');
  }
  createBuffer(channels: number, length: number) {
    if (++this.buffers === this.failBufferNumber) throw new Error('buffer allocation failed');
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { getChannelData: (channel: number) => data[channel] };
  }
  addEventListener(name: string, listener: () => void) {
    assert.equal(name, 'statechange');
    this.listeners.add(listener);
  }
  removeEventListener(name: string, listener: () => void) {
    assert.equal(name, 'statechange');
    this.listeners.delete(listener);
  }
  resume() {
    this.contextLifecycleCalls++;
  }
  suspend() {
    this.contextLifecycleCalls++;
  }
  close() {
    this.contextLifecycleCalls++;
  }
  setState(state: AudioContextState) {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
  advance(time: number) {
    this.currentTime = time;
    for (const source of this.sources) {
      if (!source.ended && source.stopAt !== undefined && source.stopAt <= time) {
        source.ended = true;
        source.onended?.();
      }
    }
  }
  get sources() {
    return this.nodes.filter((node) => node.kind === 'oscillator' || node.kind === 'buffer-source');
  }
  get liveSources() {
    return this.sources.filter((node) => node.disconnects === 0);
  }
  asAudioContext() {
    return this as unknown as AudioContext;
  }
}

function clock(t: TestContext, context: FakeContext) {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; callback: () => void }>();
  t.mock.method(globalThis, 'setTimeout', (callback: () => void, delay = 0) => {
    const id = nextId++;
    timers.set(id, { at: now + delay, callback });
    return id;
  });
  t.mock.method(globalThis, 'clearTimeout', (id: number) => {
    timers.delete(id);
  });
  return {
    get pending() {
      return timers.size;
    },
    advance(seconds: number) {
      const target = now + seconds * 1000;
      for (;;) {
        const first = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
        if (!first || first[1].at > target) break;
        const [id, timer] = first;
        now = timer.at;
        context.advance(now / 1000);
        timers.delete(id);
        timer.callback();
      }
      now = target;
      context.advance(now / 1000);
    },
  };
}

const preferences: AudioPreferences = { muted: false, musicVolume: 0.37, effectsVolume: 0.61 };
const scene: AudioScene = { region: 'meadow', temple: false, flying: false, ducked: false };
const cues: SoundCue[] = [
  'collect',
  'reward',
  'capture',
  'pet',
  'takeoff',
  'land',
  'travel',
  'seal',
  'mistake',
  'temple-open',
  'ui',
];

test('the engine stays idle until activated, has one timer, and never owns the context lifecycle', (t) => {
  const context = new FakeContext();
  const time = clock(t, context);
  const engine = createGameAudioEngine(context.asAudioContext(), preferences, scene);
  assert.equal(context.sources.length, 0);
  assert.equal(time.pending, 0);
  engine.play('reward');
  assert.equal(context.sources.length, 0);
  engine.setActive(true);
  assert(context.sources.length >= 4, 'Activation starts both a chord and a melody');
  const initial = context.sources.length;
  engine.setActive(true);
  engine.setActive(true);
  assert.equal(context.sources.length, initial);
  assert.equal(time.pending, 1);
  time.advance(2);
  assert(context.sources.length > initial);
  engine.setActive(false);
  assert.equal(time.pending, 0);
  assert.equal(
    context.liveSources.length,
    0,
    'Inactive audio must be disconnected before a context suspension',
  );
  const stopped = context.sources.length;
  time.advance(10);
  assert.equal(context.sources.length, stopped);
  engine.setActive(true);
  assert(context.sources.length > stopped);
  engine.dispose();
  engine.dispose();
  engine.setActive(true);
  engine.setScene({ ...scene, region: 'water' });
  engine.play('collect');
  assert.equal(time.pending, 0);
  assert.equal(context.listeners.size, 0);
  assert(context.nodes.every((node) => node.disconnects === 1));
  assert.equal(context.contextLifecycleCalls, 0);
});

test('music and effects volumes are independent, ducking affects music, and mute cancels scheduled cues', (t) => {
  const context = new FakeContext();
  const time = clock(t, context);
  const engine = createGameAudioEngine(context.asAudioContext(), preferences, scene);
  const musicBus = context.nodes.find((node) => node.kind === 'gain' && node.gain.value === 0.37)!;
  const effectsBus = context.nodes.find(
    (node) => node.kind === 'gain' && node.gain.value === 0.61,
  )!;
  assert(musicBus && effectsBus);
  engine.setActive(true);
  engine.setPreferences({ muted: false, musicVolume: 0.8, effectsVolume: 0.2 });
  assert.equal(musicBus.gain.value, 0.8);
  assert.equal(effectsBus.gain.value, 0.2);
  const sourceCount = context.sources.length;
  engine.setScene({ ...scene, ducked: true });
  assert.equal(musicBus.gain.value, 0.24);
  assert.equal(effectsBus.gain.value, 0.2);
  assert.equal(
    context.sources.length,
    sourceCount,
    'Opening a dialog should not restart the composition',
  );
  engine.play('reward');
  assert(context.liveSources.some((source) => source.startAt! > context.currentTime + 0.3));
  engine.setPreferences({ muted: true, musicVolume: 0.8, effectsVolume: 0.2 });
  assert.equal(context.liveSources.length, 0);
  assert.equal(time.pending, 0);
  engine.play('collect');
  const muted = context.sources.length;
  time.advance(3);
  assert.equal(context.sources.length, muted);
  engine.setPreferences({ muted: false, musicVolume: 0, effectsVolume: 1 });
  assert.equal(time.pending, 0);
  engine.play('collect');
  assert(context.sources.length > muted, 'Effects stay available with music at zero');
  engine.setPreferences({ muted: false, musicVolume: Number.NaN, effectsVolume: -3 });
  assert.equal(musicBus.gain.value, 0);
  assert.equal(effectsBus.gain.value, 0);
  time.advance(0.1);
  assert.equal(context.liveSources.length, 0);
  engine.dispose();
});

test('region, temple and flying transitions replace the score while preserving a single scheduler', (t) => {
  const context = new FakeContext();
  const time = clock(t, context);
  const engine = createGameAudioEngine(context.asAudioContext(), preferences, scene);
  engine.setActive(true);
  const signatures = new Set<string>();
  for (const region of ['meadow', 'water', 'fire', 'earth', 'steel', 'fairy'] as const) {
    time.advance(0.3);
    engine.setScene({ ...scene, region });
    time.advance(0.1);
    signatures.add(
      context.liveSources
        .filter((source) => source.kind === 'oscillator')
        .map((source) => `${source.type}:${source.frequency.events[0]?.value}`)
        .join(','),
    );
    assert.equal(time.pending, 1);
  }
  assert.equal(signatures.size, 6, 'Each region has a distinct melodic key or timbre');
  const beforeTemple = context.sources.length;
  engine.setScene({ ...scene, region: 'fairy', temple: true });
  assert(context.sources.length > beforeTemple);
  const temple = context.sources
    .slice(beforeTemple)
    .filter((source) => source.kind === 'oscillator');
  assert(temple.every((source) => source.type === 'sine'));
  assert(temple.some((source) => source.stopAt! - source.startAt! > 7));
  time.advance(0.1);
  engine.setScene({ ...scene, flying: true });
  assert(
    context.liveSources.some((source) => source.kind === 'buffer-source'),
    'Flight adds a soft breath of wind',
  );
  assert.equal(time.pending, 1);
  engine.dispose();
});

test('all eleven cues are short bounded phrases and repeated events are deduplicated', (t) => {
  const context = new FakeContext();
  const time = clock(t, context);
  const engine = createGameAudioEngine(
    context.asAudioContext(),
    { ...preferences, musicVolume: 0 },
    scene,
  );
  engine.setActive(true);
  for (const cue of cues) {
    const previous = context.sources.length;
    engine.play(cue);
    assert(context.sources.length > previous, `${cue} must produce feedback`);
    const count = context.sources.length;
    engine.play(cue);
    assert.equal(context.sources.length, count, `${cue} should suppress duplicate callbacks`);
    const phrase = context.sources.slice(previous);
    assert(phrase.every((source) => source.stopAt! - context.currentTime < 2));
    time.advance(2);
    assert.equal(context.liveSources.length, 0, `${cue} must release its nodes after playing`);
  }
  assert.equal(time.pending, 0, 'Effects do not need cleanup timers');
  engine.dispose();
  assert(context.nodes.every((node) => node.disconnects === 1));
});

test('rapid events and long playback cannot grow the live graph without a bound', (t) => {
  const context = new FakeContext();
  const time = clock(t, context);
  const engine = createGameAudioEngine(context.asAudioContext(), preferences, {
    ...scene,
    flying: true,
  });
  engine.setActive(true);
  for (let i = 0; i < 120; i++) {
    for (const cue of cues) engine.play(cue);
    assert(
      context.liveSources.length <= 24,
      'Music and effect voices share a hard concurrency ceiling',
    );
    assert.equal(time.pending, 1);
    time.advance(0.08);
  }
  time.advance(120);
  assert(context.liveSources.length <= 12, 'Long-running music keeps only its current notes');
  assert.equal(time.pending, 1);
  engine.dispose();
  assert.equal(time.pending, 0);
  assert(context.nodes.every((node) => node.disconnects === 1));
});

test('suspension and hidden-page inactivity cannot resurrect stopped cues on resume', (t) => {
  const context = new FakeContext();
  context.state = 'suspended';
  const time = clock(t, context);
  const engine = createGameAudioEngine(context.asAudioContext(), preferences, scene);
  engine.setActive(true);
  assert.equal(time.pending, 0);
  assert.equal(context.sources.length, 0);
  context.setState('running');
  engine.play('reward');
  assert(context.liveSources.length > 0);
  engine.setActive(false);
  context.setState('suspended');
  assert.equal(context.liveSources.length, 0);
  assert.equal(time.pending, 0);
  const stopped = context.sources.length;
  context.setState('running');
  assert.equal(context.sources.length, stopped);
  engine.setActive(true);
  assert(context.sources.length > stopped);
  context.setState('closed');
  assert.equal(context.liveSources.length, 0);
  assert.equal(time.pending, 0);
  assert.equal(context.contextLifecycleCalls, 0);
  engine.dispose();
});

test('partial initialization releases earlier nodes when any later allocation fails', (t) => {
  for (const failure of ['convolver', 'compressor', 'buffer-one', 'buffer-two']) {
    const context = new FakeContext();
    const time = clock(t, context);
    if (failure.startsWith('buffer')) context.failBufferNumber = failure === 'buffer-one' ? 1 : 2;
    else context.failMethod = failure;
    assert.throws(
      () => createGameAudioEngine(context.asAudioContext(), preferences, scene),
      /failed/,
    );
    assert(context.nodes.length > 0);
    assert(
      context.nodes.every((node) => node.disconnects === 1),
      failure,
    );
    assert.equal(context.listeners.size, 0);
    assert.equal(context.contextLifecycleCalls, 0);
    assert.equal(time.pending, 0);
  }
});

test('an audio device failure during a scheduler callback stops cleanly without an uncaught error', (t) => {
  const context = new FakeContext();
  const time = clock(t, context);
  let failures = 0;
  const engine = createGameAudioEngine(context.asAudioContext(), preferences, scene, () => {
    failures++;
  });
  engine.setActive(true);
  context.failMethod = 'filter';
  assert.doesNotThrow(() => time.advance(3));
  assert.equal(time.pending, 0);
  assert.equal(context.liveSources.length, 0);
  assert.equal(context.listeners.size, 0);
  assert(context.nodes.every((node) => node.disconnects === 1));
  engine.dispose();
  engine.play('collect');
  engine.setActive(true);
  time.advance(3);
  assert.equal(failures, 1, 'The controller receives one failure and can offer a fresh engine');
});
