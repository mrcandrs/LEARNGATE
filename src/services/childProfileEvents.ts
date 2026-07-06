/** Broadcast child profile refresh without NavigationContainer (single realtime bridge → many listeners). */
const listeners = new Set<() => void>();

export function subscribeChildProfileRefresh(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitChildProfileRefresh(): void {
  for (const listener of listeners) {
    listener();
  }
}
