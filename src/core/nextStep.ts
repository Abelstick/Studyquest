import type { Course, Habit, ID, ISODate, Snapshot, Task, Topic } from './domain';
import { clockToMinutes, isClockTime, minutesOfDay, today } from './dates';
import { isDueOn, isHabitDone, logFor } from './game';
import { isQuit } from './quit';
import { dueReviews, type DueReview } from './review';
import { dueTimeOf, isOverdue } from './tasks';

/**
 * El «siguiente paso» de la pantalla Hoy: una sola cosa concreta que hacer ahora.
 * Prioridad: tarea vencida → tarea que vence hoy → hábito pendiente → repaso que toca → tema en curso.
 */
export type NextStep =
  | { kind: 'task-late'; task: Task; courseId: ID | null }
  | { kind: 'task-today'; task: Task; courseId: ID | null }
  | { kind: 'habit'; habit: Habit; courseId: null }
  | { kind: 'review'; review: DueReview; pending: number; courseId: ID }
  | { kind: 'topic'; course: Course; topic: Topic; courseId: ID };

export type NextStepInput = Pick<Snapshot, 'tasks' | 'habits' | 'habitLogs' | 'courses'>;

/** Minuto del día en que vence la tarea; sin hora límite vale todo el día, así que va detrás. */
const dueMinute = (t: Task): number => {
  const time = dueTimeOf(t);
  return time ? clockToMinutes(time) : 24 * 60;
};

/** Hora del recordatorio en minutos; sin recordatorio, al final. */
const reminderMinute = (h: Habit): number => (isClockTime(h.reminder) ? clockToMinutes(h.reminder) : 24 * 60);

/**
 * Elige el siguiente paso. `now` es el día local (`YYYY-MM-DD`) y `nowMin` el minuto local del día:
 * nunca UTC, para que a las 23:00 en Lima «hoy» siga siendo hoy.
 */
export function nextStep(s: NextStepInput, now: ISODate = today(), nowMin: number = minutesOfDay()): NextStep | null {
  const open = s.tasks.filter((t) => t.status !== 'done' && t.dueDate !== null);

  // 1. Vencidas: la más antigua primero (por fecha y, dentro del día, por hora límite).
  const late = open
    .filter((t) => isOverdue(t, now, nowMin))
    .sort((a, b) => (a.dueDate as string).localeCompare(b.dueDate as string) || dueMinute(a) - dueMinute(b) || b.xp - a.xp);
  if (late[0]) return { kind: 'task-late', task: late[0], courseId: late[0].courseId };

  // 2. Vencen hoy y aún hay tiempo: la de hora límite más cercana.
  const dueToday = open.filter((t) => t.dueDate === now).sort((a, b) => dueMinute(a) - dueMinute(b) || b.xp - a.xp);
  if (dueToday[0]) return { kind: 'task-today', task: dueToday[0], courseId: dueToday[0].courseId };

  // 3. Hábitos que tocan hoy y no están cumplidos. Los de «dejar» se marcan al final del día, no son una acción.
  // Uno a medias (3 de 8 vasos, solo el mínimo) sigue siendo el paso hasta cumplirlo por completo: no se pasa al
  // siguiente porque ya se haya hecho algo.
  const habit = s.habits
    .filter((h) => !isQuit(h) && isDueOn(h, now, s.habitLogs) && !isHabitDone(h, logFor(s.habitLogs, h.id, now)))
    .sort((a, b) => reminderMinute(a) - reminderMinute(b))[0];
  if (habit) return { kind: 'habit', habit, courseId: null };

  // 4. Repasos que tocan hoy o están atrasados (ya vienen ordenados por antigüedad).
  const reviews = dueReviews(s, now);
  if (reviews[0]) return { kind: 'review', review: reviews[0], pending: reviews.length, courseId: reviews[0].courseId };

  // 5. Un tema que dejaste a medias.
  for (const course of s.courses) {
    const topic = course.modules.flatMap((m) => m.topics).find((t) => t.status === 'doing');
    if (topic) return { kind: 'topic', course, topic, courseId: course.id };
  }

  return null;
}
