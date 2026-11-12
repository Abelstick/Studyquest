import { useEffect, useState, useSyncExternalStore } from 'react';
import type { SyncPort } from '@/data/ports';

export function useOnline(): boolean {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('online', cb);
      window.addEventListener('offline', cb);
      return () => {
        window.removeEventListener('online', cb);
        window.removeEventListener('offline', cb);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Permite ofrecer el botón "Instalar app" cuando el navegador lo permite. */
export function useInstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setEvent(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  return {
    canInstall: !!event && !installed,
    installed,
    install: async () => {
      if (!event) return;
      await event.prompt();
      await event.userChoice;
      setEvent(null);
    },
  };
}

/** Cambios guardados en el dispositivo pendientes de enviar (0 si el backend no usa cola offline). */
export function useSyncPending(sync: SyncPort | undefined): number {
  return useSyncExternalStore(
    (cb) => sync?.subscribe(cb) ?? (() => {}),
    () => sync?.pending() ?? 0,
    () => 0,
  );
}

/** Tiempo mínimo fuera de la app para volver a leer los datos al regresar. */
export const RESUME_REFRESH_MS = 2 * 60_000;

/**
 * Al volver a la app tras un rato en segundo plano, pide los datos otra vez. En el celular la app instalada
 * sigue viva durante días: sin esto, al volver se vería lo de la última vez y no lo hecho en otro dispositivo.
 */
export function useResumeRefresh(refresh: () => void, minHiddenMs: number = RESUME_REFRESH_MS): void {
  useEffect(() => {
    let hiddenAt: number | null = document.hidden ? Date.now() : null;
    const onChange = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt !== null && Date.now() - hiddenAt >= minHiddenMs) refresh();
      hiddenAt = null;
    };
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, [refresh, minHiddenMs]);
}
