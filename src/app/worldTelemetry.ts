import type { FlightStatus } from '../game/flight';
import { SPAWN_POSITION } from '../game/worldLayout';
export interface WorldPosition {
  x: number;
  z: number;
  heading: number;
}
function channel<T>(initial: T, equal: (a: T, b: T) => boolean) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => value,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set: (next: T) => {
      if (equal(value, next)) return;
      value = { ...next };
      listeners.forEach((listener) => listener());
    },
  };
}
/** High-frequency renderer telemetry never mutates the persistent game session. */
export function createWorldTelemetry() {
  return {
    position: channel<WorldPosition>(
      { ...SPAWN_POSITION, heading: 0 },
      (a, b) => a.x === b.x && a.z === b.z && a.heading === b.heading,
    ),
    flight: channel<FlightStatus>(
      { flying: false, landing: false, altitude: 0 },
      (a, b) => a.flying === b.flying && a.landing === b.landing && a.altitude === b.altitude,
    ),
  };
}
