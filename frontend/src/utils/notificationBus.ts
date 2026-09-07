// Cross-component notification sync (M19).
//
// The Layout bell polls the unread count while NotificationsPage owns the
// list - without a shared signal the badge and the list disagree after
// mark-read (split-brain badge). Pages emit after mutating notification
// state; the bell subscribes and refreshes immediately instead of waiting
// for the next poll tick.
type Listener = () => void;

const listeners = new Set<Listener>();

export function notifyNotificationsChanged(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // A broken subscriber must not break the emitter.
    }
  });
}

export function subscribeNotificationsChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
