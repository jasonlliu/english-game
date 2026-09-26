import { CUE_SCORES, musicProfile, scalePitch } from './score';
import type { AudioPreferences, AudioScene, GameAudioEngine, SoundCue } from './types';

type Channel = 'music' | 'effects';
type Source = OscillatorNode | AudioBufferSourceNode;
interface Voice {
  source: Source;
  envelope: GainNode;
  nodes: AudioNode[];
  channel: Channel;
  peak: number;
  end: number;
  released: boolean;
}

const MAX_MUSIC_VOICES = 12;
const MAX_EFFECT_VOICES = 14;
const MAX_VOICES = 24;
const LOOK_AHEAD = 0.18;
const TICK_MS = 100;
const clampVolume = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** One engine owns nodes, never the AudioContext or the user's permission to resume it. */
export function createGameAudioEngine(
  context: AudioContext,
  initialPreferences: AudioPreferences,
  initialScene: AudioScene,
  onFailure?: () => void,
): GameAudioEngine {
  let preferences = { ...initialPreferences };
  let scene = { ...initialScene };
  let active = false;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let nextBeat = 0;
  let step = 0;
  let profile = musicProfile(scene);
  const voices = new Set<Voice>();
  const cueTimes = new Map<SoundCue, number>();
  const ownedNodes = new Set<AudioNode>();
  let stateListener: (() => void) | undefined;
  const keep = <T extends AudioNode>(node: T) => {
    ownedNodes.add(node);
    return node;
  };
  const disconnect = (node: AudioNode) => {
    if (!ownedNodes.delete(node)) return;
    try {
      node.disconnect();
    } catch {
      /* Continue releasing the remaining graph. */
    }
  };
  try {
    const music = keep(context.createGain());
    const effects = keep(context.createGain());
    const master = keep(context.createGain());
    const wet = keep(context.createGain());
    const reverb = keep(context.createConvolver());
    const limiter = keep(context.createDynamicsCompressor());
    // A soft ceiling and conservative source gains prevent reward chords from startling.
    limiter.threshold.value = -12;
    limiter.knee.value = 18;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    master.gain.value = 0;
    wet.gain.value = 0.23;
    music.connect(master);
    effects.connect(master);
    music.connect(reverb);
    effects.connect(reverb);
    reverb.connect(wet);
    wet.connect(master);
    master.connect(limiter);
    limiter.connect(context.destination);

    let seed = 58421;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const impulse = context.createBuffer(
      2,
      Math.ceil(context.sampleRate * 1.8),
      context.sampleRate,
    );
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < data.length; i++)
        data[i] = (random() * 2 - 1) * (1 - i / data.length) ** 3.2 * 0.45;
    }
    reverb.buffer = impulse;
    const air = context.createBuffer(1, Math.ceil(context.sampleRate * 4), context.sampleRate);
    const airData = air.getChannelData(0);
    let previous = 0;
    for (let i = 0; i < airData.length; i++) {
      previous = (previous + (random() * 2 - 1) * 0.08) / 1.08;
      airData[i] = previous * 2.5;
    }

    const canPlay = () => !disposed && active && !preferences.muted && context.state === 'running';
    const ramp = (parameter: AudioParam, value: number, seconds: number) => {
      const now = context.currentTime;
      parameter.cancelScheduledValues(now);
      parameter.setTargetAtTime(value, now, seconds);
    };
    const setLevels = () => {
      ramp(music.gain, clampVolume(preferences.musicVolume) * (scene.ducked ? 0.3 : 1), 0.16);
      ramp(effects.gain, clampVolume(preferences.effectsVolume), 0.025);
      ramp(wet.gain, scene.temple ? 0.38 : scene.flying ? 0.28 : 0.23, 0.3);
      ramp(master.gain, canPlay() ? 0.72 : 0, canPlay() ? 0.14 : 0.015);
    };
    const cleanupVoice = (voice: Voice) => {
      if (!voices.delete(voice)) return;
      voice.source.onended = null;
      for (const node of voice.nodes) disconnect(node);
    };
    const stopVoice = (voice: Voice, immediate = false) => {
      if (voice.released && !immediate) return;
      voice.released = true;
      const now = context.currentTime;
      if (!immediate) {
        voice.envelope.gain.cancelScheduledValues(now);
        voice.envelope.gain.setValueAtTime(
          Math.min(voice.peak, Math.max(0, voice.envelope.gain.value)),
          now,
        );
        voice.envelope.gain.linearRampToValueAtTime(0, now + 0.025);
      }
      voice.end = now + (immediate ? 0 : 0.03);
      try {
        voice.source.stop(voice.end);
      } catch {
        /* A source may have ended between frames. */
      }
      if (immediate) cleanupVoice(voice);
    };
    const stopChannel = (channel?: Channel, immediate = false) => {
      for (const voice of voices)
        if (!channel || voice.channel === channel) stopVoice(voice, immediate);
    };
    const sweepVoices = () => {
      for (const voice of voices) if (voice.end <= context.currentTime) cleanupVoice(voice);
    };
    const reserveVoice = (channel: Channel) => {
      sweepVoices();
      const limit = channel === 'music' ? MAX_MUSIC_VOICES : MAX_EFFECT_VOICES;
      const channelVoices = [...voices].filter((voice) => voice.channel === channel);
      if (channelVoices.length >= limit) return false;
      if (voices.size >= MAX_VOICES) {
        // A short interaction can replace a quiet pad, never an unbounded pile of cues.
        const replaceable =
          channel === 'effects'
            ? [...voices].find((voice) => voice.channel === 'music')
            : undefined;
        if (!replaceable) return false;
        stopVoice(replaceable, true);
      }
      return true;
    };
    const attachVoice = (
      source: Source,
      channel: Channel,
      at: number,
      duration: number,
      peak: number,
      attack: number,
      pan: number,
      brightness: number,
    ) => {
      const filter = keep(context.createBiquadFilter());
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(brightness, at);
      filter.Q.value = 0.45;
      const envelope = keep(context.createGain());
      const stereo = keep(context.createStereoPanner());
      stereo.pan.value = pan;
      envelope.gain.setValueAtTime(0, at);
      envelope.gain.linearRampToValueAtTime(peak, at + attack);
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      envelope.gain.linearRampToValueAtTime(0, at + duration + 0.03);
      source.connect(filter);
      filter.connect(envelope);
      envelope.connect(stereo);
      stereo.connect(channel === 'music' ? music : effects);
      const voice: Voice = {
        source,
        envelope,
        nodes: [source, filter, envelope, stereo],
        channel,
        peak,
        end: at + duration + 0.04,
        released: false,
      };
      voices.add(voice);
      source.onended = () => cleanupVoice(voice);
      source.start(at);
      source.stop(voice.end);
    };
    const tone = (
      pitch: number,
      at: number,
      duration: number,
      peak: number,
      channel: Channel,
      type: OscillatorType = 'sine',
      pan = 0,
      brightness = 2800,
      attack = 0.018,
      endPitch?: number,
    ) => {
      if (!reserveVoice(channel)) return;
      const source = keep(context.createOscillator());
      source.type = type;
      source.frequency.setValueAtTime(frequency(pitch), at);
      if (endPitch !== undefined)
        source.frequency.exponentialRampToValueAtTime(frequency(endPitch), at + duration * 0.8);
      attachVoice(source, channel, at, duration, peak, attack, pan, brightness);
    };
    const breath = (
      at: number,
      duration: number,
      gain: number,
      brightness: number,
      channel: Channel,
    ) => {
      if (!reserveVoice(channel)) return;
      const source = keep(context.createBufferSource());
      source.buffer = air;
      attachVoice(
        source,
        channel,
        at,
        Math.min(3.7, duration),
        gain,
        Math.min(0.5, duration * 0.3),
        0,
        brightness,
      );
    };
    const scheduleBeat = (at: number, beat: number) => {
      if (beat % 8 === 0) {
        const root = profile.chords[Math.floor(beat / 8) % profile.chords.length];
        for (let i = 0; i < 3; i++) {
          const pitch = scalePitch(profile, root + i * 2) - (scene.flying ? 24 : 12);
          tone(
            pitch,
            at + i * 0.065,
            profile.step * 7.5,
            0.025,
            'music',
            profile.pad,
            (i - 1) * 0.35,
            900,
            0.8,
          );
        }
        if (scene.flying) breath(at + 0.2, 3.7, 0.035, 1600, 'music');
      }
      const degree = profile.motif[beat % profile.motif.length];
      if (degree !== null) {
        const octave = scene.temple && beat % 4 === 0 ? 12 : 0;
        tone(
          scalePitch(profile, degree) + octave,
          at + 0.035,
          profile.release,
          scene.temple ? 0.045 : 0.06,
          'music',
          profile.melody,
          Math.sin(beat * 1.7) * 0.32,
          profile.brightness,
        );
      }
    };
    const clearScheduler = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    };
    const schedule = () => {
      timer = undefined;
      if (!canPlay() || clampVolume(preferences.musicVolume) === 0) return;
      try {
        const now = context.currentTime;
        // A stalled tab resumes at the current beat instead of emitting a catch-up burst.
        if (nextBeat < now - LOOK_AHEAD) nextBeat = now + 0.035;
        sweepVoices();
        while (nextBeat < now + LOOK_AHEAD) {
          scheduleBeat(nextBeat, step++);
          nextBeat += profile.step;
        }
        timer = setTimeout(schedule, TICK_MS);
      } catch {
        // Context closure or a device failure must not escape a timer into the page.
        fail();
      }
    };
    const reconcile = () => {
      if (disposed) return;
      setLevels();
      if (!canPlay()) {
        clearScheduler();
        step = 0;
        // Hidden tabs can suspend before a scheduled 30 ms stop fires. Disconnect now
        // so resuming the context can never resurrect an earlier cue or held note.
        stopChannel(undefined, true);
        // Reset convolution memory so quickly unmuting cannot replay an old reward tail.
        reverb.buffer = null;
        reverb.buffer = impulse;
        return;
      }
      if (clampVolume(preferences.musicVolume) === 0) {
        clearScheduler();
        stopChannel('music');
      } else if (timer === undefined) {
        nextBeat = context.currentTime + 0.07;
        schedule();
      }
      if (clampVolume(preferences.effectsVolume) === 0) stopChannel('effects');
    };
    stateListener = () => {
      try {
        reconcile();
      } catch {
        fail();
      }
    };
    context.addEventListener('statechange', stateListener);
    setLevels();

    function dispose() {
      if (disposed) return;
      disposed = true;
      active = false;
      clearScheduler();
      if (stateListener) context.removeEventListener('statechange', stateListener);
      stopChannel(undefined, true);
      try {
        master.gain.cancelScheduledValues(context.currentTime);
        master.gain.setValueAtTime(0, context.currentTime);
        reverb.buffer = null;
      } catch {
        /* A failed device must not interrupt ownership cleanup. */
      }
      for (const node of ownedNodes) disconnect(node);
      cueTimes.clear();
    }

    function fail() {
      if (disposed) return;
      dispose();
      try {
        onFailure?.();
      } catch {
        /* Error reporting must not escape an audio timer. */
      }
    }

    return {
      setScene(next) {
        if (disposed) return;
        try {
          const changed =
            scene.region !== next.region ||
            scene.temple !== next.temple ||
            scene.flying !== next.flying;
          scene = { ...next };
          if (changed) {
            profile = musicProfile(scene);
            clearScheduler();
            stopChannel('music');
            step = 0;
          }
          reconcile();
        } catch {
          fail();
        }
      },
      setPreferences(next) {
        if (disposed) return;
        preferences = { ...next };
        try {
          reconcile();
        } catch {
          fail();
        }
      },
      setActive(next) {
        if (disposed) return;
        active = next;
        try {
          reconcile();
        } catch {
          fail();
        }
      },
      play(cue) {
        if (!canPlay() || clampVolume(preferences.effectsVolume) === 0) return;
        try {
          const score = CUE_SCORES[cue];
          if (!score) return;
          const now = context.currentTime;
          if (now - (cueTimes.get(cue) ?? -Infinity) < score.cooldown) return;
          cueTimes.set(cue, now);
          for (const note of score.notes) {
            tone(
              note.pitch,
              now + 0.008 + note.at,
              note.duration,
              note.gain,
              'effects',
              note.type,
              0,
              cue === 'mistake' ? 950 : 3100,
              0.012,
              note.endPitch,
            );
          }
          if (score.breath)
            breath(
              now + score.breath.at,
              score.breath.duration,
              score.breath.gain,
              score.breath.frequency,
              'effects',
            );
        } catch {
          fail();
        }
      },
      dispose,
    };
  } catch (error) {
    disposed = true;
    if (timer !== undefined) clearTimeout(timer);
    if (stateListener) context.removeEventListener('statechange', stateListener);
    for (const node of ownedNodes) disconnect(node);
    throw error;
  }
}
