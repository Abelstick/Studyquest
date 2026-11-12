import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '@/state';
import { isHabitDone, logFor } from '@/core/game';
import { today } from '@/core/dates';
import { taskReminderKey } from '../../supabase/functions/_shared/taskReminders';

/** Parámetros con los que la notificación abre la app para marcar algo: `/?hecho=<hábito>` o `/?tarea_hecha=<tarea>`. */
export const DONE_PARAM = 'hecho';
export const TASK_DONE_PARAM = 'tarea_hecha';

const TASK_PREFIX = taskReminderKey('');

/** Id de la tarea de un aviso (`task:<id>`); null si el aviso es de otra cosa. */
export const taskIdOfKey = (key: string | null | undefined): string | null => (key && key.startsWith(TASK_PREFIX) && key.length > TASK_PREFIX.length ? key.slice(TASK_PREFIX.length) : null);

/** Da por hecho el hábito de hoy (si existe y aún no lo está). Devuelve si hizo algo. */
export function completeHabitFromNotification(habitId: string): boolean {
  const s = useData.getState();
  const habit = s.habits.find((h) => h.id === habitId);
  if (!habit || isHabitDone(habit, logFor(s.habitLogs, habit.id, today()))) return false;
  s.setHabitValue(habit.id, habit.target);
  return true;
}

/** Completa la tarea (si existe y sigue abierta). Devuelve si hizo algo. */
export function completeTaskFromNotification(taskId: string): boolean {
  const s = useData.getState();
  const task = s.tasks.find((t) => t.id === taskId);
  if (!task || task.status === 'done') return false;
  s.setTaskStatus(task.id, 'done');
  return true;
}

/**
 * Botones «Hecho» / «Completar» de las notificaciones. El service worker no puede guardar por su cuenta (no
 * tiene la sesión), así que avisa a la app si está a la vista o la abre con el parámetro; aquí se marca.
 */
export function useNotificationActions(): void {
  const [params, setParams] = useSearchParams();
  const habitId = params.get(DONE_PARAM);
  const taskId = params.get(TASK_DONE_PARAM);

  useEffect(() => {
    if (!habitId && !taskId) return;
    if (habitId) completeHabitFromNotification(habitId);
    if (taskId) completeTaskFromNotification(taskId);
    // Se quita de la URL: recargar o volver atrás no debe marcarlo otra vez.
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        next.delete(DONE_PARAM);
        next.delete(TASK_DONE_PARAM);
        return next;
      },
      { replace: true },
    );
  }, [habitId, taskId, setParams]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const msg = e.data as { type?: string; habitId?: string; taskId?: string } | undefined;
      if (msg?.type === 'habit-done' && msg.habitId) completeHabitFromNotification(msg.habitId);
      if (msg?.type === 'task-done' && msg.taskId) completeTaskFromNotification(msg.taskId);
    };
    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage);
  }, []);
}
