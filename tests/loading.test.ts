import test from 'node:test';
import assert from 'node:assert/strict';
import { createModuleLoader } from '../src/loading/createModuleLoader.ts';

test('loading one region never loads another, and concurrent consumers share one request', async () => {
  let firstCalls = 0,
    otherCalls = 0;
  let release!: (value: object) => void;
  const loader = createModuleLoader({
    first: () => {
      firstCalls++;
      return new Promise<object>((resolve) => {
        release = resolve;
      });
    },
    other: async () => {
      otherCalls++;
      return {};
    },
  });
  const first = loader.load('first');
  const duplicate = loader.load('first');
  assert.equal(first, duplicate);
  await Promise.resolve();
  const module = { create: () => ({ disposed: false }) };
  release(module);
  assert.equal(await first, module);
  assert.equal(await loader.load('first'), module);
  assert.equal(loader.peek('first'), module);
  assert.equal(firstCalls, 1);
  assert.equal(otherCalls, 0);
});

test('a failed prefetch or load is evicted and can be retried', async () => {
  let calls = 0;
  const loader = createModuleLoader({
    scene: async () => {
      if (++calls === 1) throw new Error('offline');
      return { ready: true };
    },
  });
  await assert.rejects(loader.load('scene'), /offline/);
  assert.equal(loader.peek('scene'), undefined);
  assert.deepEqual(await loader.load('scene'), { ready: true });
  assert.equal(calls, 2);
});

test('synchronous loader failures do not leave a stuck in-flight entry', async () => {
  let calls = 0;
  const loader = createModuleLoader({
    scene: () => {
      if (++calls === 1) throw new Error('sync failure');
      return Promise.resolve('ready');
    },
  });
  await assert.rejects(loader.load('scene'), /sync failure/);
  assert.equal(await loader.load('scene'), 'ready');
});

test('unknown module IDs reject without invoking inherited object methods', async () => {
  const loader = createModuleLoader({ scene: async () => 'ready' });
  await assert.rejects(loader.load('toString' as 'scene'), /Unknown module/);
});
