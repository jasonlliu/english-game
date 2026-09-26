import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldTelemetry } from '../src/app/worldTelemetry.ts';
test('movement only notifies minimap subscribers, not flight or session consumers', () => {
  const telemetry = createWorldTelemetry();
  let positions = 0,
    flights = 0;
  const unsubscribe = telemetry.position.subscribe(() => positions++);
  telemetry.flight.subscribe(() => flights++);
  const next = { x: 1, z: 2, heading: 0 };
  telemetry.position.set(next);
  const snapshot = telemetry.position.getSnapshot();
  telemetry.position.set({ ...next });
  assert.equal(positions, 1);
  assert.equal(flights, 0);
  assert.equal(telemetry.position.getSnapshot(), snapshot);
  next.x = 100;
  assert.equal(snapshot.x, 1);
  unsubscribe();
  telemetry.position.set({ x: 2, z: 3, heading: 0 });
  assert.equal(positions, 1);
});
