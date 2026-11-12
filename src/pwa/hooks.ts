import { useEffect, useSyncExternalStore } from 'react';
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

/*
 * El navegador avisa UNA vez, al cargar, de que la app se puede instalar. Se guarda aquí, a nivel de módulo:
 * si solo lo escuchara la pantalla que enseña el botón (Perfil), el aviso llegaría antes de que existiera.
 */
interface InstallState {
  event: BeforeInstallPromptEvent | null;
  installed: boolean;
}
let installState: InstallState = {
  event: null,
  installed: typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches,
};
const installListeners = new Set<() => void>();
const setInstallState = (next: InstallState) => {
  installState = next;
  installListeners.forEach((cb) => cb());
};
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    setInstallState({ ...installState, event: e as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => setInstallState({ event: null, installed: true }));
}
const SERVER_INSTALL: InstallState = { event: null, installed: false };

/** Permite ofrecer el botón "Instalar app" cuando el navegador lo permite. */
export function useInstallPrompt() {
  const { event, installed } = useSyncExternalStore(
    (cb) => {
      installListeners.add(cb);
      return () => installListeners.delete(cb);
    },
    () => installState,
    () => SERVER_INSTALL,
  );
  return {
    canInstall: !!event && !installed,
    installed,
    install: async () => {
      if (!event) return;
      await event.prompt();
      await event.userChoice;
      // El aviso solo sirve una vez, se acepte o no.
      setInstallState({ ...installState, event: null });
    },
  };
}

/**
 * Pide al navegador que no borre lo guardado en el dispositivo si falta espacio: ahí viven la app sin
 * conexión y la cola de cambios aún sin enviar. Chrome lo concede solo a las apps instaladas, sin preguntar.
 */
export function usePersistentStorage(): void {
  useEffect(() => {
    const storage = typeof navigator === 'undefined' ? undefined : navigator.storage;
    if (!storage?.persist || !storage.persisted) return;
    storage
      .persisted()
      .then((already) => (already ? true : storage.persist()))
      .catch((e: unknown) => console.warn('[storage]', e));
  }, []);
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
