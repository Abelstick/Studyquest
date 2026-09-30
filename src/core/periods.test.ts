import { describe, expect, it } from 'vitest';
import type { Habit, HabitLog } from './domain';
import { daysLeftLabel } from './dates';
import { pendingCatchUp } from './catchup';
import { inDaysLabel, nextDueDate, quotaInfo, quotaText } from './periods';

const NOW = '2026-09-16'; // miércoles
const habit = (over: Partial<Habit>): Habit => ({
  id: 'h', title: 'h', frequency: { type: 'daily' }, measure: 'boolean', target: 1, xp: 30, reminder: null, steps: [], startDate: '2026-08-01', createdAt: '', ...over,
});
const log = (date: string, value = 1): HabitLog => ({ id: date, habitId: 'h', date, value, stepsDone: [] });

describe('hábitos de cuota', () => {
  const h = habit({ frequency: { type: 'custom', times: 3, per: 'week' } });
  it('cuenta las veces cumplidas en la semana y cuánto queda', () => {
    const q = quotaInfo(h, [log('2026-09-14'), log('2026-09-15')], NOW)!;
    expect(q).toMatchObject({ per: 'week', goal: 3, done: 2, met: false, daysLeft: 5, tight: false });
    expect(quotaText(h, [log('2026-09-14')], NOW)).toBe('1/3 esta semana · quedan 5 días');
  });
  it('avisa cuando ya no hay margen', () => {
    expect(quotaInfo(h, [], '2026-09-20')!.tight).toBe(true); // domingo, faltan 3 y solo queda hoy
  });
  it('un hábito de cuota no genera «días sin marcar»', () => {
    expect(pendingCatchUp(h, [], NOW)).toEqual([]);
  });
  it('cumplida la cuota, la próxima es el inicio del periodo siguiente', () => {
    const w = habit({ frequency: { type: 'weekly' } });
    expect(nextDueDate(w, [log('2026-09-15')], NOW)).toBe('2026-09-21');
  });
  it('los diarios no tienen cuota', () => {
    expect(quotaInfo(habit({}), [], NOW)).toBeNull();
  });
});

describe('hábitos cada N días', () => {
  it('dice cuándo toca la próxima', () => {
    const h = habit({ frequency: { type: 'every', every: 3 }, startDate: '2026-09-10' }); // 10, 13, 16, 19…
    expect(nextDueDate(h, [], NOW)).toBe('2026-09-16');
    expect(nextDueDate(h, [log('2026-09-16')], NOW)).toBe('2026-09-19');
    expect(inDaysLabel('2026-09-19', NOW)).toBe('en 3 días');
  });
});

describe('días que faltan para una tarea', () => {
  it('lo dice en claro', () => {
    expect(daysLeftLabel(null, NOW)).toBeNull();
    expect(daysLeftLabel('2026-09-16', NOW)).toBe('Vence hoy');
    expect(daysLeftLabel('2026-09-17', NOW)).toBe('Falta 1 día');
    expect(daysLeftLabel('2026-09-21', NOW)).toBe('Faltan 5 días');
    expect(daysLeftLabel('2026-09-14', NOW)).toBe('Venció hace 2 días');
  });
});
