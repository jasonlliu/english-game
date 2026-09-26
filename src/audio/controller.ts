import {
  defaultAudioStorage,
  loadAudioPreferences,
  sanitizeAudioPreferences,
  saveAudioPreferences,
  type AudioPreferenceStorage,
} from './preferences';
import type {
  AudioPreferences,
  AudioScene,
  AudioSnapshot,
  AudioStatus,
  GameAudioController,
  GameAudioEngine,
} from './types';

type Events = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
interface EngineModule {
  createGameAudioEngine(
    context: AudioContext,
    preferences: AudioPreferences,
    scene: AudioScene,
    onFailure?: () => void,
  ): GameAudioEngine;
}
export interface AudioControllerOptions {
  storage?: AudioPreferenceStorage | null;
  events?: Events | null;
  page?: (Events & { readonly hidden: boolean }) | null;
  createContext?: () => AudioContext | null;
  loadEngine?: () => Promise<EngineModule>;
}

function createBrowserContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Constructor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Constructor ? new Constructor() : null;
}

export function createGameAudioController(
  options: AudioControllerOptions = {},
): GameAudioController {
  const storage = options.storage === undefined ? defaultAudioStorage() : options.storage;
  const events =
    options.events === undefined ? (typeof window === 'undefined' ? null : window) : options.events;
  const page =
    options.page === undefined ? (typeof document === 'undefined' ? null : document) : options.page;
  const createContext = options.createContext ?? createBrowserContext;
  const loadEngine = options.loadEngine ?? (() => import('./engine'));
  let preferences = loadAudioPreferences(storage);
  let scene: AudioScene = { region: 'meadow', temple: false, flying: false, ducked: false };
  let snapshot: AudioSnapshot = { preferences, status: preferences.muted ? 'muted' : 'locked' };
  const listeners = new Set<() => void>();
  let starts = 0,
    generation = 0,
    intent = 0;
  let context: AudioContext | null = null;
  let engine: GameAudioEngine | null = null;
  let engineActive = false,
    failed = false;
  let pending: Promise<void> | null = null;
  let suspension: Promise<void> | null = null;
  const blocked = () => !starts || preferences.muted || !!page?.hidden;

  function discardEngine() {
    const previous = engine;
    engine = null;
    engineActive = false;
    try {
      previous?.dispose();
    } catch {
      /* Disposal must not interrupt game cleanup. */
    }
  }

  function callEngine(action: (target: GameAudioEngine) => void): boolean {
    try {
      if (engine) action(engine);
      return true;
    } catch {
      failed = true;
      discardEngine();
      return false;
    }
  }

  function discardContext() {
    generation++;
    pending = null;
    suspension = null;
    discardEngine();
    const previous = context;
    context = null;
    if (previous) {
      previous.removeEventListener('statechange', publish);
      try {
        if (previous.state !== 'closed') void previous.close().catch(() => {});
      } catch {
        /* Already closed. */
      }
    }
  }

  function publish() {
    if (context?.state === 'closed') failed = true;
    let active = !blocked() && !failed && context?.state === 'running' && !!engine;
    if (active !== engineActive) {
      engineActive = active;
      if (!callEngine((target) => target.setActive(active))) active = false;
    }
    const status: AudioStatus = preferences.muted
      ? 'muted'
      : !starts
        ? 'locked'
        : page?.hidden
          ? 'paused'
          : failed
            ? 'unavailable'
            : pending
              ? 'loading'
              : active
                ? 'playing'
                : context
                  ? 'paused'
                  : 'locked';
    if (snapshot.preferences !== preferences || snapshot.status !== status) {
      snapshot = { preferences, status };
      listeners.forEach((listener) => listener());
    }
  }

  function pause() {
    publish();
    if (!context || context.state === 'closed' || suspension) return;
    const target = context,
      token = generation;
    try {
      suspension = Promise.resolve(target.suspend())
        .catch(() => {})
        .finally(() => {
          if (context !== target || generation !== token) return;
          suspension = null;
          publish();
          if (!blocked() && !pending && !failed) void activate(false, false);
        });
    } catch {
      // Voices are already stopped even when a browser refuses suspension.
    }
  }

  function activate(allowCreate: boolean, retry: boolean): Promise<void> {
    if (blocked() || (failed && !retry)) {
      publish();
      return Promise.resolve();
    }
    if (pending) return pending;
    if (context?.state === 'closed') discardContext();
    if (engine && context?.state === 'running' && !failed) {
      publish();
      return Promise.resolve();
    }
    if (!context && !allowCreate) {
      publish();
      return Promise.resolve();
    }
    failed = false;
    const token = generation,
      revision = intent;
    let resumed: Promise<void>;
    try {
      if (!context) {
        context = createContext();
        if (!context) throw new Error('AudioContext unavailable');
        context.addEventListener('statechange', publish);
      }
      // Safari requires construction and resume in the original gesture call stack.
      resumed = context.resume();
    } catch {
      failed = true;
      publish();
      return Promise.resolve();
    }
    const target = context;
    const previousSuspension = suspension;
    const current = () => generation === token && context === target;
    const task = (async () => {
      await resumed;
      if (previousSuspension) {
        await previousSuspension;
        if (current() && !blocked() && target.state !== 'running') await target.resume();
      }
      if (!current() || blocked()) return;
      if (target.state !== 'running') {
        if (revision !== intent || suspension) return;
        throw new Error('AudioContext did not resume');
      }
      if (!engine) {
        const module = await loadEngine();
        if (!current() || blocked()) return;
        let created: GameAudioEngine | undefined;
        let rejected = false;
        created = module.createGameAudioEngine(target, preferences, scene, () => {
          if (!current() || (created && engine !== created)) return;
          rejected = true;
          failed = true;
          discardEngine();
          pause();
        });
        engine = created;
        if (rejected) discardEngine();
      }
      if (suspension) await suspension;
      if (current() && !blocked() && target.state !== 'running' && revision === intent)
        throw new Error('AudioContext is suspended');
    })()
      .catch(() => {
        if (current()) {
          failed = true;
          pause();
        }
      })
      .finally(() => {
        if (!current()) return;
        pending = null;
        publish();
        if (!blocked() && !failed && (!engine || target.state !== 'running'))
          void activate(false, false);
      });
    pending = task;
    publish();
    return task;
  }

  const unlock = () => activate(true, true);
  const pointer: EventListener = (event) => {
    const input = event as PointerEvent;
    if ((input.button === undefined || input.button === 0) && input.isPrimary !== false)
      void unlock();
  };
  const key: EventListener = (event) => {
    const input = event as KeyboardEvent;
    if (
      !input.repeat &&
      !input.ctrlKey &&
      !input.metaKey &&
      !input.altKey &&
      !['Shift', 'Control', 'Alt', 'Meta'].includes(input.key)
    )
      void unlock();
  };
  const visibility = () => {
    intent++;
    if (blocked()) pause();
    else void activate(false, true);
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      if (++starts === 1) {
        events?.addEventListener('pointerdown', pointer);
        events?.addEventListener('keydown', key);
        page?.addEventListener('visibilitychange', visibility);
        publish();
      }
      let stopped = false;
      return () => {
        if (stopped) return;
        stopped = true;
        if (--starts) return;
        events?.removeEventListener('pointerdown', pointer);
        events?.removeEventListener('keydown', key);
        page?.removeEventListener('visibilitychange', visibility);
        discardContext();
        failed = false;
        publish();
      };
    },
    unlock,
    setPreferences(patch) {
      const next = sanitizeAudioPreferences(patch, preferences);
      if (
        next.muted === preferences.muted &&
        next.musicVolume === preferences.musicVolume &&
        next.effectsVolume === preferences.effectsVolume
      )
        return;
      const changedMute = next.muted !== preferences.muted;
      preferences = next;
      saveAudioPreferences(preferences, storage);
      callEngine((target) => target.setPreferences(preferences));
      if (changedMute) {
        intent++;
        if (blocked()) pause();
        else void activate(false, true);
      }
      publish();
    },
    setScene(next) {
      if (
        Object.keys(next).every(
          (key) => next[key as keyof AudioScene] === scene[key as keyof AudioScene],
        )
      )
        return;
      scene = { ...next };
      callEngine((target) => target.setScene(scene));
      publish();
    },
    play(cue) {
      if (!blocked() && engineActive && context?.state === 'running') {
        callEngine((target) => target.play(cue));
        publish();
      }
    },
  };
}
