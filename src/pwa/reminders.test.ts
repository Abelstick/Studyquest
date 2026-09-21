import { describe, expect, it } from 'vitest';
import type { Habit } from '@/core/domain';
import { acceptPushMessage, loadReminderState, saveReminderState, tickReminders, type ReminderFile, type TickInput } from './reminders';

// 2026-09-21 00:00Z = domingo 20 a las 19:00 en Lima
const T19 = Date.UTC(2026, 8, 21, 0, 0, 0);
const at = (min: number) => new Date(T19 + min * 60_000);
const TZ = 'America/Lima';

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h1', title: 'Estudiar Python', frequency: { type: 'daily' }, measure: 'minutes', target: 30, xp: 30, reminder: '19:00', steps: [], startDate: '2026-01-01', createdAt: '', ...over,
});
const empty: ReminderFile = { day: '2026-09-20', items: {} };
const tick = (over: Partial<TickInput> & { min: number }) =>
  tickReminders({ habits: [habit()], logs: [], now: at(over.min), timeZone: TZ, visible: true, pushActive: false, canNotify: false, state: empty, ...over });

describe('tickReminders (recordatorios dentro de la web)', () => {
  it('con la app visible avisa dentro de la app', () => {
    const r = tick({ min: 0 });
    expect(r.effects).toHaveLength(1);
    expect(r.effects[0].effect).toBe('inapp');
    expect(r.effects[0].reminder.title).toBe('🔥 Estudiar Python');
  });
  it('no avisa antes de la hora ni si el hábito no tiene recordatorio', () => {
    expect(tick({ min: -1 }).effects).toEqual([]);
    expect(tick({ min: 0, habits: [habit({ reminder: null })] }).effects).toEqual([]);
  });
  it('memoriza el aviso y no lo repite en el siguiente ciclo de 15 s', () => {
    const first = tick({ min: 0 });
    const second = tick({ min: 0.25, state: first.state });
    expect(second.effects).toEqual([]);
  });
  it('repite a los 30 min por defecto y a los 15 si el hábito lo pide', () => {
    const first = tick({ min: 0 });
    expect(tick({ min: 29, state: first.state }).effects).toEqual([]);
    expect(tick({ min: 30, state: first.state }).effects).toHaveLength(1);
    const fast = tick({ min: 0, habits: [habit({ reminderRepeatMin: 15 })] });
    expect(tick({ min: 15, habits: [habit({ reminderRepeatMin: 15 })], state: fast.state }).effects).toHaveLength(1);
  });
  it('"No repetir" (0) avisa una sola vez', () => {
    const h = [habit({ reminderRepeatMin: 0 })];
    const first = tick({ min: 0, habits: h });
    expect(tick({ min: 120, habits: h, state: first.state }).effects).toEqual([]);
  });
  it('deja de avisar cuando el hábito ya está hecho', () => {
    const first = tick({ min: 0 });
    const logs = [{ id: 'l', habitId: 'h1', date: '2026-09-20', value: 30, stepsDone: [] }];
    expect(tick({ min: 30, state: first.state, logs }).effects).toEqual([]);
  });

  describe('según el estado de la pestaña', () => {
    it('oculta y con push activo: silencio (ya avisa el servidor), pero recuerda el aviso', () => {
      const r = tick({ min: 0, visible: false, pushActive: true });
      expect(r.effects[0].effect).toBe('silent');
      expect(r.state.items.h1.count).toBe(1);
    });
    it('oculta, sin push y con permiso: notificación del sistema', () => {
      expect(tick({ min: 0, visible: false, canNotify: true }).effects[0].effect).toBe('system');
    });
    it('oculta, sin push ni permiso: banner + sonido igualmente', () => {
      expect(tick({ min: 0, visible: false }).effects[0].effect).toBe('inapp');
    });
  });

  it('al cambiar de día el estado se reinicia', () => {
    const yesterday: ReminderFile = { day: '2026-09-19', items: { h1: { count: 6, lastSentAt: 1 } } };
    const r = tick({ min: 0, state: yesterday });
    expect(r.effects).toHaveLength(1);
    expect(r.state.day).toBe('2026-09-20');
  });
});

describe('acceptPushMessage (push recibido con la app visible)', () => {
  const msg = { title: '🔥 X', body: 'b', url: '/habitos/h1', tag: 'habit-h1', habitId: 'h1', count: 2 };
  it('muestra el aviso si aún no se había mostrado', () => {
    const r = acceptPushMessage(msg, empty, 1_000_000);
    expect(r.show).toBe(true);
    expect(r.state.items.h1).toEqual({ count: 2, lastSentAt: 1_000_000 });
  });
  it('no lo duplica si la propia web acaba de avisar (menos de 90 s)', () => {
    const state: ReminderFile = { day: 'x', items: { h1: { count: 1, lastSentAt: 1_000_000 } } };
    expect(acceptPushMessage(msg, state, 1_000_000 + 30_000).show).toBe(false);
    expect(acceptPushMessage(msg, state, 1_000_000 + 91_000).show).toBe(true);
  });
});

describe('estado guardado', () => {
  it('ida y vuelta, y se descarta el de otro día o el corrupto', () => {
    const mem = new Map<string, string>();
    const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    saveReminderState({ day: '2026-09-20', items: { h1: { count: 2, lastSentAt: 5 } } }, store);
    expect(loadReminderState('2026-09-20', store).items.h1.count).toBe(2);
    expect(loadReminderState('2026-09-21', store).items).toEqual({});
    mem.set('sq:reminder-state', '{no es json');
    expect(loadReminderState('2026-09-20', store)).toEqual({ day: '2026-09-20', items: {} });
  });
});
