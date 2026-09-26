/** Cache immutable JS modules, never scene instances or GPU resources. */
export function createModuleLoader<K extends string, V>(loaders: Record<K, () => Promise<V>>) {
  const resolved = new Map<K, V>();
  const pending = new Map<K, Promise<V>>();

  function load(key: K): Promise<V> {
    if (resolved.has(key)) return Promise.resolve(resolved.get(key)!);
    const existing = pending.get(key);
    if (existing) return existing;
    if (!Object.prototype.hasOwnProperty.call(loaders, key)) {
      return Promise.reject(new Error(`Unknown module: ${key}`));
    }
    const request = Promise.resolve()
      .then(() => loaders[key]())
      .then(
        (module) => {
          resolved.set(key, module);
          pending.delete(key);
          return module;
        },
        (error) => {
          pending.delete(key);
          throw error;
        },
      );
    pending.set(key, request);
    return request;
  }

  return {
    load,
    peek: (key: K): V | undefined => resolved.get(key),
    // Intentional prefetch is best effort. A failure must not poison a later visit.
    preload: (key: K): void => {
      void load(key).catch(() => undefined);
    },
  };
}
