import { useEffect } from 'react';
import { useData } from '@/state';
import { dailyMissions, dayProgress } from '@/core/missions';

/**
 * Número en el icono de la app instalada: lo que queda por hacer hoy (hábitos que tocan y tareas de hoy o vencidas).
 * Se actualiza mientras la app está abierta y al volver a ella; con todo hecho, se quita.
 */
export function useAppBadge(): void {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('setAppBadge' in navigator)) return;
    let last = -1;
    const update = () => {
      const s = useData.getState();
      const p = s.status === 'ready' ? dayProgress(dailyMissions(s)) : null;
      const left = p ? p.total - p.done : 0;
      if (left === last) return;
      last = left;
      (left > 0 ? navigator.setAppBadge(left) : navigator.clearAppBadge()).catch((e: unknown) => console.warn('[badge]', e));
    };
    update();
    const off = useData.subscribe(update);
    // Al volver puede ser ya otro día: lo pendiente cambia aunque los datos no.
    document.addEventListener('visibilitychange', update);
    return () => {
      off();
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
}
