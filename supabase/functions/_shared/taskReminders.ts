/**
 * Aviso de hora límite de tareas: decide QUÉ tareas hay que avisar ahora porque vencen pronto.
 *
 * Lógica pura y sin dependencias, compartida como `reminders.ts`: la usa la Edge Function `send-reminders`
 * (push con la app cerrada) y la web (aviso dentro de la app). Así ambos coinciden en cuándo avisar.
 *
 * Reglas:
 *  - Solo tareas abiertas con fecha de HOY (día local) y hora límite.
 *  - Un único aviso por tarea y día, en la última hora antes de que venza (TASK_LEAD_MIN).
 *  - Si la tarea se crea con menos de una hora de margen, se avisa igual mientras no haya vencido.
 */
import { localParts, minutesSince } from './due.ts';

export const TASK_LEAD_MIN = 60;

/** Una tarea tal como la guarda la base de datos (`tasks.data`). */
export interface TaskRow {
  id: string;
  data: {
    title?: string;
    status?: string;
    dueDate?: string | null;
    dueTime?: string;
    xp?: number;
  };
}

export interface PlannedTaskReminder {
  taskId: string;
  /** Clave común para no repetir el aviso entre el servidor y la web. */
  key: string;
  title: string;
  body: string;
  url: string;
  tag: string;
}

export const taskReminderKey = (taskId: string) => `task:${taskId}`;

export function planTaskReminders(input: { tasks: TaskRow[]; sent: Set<string>; now: Date; timeZone: string }): PlannedTaskReminder[] {
  const { date, minutes } = localParts(input.now, input.timeZone);
  const out: PlannedTaskReminder[] = [];
  for (const t of input.tasks) {
    const d = t.data;
    if (d.status === 'done' || d.dueDate !== date || input.sent.has(t.id)) continue;
    const since = minutesSince(d.dueTime, minutes);
    if (since === null) continue;
    const left = -since;
    if (left <= 0 || left > TASK_LEAD_MIN) continue;
    out.push({
      taskId: t.id,
      key: taskReminderKey(t.id),
      title: `⏰ ${d.title ?? 'Tu tarea'}`,
      body: `Vence a las ${d.dueTime} (en ${left} min). Complétala y suma ${d.xp ?? 0} XP.`,
      url: '/tareas',
      tag: `task-${t.id}`,
    });
  }
  return out;
}
