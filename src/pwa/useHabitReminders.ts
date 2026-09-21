import { useEffect } from 'react';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { sfx } from '@/audio/sfx';
import { localParts } from '../../supabase/functions/_shared/due';
import type { PlannedReminder } from '../../supabase/functions/_shared/reminders';
import { acceptPushMessage, loadReminderState, saveReminderState, tickReminders, type Effect, type PushMessage } from './reminders';
import { getPushState } from './push';

const TICK_MS = 15_000;

function deliver(r: Pick<PlannedReminder, 'title' | 'body' | 'url' | 'tag'>, effect: Effect) {
  if (effect === 'silent') return;
  if (effect === 'system') {
    void navigator.serviceWorker?.getRegistration().then((reg) =>
      reg?.showNotification(r.title, { body: r.body, tag: r.tag, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { url: r.url }, renotify: true } as NotificationOptions),
    );
  } else {
    useUi.getState().toast({ kind: 'reminder', title: r.title, body: r.body, to: r.url });
  }
  sfx.reminder();
}

/**
 * Recordatorios dentro de la app: cada 15 s comprueba qué hábitos toca avisar y muestra un banner con sonido.
 * Se monta una sola vez, en el layout.
 */
export function useHabitReminders() {
  useEffect(() => {
    let pushActive = false;
    const refreshPush = () => void getPushState().then((s) => (pushActive = s === 'on')).catch(() => {});
    refreshPush();

    const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    const run = () => {
      const { habits, habitLogs } = useData.getState();
      if (!habits.some((h) => h.reminder)) return;
      const now = new Date();
      const tz = timeZone();
      const { effects, state } = tickReminders({
        habits,
        logs: habitLogs,
        now,
        timeZone: tz,
        visible: document.visibilityState === 'visible',
        pushActive,
        canNotify: typeof Notification !== 'undefined' && Notification.permission === 'granted' && 'serviceWorker' in navigator,
        state: loadReminderState(localParts(now, tz).date),
      });
      if (effects.length) saveReminderState(state);
      for (const { reminder, effect } of effects) deliver(reminder, effect);
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        refreshPush();
        run();
      }
    };

    // Un push llegó con la app visible: el service worker no muestra la notificación del sistema y nos avisa a nosotros.
    const onMessage = (e: MessageEvent) => {
      const msg = e.data as (PushMessage & { type?: string }) | undefined;
      if (msg?.type !== 'reminder' || !msg.habitId) return;
      const now = new Date();
      const res = acceptPushMessage(msg, loadReminderState(localParts(now, timeZone()).date), now.getTime());
      if (!res.show) return;
      saveReminderState(res.state);
      deliver(msg, 'inapp');
    };

    run();
    const timer = setInterval(run, TICK_MS);
    document.addEventListener('visibilitychange', onVisible);
    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      navigator.serviceWorker?.removeEventListener('message', onMessage);
    };
  }, []);
}
