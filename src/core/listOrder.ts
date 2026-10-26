/**
 * Orden y filtros de las listas de Hábitos, Cursos y Tareas. Funciones puras: la pantalla elige el criterio y
 * aquí se decide quién va antes. Nada se oculta salvo lo que pide un filtro.
 */
import type { Course, Habit, ISODate, Snapshot, Task } from './domain';
import { courseProgress } from './game';
import { courseLastStudied } from './stats';

/* ---------- Hábitos ---------- */

/** `today`: lo que toca y falta, luego lo hecho, al final lo que hoy no toca. `month`: el menos cumplido primero. */
export type HabitSort = 'today' | 'name' | 'month';

export const HABIT_SORTS: { value: HabitSort; label: string }[] = [
  { value: 'today', label: 'Lo de hoy primero' },
  { value: 'month', label: 'Menos cumplidos' },
  { value: 'name', label: 'A–Z' },
];

interface HabitCard {
  h: Habit;
  due: boolean;
  done: boolean;
  /** Cumplimiento del mes, 0-100. */
  pct: number;
}

/** 0 = toca y falta · 1 = ya hecho hoy · 2 = hoy no toca. */
const habitRank = (c: Pick<HabitCard, 'due' | 'done'>): number => {
  if (c.done) return 1;
  return c.due ? 0 : 2;
};

/** Ordena sin tocar la lista original. Con empate se conserva el orden de creación. */
export function sortHabitCards<T extends HabitCard>(cards: T[], sort: HabitSort): T[] {
  const by = (a: T, b: T): number => {
    if (sort === 'name') return a.h.title.localeCompare(b.h.title, 'es');
    if (sort === 'month') return a.pct - b.pct;
    return habitRank(a) - habitRank(b);
  };
  return cards
    .map((c, i) => ({ c, i }))
    .sort((x, y) => by(x.c, y.c) || x.i - y.i)
    .map((x) => x.c);
}

/* ---------- Cursos ---------- */

/** `new`: sin ningún tema hecho · `doing`: empezado · `done`: todos los temas hechos. */
export type CourseStatus = 'new' | 'doing' | 'done';
export type CourseFilter = CourseStatus | 'all';
export type CourseSort = 'recent' | 'progress' | 'name';

export const COURSE_FILTERS: { value: CourseFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'doing', label: 'En curso' },
  { value: 'new', label: 'Sin empezar' },
  { value: 'done', label: 'Completados' },
];
export const COURSE_SORTS: { value: CourseSort; label: string }[] = [
  { value: 'recent', label: 'Estudiados hace poco' },
  { value: 'progress', label: 'Más avanzados' },
  { value: 'name', label: 'A–Z' },
];

export function courseStatus(c: Course): CourseStatus {
  const p = courseProgress(c);
  if (p.total > 0 && p.done === p.total) return 'done';
  return p.done > 0 ? 'doing' : 'new';
}

/** Filtra por estado y ordena. Con «recientes» los completados van al final. */
export function arrangeCourses(courses: Course[], sessions: Snapshot['sessions'], filter: CourseFilter, sort: CourseSort): Course[] {
  const last = (c: Course): ISODate | '' => courseLastStudied({ sessions }, c) ?? '';
  const by = (a: Course, b: Course): number => {
    if (sort === 'name') return a.title.localeCompare(b.title, 'es');
    if (sort === 'progress') return courseProgress(b).pct - courseProgress(a).pct;
    return Number(courseStatus(a) === 'done') - Number(courseStatus(b) === 'done') || last(b).localeCompare(last(a)) || b.createdAt.localeCompare(a.createdAt);
  };
  return courses.filter((c) => filter === 'all' || courseStatus(c) === filter).sort(by);
}

/* ---------- Tareas superadas ---------- */

/** Cuántas tareas superadas se enseñan de entrada; el resto queda tras «Ver más». */
export const DONE_SHOWN = 6;

/** Las superadas, la más reciente primero. Las que no guardan el día de cierre van al final. */
export const byRecentlyDone = (a: Task, b: Task): number => (b.completedAt ?? '').localeCompare(a.completedAt ?? '');
