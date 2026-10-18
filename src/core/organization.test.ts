import { describe, expect, it } from 'vitest';
import type { Goal, Habit, HabitLog, Snapshot, Task } from './domain';
import { habitStreaks, weakestWeekday } from './game';
import { AREAS, areaBalance, cleanArea, matchesArea } from './areas';
import { MAX_IF_THEN, cleanIfThen, ifThenText } from './ifthen';
import { cleanMinimum, isMinimumMet, keepsStreakAt, minimumOf } from './minimum';
import { needsRecovery } from './catchup';
import { actionsSummary, goalActions, goalPace, milestoneProgress, smartChecklist, smartScore, unlinkGoal } from './goals';
import { existingPlanFor } from './plans';
import { addDays } from './dates';

const NOW = '2026-09-16'; // miércoles
const task = (id: string, extra: Partial<Task> = {}): Task => ({ id, title: id, courseId: null, priority: 'mid', status: 'todo', dueDate: null, estimateMin: 0, xp: 10, subtasks: [], tags: [], createdAt: '', completedAt: null, ...extra });
const habit = (id: string, extra: Partial<Habit> = {}): Habit => ({ id, title: id, frequency: { type: 'daily' }, measure: 'minutes', target: 30, xp: 30, reminder: null, steps: [], startDate: '2026-08-01', createdAt: '', ...extra });
const log = (habitId: string, date: string, value: number): HabitLog => ({ id: `${habitId}-${date}`, habitId, date, value, stepsDone: [] });
const goal = (extra: Partial<Goal> = {}): Goal => ({
  id: 'g1', title: 'Programar mejor', rewardTitle: '', rewardDescription: '', createdAt: '2026-08-17T10:00:00.000Z',
  milestones: [
    { id: 'm1', title: 'SQL', summary: '', xp: 100, done: false, skills: [] },
    { id: 'm2', title: 'API', summary: '', xp: 100, done: false, skills: [] },
  ],
  ...extra,
});

describe('áreas de la vida', () => {
  it('son seis y se validan', () => {
    expect(AREAS).toHaveLength(6);
    expect(cleanArea('health')).toBe('health');
    expect(cleanArea('otra')).toBeUndefined();
  });

  it('el filtro distingue «todas», un área y «sin área»', () => {
    expect(matchesArea({ area: 'home' }, 'all')).toBe(true);
    expect(matchesArea({}, 'none')).toBe(true);
    expect(matchesArea({ area: 'home' }, 'none')).toBe(false);
    expect(matchesArea({ area: 'home' }, 'health')).toBe(false);
  });

  it('el equilibrio no inventa nada si nada tiene área, y cuenta lo hecho por área', () => {
    const none = areaBalance({ tasks: [task('a')], habits: [], habitLogs: [], goals: [] }, '2026-09-14', '2026-09-20');
    expect(none.rows).toEqual([]);
    const tasks = [task('a', { area: 'health', status: 'done', completedAt: NOW }), task('b', { area: 'health' }), task('c', { status: 'done', completedAt: NOW })];
    const h = habit('h', { area: 'career', measure: 'boolean', target: 1 });
    const res = areaBalance({ tasks, habits: [h], habitLogs: [log('h', NOW, 1)], goals: [] }, '2026-09-14', '2026-09-20');
    const get = (a: string) => res.rows.find((r) => r.area === a);
    expect(get('health')).toMatchObject({ tasksDone: 1, open: 1 });
    expect(get('career')?.habitDays).toBe(1);
    expect(res.unassigned).toBe(1);
  });
});

describe('planes si… entonces…', () => {
  it('descarta los incompletos, recorta y limita a tres', () => {
    const raw = [
      { when: '  termino   cansado ', then: 'descanso 15 min' },
      { when: 'solo situación', then: '' },
      { when: 'a', then: 'b' }, { when: 'c', then: 'd' }, { when: 'e', then: 'f' },
    ];
    const out = cleanIfThen(raw, () => 'id');
    expect(out).toHaveLength(MAX_IF_THEN);
    expect(out?.[0]).toMatchObject({ when: 'termino cansado', then: 'descanso 15 min' });
    expect(cleanIfThen([{ when: '', then: '' }])).toBeUndefined();
    expect(cleanIfThen('x')).toBeUndefined();
  });

  it('no duplica el «si» al mostrarlo', () => {
    expect(ifThenText({ when: 'Si llueve', then: 'estudio en casa' }).when).toBe('llueve');
  });
});

describe('versión mínima de un hábito', () => {
  const h = habit('estudiar', { minTarget: 5 });

  it('solo es válida si es menor que el objetivo y el hábito se mide en cantidad', () => {
    expect(minimumOf(h)).toBe(5);
    expect(minimumOf(habit('x', { minTarget: 30 }))).toBeNull();
    expect(minimumOf(habit('x', { minTarget: 5, measure: 'boolean', target: 1 }))).toBeNull();
    expect(minimumOf(habit('x', { minTarget: 5, kind: 'quit' }))).toBeNull();
    expect(cleanMinimum(0, h)).toBeUndefined();
    expect(cleanMinimum(10, h)).toBe(10);
    expect(cleanMinimum(99, h)).toBeUndefined();
  });

  it('el mínimo se reconoce solo entre el mínimo y el objetivo', () => {
    expect(isMinimumMet(h, log('estudiar', NOW, 4))).toBe(false);
    expect(isMinimumMet(h, log('estudiar', NOW, 5))).toBe(true);
    expect(isMinimumMet(h, log('estudiar', NOW, 30))).toBe(false);
    expect(keepsStreakAt(h)).toBe(5);
    expect(keepsStreakAt(habit('y'))).toBe(30);
  });

  it('un día en el mínimo mantiene la racha del hábito pero no cuenta como cumplido', () => {
    const logs = [log('estudiar', '2026-09-14', 30), log('estudiar', '2026-09-15', 5), log('estudiar', NOW, 30)];
    const withMin = habitStreaks(h, logs, NOW);
    expect(withMin.current).toBe(3);
    expect(withMin.completions).toBe(2);
    const without = habitStreaks(habit('estudiar'), logs, NOW);
    expect(without.current).toBe(1); // sin mínimo, el día de 5 min rompe la racha
  });

  it('en el mínimo no es un «día flojo» del hábito', () => {
    const logs = Array.from({ length: 90 }, (_, i) => log('estudiar', addDays(NOW, -i), 5));
    expect(weakestWeekday(h, logs, NOW)).toBeNull();
  });
});

describe('recuperar la rutina tras un día perdido', () => {
  it('avisa si ayer tocaba y no se hizo ni el mínimo, y hoy sigue pendiente', () => {
    const h = habit('h', { minTarget: 5 });
    expect(needsRecovery(h, [], NOW)).toBe(true);
    expect(needsRecovery(h, [log('h', '2026-09-15', 5)], NOW)).toBe(false); // ayer cumplió el mínimo
    expect(needsRecovery(h, [log('h', NOW, 5)], NOW)).toBe(false); // hoy ya retomó
  });

  it('no avisa en hábitos de cuota, de dejar un vicio ni recién creados', () => {
    expect(needsRecovery(habit('w', { frequency: { type: 'weekly' } }), [], NOW)).toBe(false);
    expect(needsRecovery(habit('q', { kind: 'quit', measure: 'boolean', target: 1 }), [], NOW)).toBe(false);
    expect(needsRecovery(habit('n', { startDate: NOW }), [], NOW)).toBe(false);
  });

  it('un día que no tocaba no es un día perdido', () => {
    const lunes = habit('l', { frequency: { type: 'days', days: [0] } });
    expect(needsRecovery(lunes, [], NOW)).toBe(false);
  });
});

describe('metas SMART', () => {
  it('enlaza acciones por goalId sin copiar nada', () => {
    const tasks = [task('t1', { goalId: 'g1' }), task('t2'), task('t3', { goalId: 'otra' })];
    const habits = [habit('h1', { goalId: 'g1' }), habit('h2')];
    const a = goalActions('g1', { tasks, habits });
    expect(a.tasks.map((t) => t.id)).toEqual(['t1']);
    expect(a.habits.map((h) => h.id)).toEqual(['h1']);
  });

  it('el avance de la meta sigue siendo el de sus hitos', () => {
    const g = goal();
    g.milestones[0].done = true;
    expect(milestoneProgress(g)).toEqual({ done: 1, total: 2, pct: 50 });
  });

  it('resume las acciones con los indicadores de siempre', () => {
    const h = habit('h1', { goalId: 'g1' });
    const sum = actionsSummary({ tasks: [task('t1', { status: 'done' }), task('t2')], habits: [h] }, [log('h1', NOW, 30)], NOW);
    expect(sum.tasksDone).toBe(1);
    expect(sum.tasksTotal).toBe(2);
    expect(sum.habits[0].pct).toBeGreaterThan(0);
  });

  it('el ritmo compara el tiempo transcurrido con los hitos conquistados', () => {
    expect(goalPace(goal(), NOW).state).toBe('none'); // sin plazo no hay ritmo
    const g = goal({ deadline: '2026-10-16' }); // 60 días desde el 17-ago; ya pasó ~48 %
    expect(goalPace(g, NOW).state).toBe('behind');
    g.milestones[0].done = true; // 50 % hecho
    expect(goalPace(g, NOW).state).toBe('on-track');
    g.milestones[1].done = true;
    expect(goalPace(g, NOW).state).toBe('done');
    expect(goalPace(goal({ deadline: '2026-09-01' }), NOW).state).toBe('overdue');
  });

  it('el checklist SMART orienta sin bloquear', () => {
    const empty = smartChecklist(goal(), { tasks: [], habits: [] });
    expect(smartScore(empty)).toBe(1); // solo «específica»
    const full = smartChecklist(goal({ measure: '3 sesiones por semana', why: 'Quiero un mejor empleo', deadline: '2026-12-01' }), { tasks: [task('t')], habits: [] });
    expect(smartScore(full)).toBe(5);
  });

  it('al borrar la meta solo se suelta el vínculo de lo que aportaba', () => {
    const freed = unlinkGoal('g1', { tasks: [task('t1', { goalId: 'g1', area: 'growth' }), task('t2')], habits: [habit('h1', { goalId: 'g1' })] });
    expect(freed.tasks).toHaveLength(1);
    expect(freed.tasks[0].goalId).toBeUndefined();
    expect(freed.tasks[0].area).toBe('growth');
    expect(freed.habits[0].goalId).toBeUndefined();
  });
});

describe('planes duplicados', () => {
  it('avisa si ya hay un curso o una meta con ese nombre', () => {
    const s = { courses: [{ title: 'Análisis de datos' }], goals: [] } as unknown as Pick<Snapshot, 'courses' | 'goals'>; // solo cuenta el título
    expect(existingPlanFor('  análisis DE datos ', s)).toBe('el curso «Análisis de datos»');
    expect(existingPlanFor('Inglés', s)).toBeNull();
    expect(existingPlanFor('', s)).toBeNull();
  });
});
