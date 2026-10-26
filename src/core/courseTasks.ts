/**
 * Las tareas de un curso vistas de un vistazo: cuántas siguen abiertas, cuántas están vencidas y cuál es la
 * siguiente. Sirve a las pantallas de Cursos, del curso e Inicio para que un curso diga qué le debes.
 */
import type { ID, ISODate, Task } from './domain';
import { today } from './dates';
import { dueTimeOf } from './tasks';

export interface CourseTasks {
  /** Abiertas, por vencimiento: primero las que vencen antes; sin fecha, al final. */
  open: Task[];
  late: number;
  dueToday: number;
  done: number;
  /** La que toca primero, o null si no queda ninguna abierta. */
  next: Task | null;
}

const dueKey = (t: Task) => `${t.dueDate ?? '9999'} ${dueTimeOf(t) ?? '99'}`;

export function courseTasks(tasks: Task[], courseId: ID, now: ISODate = today()): CourseTasks {
  const mine = tasks.filter((t) => t.courseId === courseId);
  const open = mine.filter((t) => t.status !== 'done').sort((a, b) => dueKey(a).localeCompare(dueKey(b)) || b.xp - a.xp);
  return {
    open,
    late: open.filter((t) => t.dueDate && t.dueDate < now).length,
    dueToday: open.filter((t) => t.dueDate === now).length,
    done: mine.length - open.length,
    next: open[0] ?? null,
  };
}

/** «3 abiertas · 1 vencida», o «Sin tareas» / «Todo al día» cuando no hay nada abierto. */
export function courseTasksLabel(c: CourseTasks): string {
  if (c.open.length === 0) return c.done > 0 ? 'Todo al día' : 'Sin tareas';
  const open = `${c.open.length} ${c.open.length === 1 ? 'abierta' : 'abiertas'}`;
  return c.late > 0 ? `${open} · ${c.late} ${c.late === 1 ? 'vencida' : 'vencidas'}` : open;
}
