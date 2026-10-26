import { describe, expect, it } from 'vitest';
import type { Habit, Snapshot, Task } from './domain';
import { dailyMissions, dayProgress, daySummary, deadlineText, habitDayState, missionUrgency, taskBucket } from './missions';

const NOW = '2026-09-16';
const task = (id: string, dueDate: string | null): Task => ({ id, title: id, courseId: null, priority: 'mid', status: 'todo', dueDate, estimateMin: 0, xp: 10, subtasks: [], tags: [], createdAt: '', completedAt: null });
const habit: Habit = { id: 'h', title: 'Agua', frequency: { type: 'daily' }, measure: 'boolean', target: 1, xp: 20, reminder: null, steps: [], startDate: '2026-08-01', createdAt: '' };

describe('misiones de hoy', () => {
  it('no deja fuera a los hábitos aunque haya muchas tareas con fecha', () => {
    const tasks = Array.from({ length: 10 }, (_, i) => task(`t${i}`, '2026-09-10'));
    const m = dailyMissions({ tasks, habits: [habit], habitLogs: [], courses: [] } as unknown as Snapshot, NOW);
    expect(m).toHaveLength(11);
    expect(m.some((x) => x.kind === 'habit')).toBe(true);
  });
  it('lo pendiente va antes que lo hecho y los hábitos de hoy cuentan como urgentes', () => {
    const m = dailyMissions({ tasks: [task('a', '2026-09-20'), task('b', null)], habits: [habit], habitLogs: [], courses: [] } as unknown as Snapshot, NOW);
    expect(m[0].kind).toBe('habit');
    expect(missionUrgency(m[0], NOW)).toBe(0);
  });
});

describe('qué hacer hoy', () => {
  it('clasifica las tareas por cuándo tocan', () => {
    expect(taskBucket(task('a', '2026-09-15'), NOW)).toBe('late');
    expect(taskBucket(task('b', NOW), NOW)).toBe('today');
    expect(taskBucket(task('c', '2026-09-23'), NOW)).toBe('soon');
    expect(taskBucket(task('d', '2026-09-24'), NOW)).toBe('later');
    expect(taskBucket(task('e', null), NOW)).toBe('none');
  });

  it('resume vencidas, las de hoy y la siguiente fecha', () => {
    const s = { habits: [], habitLogs: [], courses: [], tasks: [task('a', '2026-09-14'), task('b', NOW), task('c', '2026-09-30'), task('d', '2026-09-20')] } as unknown as Snapshot; // solo hacen falta estos campos
    const sum = daySummary(dailyMissions(s, NOW), NOW);
    expect(sum).toMatchObject({ late: 1, dueToday: 1, habits: 0 });
    expect(sum.next?.id).toBe('d');
  });
});

describe('avance del día', () => {
  it('cuenta hábitos y tareas hechos, el XP pendiente y las vencidas', () => {
    const done = { ...task('d', NOW), status: 'done' as const, completedAt: NOW, xp: 30 };
    const s = { habits: [habit], habitLogs: [], courses: [], tasks: [task('a', '2026-09-14'), task('b', NOW), done] } as unknown as Snapshot; // solo hacen falta estos campos
    expect(dayProgress(dailyMissions(s, NOW), NOW)).toEqual({ habitsDone: 0, habitsTotal: 1, tasksDone: 1, tasksTotal: 3, done: 1, total: 4, pct: 25, xpLeft: 40, late: 1 });
  });

  it('las tareas sin fecha o para más adelante no entran: si el día tenía 7 cosas, hacerlas es el 100 %', () => {
    const hoy = Array.from({ length: 6 }, (_, i) => ({ ...task(`d${i}`, NOW), status: 'done' as const, completedAt: NOW }));
    const open = [task('sin', null), task('luego', '2026-10-30'), { ...task('extra', null), status: 'done' as const, completedAt: NOW }];
    const hab = { ...habit, id: 'hh' };
    const s = { habits: [hab], habitLogs: [{ id: 'l', habitId: 'hh', date: NOW, value: 1, stepsDone: [] }], courses: [], tasks: [...hoy, ...open] } as unknown as Snapshot; // solo hacen falta estos campos
    const p = dayProgress(dailyMissions(s, NOW), NOW);
    expect(p).toMatchObject({ habitsDone: 1, habitsTotal: 1, tasksDone: 6, tasksTotal: 6, done: 7, total: 7, pct: 100, xpLeft: 0 });
  });

  it('sin misiones el avance es 0, no NaN', () => {
    expect(dayProgress([], NOW)).toMatchObject({ total: 0, pct: 0, xpLeft: 0 });
  });
});

describe('estado de un hábito hoy', () => {
  it('distingue hecho, a medias, pendiente y fuera de calendario', () => {
    expect(habitDayState(true, 1, true)).toBe('done');
    expect(habitDayState(false, 0.4, true)).toBe('partial');
    expect(habitDayState(false, 0, true)).toBe('pending');
    expect(habitDayState(false, 0, false)).toBe('off');
  });
});

describe('fecha límite de una tarea', () => {
  it('dice hasta cuándo se puede hacer', () => {
    expect(deadlineText(task('a', '2026-09-20'), NOW)).toBe('Hasta el 20 sep');
    expect(deadlineText(task('a', NOW), NOW)).toBe('Hasta hoy (16 sep)');
    expect(deadlineText(task('a', '2026-09-14'), NOW)).toBe('Venció el 14 sep');
    expect(deadlineText(task('a', null), NOW)).toBe('Sin fecha límite');
  });

  it('aparece en el subtítulo de la misión mientras está abierta', () => {
    const m = dailyMissions({ tasks: [task('a', '2026-09-20')], habits: [], habitLogs: [], courses: [] } as unknown as Snapshot, NOW); // solo hacen falta estos campos
    expect(m[0].subtitle).toBe('Side quest · Hasta el 20 sep');
  });
});
