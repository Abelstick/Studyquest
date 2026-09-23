import { describe, expect, it } from 'vitest';
import type { Course, Goal, Habit, Task } from './domain';
import { describeExtras, legacyPlanMembers, planIdsToDelete, planMembers, planOfCourse } from './plans';

const course = (over: Partial<Course> = {}): Course => ({
  id: 'c1', title: 'Aprender guitarra', professor: 'Plan inteligente', field: 'plan de estudio', mentor: null, modules: [], createdAt: '', ...over,
});
const goal = (over: Partial<Goal> = {}): Goal => ({ id: 'g1', title: 'Aprender guitarra', rewardTitle: '', rewardDescription: '', milestones: [], createdAt: '', ...over });
const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h1', title: 'Estudiar Aprender guitarra', frequency: { type: 'daily' }, measure: 'minutes', target: 30, xp: 30,
  reminder: null, steps: [], startDate: '2026-01-01', createdAt: '', ...over,
});
const task = (over: Partial<Task> = {}): Task => ({
  id: 't1', title: 'Semana 1', courseId: 'c1', priority: 'mid', status: 'todo', dueDate: null, estimateMin: 60, xp: 40,
  subtasks: [], tags: ['plan'], createdAt: '', completedAt: null, ...over,
});

const partes = (over: Partial<{ courses: Course[]; goals: Goal[]; habits: Habit[]; tasks: Task[] }> = {}) => ({
  courses: [], goals: [], habits: [], tasks: [], ...over,
});

describe('lo que pertenece a un plan', () => {
  it('reúne curso, meta, hábito y tareas por su marca', () => {
    const p = partes({
      courses: [course({ planId: 'p1' })],
      goals: [goal({ planId: 'p1' }), goal({ id: 'suelta', planId: 'otro' })],
      habits: [habit({ planId: 'p1' })],
      tasks: [task({ planId: 'p1' }), task({ id: 't2', planId: 'p1' }), task({ id: 'ajena' })],
    });
    const m = planMembers('p1', p);
    expect(m.course?.id).toBe('c1');
    expect(m.goal?.id).toBe('g1');
    expect(m.habit?.id).toBe('h1');
    expect(m.tasks.map((t) => t.id)).toEqual(['t1', 't2']);
  });

  it('no mezcla cosas de otro plan', () => {
    const p = partes({ goals: [goal({ planId: 'otro' })] });
    expect(planMembers('p1', p).goal).toBeUndefined();
  });
});

describe('planes creados antes de que existiera la marca', () => {
  it('los reconoce por su forma: misma meta y hábito «Estudiar X»', () => {
    const c = course();
    const p = partes({ courses: [c], goals: [goal()], habits: [habit()], tasks: [task()] });
    const m = legacyPlanMembers(c, p);
    expect(m.goal?.id).toBe('g1');
    expect(m.habit?.id).toBe('h1');
    expect(m.tasks).toHaveLength(1);
  });

  it('no se lleva por delante una meta que ya pertenece a otro plan', () => {
    const c = course();
    const p = partes({ courses: [c], goals: [goal({ planId: 'otro' })], habits: [] });
    expect(legacyPlanMembers(c, p).goal).toBeUndefined();
  });

  it('no confunde una meta con nombre parecido', () => {
    const c = course();
    const p = partes({ courses: [c], goals: [goal({ title: 'Aprender guitarra eléctrica' })], habits: [] });
    expect(legacyPlanMembers(c, p).goal).toBeUndefined();
  });
});

describe('¿este curso salió de un plan?', () => {
  it('sí, si lleva la marca', () => {
    const c = course({ planId: 'p1' });
    const p = partes({ courses: [c], goals: [goal({ planId: 'p1' })], habits: [] });
    expect(planOfCourse(c, p)).not.toBeNull();
  });

  it('sí, si es antiguo pero tiene la forma de un plan', () => {
    const c = course();
    expect(planOfCourse(c, partes({ courses: [c], goals: [goal()], habits: [habit()] }))).not.toBeNull();
  });

  it('NO, si es un curso normal creado a mano', () => {
    const c = course({ professor: 'Prof. Marta' });
    expect(planOfCourse(c, partes({ courses: [c], goals: [goal()], habits: [habit()] }))).toBeNull();
  });

  it('NO, si no queda nada suelto que borrar', () => {
    const c = course({ planId: 'p1' });
    expect(planOfCourse(c, partes({ courses: [c] }))).toBeNull();
  });
});

describe('lo que se le cuenta a quien borra', () => {
  it('nombra la meta y el hábito', () => {
    expect(describeExtras({ goal: goal(), habit: habit(), tasks: [] })).toBe('la meta «Aprender guitarra» y el hábito «Estudiar Aprender guitarra»');
  });

  it('nombra solo lo que hay', () => {
    expect(describeExtras({ goal: goal(), tasks: [] })).toBe('la meta «Aprender guitarra»');
    expect(describeExtras({ tasks: [] })).toBe('');
  });

  it('los ids a borrar salen agrupados (el curso va aparte, arrastra sus tareas)', () => {
    expect(planIdsToDelete({ goal: goal(), habit: habit(), tasks: [task()] })).toEqual({ goals: ['g1'], habits: ['h1'] });
    expect(planIdsToDelete({ tasks: [] })).toEqual({ goals: [], habits: [] });
  });
});
