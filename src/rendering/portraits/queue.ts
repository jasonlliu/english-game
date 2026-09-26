interface Subscriber<T> {
  resolve(value: T): void;
  reject(reason: unknown): void;
  detach(): void;
}
interface Job<Input, Output> {
  key: string;
  input: Input;
  subscribers: Set<Subscriber<Output>>;
}
interface QueueOptions<Input, Output> {
  render(input: Input): Output | Promise<Output>;
  /** Release the shared renderer after a batch, including failed batches. */
  onIdle?(): void;
  maxEntries: number;
  maxBytes: number;
  sizeOf(value: Output): number;
}
const aborted = () => new DOMException('Portrait request cancelled', 'AbortError');
/** Serial work, independently cancellable subscribers, and a bounded LRU cache. */
export function createPortraitQueue<Input, Output>(options: QueueOptions<Input, Output>) {
  const cache = new Map<
    string,
    {
      value: Output;
      bytes: number;
    }
  >();
  const jobs = new Map<string, Job<Input, Output>>();
  const queued: Job<Input, Output>[] = [];
  let cacheBytes = 0;
  let draining = false;
  function remember(key: string, value: Output) {
    const bytes = options.sizeOf(value);
    if (!Number.isFinite(bytes) || bytes < 0 || bytes > options.maxBytes || options.maxEntries < 1)
      return;
    const previous = cache.get(key);
    if (previous) cacheBytes -= previous.bytes;
    cache.delete(key);
    cache.set(key, { value, bytes });
    cacheBytes += bytes;
    while (cache.size > options.maxEntries || cacheBytes > options.maxBytes) {
      const oldest = cache.keys().next().value!;
      cacheBytes -= cache.get(oldest)!.bytes;
      cache.delete(oldest);
    }
  }
  async function drain() {
    try {
      while (queued.length) {
        const job = queued.shift()!;
        if (!job.subscribers.size) {
          jobs.delete(job.key);
          continue;
        }
        try {
          const value = await options.render(job.input);
          if (job.subscribers.size) remember(job.key, value);
          for (const subscriber of job.subscribers) {
            subscriber.detach();
            subscriber.resolve(value);
          }
        } catch (error) {
          for (const subscriber of job.subscribers) {
            subscriber.detach();
            subscriber.reject(error);
          }
        } finally {
          job.subscribers.clear();
          jobs.delete(job.key);
        }
        // Let input and React paints run between expensive model builds.
        if (queued.length) await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    } finally {
      draining = false;
      try {
        options.onIdle?.();
      } catch {
        /* A cleanup failure must not poison future requests. */
      }
    }
  }
  function request(key: string, input: Input, signal?: AbortSignal): Promise<Output> {
    if (signal?.aborted) return Promise.reject(aborted());
    const hit = cache.get(key);
    if (hit) {
      cache.delete(key);
      cache.set(key, hit);
      return Promise.resolve(hit.value);
    }
    let job = jobs.get(key);
    if (!job) {
      job = { key, input, subscribers: new Set() };
      jobs.set(key, job);
      queued.push(job);
    }
    const target = job;
    const result = new Promise<Output>((resolve, reject) => {
      const cancel = () => {
        target.subscribers.delete(subscriber);
        subscriber.detach();
        reject(aborted());
      };
      const subscriber: Subscriber<Output> = {
        resolve,
        reject,
        detach: () => signal?.removeEventListener('abort', cancel),
      };
      target.subscribers.add(subscriber);
      signal?.addEventListener('abort', cancel, { once: true });
    });
    if (!draining) {
      draining = true;
      queueMicrotask(() => {
        void drain();
      });
    }
    return result;
  }
  return { request };
}
