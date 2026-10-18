import { describe, expect, it } from 'vitest';
import type { Habit, HabitLog, Snapshot, Task, WeekReview, XpEvent } from './domain';
import { defaultProfile } from './game';
import { addDays } from './dates';
import { agendaToday, topPriorities } from './today';
import {
  buildWeekReview, cleanReview, emptyReview, MAX_REVIEWS, recurringObstacles, reviewOf, reviewWeekFor, spreadTasks, suggestPriorities, upsertReview, weeklyPriorityIds,
} from './weekReview';

const WEEK = '2026-09-14'; // lunes
const NOW = '2026-09-16'; // miércoles
const task = (id: string, extra: Partial<Task> = {}): Task => ({ id, title: id, courseId: null, priority: 'mid', status: 'todo', dueDate: null, estimateMin: 0, xp: 10, subtasks: [], tags: [], createdAt: '', completedAt: null, ...extra });
const habit = (id: string, extra: Partial<Habit> = {}): Habit => ({ id, title: id, frequency: { type: 'daily' }, measure: 'boolean', target: 1, xp: 20, reminder: null, steps: [], startDate: '2026-08-01', createdAt: '', ...extra });
const log = (habitId: string, date: string, value = 1): HabitLog => ({ id: `${habitId}-${date}`, habitId, date, value, stepsDone: [] });
const snap = (over: Partial<Snapshot> = {}): Snapshot => ({
  profile: defaultProfile('u'), tasks: [], habits: [], habitLogs: [], courses: [], goals: [], projects: [], notes: [], certifications: [], personalRewards: [], sessions: [], xpEvents: [], notifications: [], events: [], ...over,
});
const review = (week: string, extra: Partial<WeekReview> = {}): WeekReview => ({ ...emptyReview(week), ...extra });

describe('qué semana toca revisar', () => {
  it('el domingo la que termina; de lunes a miércoles la anterior; el resto, ninguna', () => {
    expect(reviewWeekFor('2026-09-20')).toBe('2026-09-14'); // domingo
    expect(reviewWeekFor('2026-09-21')).toBe('2026-09-14'); // lunes
    expect(reviewWeekFor('2026-09-23')).toBe('2026-09-14'); // miércoles
    expect(reviewWeekFor('2026-09-24')).toBeNull(); // jueves
    expect(reviewWeekFor('2026-09-19')).toBeNull(); // sábado
  });
});

describe('guardar revisiones', () => {
  it('sustituye la de la misma semana y conserva solo las últimas', () => {
    let list: WeekReview[] | undefined;
    list = upsertReview(list, review('2026-09-07', { wins: 'a' }));
    list = upsertReview(list, review('2026-09-07', { wins: 'b' }));
    expect(list).toHaveLength(1);
    expect(list[0].wins).toBe('b');
    for (let i = 0; i < MAX_REVIEWS + 5; i++) list = upsertReview(list, review(addDays('2020-01-06', i * 7)));
    expect(list.length).toBeLessThanOrEqual(MAX_REVIEWS);
  });

  it('limpia lo que llega de una copia: recorta, limita y resuelve prioridades', () => {
    const r = cleanReview({ week: '2026-09-16', obstacles: ['  Cansancio ', '', 'x'.repeat(500)], wins: 5, adjustment: 'Dormir antes', priorities: ['t1', 't2', 't1', 'muerta', 't3', 't4'] }, (id) => (id === 'muerta' ? null : String(id)));
    expect(r?.week).toBe(WEEK); // siempre el lunes
    expect(r?.obstacles).toHaveLength(2);
    expect(r?.obstacles[1]).toHaveLength(200);
    expect(r?.wins).toBe('');
    expect(r?.priorities).toEqual(['t1', 't2', 't3']);
    expect(cleanReview({ week: 'ayer' })).toBeNull();
    expect(cleanReview(null)).toBeNull();
  });

  it('las prioridades de la revisión de la semana anterior rigen la semana en curso', () => {
    const profile = { ...defaultProfile('u'), reviews: [review('2026-09-07', { priorities: ['t1'] })] };
    expect(weeklyPriorityIds(profile, NOW)).toEqual(['t1']);
    expect(reviewOf(profile, '2026-09-07')?.priorities).toEqual(['t1']);
    expect(weeklyPriorityIds(profile, '2026-09-23')).toEqual([]);
  });

  it('detecta los obstáculos que se repiten', () => {
    const rs = [review('2026-08-31', { obstacles: ['Cansancio'] }), review('2026-09-07', { obstacles: ['cansancio', 'Imprevisto'] }), review(WEEK, { obstacles: ['Cansancio'] })];
    expect(recurringObstacles(rs, WEEK)).toEqual([{ text: 'Cansancio', count: 2 }]);
    expect(recurringObstacles(rs, '2026-08-31')).toEqual([]);
  });
});

describe('construir la revisión', () => {
  it('compara lo planificado con lo hecho sin tratar lo pendiente como fallo', () => {
    const tasks = [
      task('hecha', { dueDate: '2026-09-15', status: 'done', completedAt: '2026-09-15' }),
      task('pendiente', { dueDate: '2026-09-16' }),
      task('vieja', { dueDate: '2026-09-01' }),
      task('extra', { status: 'done', completedAt: '2026-09-16' }),
      task('futura', { dueDate: '2026-09-30' }),
    ];
    const r = buildWeekReview(snap({ tasks }), WEEK, NOW);
    expect(r.tasks).toMatchObject({ planned: 2, plannedDone: 1, extraDone: 1 });
    expect(r.tasks.pending.map((t) => t.id)).toEqual(['vieja', 'pendiente']);
    expect(r.inProgress).toBe(true);
  });

  it('separa hechos, mínimo, omitidos y lo que no tocaba', () => {
    const h = habit('estudiar', { measure: 'minutes', target: 30, minTarget: 5 });
    const lunes = habit('gym', { frequency: { type: 'days', days: [0] } });
    const logs = [log('estudiar', '2026-09-14', 30), log('estudiar', '2026-09-15', 5), log('gym', '2026-09-14')];
    const r = buildWeekReview(snap({ habits: [h, lunes], habitLogs: logs }), WEEK, NOW);
    const e = r.habits.find((x) => x.habit.id === 'estudiar');
    expect(e).toMatchObject({ due: 3, done: 1, minimum: 1, missed: 0 }); // hoy aún no cuenta como omitido
    expect(r.habits.find((x) => x.habit.id === 'gym')).toMatchObject({ due: 1, done: 1, missed: 0 }); // martes a domingo no tocaban
  });

  it('un día pasado sin registro es una omisión; uno futuro o que no tocaba, no', () => {
    const h = habit('a');
    const r = buildWeekReview(snap({ habits: [h], habitLogs: [log('a', '2026-09-14')] }), WEEK, NOW);
    expect(r.habits[0]).toMatchObject({ due: 3, done: 1, missed: 1 });
  });

  it('los hábitos de cuota se miden por veces en la semana', () => {
    const h = habit('x3', { frequency: { type: 'custom', times: 3, per: 'week' } });
    const past = buildWeekReview(snap({ habits: [h], habitLogs: [log('x3', '2026-09-08')] }), '2026-09-07', NOW);
    expect(past.habits[0]).toMatchObject({ due: 3, done: 1, missed: 2 });
    const current = buildWeekReview(snap({ habits: [h], habitLogs: [log('x3', '2026-09-14')] }), WEEK, NOW);
    expect(current.habits[0].missed).toBe(0); // la semana sigue abierta
  });

  it('una meta avanzó si se conquistó un hito, se cerró una tarea enlazada o se cumplió un hábito enlazado', () => {
    const goal = { id: 'g', title: 'Meta', rewardTitle: '', rewardDescription: '', createdAt: '2026-08-01T00:00:00.000Z', milestones: [{ id: 'm', title: 'Hito', summary: '', xp: 10, done: false, skills: [] }, { id: 'm2', title: 'Otro', summary: '', xp: 10, done: false, skills: [] }] };
    const quiet = buildWeekReview(snap({ goals: [goal] }), WEEK, NOW);
    expect(quiet.goals[0].moved).toBe(false);
    const xp: XpEvent = { id: 'x', date: NOW, amount: 10, source: 'milestone', label: 'Hito' };
    const moved = buildWeekReview(snap({ goals: [{ ...goal, milestones: [{ ...goal.milestones[0], done: true }, goal.milestones[1]] }], xpEvents: [xp], tasks: [task('t', { goalId: 'g', status: 'done', completedAt: NOW })] }), WEEK, NOW);
    expect(moved.goals[0]).toMatchObject({ milestones: 1, tasksDone: 1, moved: true });
    const undone = buildWeekReview(snap({ goals: [{ ...goal, milestones: [{ ...goal.milestones[0], done: true }, goal.milestones[1]] }], xpEvents: [xp, { ...xp, id: 'y', amount: -10, label: 'Deshacer: Hito' }] }), WEEK, NOW);
    expect(undone.goals[0].milestones).toBe(0);
  });

  it('cuenta los bloques del calendario y sus horas por tipo, también de la semana siguiente', () => {
    const events = [
      { id: 'e1', title: 'Estudio', category: 'study' as const, date: '2026-09-15', start: '18:00', minutes: 90, rev: 0, createdAt: '', updatedAt: '' },
      { id: 'e2', title: 'Trabajo', category: 'work' as const, date: '2026-09-21', start: '09:00', minutes: 480, rev: 0, createdAt: '', updatedAt: '' },
    ];
    const r = buildWeekReview(snap({ events }), WEEK, NOW);
    expect(r.agenda).toMatchObject({ planned: 1, unmarked: 1 });
    expect(r.next.blocks).toBe(1);
    expect(r.next.minutesByCategory.work).toBe(480);
    expect(r.next.notes.join(' ')).toMatch(/descanso/);
  });
});

describe('prioridades y reparto', () => {
  it('sugiere primero lo vencido, luego lo de la semana y al final lo importante sin fecha', () => {
    const tasks = [task('sin', { priority: 'high' }), task('semana', { dueDate: '2026-09-22' }), task('vencida', { dueDate: '2026-09-10' }), task('lejos', { dueDate: '2026-12-01' }), task('hecha', { status: 'done', dueDate: '2026-09-22' })];
    expect(suggestPriorities(tasks, '2026-09-21').map((t) => t.id)).toEqual(['vencida', 'semana', 'sin']);
  });

  it('reparte entre lunes y viernes sin apilar y conserva el orden', () => {
    const shifts = spreadTasks(Array.from({ length: 7 }, (_, i) => task(`t${i}`, { dueDate: `2026-09-1${i}` })), '2026-09-21');
    expect(shifts.map((s) => s.dueDate)).toEqual(['2026-09-21', '2026-09-21', '2026-09-22', '2026-09-22', '2026-09-23', '2026-09-23', '2026-09-24']);
    expect(spreadTasks([], '2026-09-21')).toEqual([]);
  });
});

describe('Hoy: tres prioridades y agenda', () => {
  const profile = { ...defaultProfile('u'), reviews: [review('2026-09-07', { priorities: ['semana'] })] };

  it('ordena vencidas, de hoy y prioridad de la semana, con un máximo de tres', () => {
    const tasks = [task('semana'), task('hoy', { dueDate: NOW }), task('tarde', { dueDate: '2026-09-10' }), task('otra', { dueDate: '2026-09-11' }), task('hecha', { dueDate: NOW, status: 'done' })];
    const top = topPriorities({ tasks, profile }, NOW, 12 * 60);
    expect(top.map((p) => `${p.task.id}:${p.reason}`)).toEqual(['tarde:late', 'otra:late', 'hoy:today']);
    const few = topPriorities({ tasks: [task('semana'), task('suelta')], profile }, NOW, 12 * 60);
    expect(few.map((p) => p.task.id)).toEqual(['semana']);
  });

  it('lo importante que se acerca cuenta; lo que no, no', () => {
    const tasks = [task('alta', { priority: 'high', dueDate: '2026-09-18' }), task('baja', { priority: 'low', dueDate: '2026-09-18' }), task('lejana', { priority: 'high', dueDate: '2026-10-30' })];
    expect(topPriorities({ tasks, profile: defaultProfile('u') }, NOW, 600).map((p) => p.task.id)).toEqual(['alta']);
  });

  it('la agenda marca ahora y siguiente, y los bloques vinculados no se cierran desde ahí', () => {
    const base = { rev: 0, createdAt: '', updatedAt: '', category: 'study' as const, date: NOW };
    const events = [
      { ...base, id: 'a', title: 'Mañana', start: '08:00', minutes: 60 },
      { ...base, id: 'b', title: 'Ahora', start: '12:00', minutes: 60 },
      { ...base, id: 'c', title: 'Luego', start: '15:00', minutes: 30 },
      { ...base, id: 'd', title: 'Más tarde', start: '19:00', minutes: 30, taskId: 't1' },
    ];
    const items = agendaToday({ events, habits: [], tasks: [task('t1')], habitLogs: [] }, NOW, 12 * 60 + 15);
    expect(items.map((i) => `${i.occ.event.id}:${i.state}`)).toEqual(['a:past', 'b:now', 'c:next', 'd:later']);
    expect(items[3].linked).toBe('task');
    expect(items[2].linked).toBeNull();
  });
});
