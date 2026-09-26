import {
  advanceDemoDay,
  ADVENTURE_STORAGE_KEYS,
  capturePet as captureAdventurePet,
  changeRegion,
  collectSeal,
  createAdventure,
  getUnlockedRegions,
  sanitizeAdventure,
  selectCompanion,
  visitAdventure,
  type Adventure,
  type PetId,
  type RegionId,
} from './adventure';
import {
  collectCrystal,
  createExploration,
  EXPLORATION_STORAGE_KEYS,
  openTreasure as openExpeditionTreasure,
  resetExpedition,
  sanitizeExploration,
  type Exploration,
} from './exploration';
import {
  completeMission,
  createInitialProgress,
  getTodayKey,
  sanitizeProgress,
  STORAGE_KEYS,
  type MissionResult,
  type Mode,
  type Progress,
} from './progress';
import {
  completeTemple,
  createTempleProgress,
  sanitizeTempleProgress,
  TEMPLE_STORAGE_KEYS,
  type TempleProgress,
} from './temple';
import {
  createDiscoveryProgress,
  DISCOVERY_STORAGE_KEYS,
  investigateDiscovery as investigateDiscoverySite,
  sanitizeDiscoveryProgress,
  type DiscoveryProgress,
  type DiscoveryResult,
} from './discovery';
import {
  createFieldProgress,
  FIELD_STORAGE_KEYS,
  recordMeadowRace,
  recordWildlife,
  sanitizeFieldProgress,
  type FieldProgress,
  type FieldResult,
  type WildlifeResult,
} from './fieldActivities';
import type { WorldPoint } from './world';
import {
  createWorldSurvey,
  sanitizeWorldSurvey,
  SURVEY_STORAGE_KEYS,
  surveyPosition,
  type SurveyResult,
  type WorldSurvey,
} from './worldSurvey';

/** The session needs only these two methods; browser Storage and test stores both fit. */
export interface GameStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface GameSnapshot {
  readonly mode: Mode;
  readonly progress: Progress;
  readonly expedition: Exploration;
  readonly adventure: Adventure;
  readonly templeProgress: TempleProgress;
  readonly discovery: DiscoveryProgress;
  readonly field: FieldProgress;
  readonly survey: WorldSurvey;
  readonly today: string;
  readonly storageWarning: boolean;
}

export interface GameSessionOptions {
  mode?: Mode;
  /** A getter also supports storage becoming available again without recreating the session. */
  storage?: GameStorage | null | (() => GameStorage | null);
  today?: () => string;
}

export interface GameSession {
  getSnapshot(): GameSnapshot;
  subscribe(listener: () => void): () => void;
  load(): GameSnapshot;
  refresh(): GameSnapshot;
  /** Ignores unrelated keys and inactive-mode events. null represents localStorage.clear(). */
  refreshFromStorage(key: string | null): GameSnapshot;
  switchMode(mode: Mode): GameSnapshot;
  checkin(missionId: string): MissionResult;
  collect(
    id: number,
    expectedRegion?: RegionId,
  ): { collected: boolean; region: RegionId; count: number };
  openTreasure(): { state: Exploration; opened: boolean };
  newExpedition(): Exploration;
  resetDemo(): boolean;
  simulateTomorrow(): Adventure;
  enterRegion(id: RegionId): { entered: boolean; state: Adventure };
  capturePet(id: PetId): { captured: boolean; state: Adventure };
  choosePet(id: PetId | null): { chosen: boolean; state: Adventure };
  claimTemple(region: RegionId): { completed: boolean; state: TempleProgress };
  investigateDiscovery(id: string, position: WorldPoint, expectedRegion: RegionId): DiscoveryResult;
  recordWildlife(species: string, expectedRegion: RegionId): WildlifeResult;
  recordMeadowRace(seconds: number, expectedRegion: RegionId): FieldResult;
  recordSurvey(position: WorldPoint, expectedRegion: RegionId, expectedMode: Mode): SurveyResult;
}

const keysByStore = {
  progress: STORAGE_KEYS,
  expedition: EXPLORATION_STORAGE_KEYS,
  adventure: ADVENTURE_STORAGE_KEYS,
  templeProgress: TEMPLE_STORAGE_KEYS,
  discovery: DISCOVERY_STORAGE_KEYS,
  field: FIELD_STORAGE_KEYS,
  survey: SURVEY_STORAGE_KEYS,
} as const;
type StoreName = keyof typeof keysByStore;
const storeNames = Object.keys(keysByStore) as StoreName[];
export const GAME_STORAGE_KEYS: readonly string[] = Object.values(keysByStore).flatMap((keys) => [
  keys.real,
  keys.demo,
]);
export const isGameStorageKey = (key: string | null): boolean =>
  key === null || GAME_STORAGE_KEYS.includes(key);

interface Entry<T> {
  value: T;
  serialized: string;
  dirty: boolean;
}
interface Bundle {
  progress: Entry<Progress>;
  expedition: Entry<Exploration>;
  adventure: Entry<Adventure>;
  templeProgress: Entry<TempleProgress>;
  discovery: Entry<DiscoveryProgress>;
  field: Entry<FieldProgress>;
  survey: Entry<WorldSurvey>;
}
const entry = <T>(value: T): Entry<T> => ({
  value,
  serialized: JSON.stringify(value),
  dirty: false,
});

function browserStorage(): GameStorage | null {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

/**
 * Synchronous application service. Domain transitions stay pure, while this layer owns
 * persistence, cross-tab refreshes, per-mode unsaved state, and stable subscriptions.
 * A failed write keeps the in-memory value authoritative until a later retry succeeds.
 */
export function createGameSession(options: GameSessionOptions = {}): GameSession {
  let mode = options.mode ?? 'real';
  const todayKey = options.today ?? getTodayKey;
  const storageSource = options.storage === undefined ? browserStorage : options.storage;
  const bundles = new Map<Mode, Bundle>();
  const listeners = new Set<() => void>();
  let today = todayKey();
  let storageWarning = false;

  function bundleFor(targetMode: Mode): Bundle {
    let bundle = bundles.get(targetMode);
    if (!bundle) {
      bundle = {
        progress: entry(createInitialProgress(targetMode)),
        expedition: entry(createExploration(targetMode)),
        adventure: entry(createAdventure(targetMode)),
        templeProgress: entry(createTempleProgress(targetMode)),
        discovery: entry(createDiscoveryProgress(targetMode)),
        field: entry(createFieldProgress(targetMode)),
        survey: entry(createWorldSurvey(targetMode)),
      };
      bundles.set(targetMode, bundle);
    }
    return bundle;
  }

  /** Equivalent values keep their existing reference and never become a new write. */
  function replace<T>(target: Entry<T>, value: T, dirty: boolean): boolean {
    const serialized = JSON.stringify(value);
    if (serialized === target.serialized) return false;
    target.value = value;
    target.serialized = serialized;
    target.dirty = dirty;
    return true;
  }

  function makeSnapshot(): GameSnapshot {
    const bundle = bundleFor(mode);
    return {
      mode,
      progress: bundle.progress.value,
      expedition: bundle.expedition.value,
      adventure: bundle.adventure.value,
      templeProgress: bundle.templeProgress.value,
      discovery: bundle.discovery.value,
      field: bundle.field.value,
      survey: bundle.survey.value,
      today,
      storageWarning,
    };
  }
  let snapshot = makeSnapshot();

  function publish(): void {
    const next = makeSnapshot();
    if (
      Object.keys(next).every(
        (key) => next[key as keyof GameSnapshot] === snapshot[key as keyof GameSnapshot],
      )
    )
      return;
    snapshot = next;
    for (const listener of [...listeners]) listener();
  }

  function resolveStorage(): GameStorage | null {
    try {
      return typeof storageSource === 'function' ? storageSource() : storageSource;
    } catch {
      return null;
    }
  }

  /** One transaction reads fresh saves, applies a command, flushes changes once, and notifies once. */
  function transact<T>(command: (bundle: Bundle) => T): T {
    const storage = resolveStorage();
    let readFailed = storage === null;
    const bundle = bundleFor(mode);
    today = todayKey();
    function read<TValue>(
      target: Entry<TValue>,
      key: string,
      decode: (value: unknown) => TValue,
      migrated?: (stored: unknown, decoded: TValue) => boolean,
    ): void {
      if (target.dirty || !storage) return;
      let raw: string | null;
      try {
        raw = storage.getItem(key);
      } catch {
        readFailed = true;
        return;
      }
      let parsed: unknown = null;
      try {
        parsed = raw === null ? null : JSON.parse(raw);
      } catch {
        /* The domain sanitizer recovers malformed JSON exactly like the legacy loaders. */
      }
      const decoded = decode(parsed);
      replace(target, decoded, false);
      if (migrated?.(parsed, decoded)) target.dirty = true;
    }
    read(bundle.progress, STORAGE_KEYS[mode], (value) => sanitizeProgress(value, mode));
    read(bundle.expedition, EXPLORATION_STORAGE_KEYS[mode], (value) =>
      sanitizeExploration(value, mode),
    );
    // Supply check-in dates before checking region unlocks. Sanitizing first without
    // those dates would permanently discard pets/seals from migrated older saves.
    read(
      bundle.adventure,
      ADVENTURE_STORAGE_KEYS[mode],
      (value) => sanitizeAdventure(value, mode, bundle.progress.value),
      (stored, decoded) =>
        JSON.stringify(sanitizeAdventure(stored, mode)) !== JSON.stringify(decoded),
    );
    read(bundle.templeProgress, TEMPLE_STORAGE_KEYS[mode], (value) =>
      sanitizeTempleProgress(value, mode),
    );
    read(bundle.discovery, DISCOVERY_STORAGE_KEYS[mode], (value) =>
      sanitizeDiscoveryProgress(value, mode),
    );
    read(bundle.field, FIELD_STORAGE_KEYS[mode], (value) => sanitizeFieldProgress(value, mode));
    read(bundle.survey, SURVEY_STORAGE_KEYS[mode], (value) => sanitizeWorldSurvey(value, mode));
    // Migration and today's arrival are real changes; another same-day refresh is a no-op.
    replace(
      bundle.adventure,
      visitAdventure(bundle.adventure.value, bundle.progress.value, today),
      true,
    );

    const result = command(bundle);
    // Failed data in either mode remains in its own bundle and is retried under its own key.
    for (const [savedMode, savedBundle] of bundles) {
      for (const storeName of storeNames) {
        const pending = savedBundle[storeName];
        if (!pending.dirty || !storage) continue;
        try {
          storage.setItem(keysByStore[storeName][savedMode], pending.serialized);
          pending.dirty = false;
        } catch {
          /* Keep the latest unsaved value across refreshes and mode switches. */
        }
      }
    }
    storageWarning =
      readFailed ||
      [...bundles.values()].some((saved) => storeNames.some((name) => saved[name].dirty));
    publish();
    return result;
  }

  const refresh = (): GameSnapshot => {
    transact(() => undefined);
    return snapshot;
  };
  const session: GameSession = {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    load: refresh,
    refresh,
    refreshFromStorage(key) {
      if (
        !isGameStorageKey(key) ||
        (key !== null && !storeNames.some((name) => keysByStore[name][mode] === key))
      )
        return snapshot;
      return refresh();
    },
    switchMode(next) {
      mode = next;
      return refresh();
    },
    checkin(missionId) {
      return transact((bundle) => {
        const result = completeMission(bundle.progress.value, missionId, today);
        replace(bundle.progress, result.progress, true);
        return { ...result, progress: bundle.progress.value };
      });
    },
    collect(id, expectedRegion) {
      return transact((bundle) => {
        const region = bundle.adventure.value.currentRegion;
        let collected = false;
        if (
          (expectedRegion === undefined || expectedRegion === region) &&
          (id === 0 || id === 1 || id === 2)
        ) {
          if (region === 'meadow') {
            const result = collectCrystal(bundle.expedition.value, id);
            replace(bundle.expedition, result.state, true);
            collected = result.collected;
          } else {
            const result = collectSeal(bundle.adventure.value, id);
            replace(bundle.adventure, result.state, true);
            collected = result.collected;
          }
        }
        return {
          collected,
          region,
          count:
            region === 'meadow'
              ? bundle.expedition.value.crystals.length
              : bundle.adventure.value.seals[region].length,
        };
      });
    },
    openTreasure() {
      return transact((bundle) => {
        const result = openExpeditionTreasure(bundle.expedition.value);
        replace(bundle.expedition, result.state, true);
        return { ...result, state: bundle.expedition.value };
      });
    },
    newExpedition() {
      return transact((bundle) => {
        replace(bundle.expedition, resetExpedition(bundle.expedition.value), true);
        return bundle.expedition.value;
      });
    },
    resetDemo() {
      return transact((bundle) => {
        if (mode !== 'demo') return false;
        const progress = createInitialProgress('demo');
        replace(bundle.progress, progress, true);
        replace(bundle.expedition, createExploration('demo'), true);
        replace(bundle.templeProgress, createTempleProgress('demo'), true);
        replace(bundle.discovery, createDiscoveryProgress('demo'), true);
        replace(bundle.field, createFieldProgress('demo'), true);
        replace(bundle.survey, createWorldSurvey('demo'), true);
        replace(
          bundle.adventure,
          visitAdventure(createAdventure('demo', progress), progress, today),
          true,
        );
        return true;
      });
    },
    simulateTomorrow() {
      return transact((bundle) => {
        replace(bundle.adventure, advanceDemoDay(bundle.adventure.value), true);
        return bundle.adventure.value;
      });
    },
    enterRegion(id) {
      return transact((bundle) => {
        replace(bundle.adventure, changeRegion(bundle.adventure.value, id), true);
        return {
          entered: bundle.adventure.value.currentRegion === id,
          state: bundle.adventure.value,
        };
      });
    },
    capturePet(id) {
      return transact((bundle) => {
        const result = captureAdventurePet(bundle.adventure.value, id);
        replace(bundle.adventure, result.state, true);
        return { ...result, state: bundle.adventure.value };
      });
    },
    choosePet(id) {
      return transact((bundle) => {
        replace(bundle.adventure, selectCompanion(bundle.adventure.value, id), true);
        return { chosen: bundle.adventure.value.activePet === id, state: bundle.adventure.value };
      });
    },
    claimTemple(region) {
      return transact((bundle) => {
        if (
          region !== bundle.adventure.value.currentRegion ||
          !getUnlockedRegions(bundle.adventure.value).includes(region)
        ) {
          return { completed: false, state: bundle.templeProgress.value };
        }
        const result = completeTemple(bundle.templeProgress.value, region);
        replace(bundle.templeProgress, result.state, true);
        return { ...result, state: bundle.templeProgress.value };
      });
    },
    investigateDiscovery(id, position, expectedRegion) {
      return transact((bundle) => {
        const region = bundle.adventure.value.currentRegion;
        if (region !== expectedRegion)
          return {
            state: bundle.discovery.value,
            changed: false,
            message: '你已经前往另一片地区，请在当前场景重新调查。',
          };
        const result = investigateDiscoverySite(
          bundle.discovery.value,
          id,
          position,
          today,
          region,
        );
        replace(bundle.discovery, result.state, true);
        return { ...result, state: bundle.discovery.value };
      });
    },
    recordWildlife(species, expectedRegion) {
      return transact((bundle) => {
        const region = bundle.adventure.value.currentRegion;
        if (region !== expectedRegion)
          return { state: bundle.field.value, changed: false, completed: false };
        const result = recordWildlife(bundle.field.value, species, region);
        replace(bundle.field, result.state, true);
        return { ...result, state: bundle.field.value };
      });
    },
    recordMeadowRace(seconds, expectedRegion) {
      return transact((bundle) => {
        const region = bundle.adventure.value.currentRegion;
        if (region !== expectedRegion) return { state: bundle.field.value, changed: false };
        const result = recordMeadowRace(bundle.field.value, seconds, region);
        replace(bundle.field, result.state, true);
        return { ...result, state: bundle.field.value };
      });
    },
    recordSurvey(position, expectedRegion, expectedMode) {
      // Telemetry repeats while idle: skip storage reads/serialization for charted ground.
      // A warning bypasses this fast path so pending saves still get a chance to recover.
      const preview = surveyPosition(bundleFor(mode).survey.value, expectedRegion, position);
      if (!preview.changed && !storageWarning) return preview;
      return transact((bundle) => {
        if (
          mode !== expectedMode ||
          bundle.adventure.value.currentRegion !== expectedRegion ||
          !getUnlockedRegions(bundle.adventure.value).includes(expectedRegion)
        )
          return { state: bundle.survey.value, changed: false, newPlaces: [] };
        const result = surveyPosition(bundle.survey.value, expectedRegion, position);
        if (result.changed) replace(bundle.survey, result.state, true);
        return { ...result, state: bundle.survey.value };
      });
    },
  };
  refresh();
  return session;
}
