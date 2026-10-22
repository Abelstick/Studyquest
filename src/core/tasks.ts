/** Reglas de tareas: repetición y jefes finales. Funciones puras. */
import type { ID, ISODate, Priority, Recurrence, Task, TaskStatus } from './domain';
import { addDays, addMonths, clockToMinutes, daysLeftLabel, diffDays, isClockTime, isoNow, minutesOfDay, today } from './dates';

/** Cómo se nombran la prioridad y el estado de una tarea en toda la app. */
export const PRIORITY_LABEL: Record<Priority, string> = { low: 'Baja', mid: 'Media', high: 'Alta', boss: 'Jefe final' };
export const STATUS_LABEL: Record<TaskStatus, string> = { todo: 'Por jugar', doing: 'En juego', done: 'Superada' };
/** Qué hace el botón principal de una tarea en cada estado. Solo el texto: el ícono lo pone la interfaz (ui/domainIcons). */
export const NEXT_STATUS: Record<TaskStatus, { to: TaskStatus; label: string }> = {
  todo: { to: 'doing', label: 'Empezar' },
  doing: { to: 'done', label: 'Completar' },
  done: { to: 'todo', label: 'Reabrir' },
};

/* ---------- Hora límite ---------- */

/** La hora límite de la tarea, si tiene fecha y una hora válida. */
export const dueTimeOf = (t: Pick<Task, 'dueDate' | 'dueTime'>): string | null => (t.dueDate && isClockTime(t.dueTime) ? t.dueTime : null);

/** Minutos que faltan para que venza (negativo si ya venció), o null sin fecha. Sin hora vence al terminar el día. */
export function minutesToDue(t: Pick<Task, 'dueDate' | 'dueTime'>, now: ISODate = today(), nowMin: number = minutesOfDay()): number | null {
  if (!t.dueDate) return null;
  const time = dueTimeOf(t);
  return diffDays(t.dueDate, now) * 1440 + (time ? clockToMinutes(time) : 1440) - nowMin;
}

/** Abierta y con el plazo ya pasado (con hora, en cuanto pasa esa hora; sin hora, desde el día siguiente). */
export const isOverdue = (t: Pick<Task, 'dueDate' | 'dueTime' | 'status'>, now: ISODate = today(), nowMin: number = minutesOfDay()): boolean =>
  t.status !== 'done' && (minutesToDue(t, now, nowMin) ?? 1) <= 0;

/** Cuánto falta: si vence hoy y tiene hora, en horas o minutos («Quedan 3 h», «Venció a las 18:00»); si no, en días. */
export function timeLeftLabel(t: Pick<Task, 'dueDate' | 'dueTime'>, now: ISODate = today(), nowMin: number = minutesOfDay()): string | null {
  const time = dueTimeOf(t);
  if (!t.dueDate || !time || t.dueDate !== now) return daysLeftLabel(t.dueDate, now);
  const left = clockToMinutes(time) - nowMin;
  if (left <= 0) return `Venció a las ${time}`;
  if (left < 60) return `Quedan ${left} min`;
  const h = Math.floor(left / 60);
  return `Quedan ${h} h`;
}

/* ---------- Tareas recurrentes ---------- */

export const RECURRENCE_UNITS: { value: Recurrence['unit']; label: string }[] = [
  { value: 'day', label: 'Días' },
  { value: 'week', label: 'Semanas' },
  { value: 'month', label: 'Meses' },
];

const step = (date: ISODate, r: Recurrence): ISODate => {
  const n = Math.max(1, Math.floor(r.interval));
  if (r.unit === 'day') return addDays(date, n);
  if (r.unit === 'week') return addDays(date, 7 * n);
  return addMonths(date, n);
};

/**
 * Fecha de la siguiente repetición: sigue el calendario de la tarea (desde su fecha límite) pero nunca cae en el pasado,
 * así completar tarde una tarea diaria no crea una cola de días atrasados.
 */
export function nextOccurrence(task: Pick<Task, 'dueDate' | 'recurrence'>, now: ISODate = today()): ISODate | null {
  const r = task.recurrence;
  if (!r) return null;
  let next = step(task.dueDate ?? now, r);
  for (let i = 0; next <= now && i < 2000; i++) next = step(next, r);
  return next;
}

/** Repeticiones de una tarea que caen en [from, to] (para pintarlas por adelantado en el calendario). */
export function projectOccurrences(task: Pick<Task, 'dueDate' | 'recurrence' | 'status'>, from: ISODate, to: ISODate, now: ISODate = today()): ISODate[] {
  const r = task.recurrence;
  if (!r || !task.dueDate || task.status === 'done') return [];
  const out: ISODate[] = [];
  let d = step(task.dueDate, r);
  for (let i = 0; d <= to && i < 2000; i++, d = step(d, r)) if (d >= from && d > now) out.push(d);
  return out;
}

export function recurrenceLabel(r: Recurrence): string {
  const n = Math.max(1, r.interval);
  if (n === 1) return r.unit === 'day' ? 'Cada día' : r.unit === 'week' ? 'Cada semana' : 'Cada mes';
  return `Cada ${n} ${r.unit === 'day' ? 'días' : r.unit === 'week' ? 'semanas' : 'meses'}`;
}

/** La tarea que nace al completar una recurrente: misma tarea, sin avance y con nueva fecha. */
export function spawnNext(task: Task, newId: () => ID, now: ISODate = today()): Task {
  return {
    ...task,
    id: newId(),
    status: 'todo',
    dueDate: nextOccurrence(task, now),
    subtasks: task.subtasks.map((s) => ({ ...s, done: false })),
    createdAt: isoNow(),
    completedAt: null,
    spawnedId: undefined,
  };
}

/* ---------- Jefes finales ---------- */

export const BOSS_BONUS_XP = 50;
export const isBoss = (t: Pick<Task, 'priority'>) => t.priority === 'boss';

/** Lo que da completar la tarea: su XP y, si es un jefe, el botín extra. */
export const taskReward = (t: Pick<Task, 'priority' | 'xp'>) => t.xp + (isBoss(t) ? BOSS_BONUS_XP : 0);

/** Vida del jefe: una vida por subtarea pendiente. Sin subtareas, tiene 1 (se derrota completándolo). */
export function bossHp(t: Pick<Task, 'subtasks' | 'status'>) {
  const max = Math.max(1, t.subtasks.length);
  const hp = t.status === 'done' ? 0 : t.subtasks.length ? t.subtasks.filter((s) => !s.done).length : 1;
  return { hp, max, pct: Math.round((hp / max) * 100) };
}
