import { useEffect, useRef, useSyncExternalStore } from 'react';
import { createGameSession, type GameSession } from '../game/session';

/** Browser lifecycle belongs here; the underlying session has no React or Three dependency. */
export function useGameSession(providedSession?: GameSession) {
  const ownedSession = useRef<GameSession | null>(null);
  if (!providedSession && !ownedSession.current) {
    const mode =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('mode') === 'demo'
        ? 'demo'
        : 'real';
    ownedSession.current = createGameSession({ mode });
  }
  const session = providedSession ?? ownedSession.current!;
  const snapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  useEffect(() => {
    const refresh = () => {
      session.refresh();
    };
    const onStorage = (event: StorageEvent) => {
      session.refreshFromStorage(event.key);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [session]);
  return { snapshot, session };
}
