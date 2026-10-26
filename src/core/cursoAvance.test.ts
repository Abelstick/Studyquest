import { describe, expect, it } from 'vitest';
import type { AppNotification, Course, StudySession, Task, XpEvent } from './domain';
import { courseStats, topicPace } from './courseStats';
import { courseDeadline, paceText } from './courseDeadline';
import { recoveryPlan } from './courseRecovery';
import { courseAlerts, newAlerts } from './courseAlerts';
import { challengeProgress, newChallenge } from './challenge';
import { heatLevel, yearHeat } from './heatmap';

// Miércoles 16-sep-2026.
const NOW = '2026-09-16';

type TopicSpec = { status?: 'todo' | 'done'; doneAt?: string };
const course = (topics: TopicSpec[], extra: Partial<Course> = {}): Course => ({
  id: 'c1',
  title: 'SQL',
  professor: '',
  field: '',
  mentor: null,
  createdAt: '',
  modules: [{ id: 'm', title: 'M', summary: '', xp: 40, topics: topics.map((t, i) => ({ id: `t${i}`, title: `Tema ${i}`, status: t.status ?? 'todo', review: false, markedAt: null, ...(t.doneAt ? { doneAt: t.doneAt } : {}) })) }],
  ...extra,
});
const done = (doneAt?: string): TopicSpec => ({ status: 'done', doneAt });
const session = (date: string, minutes = 30, courseId: string | null = 'c1'): StudySession => ({ id: `${date}-${minutes}-${courseId}`, date, minutes, courseId, label: '' });
const task = (id: string, extra: Partial<Task> = {}): Task => ({ id, title: id, courseId: 'c1', priority: 'mid', status: 'todo', dueDate: null, estimateMin: 0, xp: 10, subtasks: [], tags: [], createdAt: '', completedAt: null, ...extra });

describe('ritmo real de un curso', () => {
  it('sin ningún tema con fecha no hay ritmo (los hechos antes de guardarla no cuentan)', () => {
    expect(topicPace(course([done(), done(), {}]), NOW)).toBeNull();
  });

  it('cuenta los temas de las últimas 4 semanas entre 4', () => {
    const c = course([done('2026-09-15'), done('2026-09-01'), done('2026-08-25'), done('2026-07-01'), {}]);
    // Ventana: 28 días hasta hoy → desde el 20 ago. Entran 3 de 4 → 0,75 → 0,8.
    expect(topicPace(c, NOW)).toBe(0.8);
  });

  it('con datos pero ninguno reciente el ritmo es 0, no null', () => {
    expect(topicPace(course([done('2026-01-01'), {}]), NOW)).toBe(0);
  });
});

describe('estadísticas del curso', () => {
  it('agrupa por semanas, cuenta días distintos y sigue la tendencia', () => {
    const c = course([done('2026-09-14'), {}, {}, {}]);
    const s = courseStats(c, [session('2026-09-14', 60), session('2026-09-14', 30), session('2026-09-16', 30), session('2026-09-08', 30), session('2026-09-10', 30, 'otro')], NOW);
    expect(s.weeks).toHaveLength(8);
    expect(s.weeks[7]).toMatchObject({ from: '2026-09-14', minutes: 120, days: 2 });
    expect(s.weeks[6]).toMatchObject({ from: '2026-09-07', minutes: 30, days: 1 });
    expect(s.days30).toBe(3);
    expect(s.trend).toBe(1);
  });

  it('proyecta cuándo terminarías al ritmo actual', () => {
    // 8 temas hechos hoy... ritmo = 4/4 sem = 1 por semana; quedan 3 → 21 días.
    const c = course([done('2026-09-10'), done('2026-09-05'), done('2026-09-01'), done('2026-08-28'), {}, {}, {}]);
    const s = courseStats(c, [], NOW);
    expect(s.pace).toBe(1);
    expect(s.projected).toBe('2026-10-07');
  });

  it('sin ritmo no hay proyección', () => {
    expect(courseStats(course([{}, {}]), [], NOW).projected).toBeNull();
  });
});

describe('plazo en riesgo', () => {
  it('el ritmo que llevas frente al necesario sale en el texto', () => {
    const c = course([done('2026-09-10'), {}, {}, {}, {}, {}, {}], { dueDate: '2026-09-30' });
    const d = courseDeadline(c, [], NOW);
    // 6 temas en 14 días = 3 por semana; llevas 0,3.
    expect(d).toMatchObject({ perWeek: 3, actualPerWeek: 0.3, atRisk: true });
    expect(paceText(d)).toBe('≈ 3 temas por semana para llegar · llevas 0,3');
  });

  it('si vas al ritmo no hay riesgo', () => {
    const c = course([done('2026-09-15'), done('2026-09-10'), done('2026-09-05'), done('2026-09-01'), {}, {}], { dueDate: '2026-09-30' });
    expect(courseDeadline(c, [], NOW).atRisk).toBe(false);
  });

  it('vencido sin terminar siempre está en riesgo; sin ritmo medido, solo si venció', () => {
    expect(courseDeadline(course([{}, {}], { dueDate: '2026-09-01' }), [], NOW).atRisk).toBe(true);
    expect(courseDeadline(course([{}, {}], { dueDate: '2026-12-01' }), [], NOW).atRisk).toBe(false);
  });
});

describe('plan de recuperación', () => {
  it('reparte los temas pendientes hasta el plazo si aún no venció, y propone una fecha realista', () => {
    const c = course([done('2026-09-10'), {}, {}, {}], { dueDate: '2026-09-30' });
    const p = recoveryPlan(c, [], NOW);
    expect(p).not.toBeNull();
    expect(p!.target).toBe('2026-09-30');
    expect(p!.slots).toHaveLength(3);
    const dates = p!.slots.map((s) => s.date);
    expect(dates).toEqual([...dates].sort());
    expect(dates.every((d) => d > NOW && d <= '2026-09-30')).toBe(true);
    expect(dates[2]).toBe('2026-09-30');
  });

  it('vencido: reparte hasta la fecha nueva, calculada con el ritmo que llevas', () => {
    const c = course([done('2026-09-05'), done('2026-09-01'), {}, {}, {}, {}], { dueDate: '2026-09-01' });
    const p = recoveryPlan(c, [], NOW)!;
    // Ritmo 0,5/sem: 4 temas → 8 semanas.
    expect(p.pace).toBe(0.5);
    expect(p.newDate).toBe('2026-11-11');
    expect(p.target).toBe(p.newDate);
  });

  it('no duplica temas que ya tienen una tarea abierta con ese nombre', () => {
    const c = course([{}, {}], { dueDate: '2026-09-30' });
    const p = recoveryPlan(c, [task('a', { title: 'tema 0' })], NOW)!;
    expect(p.slots.map((s) => s.title)).toEqual(['Tema 1']);
  });

  it('un curso terminado no tiene plan', () => {
    expect(recoveryPlan(course([done('2026-09-01')]), [], NOW)).toBeNull();
  });
});

describe('avisos por curso', () => {
  it('avisa si el plazo está a 3 días o menos con temas pendientes', () => {
    const a = courseAlerts([course([{}, {}], { dueDate: '2026-09-18' })], [], [], NOW);
    expect(a.map((x) => x.title)).toEqual(['SQL termina en 2 días']);
  });

  it('avisa de un curso vencido y de uno parado hace 3 o más días, pero no de uno nuevo sin sesiones', () => {
    expect(courseAlerts([course([{}], { dueDate: '2026-09-01' })], [], [], NOW).map((x) => x.title)).toEqual(['SQL venció sin terminar']);
    expect(courseAlerts([course([{}, {}])], [session('2026-09-10')], [], NOW).map((x) => x.title)).toEqual(['SQL lleva días sin tocarse']);
    expect(courseAlerts([course([{}, {}])], [], [], NOW)).toEqual([]);
  });

  it('un curso terminado no avisa', () => {
    expect(courseAlerts([course([done('2026-09-01')], { dueDate: '2026-09-17' })], [session('2026-09-01')], [], NOW)).toEqual([]);
  });

  it('no repite el aviso dentro de su silencio', () => {
    const alerts = courseAlerts([course([{}, {}])], [session('2026-09-10')], [], NOW);
    const antes = (iso: string): Pick<AppNotification, 'title' | 'createdAt'> => ({ title: alerts[0].title, createdAt: iso });
    expect(newAlerts(alerts, [antes(new Date(2026, 8, 15, 10).toISOString())], NOW)).toEqual([]);
    expect(newAlerts(alerts, [antes(new Date(2026, 8, 12, 10).toISOString())], NOW)).toHaveLength(1);
  });
});

describe('reto del mes', () => {
  const xp = (date: string, amount: number): XpEvent => ({ id: date + amount, date, amount, source: 'task', label: '' });
  const src = { sessions: [session('2026-09-01'), session('2026-09-01', 60), session('2026-09-05'), session('2026-08-30')], tasks: [task('a', { status: 'done', completedAt: '2026-09-03' }), task('b', { status: 'done', completedAt: '2026-08-31' })], xpEvents: [xp('2026-09-02', 120), xp('2026-09-03', -20), xp('2026-08-01', 999)] };

  it('calcula el avance solo con lo de este mes', () => {
    expect(challengeProgress(newChallenge('studyDays', 10, NOW), src, NOW)).toMatchObject({ value: 2, pct: 20, done: false, current: true });
    expect(challengeProgress(newChallenge('studyHours', 2, NOW), src, NOW).value).toBe(2);
    expect(challengeProgress(newChallenge('tasks', 1, NOW), src, NOW)).toMatchObject({ value: 1, done: true, claimable: true });
    expect(challengeProgress(newChallenge('xp', 100, NOW), src, NOW).value).toBe(100);
  });

  it('el premio se calcula al crearlo y se cobra una sola vez', () => {
    const c = newChallenge('tasks', 10, NOW);
    expect(c).toEqual({ month: '2026-09', kind: 'tasks', target: 10, reward: 60 });
    expect(challengeProgress({ ...c, target: 1, claimed: true }, src, NOW).claimable).toBe(false);
  });

  it('un reto de otro mes no es del mes actual ni se puede cobrar, y a fin de mes quedan los días', () => {
    const viejo = { ...newChallenge('tasks', 1, '2026-08-10'), target: 1 };
    expect(challengeProgress(viejo, src, NOW)).toMatchObject({ current: false, claimable: false, daysLeft: 0 });
    expect(challengeProgress(newChallenge('tasks', 1, NOW), src, NOW).daysLeft).toBe(15);
  });
});

describe('mapa de calor', () => {
  it('niveles por XP del día', () => {
    expect([0, 1, 49, 50, 149, 150, 299, 300].map(heatLevel)).toEqual([0, 1, 1, 2, 2, 3, 3, 4]);
  });

  it('53 semanas de lunes a domingo, la última es la actual, y cuenta días activos', () => {
    const h = yearHeat([{ id: '1', date: NOW, amount: 200, source: 'task', label: '' }, { id: '2', date: '2026-09-14', amount: 20, source: 'task', label: '' }], ['2026-09-15'], NOW);
    expect(h.weeks).toHaveLength(53);
    expect(h.weeks[52][0].date).toBe('2026-09-14');
    expect(h.weeks[52].find((c) => c.date === NOW)).toMatchObject({ level: 3, xp: 200 });
    expect(h.weeks[52].find((c) => c.date === '2026-09-18')).toMatchObject({ future: true, level: 0 });
    expect(h.activeDays).toBe(3);
    expect(h.best).toBe(200);
  });
});
