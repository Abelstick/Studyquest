/**
 * Panorama de lo que toca: tareas por día, semana, mes y año, y hábitos de la semana. Funciones puras.
 *
 * Una tarea cuenta en un periodo si tiene fecha límite y esa fecha cae dentro o antes del final del periodo, y
 * además sigue abierta (arrastra lo atrasado) o se cerró dentro del periodo. Las que no tienen fecha, o las que
 * se adelantan mucho, no inflan el total: son extra. Así, si el día tenía 7 cosas, hacer las 7 es el 100 %.
 */
import type { Habit, HabitLog, ISODate, Task } from './domain';
import { addDays, fromISODate, today, toISODate, weekStart } from './dates';
import { isDueOn, isHabitDone, logFor } from './game';

export interface Tally {
  done: number;
  total: number;
  /** Abiertas con la fecha ya vencida. */
  late: number;
}

/** Tareas del periodo [from, to] (días locales, inclusive). */
export function taskTally(tasks: Task[], from: ISODate, to: ISODate, now: ISODate = today()): Tally {
  const t: Tally = { done: 0, total: 0, late: 0 };
  for (const x of tasks) {
    if (!x.dueDate || x.dueDate > to) continue;
    if (x.status === 'done') {
      if (!x.completedAt || x.completedAt < from || x.completedAt > to) continue;
      t.done++;
    } else if (x.dueDate < now) t.late++;
    t.total++;
  }
  return t;
}

export interface TaskScopes {
  day: Tally;
  week: Tally;
  month: Tally;
  year: Tally;
  /** Todas las abiertas, tengan fecha o no: lo que hay en la lista en total. */
  open: number;
}

const lastOfMonth = (d: ISODate): ISODate => {
  const x = fromISODate(d);
  return toISODate(new Date(x.getFullYear(), x.getMonth() + 1, 0));
};

export function taskScopes(tasks: Task[], now: ISODate = today()): TaskScopes {
  const weekFrom = weekStart(now);
  const monthFrom = `${now.slice(0, 7)}-01`;
  const yearFrom = `${now.slice(0, 4)}-01-01`;
  return {
    day: taskTally(tasks, now, now, now),
    week: taskTally(tasks, weekFrom, addDays(weekFrom, 6), now),
    month: taskTally(tasks, monthFrom, lastOfMonth(now), now),
    year: taskTally(tasks, yearFrom, `${now.slice(0, 4)}-12-31`, now),
    open: tasks.filter((t) => t.status !== 'done').length,
  };
}

export interface HabitWeek {
  /** Veces que se cumplió un hábito en los días de la semana que ya pasaron (hoy incluido). */
  done: number;
  /** Veces que tocaba, o se cumplió aunque no tocara. */
  due: number;
  /** Porcentaje 0-100; sin nada que cumplir, 0. */
  pct: number;
}

/** Cumplimiento de la semana en curso, de lunes a hoy. Un hábito cuenta desde su fecha de inicio. */
export function habitWeek(habits: Habit[], logs: HabitLog[], now: ISODate = today()): HabitWeek {
  let done = 0;
  let due = 0;
  for (let d = weekStart(now); d <= now; d = addDays(d, 1)) {
    for (const h of habits) {
      if (d < h.startDate) continue;
      const ok = isHabitDone(h, logFor(logs, h.id, d));
      if (ok || isDueOn(h, d, logs)) {
        due++;
        if (ok) done++;
      }
    }
  }
  return { done, due, pct: due ? Math.round((done / due) * 100) : 0 };
}
