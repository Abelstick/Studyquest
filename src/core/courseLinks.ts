/**
 * Lo que está vinculado a un curso además de sus tareas: sus hábitos y los bloques que reservaste en el calendario.
 * Solo informa. Marcar un bloque o un hábito no registra una sesión de estudio ni avance del curso. Funciones puras.
 */
import type { AgendaEvent, Habit, HabitLog, ID, ISODate, Task } from './domain';
import { occurrencesBetween, type Occurrence } from './agenda';
import { isDueOn, isHabitDone, logFor } from './game';
import { today } from './dates';

/** Hábitos del curso, en el orden en que se crearon. */
export const courseHabits = (habits: Habit[], courseId: ID): Habit[] => habits.filter((h) => h.courseId === courseId);

export interface CourseHabitToday {
  habit: Habit;
  /** Hoy le toca (o ya lo hiciste aunque no tocara). */
  due: boolean;
  done: boolean;
}

/** Cómo van hoy los hábitos del curso. Los que hoy no tocan y no se hicieron quedan fuera. */
export function courseHabitsToday(habits: Habit[], logs: HabitLog[], courseId: ID, now: ISODate = today()): CourseHabitToday[] {
  return courseHabits(habits, courseId)
    .map((habit) => {
      const done = isHabitDone(habit, logFor(logs, habit.id, now));
      return { habit, done, due: done || isDueOn(habit, now, logs) };
    })
    .filter((x) => x.due);
}

/** Bloques reservados para el curso entre dos días, sin los cancelados. */
export function courseBlocks(events: AgendaEvent[], ctx: { habits: Habit[]; tasks: Task[]; logs: HabitLog[] }, courseId: ID, from: ISODate, to: ISODate): Occurrence[] {
  const mine = events.filter((e) => e.courseId === courseId);
  if (mine.length === 0) return [];
  return occurrencesBetween(mine, from, to, ctx).filter((o) => o.status !== 'cancelled' && o.date >= from && o.date <= to);
}
