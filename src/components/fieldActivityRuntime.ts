import {
  createRaceRun,
  stepRaceRun,
  RACE_START,
  RACE_DURATION,
  RACE_GATES,
  RACE_GATE_RADIUS,
  createObservationRun,
  stepObservation,
  type RaceRun,
  type FieldProgress,
  type FieldSpecies,
} from '../game/fieldActivities';
import type { WorldPoint } from '../game/worldLayout';
import type { WildlifeObservation } from '../rendering/scenery/types';
import type { SoundCue } from '../audio/types';

export interface FieldActivityView {
  nearStart: boolean;
  race: { status: RaceRun['status']; nextGate: number; elapsed: number; direction: string } | null;
  animal: {
    id: string;
    kind: FieldSpecies;
    recorded: boolean;
    startled: boolean;
    progress: number;
  } | null;
}
export const EMPTY_FIELD_VIEW: FieldActivityView = { nearStart: false, race: null, animal: null };
interface Context {
  position: WorldPoint;
  speed: number;
  viewYaw: number;
  paused: boolean;
  flying: boolean;
  jumping: boolean;
  field?: FieldProgress;
  wildlife: readonly WildlifeObservation[];
}
interface Options {
  read(): Context;
  publish(view: FieldActivityView): void;
  stopMovement(): void;
  sound(cue: SoundCue): void;
  observed(kind: FieldSpecies): void;
  finished(seconds: number): void;
}

/** Scene-local activity state. Persistence belongs to the application session. */
export function createFieldActivityRuntime(options: Options) {
  let race: RaceRun | null = null;
  let observation = createObservationRun();
  let observing = false;
  let publication = '';
  let finishedAge = 0;
  let lastAnimal: WildlifeObservation | null = null;
  const start = () => {
    const c = options.read();
    if (
      c.paused ||
      c.flying ||
      c.jumping ||
      !c.field ||
      Math.hypot(c.position.x - RACE_START.x, c.position.z - RACE_START.z) > 10
    )
      return;
    options.stopMovement();
    observing = false;
    observation = createObservationRun();
    race = createRaceRun(c.position);
    finishedAge = 0;
    options.sound('ui');
  };
  const holdObservation = (held: boolean) => {
    const c = options.read();
    observing = held && !!c.field && !c.paused && !c.flying && race?.status !== 'running';
    if (observing) options.stopMovement();
    else {
      observation = createObservationRun();
      lastAnimal = null;
    }
  };
  return {
    start,
    holdObservation,
    cancel() {
      race = null;
      observation = createObservationRun();
      observing = false;
    },
    getRace() {
      return race;
    },
    update(delta: number) {
      const c = options.read();
      if (!c.field) {
        race = null;
        observation = createObservationRun();
        observing = false;
        lastAnimal = null;
        if (publication) {
          publication = '';
          options.publish(EMPTY_FIELD_VIEW);
        }
        return;
      }
      if (c.paused) observing = false;
      if (race) {
        const result = stepRaceRun(race, {
          position: c.position,
          delta,
          paused: c.paused,
          flying: c.flying,
        });
        race = result.state;
        if (result.event === 'gate') options.sound('collect');
        if (result.completed) options.finished(result.completed.seconds);
        if (result.event === 'timed-out' || result.event === 'cancelled') options.sound('mistake');
        if (race.status !== 'running' && !c.paused) {
          finishedAge += Math.max(0, Math.min(delta, 0.05));
          if (finishedAge > 8) race = null;
        }
      }
      let animal: WildlifeObservation | null = null;
      if (!c.paused && !c.flying && !c.jumping && race?.status !== 'running') {
        // Keep the same animal in view during a hold, instead of switching subjects mid-observation.
        if (observing && observation.targetId)
          animal =
            c.wildlife.find(
              (a) =>
                a.id === observation.targetId &&
                Math.hypot(a.x - c.position.x, a.z - c.position.z) <= 9,
            ) ?? null;
        else {
          let best = Infinity;
          for (const a of c.wildlife) {
            const d = Math.hypot(a.x - c.position.x, a.z - c.position.z);
            // A newly seen species takes precedence over a familiar neighbour.
            const score = d + (c.field.observed.includes(a.kind) ? 3 : 0);
            if (d <= 9 && score < best) {
              best = score;
              animal = a;
            }
          }
        }
      }
      lastAnimal = animal;
      const result = stepObservation(observation, {
        candidateId: animal && !c.field.observed.includes(animal.kind) ? animal.id : null,
        speed: c.speed,
        delta,
        paused: c.paused,
        startled: animal?.startled ?? false,
        requested: observing && !c.flying && !c.jumping,
      });
      observation = result.state;
      if (result.completedId && animal) {
        observing = false;
        options.observed(animal.kind);
      }
      const next = race?.status === 'running' ? RACE_GATES[race.nextGate] : null;
      const angle = next
        ? Math.atan2(
            Math.sin(
              Math.atan2(next.x - c.position.x, next.z - c.position.z) - c.viewYaw - Math.PI,
            ),
            Math.cos(
              Math.atan2(next.x - c.position.x, next.z - c.position.z) - c.viewYaw - Math.PI,
            ),
          )
        : 0;
      const direction = next
        ? race?.nextGate === 0 &&
          Math.hypot(next.x - c.position.x, next.z - c.position.z) <= RACE_GATE_RADIUS
          ? '先走出脚下光环，再穿回来'
          : `${Math.abs(angle) > 2 ? '身后' : Math.abs(angle) < 0.5 ? '前方' : angle > 0 ? '左侧' : '右侧'} · ${Math.round(Math.hypot(next.x - c.position.x, next.z - c.position.z))} 米`
        : '';
      const view: FieldActivityView = {
        nearStart:
          !c.flying && Math.hypot(c.position.x - RACE_START.x, c.position.z - RACE_START.z) <= 10,
        race: race
          ? {
              status: race.status,
              nextGate: race.nextGate,
              elapsed:
                race.status === 'running'
                  ? Math.min(RACE_DURATION, Math.floor(race.elapsed * 10) / 10)
                  : Math.round(race.elapsed * 100) / 100,
              direction,
            }
          : null,
        animal: animal
          ? {
              id: animal.id,
              kind: animal.kind,
              recorded: c.field.observed.includes(animal.kind),
              startled: animal.startled,
              progress: Math.floor(observation.elapsed * 10) / 10,
            }
          : null,
      };
      const key = JSON.stringify(view);
      if (key !== publication) {
        publication = key;
        options.publish(view);
      }
    },
    subject() {
      return observing ? lastAnimal : null;
    },
  };
}
