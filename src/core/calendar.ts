/** Datos del calendario: qué cae en cada día. Funciones puras. */
import type { Habit, HabitLog, ISODate, Snapshot, StudySession, Task } from './domain';
import { addDays, toISODate, today, weekStart } from './dates';
import { habitProgress, isDueOn, isHabitDone, logFor } from './game';
import { isQuotaHabit, quotaInfo } from './periods';
import { scheduledReviews, type DueReview } from './review';
import { projectOccurrences } from './tasks';

/** Las 6 semanas (42 días, de lunes a domingo) que cubren el mes `month` (0-11). */
export function monthGrid(year: number, month: number): ISODate[] {
  const first = toISODate(new Date(year, month, 1));
  const start = weekStart(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/** Los 7 días (lunes a domingo) de la semana que contiene `date`. */
export const weekDays = (date: ISODate): ISODate[] => Array.from({ length: 7 }, (_, i) => addDays(weekStart(date), i));

/** Un hábito en un día concreto: cuánto se hizo y si tocaba. */
export interface HabitDay {
  habit: Habit;
  value: number;
  progress: number;
  done: boolean;
  /** Tocaba ese día (los de cuota «tocan» hasta cumplir la cuota). */
  due: boolean;
}

export interface DayEntry {
  tasks: Task[];
  /** Repeticiones futuras de tareas recurrentes (aún no existen como tarea). */
  upcoming: Task[];
  reviews: DueReview[];
  habits: HabitDay[];
  /** Minutos de estudio registrados ese día. */
  minutes: number;
}

const empty = (): DayEntry => ({ tasks: [], upcoming: [], reviews: [], habits: [], minutes: 0 });

type CalendarSource = Pick<Snapshot, 'tasks' | 'courses'> & { habits?: Habit[]; habitLogs?: HabitLog[]; sessions?: StudySession[] };

/** Hábito de un día concreto, o null si ese día no pinta nada para él. */
export function habitOn(h: Habit, logs: HabitLog[], date: ISODate, now: ISODate = today()): HabitDay | null {
  if (date < h.startDate) return null;
  const log = logFor(logs, h.id, date);
  const value = log?.value ?? 0;
  const progress = habitProgress(h, log);
  const done = isHabitDone(h, log);
  let due: boolean;
  if (isQuotaHabit(h)) {
    // Los de cuota no «tocan» un día concreto: se muestran cuando se hicieron, y hoy mientras falte cuota.
    due = date === now && !(quotaInfo(h, logs, now)?.met ?? true);
  } else {
    due = isDueOn(h, date, logs);
  }
  if (!due && progress === 0) return null;
  return { habit: h, value, progress, done, due };
}

/** Agrupa por día lo que hay entre `from` y `to`. Los repasos atrasados se muestran en «hoy». */
export function calendarDays(s: CalendarSource, from: ISODate, to: ISODate, now: ISODate = today()): Map<ISODate, DayEntry> {
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
  for (const ses of s.sessions ?? []) {
    if (ses.date >= from && ses.date <= to) at(ses.date).minutes += ses.minutes;
  }
  if (s.habits?.length) {
    const logs = s.habitLogs ?? [];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      // Lo futuro solo se anticipa para los hábitos de calendario; un hábito de cuota no tiene «día» futuro.
      for (const h of s.habits) {
        if (d > now && isQuotaHabit(h)) continue;
        const hd = habitOn(h, logs, d, now);
        if (hd) at(d).habits.push(hd);
      }
    }
  }
  return days;
}

/** Tareas abiertas con fecha ya pasada. */
export const overdueTasks = (tasks: Task[], now: ISODate = today()): Task[] => tasks.filter((t) => t.status !== 'done' && !!t.dueDate && t.dueDate < now);

/** Tareas abiertas sin fecha: no salen en el calendario hasta que se les pone una. */
export const undatedTasks = (tasks: Task[]): Task[] => tasks.filter((t) => t.status !== 'done' && !t.dueDate);
