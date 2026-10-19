import { describe, expect, it } from 'vitest';
import type { AgendaEvent, Habit, Task } from './domain';
import { DEFAULT_WAKING, DEFAULT_ROUTINE, freeTimeIdeas, freeWindows, habitBlockDrafts, habitsWithoutTime, nowState, routineDrafts, routineOf, suggestHabitTimes, validateRoutine, wakingOf } from './routine';

const MON = '2026-09-14';
const WED = '2026-09-16';
const SAT = '2026-09-19';
let n = 0;
const ev = (extra: Partial<AgendaEvent>): AgendaEvent => ({ id: `e${++n}`, title: 'Bloque', category: 'other', date: MON, start: '09:00', minutes: 60, rev: 0, createdAt: '', updatedAt: '', ...extra });
const habit = (extra: Partial<Habit> = {}): Habit => ({ id: 'h1', title: 'Estudiar SQL', frequency: { type: 'daily' }, measure: 'minutes', target: 30, xp: 30, reminder: null, steps: [], startDate: '2026-08-01', createdAt: '', ...extra });
const task = (extra: Partial<Task> = {}): Task => ({ id: 't1', title: 'Informe', courseId: null, priority: 'mid', status: 'todo', dueDate: WED, estimateMin: 30, xp: 20, subtasks: [], tags: [], createdAt: '', completedAt: null, ...extra });

/** Yo trabajo de lunes a viernes de 8:30 a 18:00. */
const work = (extra: Partial<AgendaEvent> = {}) => ev({ title: 'Jornada laboral', category: 'work', start: '08:30', minutes: 570, repeat: { type: 'weekly', every: 1, days: [0, 1, 2, 3, 4] }, ...extra });
const ctx = (events: AgendaEvent[], habits: Habit[] = [], tasks: Task[] = []) => ({ events, habits, tasks, habitLogs: [] });
const hm = (h: number, m = 0) => h * 60 + m;

describe('horario fijo', () => {
  it('valida las horas y el sueño', () => {
    expect(validateRoutine(DEFAULT_ROUTINE)).toBeNull();
    expect(validateRoutine({ ...DEFAULT_ROUTINE, workEnd: '08:00' })).toMatch(/posterior/);
    expect(validateRoutine({ ...DEFAULT_ROUTINE, wake: null })).toMatch(/hora de dormir como la de despertar/);
    expect(validateRoutine({ ...DEFAULT_ROUTINE, workDays: [], workEnd: '08:00' })).toBeNull();
  });

  it('el trabajo es una serie semanal y el sueño una diaria que cruza la medianoche', () => {
    const { work: w, sleep } = routineDrafts({ workDays: [4, 0, 1], workStart: '08:30', workEnd: '18:00', sleep: '23:00', wake: '06:30' }, MON);
    expect(w).toMatchObject({ title: 'Jornada laboral', category: 'work', start: '08:30', minutes: 570, repeat: { type: 'weekly', every: 1, days: [0, 1, 4] } });
    expect(sleep).toMatchObject({ title: 'Dormir', start: '23:00', minutes: 450, repeat: { type: 'daily', every: 1 } });
    expect(routineDrafts({ ...DEFAULT_ROUTINE, workDays: [], sleep: null, wake: null }, MON)).toEqual({ work: null, sleep: null });
  });

  it('reconoce el horario ya guardado para editarlo en vez de duplicarlo', () => {
    const saved = routineOf([work(), ev({ title: 'Dormir', category: 'rest', start: '22:30', minutes: 480, repeat: { type: 'daily', every: 1 } })]);
    expect(saved).toMatchObject({ workDays: [0, 1, 2, 3, 4], workStart: '08:30', workEnd: '18:00', sleep: '22:30', wake: '06:30' });
    expect(routineOf([])).toMatchObject({ sleep: '23:00' });
  });

  it('las horas despierto salen del sueño definido', () => {
    expect(wakingOf([])).toEqual(DEFAULT_WAKING);
    expect(wakingOf([ev({ title: 'Dormir', category: 'rest', start: '23:00', minutes: 420, repeat: { type: 'daily', every: 1 } })])).toEqual({ start: hm(6), end: hm(23) });
  });
});

describe('tiempo libre', () => {
  it('entre semana queda libre desde que sales del trabajo; el fin de semana, todo el día', () => {
    expect(freeWindows(ctx([work()]), WED)).toEqual([{ start: hm(6), end: hm(8, 30) }, { start: hm(18), end: hm(22, 30) }]);
    expect(freeWindows(ctx([work()]), SAT)).toEqual([DEFAULT_WAKING]);
  });

  it('un bloque corto o encima del trabajo no inventa tiempo libre', () => {
    const w = freeWindows(ctx([work(), ev({ date: WED, start: '18:10', minutes: 20 })]), WED);
    expect(w.at(-1)).toEqual({ start: hm(18, 30), end: hm(22, 30) });
  });
});

describe('qué toca ahora', () => {
  it('sin nada en el calendario no hay nada que decir', () => {
    expect(nowState(ctx([]), WED, hm(18, 40)).kind).toBe('empty');
  });

  it('a las 11:00 estás en la jornada hasta las 18:00', () => {
    const s = nowState(ctx([work()]), WED, hm(11));
    expect(s).toMatchObject({ kind: 'block', until: hm(18) });
  });

  it('a las 18:40 es tiempo libre hasta el siguiente bloque', () => {
    const s = nowState(ctx([work(), ev({ date: WED, title: 'Inglés', category: 'study', start: '20:00', minutes: 60 })]), WED, hm(18, 40));
    expect(s).toMatchObject({ kind: 'free', from: hm(18), until: hm(20) });
    expect(s.kind === 'free' && s.next?.title).toBe('Inglés');
  });

  it('de noche, fuera de tus horas despierto, es descanso', () => {
    expect(nowState(ctx([work()]), WED, hm(23, 30)).kind).toBe('rest');
  });

  it('sugiere los hábitos de hoy que faltan (el que tiene hora en este rato, primero) y tareas que caben', () => {
    const a = habit({ id: 'a', title: 'Leer' });
    const b = habit({ id: 'b', title: 'Ejercicio' });
    const events = [work(), ev({ date: WED, title: '', category: 'health', start: '19:00', minutes: 45, habitId: 'b', repeat: { type: 'daily', every: 1 } })];
    const ideas = freeTimeIdeas(ctx(events, [a, b], [task({ estimateMin: 600 }), task({ id: 't2', title: 'Corta' })]), WED, hm(18, 40), hm(22, 30));
    expect(ideas.map((i) => i.title)).toEqual(['Ejercicio', 'Leer', 'Corta']);
    expect(ideas[0].at).toBe('19:00');
  });
});

describe('a qué hora hacer un hábito', () => {
  it('trabajando de 8:30 a 18:00, propone justo al salir y nunca encima del trabajo', () => {
    const r = suggestHabitTimes(habit(), ctx([work()]), MON);
    expect(r?.times).toEqual(['18:00']);
    expect(r?.minutes).toBe(30);
    expect(r?.coverage).toBe(1);
  });

  it('respeta la hora de recordatorio del hábito si está libre', () => {
    expect(suggestHabitTimes(habit({ reminder: '20:00' }), ctx([work()]), MON)?.times).toEqual(['20:00']);
  });

  it('esquiva lo que ya tienes programado', () => {
    const busy = ev({ title: 'Clase', category: 'study', start: '18:00', minutes: 90, repeat: { type: 'daily', every: 1 } });
    expect(suggestHabitTimes(habit(), ctx([work(), busy]), MON)?.times).toEqual(['19:30']);
  });

  it('varias veces al día se reparten y no se pisan', () => {
    const r = suggestHabitTimes(habit({ title: 'Beber agua', measure: 'minutes', target: 5, xp: 5 }), ctx([work()]), MON, 3);
    expect(r?.times.length).toBeGreaterThanOrEqual(2);
    const mins = r?.times.map((t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))) ?? [];
    for (let i = 1; i < mins.length; i++) expect(mins[i] - mins[i - 1]).toBeGreaterThanOrEqual(65);
  });

  it('si no hay hueco casi nunca, no inventa una hora', () => {
    const all = ev({ title: 'Todo', start: '06:00', minutes: 1020, repeat: { type: 'daily', every: 1 } });
    expect(suggestHabitTimes(habit(), ctx([all]), MON)).toBeNull();
  });

  it('crea bloques vinculados al hábito, que siguen su calendario', () => {
    const h = habit({ frequency: { type: 'days', days: [0, 2, 4] }, area: 'health' });
    const drafts = habitBlockDrafts(h, ['18:00', '21:00'], 30, MON);
    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toMatchObject({ habitId: 'h1', start: '18:00', minutes: 30, category: 'health', repeat: { type: 'habit' }, reminderMin: 10 });
  });

  it('sabe qué hábitos aún no tienen hora', () => {
    const linked = ev({ habitId: 'h1', repeat: { type: 'habit' } });
    expect(habitsWithoutTime([habit(), habit({ id: 'h2' }), habit({ id: 'q', kind: 'quit', measure: 'boolean', target: 1 })], [linked]).map((h) => h.id)).toEqual(['h2']);
  });
});
