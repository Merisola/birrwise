'use client';

/**
 * Minimal pub/sub for a global "reload all data" signal.
 * Every data hook subscribes; any UI control can bump it.
 * Kept tiny and dependency-free on purpose.
 */
const listeners = new Set<() => void>();

export function onDataRefresh(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function emitDataRefresh(): void {
  listeners.forEach((cb) => {
    try {
      cb();
    } catch (err) {
      console.error('refresh listener failed:', err);
    }
  });
}
