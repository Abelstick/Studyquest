/**
 * Lo que «Hoy» añade para decidir qué hacer: las tres prioridades del día y la agenda de hoy.
 * Se deducen de lo que ya existe (tareas con fecha, prioridades elegidas en la revisión semanal, bloques del
 * calendario); no hay nada nuevo que registrar. Funciones puras.
 */
import type { ISODate, Snapshot, Task } from './domain';
import { clockToMinutes, diffDays, minutesOfDay, today } from './dates';
import { occurrencesBetween, type Occurrence } from './agenda';
import { dueTimeOf, isOverdue } from './tasks';
import { weeklyPriorityIds } from './weekReview';

export const MAX_TODAY_PRIORITIES = 3;

export type PriorityReason = 'late' | 'today' | 'week' | 'soon';

export interface TodayPriority {
  task: Task;
  reason: PriorityReason;
}

export const PRIORITY_REASON_TEXT: Record<PriorityReason, string> = {
  late: 'Vencida',
  today: 'Vence hoy',
  week: 'Prioridad de la semana',
  soon: 'Se acerca',
};

const dueMinute = (t: Task): number => {
  const time = dueTimeOf(t);
  return time ? clockToMinutes(time) : 24 * 60;
};

/**
 * Las (hasta) tres tareas que más importan hoy. Orden: lo vencido (lo más antiguo primero), lo que vence hoy,
 * lo que elegiste como prioridad de la semana y, por último, lo importante que se acerca (alta o jefe, en 3 días).
 */
export function topPriorities(s: Pick<Snapshot, 'tasks' | 'profile'>, now: ISODate = today(), nowMin: number = minutesOfDay()): TodayPriority[] {
  const weekly = new Set(weeklyPriorityIds(s.profile, now));
  const out: (TodayPriority & { rank: number })[] = [];
  for (const task of s.tasks) {
    if (task.status === 'done') continue;
    let reason: PriorityReason | null = null;
    if (task.dueDate && isOverdue(task, now, nowMin)) reason = 'late';
    else if (task.dueDate === now) reason = 'today';
    else if (weekly.has(task.id)) reason = 'week';
    else if ((task.priority === 'high' || task.priority === 'boss') && task.dueDate && diffDays(task.dueDate, now) <= 3) reason = 'soon';
    if (!reason) continue;
    out.push({ task, reason, rank: ['late', 'today', 'week', 'soon'].indexOf(reason) });
  }
  return out
    .sort((a, b) => a.rank - b.rank || (a.task.dueDate ?? '9999').localeCompare(b.task.dueDate ?? '9999') || dueMinute(a.task) - dueMinute(b.task) || b.task.xp - a.task.xp)
    .slice(0, MAX_TODAY_PRIORITIES)
    .map(({ task, reason }) => ({ task, reason }));
}

export type AgendaState = 'now' | 'next' | 'later' | 'past';

export interface AgendaItem {
  occ: Occurrence;
  state: AgendaState;
  /** Los bloques de un hábito o una tarea se cierran en el hábito o la tarea, nunca desde la agenda. */
  linked: 'habit' | 'task' | null;
  /** Minuto del día en que termina (el de inicio, en un recordatorio). */
  end: number;
}

/** Los bloques con hora de hoy, en orden, con el momento en que están respecto a ahora. Lo cancelado no aparece. */
export function agendaToday(s: Pick<Snapshot, 'events' | 'habits' | 'tasks' | 'habitLogs'>, now: ISODate = today(), nowMin: number = minutesOfDay()): AgendaItem[] {
  const occs = occurrencesBetween(s.events, now, now, { habits: s.habits, tasks: s.tasks, logs: s.habitLogs })
    .filter((o) => o.date === now && o.start !== null && o.status !== 'cancelled')
    .sort((a, b) => (a.start as number) - (b.start as number));
  let nextAssigned = false;
  return occs.map((occ) => {
    const start = occ.start as number;
    const end = start + occ.minutes;
    let state: AgendaState;
    if (occ.status === 'done' || end <= nowMin) state = 'past';
    else if (start <= nowMin) state = 'now';
    else if (!nextAssigned) {
      state = 'next';
      nextAssigned = true;
    } else state = 'later';
    let linked: AgendaItem['linked'] = null;
    if (occ.event.habitId) linked = 'habit';
    else if (occ.event.taskId) linked = 'task';
    return { occ, state, end, linked };
  });
}
