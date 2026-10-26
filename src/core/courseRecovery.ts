/**
 * Plan de recuperación de un curso que se complicó (vencido o con un ritmo que no alcanza): una fecha realista
 * según tu ritmo y un reparto de los temas pendientes en tareas con fecha. Solo propone: la pantalla decide si se
 * aplica. Funciones puras.
 */
import type { Course, ISODate, Task } from './domain';
import { addDays, diffDays, today } from './dates';
import { courseDeadline } from './courseDeadline';

/** Temas por semana que se asumen si todavía no hay ritmo medido. */
export const DEFAULT_PACE = 2;
/** Máximo de tareas que crea un reparto: más que eso es un plan que nadie sigue. */
export const MAX_SPREAD = 30;

export interface TopicSlot {
  topicId: string;
  title: string;
  /** Día en que toca terminar el tema. */
  date: ISODate;
}

export interface RecoveryPlan {
  /** Fecha realista para terminar al ritmo que llevas (o al mínimo si no hay datos). */
  newDate: ISODate;
  /** Ritmo con el que se calculó, en temas por semana. */
  pace: number;
  /** Los temas pendientes repartidos hasta `target`. */
  slots: TopicSlot[];
  /** Hasta cuándo se reparten: el plazo actual si aún no venció; si no, la fecha realista. */
  target: ISODate;
  /** Temas pendientes que no entraron por pasar de `MAX_SPREAD`. */
  omitted: number;
}

/** Null si el curso está terminado o no tiene nada que replantear. */
export function recoveryPlan(course: Course, tasks: Task[], now: ISODate = today()): RecoveryPlan | null {
  const d = courseDeadline(course, tasks, now);
  if (d.state === 'done' || d.topicsLeft === 0) return null;

  const pace = d.actualPerWeek && d.actualPerWeek > 0 ? d.actualPerWeek : DEFAULT_PACE;
  const newDate = addDays(now, Math.max(7, Math.ceil((d.topicsLeft / pace) * 7)));
  const target = d.date && d.daysLeft !== null && d.daysLeft >= 1 ? d.date : newDate;

  // Temas pendientes que aún no tienen una tarea abierta con ese nombre (no se duplica lo ya repartido).
  const have = new Set(tasks.filter((t) => t.courseId === course.id && t.status !== 'done').map((t) => t.title.trim().toLowerCase()));
  const pending = course.modules
    .flatMap((m) => m.topics)
    .filter((t) => t.status !== 'done' && !have.has(t.title.trim().toLowerCase()));
  const used = pending.slice(0, MAX_SPREAD);
  const span = Math.max(1, diffDays(target, now));
  const slots = used.map((t, i) => ({ topicId: t.id, title: t.title, date: addDays(now, Math.max(1, Math.ceil(((i + 1) * span) / used.length))) }));
  return { newDate, pace, slots, target, omitted: pending.length - used.length };
}
