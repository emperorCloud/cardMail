import { useEffect, useRef } from 'react';
import { apiFetch } from '../lib/api.ts';

export interface RealtimeMessage {
  type: 'mail:synced' | 'notification:new' | 'thread:updated';
  inboxId?: string;
  threadId?: string;
  data?: Record<string, unknown>;
}

interface PolledNotification {
  inboxId: string;
  threadId: string | null;
  body: string;
}

const POLL_MS = 20_000;

/**
 * Synchronisation quasi temps réel par scrutation : fonctionne sur Vercel (serverless).
 * La scrutation se met en pause quand l'onglet est masqué et reprend au retour avec une actualisation.
 */
export function useMailPolling(enabled: boolean, onEvent: (event: RealtimeMessage) => void) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled) return;
    let cursor = new Date().toISOString();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const tick = async () => {
      if (stopped) return;
      if (document.visibilityState === 'visible' && navigator.onLine) {
        try {
          const res = await apiFetch<{ data: PolledNotification[]; now: string }>(
            `/api/notifications/poll?since=${encodeURIComponent(cursor)}`
          );
          cursor = res.now;
          for (const n of res.data.slice().reverse()) {
            onEventRef.current({
              type: 'notification:new',
              inboxId: n.inboxId,
              threadId: n.threadId ?? undefined,
              data: { subject: n.body },
            });
          }
        } catch {
          // réseau instable : on réessaie au prochain cycle
        }
      }
      timer = setTimeout(tick, POLL_MS);
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') onEventRef.current({ type: 'mail:synced', inboxId: '*' });
    };

    document.addEventListener('visibilitychange', onVisible);
    timer = setTimeout(tick, POLL_MS);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled]);
}
