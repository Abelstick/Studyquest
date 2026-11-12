import { useEffect } from 'react';

/**
 * Mantiene la pantalla encendida mientras `active` (una sesión de Pomodoro en marcha).
 * El sistema suelta el bloqueo al salir de la app, así que se vuelve a pedir al regresar.
 * Donde no existe la API, o con el ahorro de batería activado, simplemente no hace nada.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let alive = true;
    const acquire = () => {
      if (!alive || document.visibilityState !== 'visible' || (lock && !lock.released)) return;
      navigator.wakeLock
        .request('screen')
        .then((l) => {
          if (alive) lock = l;
          else void l.release();
        })
        .catch((e: unknown) => console.warn('[wake-lock]', e)); // p. ej. batería baja: la pantalla se apagará como siempre
    };
    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', acquire);
      if (lock && !lock.released) void lock.release();
    };
  }, [active]);
}
