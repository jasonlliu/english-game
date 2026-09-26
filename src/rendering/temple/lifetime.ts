/** Register cleanup as each resource is created, so partial initialization is safe. */
export function createTempleLifetime() {
  const cleanups: Array<() => void> = [];
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    while (cleanups.length) {
      try {
        cleanups.pop()!();
      } catch {
        /* Continue releasing the remaining resources. */
      }
    }
  };
  return {
    get disposed() {
      return disposed;
    },
    add(cleanup: () => void) {
      if (disposed) cleanup();
      else cleanups.push(cleanup);
    },
    listen<E extends Event>(
      target: EventTarget,
      name: string,
      handler: (event: E) => void,
      options?: AddEventListenerOptions,
    ) {
      if (disposed) return;
      target.addEventListener(name, handler as EventListener, options);
      cleanups.push(() => target.removeEventListener(name, handler as EventListener, options));
    },
    dispose,
  };
}
