/** Datos del calendario mensual: qué cae en cada día. Funciones puras. */
import type { ISODate, Snapshot, Task } from './domain';
import { addDays, toISODate, today, weekStart } from './dates';
import { scheduledReviews, type DueReview } from './review';
import { projectOccurrences } from './tasks';

/** Las 6 semanas (42 días, de lunes a domingo) que cubren el mes `month` (0-11). */
export function monthGrid(year: number, month: number): ISODate[] {
  const first = toISODate(new Date(year, month, 1));
  const start = weekStart(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export interface DayEntry {
  tasks: Task[];
  /** Repeticiones futuras de tareas recurrentes (aún no existen como tarea). */
  upcoming: Task[];
  reviews: DueReview[];
}

const empty = (): DayEntry => ({ tasks: [], upcoming: [], reviews: [] });

/** Agrupa por día lo que hay entre `from` y `to`. Los repasos atrasados se muestran en «hoy». */
export function calendarDays(s: Pick<Snapshot, 'tasks' | 'courses'>, from: ISODate, to: ISODate, now: ISODate = today()): Map<ISODate, DayEntry> {
  const days = new Map<ISODate, DayEntry>();
  const at = (d: ISODate) => {
    let e = days.get(d);
    if (!e) days.set(d, (e = empty()));
    return e;
  };
  for (const t of s.tasks) {
    if (t.dueDate && t.dueDate >= from && t.dueDate <= to) at(t.dueDate).tasks.push(t);
    for (const d of projectOccurrences(t, from, to, now)) at(d).upcoming.push(t);
  }
  for (const r of scheduledReviews(s, now)) {
    const d = r.due < now ? now : r.due;
    if (d >= from && d <= to) at(d).reviews.push(r);
  }
  return days;
}
