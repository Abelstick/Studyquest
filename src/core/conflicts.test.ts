import { describe, expect, it } from 'vitest';
import type { AgendaEvent, Habit, Task } from './domain';
import { findConflicts, suggestMove } from './conflicts';

const MON = '2026-10-19';
const TUE = '2026-10-20';
let n = 0;
const ev = (extra: Partial<AgendaEvent>): AgendaEvent => ({ id: `e${++n}`, title: 'Bloque', category: 'other', date: TUE, start: '09:00', minutes: 60, rev: 0, createdAt: '', updatedAt: '', ...extra });
const task = (extra: Partial<Task> = {}): Task => ({ id: 't1', title: 'Informe', courseId: null, priority: 'mid', status: 'todo', dueDate: '2026-10-23', estimateMin: 60, xp: 20, subtasks: [], tags: [], createdAt: '', completedAt: null, ...extra });
const habit = (extra: Partial<Habit> = {}): Habit => ({ id: 'h1', title: 'Estudiar', frequency: { type: 'daily' }, measure: 'minutes', target: 30, xp: 30, reminder: null, steps: [], startDate: '2026-08-01', createdAt: '', ...extra });
/** Trabajo de lunes a viernes de 8:30 a 18:00. */
const work = ev({ id: 'w', title: 'Jornada laboral', category: 'work', date: MON, start: '08:30', minutes: 570, repeat: { type: 'weekly', every: 1, days: [0, 1, 2, 3, 4] } });
const ctx = (events: AgendaEvent[], tasks: Task[] = [], habits: Habit[] = []) => ({ events, tasks, habits, habitLogs: [] });
const hm = (h: number, m = 0) => h * 60 + m;

describe('cruces de horario', () => {
  it('un bloque de tarea dentro de tu jornada es un cruce, y lo movible es la tarea, no el trabajo', () => {
    const slot = ev({ id: 's', title: '', taskId: 't1', start: '17:00', minutes: 60 });
    const [c, ...rest] = findConflicts(ctx([work, slot], [task()]), MON, '2026-10-25');
    expect(rest).toEqual([]);
    expect(c.date).toBe(TUE);
    expect(c.movable.event.id).toBe('s');
    expect(c.others.map((o) => o.title)).toEqual(['Jornada laboral']);
    expect(c.overlap).toEqual({ start: hm(17), end: hm(18) });
  });

  it('una reunión dentro del trabajo no es un cruce que arreglar', () => {
    const reunion = ev({ title: 'Reunión', category: 'meeting', start: '11:00' });
    expect(findConflicts(ctx([work, reunion]), MON, '2026-10-25')).toEqual([]);
  });

  it('bloques que solo se tocan, o en otro día, no se cruzan', () => {
    const justo = ev({ taskId: 't1', start: '18:00' });
    const otro = ev({ taskId: 't1', date: '2026-10-24', start: '09:00' });
    expect(findConflicts(ctx([work, justo, otro], [task()]), MON, '2026-10-25')).toEqual([]);
  });

  it('lo ya hecho, lo cancelado y el sueño no cuentan', () => {
    const hecho = ev({ taskId: 't1', start: '17:00' });
    expect(findConflicts(ctx([work, hecho], [task({ status: 'done' })]), MON, '2026-10-25')).toEqual([]);
    const cancelado = ev({ taskId: 't1', start: '17:00', exceptions: { [TUE]: { status: 'cancelled' } } });
    expect(findConflicts(ctx([work, cancelado], [task()]), MON, '2026-10-25')).toEqual([]);
    const dormir = ev({ title: 'Dormir', category: 'rest', start: '23:00', minutes: 420, repeat: { type: 'daily', every: 1 } });
    const tarde = ev({ taskId: 't1', date: TUE, start: '23:30', minutes: 30 });
    expect(findConflicts(ctx([dormir, tarde], [task()]), MON, '2026-10-25')).toEqual([]);
  });

  it('entre un hábito y una tarea se mueve la tarea; el bloque que se cruza con varios sale una sola vez', () => {
    const h = ev({ id: 'hb', title: '', habitId: 'h1', start: '19:00', minutes: 30, repeat: { type: 'habit' } });
    const t = ev({ id: 'tk', title: '', taskId: 't1', start: '19:10', minutes: 30 });
    const clase = ev({ title: 'Clase', category: 'study', start: '19:20', minutes: 60 });
    const found = findConflicts(ctx([h, t, clase], [task()], [habit()]), TUE, TUE);
    const mover = found.find((c) => c.movable.event.id === 'tk');
    expect(mover?.others.map((o) => o.title).sort()).toEqual(['Clase', 'Estudiar'].sort());
    expect(found.filter((c) => c.movable.event.id === 'tk')).toHaveLength(1);
  });
});

describe('arreglar un cruce', () => {
  const setup = (events: AgendaEvent[], tasks = [task()]) => {
    const c = findConflicts(ctx(events, tasks), MON, '2026-10-25')[0];
    return { c, c2: ctx(events, tasks) };
  };

  it('propone el hueco libre más cercano: tras el trabajo, no en medio', () => {
    const slot = ev({ id: 's', title: '', taskId: 't1', start: '17:00', minutes: 60 });
    const { c, c2 } = setup([work, slot]);
    expect(suggestMove(c2, c, MON, 0)).toEqual({ date: TUE, start: '18:00' });
  });

  it('esquiva también lo demás que ya tienes esa tarde', () => {
    const slot = ev({ id: 's', title: '', taskId: 't1', start: '17:00', minutes: 60 });
    const clase = ev({ title: 'Clase', category: 'study', start: '18:00', minutes: 90 });
    const { c, c2 } = setup([work, slot, clase]);
    expect(suggestMove(c2, c, MON, 0)).toEqual({ date: TUE, start: '19:30' });
  });

  it('si ese día no cabe, pasa al siguiente sin pasarse del plazo', () => {
    const slot = ev({ id: 's', title: '', taskId: 't1', start: '17:00', minutes: 60 });
    const todo = ev({ title: 'Todo', start: '18:00', minutes: 270 });
    const { c, c2 } = setup([work, slot, todo]);
    expect(suggestMove(c2, c, MON, 0)).toEqual({ date: '2026-10-21', start: '18:00' });
    const sinMargen = setup([work, slot, todo], [task({ dueDate: TUE })]);
    expect(suggestMove(sinMargen.c2, sinMargen.c, MON, 0)).toBeNull();
  });

  it('con hora límite el último día, la sesión termina antes', () => {
    const slot = ev({ id: 's', title: '', taskId: 't1', start: '17:00', minutes: 60 });
    const { c, c2 } = setup([work, slot], [task({ dueDate: TUE, dueTime: '18:30' })]);
    expect(suggestMove(c2, c, MON, 0)).toBeNull(); // 18:00–19:00 no termina antes de las 18:30
  });

  it('hoy solo propone lo que queda desde ahora', () => {
    const slot = ev({ id: 's', title: '', taskId: 't1', start: '17:00', minutes: 60 });
    const { c, c2 } = setup([work, slot]);
    expect(suggestMove(c2, c, TUE, hm(18, 40))?.start).toBe('18:45');
  });

  it('un hábito no se manda a la madrugada y puede pasar al día siguiente', () => {
    const h = ev({ id: 'hb', title: '', habitId: 'h1', start: '17:00', minutes: 30, repeat: { type: 'habit' } });
    const c2 = ctx([work, h], [], [habit()]);
    const c = findConflicts(c2, TUE, TUE)[0];
    expect(suggestMove(c2, c, MON, 0)).toEqual({ date: TUE, start: '18:00' });
  });
});
