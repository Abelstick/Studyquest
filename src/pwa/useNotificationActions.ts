import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '@/state';
import { isHabitDone, logFor } from '@/core/game';
import { today } from '@/core/dates';

/** Parámetro con el que la notificación abre la app para marcar un hábito: `/?hecho=<id>`. */
export const DONE_PARAM = 'hecho';

/** Da por hecho el hábito de hoy (si existe y aún no lo está). Devuelve si hizo algo. */
export function completeHabitFromNotification(habitId: string): boolean {
  const s = useData.getState();
  const habit = s.habits.find((h) => h.id === habitId);
  if (!habit || isHabitDone(habit, logFor(s.habitLogs, habit.id, today()))) return false;
  s.setHabitValue(habit.id, habit.target);
  return true;
}

/**
 * Botón «Hecho» de la notificación de un hábito. El service worker no puede guardar por su cuenta (no tiene
 * la sesión), así que avisa a la app si está a la vista o la abre en `/?hecho=<id>`; aquí se marca el hábito.
 */
export function useNotificationActions(): void {
  const [params, setParams] = useSearchParams();
  const habitId = params.get(DONE_PARAM);

  useEffect(() => {
    if (!habitId) return;
    completeHabitFromNotification(habitId);
    // Se quita de la URL: recargar o volver atrás no debe marcarlo otra vez.
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        next.delete(DONE_PARAM);
        return next;
      },
      { replace: true },
    );
  }, [habitId, setParams]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const msg = e.data as { type?: string; habitId?: string } | undefined;
      if (msg?.type === 'habit-done' && msg.habitId) completeHabitFromNotification(msg.habitId);
    };
    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage);
  }, []);
}
