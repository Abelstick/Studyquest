/**
 * Plazo de un curso: hasta cuándo tienes para terminarlo y qué ritmo hace falta para llegar.
 * La fecha la fijas tú (`dueDate`); si no, se deduce de la tarea abierta más lejana del curso (así salen los
 * cursos que creó el planificador). Sin ninguna de las dos, el curso no tiene plazo. Funciones puras.
 */
import type { Course, ISODate, Task } from './domain';
import { diffDays, shortDate, today } from './dates';
import { courseProgress } from './game';
import { lastDue } from './pace';

/** `done` ya terminado · `late` venció sin terminar · `soon` termina en 7 días o menos · `ok` con tiempo · `none` sin plazo. */
export type DeadlineState = 'done' | 'late' | 'soon' | 'ok' | 'none';

export interface CourseDeadline {
  /** Fecha límite, o null si el curso no tiene plazo. */
  date: ISODate | null;
  /** `set`: la fijaste tú · `tasks`: sale de la última tarea abierta del curso. */
  source: 'set' | 'tasks' | null;
  /** Días hasta la fecha (negativo si ya pasó), o null sin plazo. */
  daysLeft: number | null;
  topicsLeft: number;
  /** Temas por semana que hay que sacar para llegar a tiempo, o null si no aplica (sin plazo, terminado o vencido). */
  perWeek: number | null;
  state: DeadlineState;
}

/** Días que quedan para decir «termina pronto». */
export const SOON_DAYS = 7;

export function courseDeadline(course: Course, tasks: Task[], now: ISODate = today()): CourseDeadline {
  const p = courseProgress(course);
  const topicsLeft = p.total - p.done;
  const finished = p.total > 0 && topicsLeft === 0;
  const own = course.dueDate ?? null;
  const fromTasks = own ? null : lastDue(tasks.filter((t) => t.courseId === course.id && t.status !== 'done'));
  const date = own ?? fromTasks;
  const source = own ? 'set' : fromTasks ? 'tasks' : null;
  const daysLeft = date ? diffDays(date, now) : null;

  let state: DeadlineState = 'none';
  if (finished) state = 'done';
  else if (daysLeft !== null) state = daysLeft < 0 ? 'late' : daysLeft <= SOON_DAYS ? 'soon' : 'ok';

  const perWeek = state === 'ok' || state === 'soon' ? (topicsLeft > 0 && daysLeft !== null ? Math.ceil(topicsLeft / Math.max(1, daysLeft / 7)) : null) : null;
  return { date, source, daysLeft, topicsLeft, perWeek, state };
}

/** «Hasta el 30 sep · faltan 14 días», «Venció el 2 sep · hace 5 días», «Completado» o «Sin plazo». */
export function deadlineSummary(d: CourseDeadline): string {
  if (d.state === 'done') return 'Completado';
  if (!d.date || d.daysLeft === null) return 'Sin plazo';
  const n = d.daysLeft;
  if (n < 0) return `Venció el ${shortDate(d.date)} · ${n === -1 ? 'ayer' : `hace ${-n} días`}`;
  if (n === 0) return 'Hasta hoy';
  if (n === 1) return `Hasta mañana (${shortDate(d.date)})`;
  return `Hasta el ${shortDate(d.date)} · faltan ${n} días`;
}

/** Ritmo para llegar: «≈ 3 temas por semana», o null si no hay nada que decir. */
export function paceText(d: CourseDeadline): string | null {
  if (d.perWeek === null) return null;
  return `≈ ${d.perWeek} ${d.perWeek === 1 ? 'tema' : 'temas'} por semana para llegar`;
}
