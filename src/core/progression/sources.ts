/**
 * Reparto de atributos de cada cosa que da XP, con su contexto: una tarea o un hábito de un curso heredan
 * la categoría del curso si su título no dice nada claro. También asigna categoría a lo que no la tiene.
 */
import type { AttributeMapping, CategoryId, Course, Goal, Habit, ID, Progressable, Project, Task } from '../domain';
import { isAttributeId } from './attributes';
import { categoryOf, isCategoryId } from './categories';
import { categoryIdOf, mappingOf, type SuggestContext } from './suggest';
import { SOURCE_BASE_XP } from './config';
import { habitBaseXp, previewGains, taskBaseXp } from './rewards';

type Courses = readonly Course[];

export const courseCtx = (c: Pick<Course, 'field'>): SuggestContext => ({ kind: 'course', extra: c.field });
const courseById = (courses: Courses, id: ID | null | undefined) => (id ? courses.find((c) => c.id === id) : undefined);
const inherited = (courses: Courses, id: ID | null | undefined): CategoryId | undefined => {
  const c = courseById(courses, id);
  return c ? categoryIdOf(c, courseCtx(c)) : undefined;
};

/** Contexto con que se sugiere la categoría de una tarea (también desde el formulario, antes de existir). */
export const taskCtx = (t: Pick<Task, 'area' | 'tags' | 'courseId'>, courses: Courses): SuggestContext => ({ kind: 'task', area: t.area, extra: t.tags.join(' '), inherit: inherited(courses, t.courseId) });
export const habitCtx = (h: Pick<Habit, 'area' | 'courseId'>, courses: Courses): SuggestContext => ({ kind: 'habit', area: h.area, inherit: inherited(courses, h.courseId) });
const goalCtx = (g: Goal): SuggestContext => ({ kind: 'goal', area: g.area });
const projectCtx: SuggestContext = { kind: 'project' };

export const courseMapping = (c: Course): AttributeMapping => mappingOf(c, courseCtx(c));
export const taskMapping = (t: Task, courses: Courses): AttributeMapping => mappingOf(t, taskCtx(t, courses));
export const habitMapping = (h: Habit, courses: Courses): AttributeMapping => mappingOf(h, habitCtx(h, courses));
export const goalMapping = (g: Goal): AttributeMapping => mappingOf(g, goalCtx(g));
export const projectMapping = (p: Project): AttributeMapping => mappingOf(p, projectCtx);

/** Sesión de estudio: la del curso, o «Estudio» si es libre. */
export const sessionMapping = (courseId: ID | null, courses: Courses): AttributeMapping => {
  const c = courseById(courses, courseId);
  return c ? courseMapping(c) : categoryOf('estudio').mapping;
};

/** Certificación: la de su curso, o «Cursos». */
export const certificationMapping = (courseId: ID | null, courses: Courses): AttributeMapping => {
  const c = courseById(courses, courseId);
  return c ? courseMapping(c) : categoryOf('curso').mapping;
};

/* Lo que se ve antes de completar algo: el XP base repartido entre sus atributos (sin multiplicadores). */
export const taskGains = (t: Task, courses: Courses) => previewGains(taskBaseXp(t), taskMapping(t, courses));
export const habitGains = (h: Habit, courses: Courses) => previewGains(habitBaseXp(h), habitMapping(h, courses));
export const topicGains = (c: Course) => previewGains(SOURCE_BASE_XP.topic, courseMapping(c));
export const milestoneGains = (g: Goal) => previewGains(SOURCE_BASE_XP.milestone, goalMapping(g));
export const checkpointGains = (p: Project) => previewGains(SOURCE_BASE_XP.checkpoint, projectMapping(p));

/** Categoría y reparto válidos de un objeto venido de fuera (copia de seguridad, IA). Lo que no es válido se descarta. */
export function cleanProgressable(o: { category?: unknown; attributes?: unknown }): Progressable {
  const out: Progressable = {};
  if (isCategoryId(o.category)) out.category = o.category;
  const a = o.attributes;
  if (a && typeof a === 'object' && 'primary' in a && isAttributeId(a.primary)) {
    const secondary = 'secondary' in a && isAttributeId(a.secondary) && a.secondary !== a.primary ? a.secondary : null;
    out.attributes = { primary: a.primary, secondary };
  }
  return out;
}

export interface Categorizable {
  tasks: readonly Task[];
  habits: readonly Habit[];
  courses: readonly Course[];
  goals: readonly Goal[];
  projects: readonly Project[];
}

/**
 * Lo que aún no tiene categoría, ya con la sugerida (solo lo que cambia). Los cursos van primero porque
 * sus tareas y hábitos la heredan. Lo que ya tiene categoría o reparto elegido no se toca.
 */
export function withMissingCategories(s: Categorizable): { tasks: Task[]; habits: Habit[]; courses: Course[]; goals: Goal[]; projects: Project[] } {
  const courses = s.courses.filter((c) => !c.category).map(categorizeCourse);
  const all = s.courses.map((c) => courses.find((x) => x.id === c.id) ?? c);
  return {
    courses,
    tasks: s.tasks.filter((t) => !t.category).map((t) => categorizeTask(t, all)),
    habits: s.habits.filter((h) => !h.category).map((h) => categorizeHabit(h, all)),
    goals: s.goals.filter((g) => !g.category).map(categorizeGoal),
    projects: s.projects.filter((p) => !p.category).map(categorizeProject),
  };
}

/* Lo mismo para una sola cosa recién creada: si ya trae categoría, se respeta. */
export const categorizeCourse = (c: Course): Course => (c.category ? c : { ...c, category: categoryIdOf(c, courseCtx(c)) });
export const categorizeTask = (t: Task, courses: Courses): Task => (t.category ? t : { ...t, category: categoryIdOf(t, taskCtx(t, courses)) });
export const categorizeHabit = (h: Habit, courses: Courses): Habit => (h.category ? h : { ...h, category: categoryIdOf(h, habitCtx(h, courses)) });
export const categorizeGoal = (g: Goal): Goal => (g.category ? g : { ...g, category: categoryIdOf(g, goalCtx(g)) });
export const categorizeProject = (p: Project): Project => (p.category ? p : { ...p, category: categoryIdOf(p, projectCtx) });
