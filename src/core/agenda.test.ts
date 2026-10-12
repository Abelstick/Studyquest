import { describe, expect, it } from 'vitest';
import type { AgendaEvent, Habit, HabitLog, Task } from './domain';
import {
  agendaNotices, changeOccurrence, durationBetween, endOf, freeMinutes, habitDefaults, habitScheduledOn, layoutColumns, occurrencesBetween, parseAgendaEvent,
  removeOccurrence, replaceFrom, segmentsOn, setOccurrenceStatus, unlinkEvents, validateEvent, type AgendaContext, type EventDraft,
} from './agenda';

const NOW = '2026-10-12T10:00:00.000Z';
let seq = 0;
const makeId = () => `new-${++seq}`;

const ev = (over: Partial<AgendaEvent> = {}): AgendaEvent => ({
  id: 'e1', title: 'Desayuno', category: 'meal', date: '2026-10-12', start: '08:00', minutes: 30, rev: 0, createdAt: NOW, updatedAt: NOW, ...over,
});
const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h1', title: 'Beber agua', frequency: { type: 'daily' }, measure: 'times', target: 8, xp: 10, reminder: null, steps: [], startDate: '2026-10-01', createdAt: NOW, ...over,
});
const task = (over: Partial<Task> = {}): Task => ({
  id: 't1', title: 'Informe', courseId: null, priority: 'mid', status: 'todo', dueDate: null, estimateMin: 45, xp: 20, subtasks: [], tags: [], createdAt: NOW, completedAt: null, ...over,
});
const ctx = (over: Partial<AgendaContext> = {}): AgendaContext => ({ habits: [], tasks: [], logs: [], ...over });
const dates = (list: { date: string }[]) => list.map((o) => o.date);

// 2026-10-12 es lunes.
describe('repeticiones', () => {
  it('una actividad puntual aparece solo en su día', () => {
    expect(dates(occurrencesBetween([ev()], '2026-10-01', '2026-10-31', ctx()))).toEqual(['2026-10-12']);
    expect(occurrencesBetween([ev()], '2026-10-13', '2026-10-20', ctx())).toHaveLength(0);
  });

  it('todos los días, cada N días y con fecha de fin', () => {
    expect(dates(occurrencesBetween([ev({ repeat: { type: 'daily', every: 1 } })], '2026-10-11', '2026-10-14', ctx()))).toEqual(['2026-10-12', '2026-10-13', '2026-10-14']);
    expect(dates(occurrencesBetween([ev({ repeat: { type: 'daily', every: 3 } })], '2026-10-12', '2026-10-20', ctx()))).toEqual(['2026-10-12', '2026-10-15', '2026-10-18']);
    expect(dates(occurrencesBetween([ev({ repeat: { type: 'daily', every: 1 }, until: '2026-10-13' })], '2026-10-12', '2026-10-20', ctx()))).toEqual(['2026-10-12', '2026-10-13']);
  });

  it('días concretos de la semana, cada semana o cada dos', () => {
    const work = ev({ repeat: { type: 'weekly', every: 1, days: [0, 1, 2, 3, 4] } });
    expect(occurrencesBetween([work], '2026-10-12', '2026-10-18', ctx())).toHaveLength(5);
    const biweekly = ev({ repeat: { type: 'weekly', every: 2, days: [0] } });
    expect(dates(occurrencesBetween([biweekly], '2026-10-12', '2026-11-09', ctx()))).toEqual(['2026-10-12', '2026-10-26', '2026-11-09']);
  });

  it('sigue el calendario del hábito vinculado sin copiar su frecuencia', () => {
    const h = habit({ frequency: { type: 'days', days: [0, 2, 4] } });
    const e = ev({ title: '', habitId: 'h1', repeat: { type: 'habit' } });
    expect(dates(occurrencesBetween([e], '2026-10-12', '2026-10-18', ctx({ habits: [h] })))).toEqual(['2026-10-12', '2026-10-14', '2026-10-16']);
    // Si el hábito cambia de días, el calendario lo sigue sin tocar la actividad.
    const changed = { ...h, frequency: { type: 'daily' as const } };
    expect(occurrencesBetween([e], '2026-10-12', '2026-10-18', ctx({ habits: [changed] }))).toHaveLength(7);
  });

  it('los hábitos semanales y mensuales caen el día en que empezaron; los de cuota no tienen días fijos', () => {
    expect(habitScheduledOn(habit({ frequency: { type: 'weekly' }, startDate: '2026-10-07' }), '2026-10-14')).toBe(true); // miércoles
    expect(habitScheduledOn(habit({ frequency: { type: 'weekly' }, startDate: '2026-10-07' }), '2026-10-15')).toBe(false);
    expect(habitScheduledOn(habit({ frequency: { type: 'monthly' }, startDate: '2026-01-31' }), '2026-02-28')).toBe(true);
    expect(habitScheduledOn(habit({ frequency: { type: 'custom', times: 3, per: 'week' } }), '2026-10-14')).toBe(false);
  });
});

describe('medianoche y cuadrícula', () => {
  it('una actividad que termina al día siguiente se ve en los dos días', () => {
    const night = ev({ start: '23:00', minutes: 120 });
    expect(dates(occurrencesBetween([night], '2026-10-13', '2026-10-13', ctx()))).toEqual(['2026-10-12']);
    const occs = occurrencesBetween([night], '2026-10-12', '2026-10-13', ctx());
    expect(segmentsOn(occs, '2026-10-12').map((s) => [s.start, s.end, s.continues])).toEqual([[1380, 1440, true]]);
    expect(segmentsOn(occs, '2026-10-13').map((s) => [s.start, s.end, s.continued])).toEqual([[0, 60, true]]);
  });

  it('una serie diaria nocturna muestra la cola de la noche anterior', () => {
    const night = ev({ start: '23:00', minutes: 120, repeat: { type: 'daily', every: 1 } });
    const occs = occurrencesBetween([night], '2026-10-14', '2026-10-14', ctx());
    expect(dates(occs)).toEqual(['2026-10-13', '2026-10-14']);
  });

  it('la duración sale de inicio y fin; el fin debe ser posterior salvo que acabe al día siguiente', () => {
    expect(durationBetween('09:00', '10:30', false)).toBe(90);
    expect(durationBetween('10:00', '09:00', false)).toBeNull();
    expect(durationBetween('10:00', '10:00', false)).toBeNull();
    expect(durationBetween('23:00', '01:00', true)).toBe(120);
    expect(endOf('23:00', 120)).toEqual({ clock: '01:00', nextDay: true });
    expect(endOf('09:00', 90)).toEqual({ clock: '10:30', nextDay: false });
  });

  it('los bloques solapados se reparten en columnas sin taparse', () => {
    const placed = layoutColumns([
      { id: 'a', start: 540, end: 630 },
      { id: 'b', start: 570, end: 600 },
      { id: 'c', start: 600, end: 660 },
      { id: 'd', start: 720, end: 780 },
    ]);
    const by = Object.fromEntries(placed.map((p) => [p.item.id, [p.col, p.cols]]));
    expect(by.a).toEqual([0, 2]);
    expect(by.b).toEqual([1, 2]);
    expect(by.c).toEqual([1, 2]);
    expect(by.d).toEqual([0, 1]);
  });

  it('el tiempo libre une los solapes', () => {
    expect(freeMinutes([{ start: 540, end: 600 }, { start: 570, end: 660 }, { start: 1380, end: 1500 }], 480, 1440)).toBe(960 - 120 - 60);
  });
});

describe('estado de cada ocurrencia', () => {
  it('el bloque de un hábito está hecho cuando el hábito llegó a su objetivo, sin registrarlo él', () => {
    const e = ev({ title: '', habitId: 'h1', repeat: { type: 'habit' } });
    const logs: HabitLog[] = [{ id: 'l1', habitId: 'h1', date: '2026-10-12', value: 8, stepsDone: [] }, { id: 'l2', habitId: 'h1', date: '2026-10-13', value: 3, stepsDone: [] }];
    const occs = occurrencesBetween([e], '2026-10-12', '2026-10-13', ctx({ habits: [habit()], logs }));
    expect(occs.map((o) => [o.title, o.status])).toEqual([['Beber agua', 'done'], ['Beber agua', 'pending']]);
  });

  it('el bloque de una tarea sigue el estado de la tarea', () => {
    const e = ev({ title: '', taskId: 't1' });
    expect(occurrencesBetween([e], '2026-10-12', '2026-10-12', ctx({ tasks: [task({ status: 'done' })] }))[0].status).toBe('done');
  });

  it('marcar hecha o cancelada una ocurrencia no toca las demás', () => {
    const e = ev({ repeat: { type: 'daily', every: 1 } });
    const next = setOccurrenceStatus(e, '2026-10-13', 'cancelled', NOW);
    const occs = occurrencesBetween([next], '2026-10-12', '2026-10-14', ctx());
    expect(occs.map((o) => o.status)).toEqual(['pending', 'cancelled', 'pending']);
    expect(next.rev).toBe(1);
    expect(setOccurrenceStatus(next, '2026-10-13', null, NOW).exceptions).toBeUndefined();
  });
});

describe('editar series por alcance', () => {
  const series = ev({ repeat: { type: 'daily', every: 1 } });

  it('solo esta: guarda una excepción y no duplica la serie', () => {
    const res = changeOccurrence(series, '2026-10-13', { start: '09:00' }, 'one', NOW, makeId);
    expect(res.create).toBeUndefined();
    expect(res.update?.exceptions).toEqual({ '2026-10-13': { start: '09:00' } });
    const occs = occurrencesBetween([res.update as AgendaEvent], '2026-10-12', '2026-10-14', ctx());
    expect(occs.map((o) => o.start)).toEqual([480, 540, 480]);
  });

  it('solo esta, moviéndola a otro día', () => {
    const res = changeOccurrence(series, '2026-10-13', { date: '2026-10-20' }, 'one', NOW, makeId);
    const e = res.update as AgendaEvent;
    expect(dates(occurrencesBetween([e], '2026-10-13', '2026-10-13', ctx()))).toEqual([]);
    expect(occurrencesBetween([e], '2026-10-20', '2026-10-20', ctx()).map((o) => o.original).sort()).toEqual(['2026-10-13', '2026-10-20']);
  });

  it('esta y las siguientes: parte la serie en dos sin solaparlas', () => {
    const res = changeOccurrence(series, '2026-10-14', { start: '07:00' }, 'following', NOW, makeId);
    expect(res.update?.until).toBe('2026-10-13');
    expect(res.create?.date).toBe('2026-10-14');
    expect(res.create?.start).toBe('07:00');
    expect(res.create?.id).not.toBe(series.id);
    const occs = occurrencesBetween([res.update as AgendaEvent, res.create as AgendaEvent], '2026-10-12', '2026-10-16', ctx());
    expect(occs.map((o) => `${o.date} ${o.start}`)).toEqual(['2026-10-12 480', '2026-10-13 480', '2026-10-14 420', '2026-10-15 420', '2026-10-16 420']);
  });

  it('toda la serie: mover un día desplaza también los días de la semana y las excepciones', () => {
    const weekly = ev({ repeat: { type: 'weekly', every: 1, days: [0, 2] }, exceptions: { '2026-10-14': { start: '10:00' } } });
    const res = changeOccurrence(weekly, '2026-10-12', { date: '2026-10-13' }, 'all', NOW, makeId);
    expect(res.update?.repeat).toEqual({ type: 'weekly', every: 1, days: [1, 3] });
    expect(res.update?.exceptions).toEqual({ '2026-10-15': { start: '10:00' } });
  });

  it('sustituir desde una ocurrencia con los datos del formulario', () => {
    const draft: EventDraft = { title: 'Desayuno largo', category: 'meal', date: '2026-10-14', start: '08:00', minutes: 60, repeat: { type: 'daily', every: 1 } };
    const res = replaceFrom(series, '2026-10-14', draft, NOW, makeId);
    expect(res.update?.until).toBe('2026-10-13');
    expect(res.create).toMatchObject({ title: 'Desayuno largo', minutes: 60, date: '2026-10-14' });
  });

  it('borrar solo esta, esta y las siguientes, o todas', () => {
    expect(removeOccurrence(series, '2026-10-13', 'one', NOW).update?.exceptions).toEqual({ '2026-10-13': { deleted: true } });
    expect(removeOccurrence(series, '2026-10-13', 'following', NOW).update?.until).toBe('2026-10-12');
    expect(removeOccurrence(series, '2026-10-12', 'following', NOW).remove).toBe(true);
    expect(removeOccurrence(series, '2026-10-13', 'all', NOW).remove).toBe(true);
  });

  it('una actividad puntual se edita entera sea cual sea el alcance', () => {
    const res = changeOccurrence(ev(), '2026-10-12', { date: '2026-10-15', minutes: 45 }, 'one', NOW, makeId);
    expect(res.update).toMatchObject({ date: '2026-10-15', minutes: 45, rev: 1 });
    expect(res.update?.exceptions).toBeUndefined();
  });
});

describe('validación', () => {
  const ok: EventDraft = { title: 'Reunión', category: 'meeting', date: '2026-10-12', start: '10:00', minutes: 60 };
  it('acepta actividades de minutos a horas, recordatorios y de todo el día', () => {
    expect(validateEvent(ok)).toBeNull();
    expect(validateEvent({ ...ok, minutes: 5 })).toBeNull();
    expect(validateEvent({ ...ok, minutes: 0 })).toBeNull();
    expect(validateEvent({ ...ok, start: null, minutes: 0 })).toBeNull();
    expect(validateEvent({ ...ok, minutes: 1440 })).toBeNull();
  });
  it('rechaza lo que no tiene sentido', () => {
    expect(validateEvent({ ...ok, title: ' ' })).toMatch(/nombre/);
    expect(validateEvent({ ...ok, minutes: 3 })).toMatch(/al menos/);
    expect(validateEvent({ ...ok, minutes: 1441 })).toMatch(/24 horas/);
    expect(validateEvent({ ...ok, start: '25:00' })).toMatch(/inicio/);
    expect(validateEvent({ ...ok, repeat: { type: 'weekly', every: 1, days: [] } })).toMatch(/día/);
    expect(validateEvent({ ...ok, repeat: { type: 'daily', every: 1 }, until: '2026-10-01' })).toMatch(/terminar/);
    expect(validateEvent({ ...ok, repeat: { type: 'habit' } })).toMatch(/vincula/);
    expect(validateEvent({ ...ok, habitId: 'h1', repeat: { type: 'habit' } }, [habit({ frequency: { type: 'custom', times: 3, per: 'week' } })])).toMatch(/días fijos/);
    expect(validateEvent({ ...ok, pulseMin: 90 })).toMatch(/intervalo/);
  });
  it('una actividad vinculada puede ir sin nombre propio', () => {
    expect(validateEvent({ ...ok, title: '', habitId: 'h1' })).toBeNull();
  });
});

describe('vínculos con hábitos y tareas', () => {
  it('propone la duración del hábito si se mide en tiempo', () => {
    expect(habitDefaults(habit({ measure: 'minutes', target: 10, reminder: '07:15' }))).toEqual({ minutes: 10, start: '07:15', repeat: { type: 'habit' } });
    expect(habitDefaults(habit({ measure: 'hours', target: 1.5 })).minutes).toBe(90);
    expect(habitDefaults(habit({ frequency: { type: 'custom', times: 2, per: 'week' } })).repeat.type).toBe('weekly');
  });

  it('al borrar el hábito, sus bloques se quedan como actividades con su nombre', () => {
    const e = ev({ title: '', habitId: 'h1', repeat: { type: 'habit' } });
    const [out] = unlinkEvents([e, ev({ id: 'e2' })], { habitId: 'h1' }, { habits: [habit()], tasks: [] }, NOW);
    expect(out).toMatchObject({ id: 'e1', title: 'Beber agua', habitId: null, repeat: { type: 'daily', every: 1 } });
  });
});

describe('avisos', () => {
  it('avisa antes del inicio y cada N minutos dentro del bloque, sin repetir', () => {
    const e = ev({ title: '', habitId: 'h1', start: '09:00', minutes: 120, reminderMin: 10, pulseMin: 30 });
    const occs = occurrencesBetween([e], '2026-10-12', '2026-10-13', ctx({ habits: [habit()] }));
    expect(agendaNotices(occs, '2026-10-12', 8 * 60 + 50, new Set()).map((n) => n.key)).toEqual(['agenda:e1:2026-10-12']);
    const at930 = agendaNotices(occs, '2026-10-12', 9 * 60 + 31, new Set());
    expect(at930.map((n) => n.key)).toEqual(['agenda:e1:2026-10-12:1']);
    expect(agendaNotices(occs, '2026-10-12', 9 * 60 + 31, new Set(['agenda:e1:2026-10-12:1']))).toHaveLength(0);
  });

  it('no avisa de lo ya hecho', () => {
    const e = setOccurrenceStatus(ev({ reminderMin: 0 }), '2026-10-12', 'done', NOW);
    expect(agendaNotices(occurrencesBetween([e], '2026-10-12', '2026-10-12', ctx()), '2026-10-12', 480, new Set())).toHaveLength(0);
  });

  it('un aviso de una actividad de mañana temprano puede caer hoy', () => {
    const e = ev({ date: '2026-10-13', start: '00:10', reminderMin: 30 });
    const occs = occurrencesBetween([e], '2026-10-12', '2026-10-13', ctx());
    expect(agendaNotices(occs, '2026-10-12', 23 * 60 + 41, new Set())).toHaveLength(1);
  });
});

describe('copias de seguridad', () => {
  const ids = { id: (v: unknown) => String(v), ref: (v: unknown) => (typeof v === 'string' ? v : null) };
  it('descarta lo inválido y suelta los vínculos rotos', () => {
    expect(parseAgendaEvent({ title: 'x', date: 'mañana' }, ids, { habits: new Set(), tasks: new Set() })).toBeNull();
    const out = parseAgendaEvent(
      { id: 'a', title: 'Agua', date: '2026-10-12', start: '09:00', minutes: 9999, habitId: 'gone', repeat: { type: 'habit' }, color: 'url(evil)', exceptions: { '2026-10-13': { deleted: true }, nope: {} } },
      ids,
      { habits: new Set(), tasks: new Set() },
    );
    expect(out).toMatchObject({ habitId: null, repeat: { type: 'daily', every: 1 }, minutes: 30, exceptions: { '2026-10-13': { deleted: true } } });
    expect(out?.color).toBeUndefined();
  });
});
