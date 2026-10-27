import { describe, expect, it } from 'vitest';
import type { AgendaEvent, Habit } from './domain';
import { firstMinute, habitTimesMap, habitTimesOn, timesText } from './habitTime';

// Miércoles 16-sep-2026.
const NOW = '2026-09-16';
const habit = (id: string, extra: Partial<Habit> = {}): Habit => ({ id, title: id, frequency: { type: 'daily' }, measure: 'boolean', target: 1, xp: 10, reminder: null, steps: [], startDate: '2026-01-01', createdAt: '', ...extra });
const block = (habitId: string, start: string, extra: Partial<AgendaEvent> = {}): AgendaEvent => ({
  id: `${habitId}-${start}`, title: '', category: 'personal', date: '2026-09-01', start, minutes: 30, repeat: { type: 'daily', every: 1 }, habitId, taskId: null, rev: 0, createdAt: '', updatedAt: '', ...extra,
});
const ctx = (habits: Habit[]) => ({ habits, tasks: [], logs: [] });

describe('hora de un hábito', () => {
  it('sin bloques ni hora propia no tiene hora', () => {
    const h = habit('a');
    expect(habitTimesOn(h, [], ctx([h]), NOW)).toEqual([]);
  });

  it('usa la hora propia del hábito cuando no hay bloques', () => {
    const h = habit('a', { reminder: '07:30' });
    expect(habitTimesOn(h, [], ctx([h]), NOW)).toEqual(['07:30']);
  });

  it('los bloques del calendario mandan sobre la hora propia, y con varios al día salen todos ordenados', () => {
    const h = habit('a', { reminder: '07:30' });
    const r = habitTimesOn(h, [block('a', '19:00'), block('a', '08:00')], ctx([h]), NOW);
    expect(r).toEqual(['08:00', '19:00']);
  });

  it('un bloque que hoy no ocurre (otro día de la semana) no cuenta; cae a la hora propia', () => {
    const h = habit('a', { reminder: '06:00' });
    // Un bloque solo de lunes: hoy es miércoles.
    const lunes = block('a', '20:00', { repeat: { type: 'weekly', every: 1, days: [0] } });
    expect(habitTimesOn(h, [lunes], ctx([h]), NOW)).toEqual(['06:00']);
  });

  it('una ocurrencia cancelada hoy no cuenta', () => {
    const h = habit('a');
    const cancelado = block('a', '20:00', { exceptions: { [NOW]: { deleted: true } } });
    expect(habitTimesOn(h, [cancelado], ctx([h]), NOW)).toEqual([]);
  });

  it('un bloque de otro hábito no se le atribuye', () => {
    const a = habit('a');
    const b = habit('b');
    const m = habitTimesMap([a, b], [block('b', '10:00')], ctx([a, b]), NOW);
    expect(m.has('a')).toBe(false);
    expect(m.get('b')).toEqual(['10:00']);
  });

  it('textos y minuto para ordenar', () => {
    expect(timesText(['07:30', '19:00'])).toBe('07:30 · 19:00');
    expect(firstMinute(['07:30'])).toBe(450);
    expect(firstMinute([])).toBeNull();
    expect(firstMinute(undefined)).toBeNull();
  });
});
