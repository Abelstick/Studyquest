/**
 * Un plan del planificador crea cuatro cosas a la vez: curso, meta, hábito y tareas.
 * Aquí se averigua qué pertenece a un mismo plan, para poder deshacerlo entero y no dejar restos.
 *
 * Lógica pura, sin React ni base de datos.
 */
import type { Course, Goal, Habit, ID, Snapshot, Task } from './domain';

export interface PlanMembers {
  course?: Course;
  goal?: Goal;
  habit?: Habit;
  tasks: Task[];
}

type Parts = Pick<Snapshot, 'courses' | 'goals' | 'habits' | 'tasks'>;

/** Todo lo que salió del mismo plan. */
export function planMembers(planId: ID, s: Parts): PlanMembers {
  return {
    course: s.courses.find((c) => c.planId === planId),
    goal: s.goals.find((g) => g.planId === planId),
    habit: s.habits.find((h) => h.planId === planId),
    tasks: s.tasks.filter((t) => t.planId === planId),
  };
}

/**
 * Planes creados ANTES de que existiera `planId`: no hay marca, así que se reconocen por su forma.
 * El planificador siempre nombra la meta igual que el curso y el hábito «Estudiar <curso>».
 * Es una suposición, por eso nunca se borra nada sin enseñarlo antes.
 */
export function legacyPlanMembers(course: Course, s: Parts): PlanMembers {
  const mismoNombre = (t: string) => t.trim().toLowerCase() === course.title.trim().toLowerCase();
  return {
    course,
    goal: s.goals.find((g) => !g.planId && mismoNombre(g.title)),
    habit: s.habits.find((h) => !h.planId && h.title.trim().toLowerCase() === `estudiar ${course.title.trim().toLowerCase()}`),
    tasks: s.tasks.filter((t) => t.courseId === course.id),
  };
}

/** ¿Este curso salió de un plan (por su marca o por su forma)? */
export function planOfCourse(course: Course, s: Parts): PlanMembers | null {
  if (course.planId) {
    const m = planMembers(course.planId, s);
    return m.goal || m.habit ? m : null;
  }
  // El planificador se identifica también por el profesor que pone.
  if (course.professor !== 'Plan inteligente') return null;
  const m = legacyPlanMembers(course, s);
  return m.goal || m.habit ? m : null;
}

/** Lo que se borraría además del curso, en palabras, para el aviso de confirmación. */
export function describeExtras(m: PlanMembers): string {
  const partes: string[] = [];
  if (m.goal) partes.push(`la meta «${m.goal.title}»`);
  if (m.habit) partes.push(`el hábito «${m.habit.title}»`);
  if (partes.length === 2) return `${partes[0]} y ${partes[1]}`;
  return partes[0] ?? '';
}

/** Ids a borrar, agrupados por colección. El curso se borra aparte (arrastra sus tareas). */
export const planIdsToDelete = (m: PlanMembers): { goals: ID[]; habits: ID[] } => ({
  goals: m.goal ? [m.goal.id] : [],
  habits: m.habit ? [m.habit.id] : [],
});

/**
 * ¿Ya hay algo con el mismo nombre que el plan que se va a crear? Crear el plan dos veces dejaría dos cursos, dos metas
 * y dos hábitos iguales, con sus tareas repetidas: se avisa antes. Devuelve en palabras qué existe, o null.
 */
export function existingPlanFor(goalTitle: string, s: Pick<Snapshot, 'courses' | 'goals'>): string | null {
  const name = goalTitle.trim().toLowerCase();
  if (!name) return null;
  const course = s.courses.find((c) => c.title.trim().toLowerCase() === name);
  const goal = s.goals.find((g) => g.title.trim().toLowerCase() === name);
  if (course && goal) return `el curso y la meta «${goal.title}»`;
  if (course) return `el curso «${course.title}»`;
  if (goal) return `la meta «${goal.title}»`;
  return null;
}
