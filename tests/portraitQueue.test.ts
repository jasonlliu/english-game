import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPortraitQueue } from '../src/rendering/portraits/queue';

const limits = { maxEntries: 2, maxBytes: 32, sizeOf: (value: string) => value.length };
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 5));

test('simultaneous portrait consumers share work and different pets render serially', async () => {
  const started: string[] = [];
  const finishes: Array<() => void> = [];
  let active = 0,
    peak = 0,
    idle = 0;
  const queue = createPortraitQueue<string, string>({
    ...limits,
    onIdle: () => {
      idle++;
    },
    render: (input) =>
      new Promise((resolve) => {
        started.push(input);
        active++;
        peak = Math.max(peak, active);
        finishes.push(() => {
          active--;
          resolve(input);
        });
      }),
  });
  const first = queue.request('ember', 'ember');
  const duplicate = queue.request('ember', 'ember');
  const other = queue.request('lumi', 'lumi');
  await tick();
  assert.deepEqual(started, ['ember']);
  finishes.shift()!();
  await tick();
  assert.deepEqual(started, ['ember', 'lumi']);
  finishes.shift()!();
  assert.deepEqual(await Promise.all([first, duplicate, other]), ['ember', 'ember', 'lumi']);
  assert.equal(peak, 1);
  assert.equal(idle, 1, 'The batch releases its renderer only after all queued jobs finish');
});

test('portrait cache uses recent reads and evicts its oldest entry at the entry limit', async () => {
  const calls: string[] = [];
  const queue = createPortraitQueue<string, string>({
    ...limits,
    render: (key) => {
      calls.push(key);
      return key;
    },
  });
  for (const key of ['a', 'b', 'a', 'c', 'a', 'b']) await queue.request(key, key);
  assert.deepEqual(calls, ['a', 'b', 'c', 'b']);
});

test('byte limits evict cached portraits and oversized images never enter the cache', async () => {
  const calls: string[] = [];
  const queue = createPortraitQueue<string, string>({
    ...limits,
    maxEntries: 10,
    maxBytes: 6,
    render: (value) => {
      calls.push(value);
      return value;
    },
  });
  for (const key of ['abc', 'def', 'abc', 'ghi', 'def', 'oversized', 'oversized'])
    await queue.request(key, key);
  assert.deepEqual(calls, ['abc', 'def', 'ghi', 'def', 'oversized', 'oversized']);
});

test('failed rendering rejects all subscribers, releases resources and permits a fresh retry', async () => {
  let attempts = 0,
    idle = 0;
  const queue = createPortraitQueue<string, string>({
    ...limits,
    onIdle: () => {
      idle++;
    },
    render: (value) => {
      if (++attempts === 1) throw new Error('WebGL unavailable');
      return value;
    },
  });
  const results = await Promise.allSettled([
    queue.request('pet', 'image'),
    queue.request('pet', 'image'),
  ]);
  assert.ok(results.every((result) => result.status === 'rejected'));
  assert.equal(await queue.request('pet', 'image'), 'image');
  assert.equal(await queue.request('pet', 'image'), 'image');
  assert.equal(attempts, 2);
  assert.equal(idle, 2);
});

test('unmounting one consumer preserves shared work, while completely cancelled queued work is skipped', async () => {
  const calls: string[] = [];
  const queue = createPortraitQueue<string, string>({
    ...limits,
    render: (value) => {
      calls.push(value);
      return value;
    },
  });
  const first = new AbortController(),
    offscreen = new AbortController();
  const cancelled = queue.request('same', 'same', first.signal);
  const kept = queue.request('same', 'same');
  const removed = queue.request('hidden', 'hidden', offscreen.signal);
  first.abort();
  offscreen.abort();
  const results = await Promise.allSettled([cancelled, kept, removed]);
  assert.deepEqual(
    results.map((result) => result.status),
    ['rejected', 'fulfilled', 'rejected'],
  );
  for (const result of [results[0], results[2]])
    if (result.status === 'rejected') assert.equal(result.reason.name, 'AbortError');
  assert.deepEqual(calls, ['same']);
  assert.equal(await queue.request('hidden', 'hidden'), 'hidden');
});

test('cancelling an active portrait avoids caching its unused result and still releases the renderer', async () => {
  const abort = new AbortController();
  let finish: ((value: string) => void) | undefined;
  let attempts = 0,
    idle = 0;
  const queue = createPortraitQueue<string, string>({
    ...limits,
    onIdle: () => {
      idle++;
    },
    render: () => {
      attempts++;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  const result = queue.request('pet', 'pet', abort.signal);
  const settled = Promise.allSettled([result]);
  await tick();
  abort.abort();
  finish!('unused');
  await settled;
  await tick();
  assert.equal(idle, 1);
  const retry = queue.request('pet', 'pet');
  await tick();
  finish!('fresh');
  assert.equal(await retry, 'fresh');
  assert.equal(attempts, 2);
  const before = attempts;
  await assert.rejects(queue.request('pet', 'pet', abort.signal), { name: 'AbortError' });
  assert.equal(attempts, before);
});
