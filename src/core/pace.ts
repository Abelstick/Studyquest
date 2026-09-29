/**
 * Ritmo: el plazo que sugiere una ruta casi nunca es el que necesitas. Según lo que ya sabes te queda corto o largo,
 * y a veces la vida se cruza y las tareas se atrasan. Aquí se estira, se comprime o se recompone el calendario
 * de las tareas pendientes sin tocar lo ya hecho. Lógica pura, sin React ni base de datos.
 */
import type { ID, ISODate, Task } from './domain';
import { addDays, diffDays, today } from './dates';

export interface PaceOption {
  id: string;
  label: string;
  hint: string;
  /** Multiplica la distancia (en días) desde hoy hasta cada tarea. */
  factor: number;
}

export const PACE_OPTIONS: PaceOption[] = [
  { id: 'fast', label: 'Intensivo', hint: 'Ya sé parte del tema: la mitad del tiempo', factor: 0.5 },
  { id: 'quick', label: 'Algo más rápido', hint: '25 % menos de plazo', factor: 0.75 },
  { id: 'same', label: 'Como propone la IA', hint: 'Sin cambios', factor: 1 },
  { id: 'easy', label: 'Más tranquilo', hint: '50 % más de plazo', factor: 1.5 },
  { id: 'slow', label: 'Muy tranquilo', hint: 'El doble de plazo', factor: 2 },
];

/** Nueva fecha para una que estaba a `days` días de hoy. Nunca cae en el pasado. */
export const scaleDays = (days: number, factor: number): number => Math.max(0, Math.round(days * factor));

export interface Shift {
  id: ID;
  dueDate: ISODate;
}

/**
 * Recoloca las tareas pendientes de un conjunto.
 * - Las que van por delante se escalan con `factor` a partir de hoy.
 * - Las atrasadas (fecha ya pasada) se recuperan: se reparten desde hoy, `gapDays` entre una y otra, en su orden original,
 *   así no se acumulan todas en un mismo día imposible de cumplir. Lo escalado nunca se queda antes que ellas.
 * Las hechas y las que no tienen fecha no se tocan. Devuelve solo las que cambian de día.
 */
export function shiftTasks(tasks: Pick<Task, 'id' | 'dueDate' | 'status'>[], factor: number, now: ISODate = today(), gapDays = 1): Shift[] {
  const pending = tasks.filter((t) => t.status !== 'done' && t.dueDate).sort((a, b) => (a.dueDate as string).localeCompare(b.dueDate as string));
  const shifts: Shift[] = [];
  let floor = now;
  for (const t of pending) {
    const due = t.dueDate as ISODate;
    const late = due < now;
    let next: ISODate = late ? floor : addDays(now, scaleDays(diffDays(due, now), factor));
    if (next < floor) next = floor;
    floor = late ? addDays(next, gapDays) : next;
    if (next !== due) shifts.push({ id: t.id, dueDate: next });
  }
  return shifts;
}

/** Tareas pendientes con la fecha ya vencida. */
export const overdueOf = (tasks: Pick<Task, 'dueDate' | 'status'>[], now: ISODate = today()): number =>
  tasks.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate < now).length;

/** Última fecha de un conjunto de tareas (para decir «terminarías el…»). */
export const lastDue = (tasks: { dueDate: ISODate | null }[]): ISODate | null =>
  tasks.reduce<ISODate | null>((m, t) => (t.dueDate && (!m || t.dueDate > m) ? t.dueDate : m), null);
