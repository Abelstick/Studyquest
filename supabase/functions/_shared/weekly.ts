/**
 * Resumen semanal por push: el domingo por la tarde, cuánto XP sumaste en la semana, cuántos días
 * estuviste activo y qué tareas tienes pendientes.
 *
 * Lógica pura y sin dependencias para que la Edge Function (Deno) la importe; se prueba en Vitest.
 * Todas las fechas son el día local "YYYY-MM-DD" del usuario.
 */
import { addDays, weekdayIndex } from './due.ts';
import type { TaskRow } from './taskReminders.ts';

/** Domingo (6 con lunes = 0) a partir de las 19:00. Si el cron falla un rato, se envía en cuanto vuelva ese mismo domingo. */
export const DIGEST_WEEKDAY = 6;
export const DIGEST_FROM_MIN = 19 * 60;

export const isDigestTime = (date: string, minutes: number): boolean => weekdayIndex(date) === DIGEST_WEEKDAY && minutes >= DIGEST_FROM_MIN;

export interface XpEventLike {
  day: string;
  amount: number;
}

export interface WeeklyDigest {
  xp: number;
  activeDays: number;
  overdue: number;
  /** La tarea vencida más antigua, para nombrarla. */
  oldestOverdue: string | null;
  dueNextWeek: number;
}

/** Los números de la semana que termina `date` (los 7 días hasta hoy incluido). */
export function weeklyDigest(events: XpEventLike[], tasks: TaskRow[], date: string): WeeklyDigest {
  const from = addDays(date, -6);
  const perDay = new Map<string, number>();
  for (const e of events) if (e.day >= from && e.day <= date) perDay.set(e.day, (perDay.get(e.day) ?? 0) + e.amount);
  const xp = [...perDay.values()].reduce((a, n) => a + n, 0);
  const activeDays = [...perDay.values()].filter((n) => n > 0).length;

  const open = tasks.filter((t) => t.data.status !== 'done' && typeof t.data.dueDate === 'string');
  const late = open.filter((t) => (t.data.dueDate as string) < date).sort((a, b) => (a.data.dueDate as string).localeCompare(b.data.dueDate as string));
  const end = addDays(date, 7);
  const dueNextWeek = open.filter((t) => (t.data.dueDate as string) > date && (t.data.dueDate as string) <= end).length;

  return { xp, activeDays, overdue: late.length, oldestOverdue: late[0]?.data.title ?? null, dueNextWeek };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function digestMessage(d: WeeklyDigest): { title: string; body: string } {
  const parts: string[] = [];
  parts.push(d.xp > 0 ? `+${d.xp} XP en ${plural(d.activeDays, 'día activo', 'días activos')} de 7.` : 'Esta semana no sumaste XP. ¡Mañana es buen día para volver!');
  if (d.overdue > 0) parts.push(`${plural(d.overdue, 'tarea vencida', 'tareas vencidas')}${d.oldestOverdue ? ` (empieza por «${d.oldestOverdue}»)` : ''}.`);
  if (d.dueNextWeek > 0) parts.push(`${plural(d.dueNextWeek, 'tarea vence', 'tareas vencen')} esta semana.`);
  return { title: '📊 Tu semana en StudyQuest', body: parts.join(' ') };
}
