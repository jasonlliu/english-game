/** Own resources immediately, so a later initialization error cannot leak them. */
export function createCleanupScope() {
  const callbacks: Array<() => void> = [];
  let disposed = false;
  return {
    add(cleanup: () => void) {
      if (disposed) cleanup();
      else callbacks.push(cleanup);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const cleanup of callbacks.reverse()) {
        try {
          cleanup();
        } catch (error) {
          console.error('Unable to release scene resource', error);
        }
      }
      callbacks.length = 0;
    },
  };
}
