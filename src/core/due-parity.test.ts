import { describe, expect, it } from 'vitest';
import type { Frequency, Habit, HabitLog } from './domain';
import { isDueOn as clientDue } from './game';
import { addDays } from './dates';
import { isDoneOn, isDueOn as serverDue, localParts, minutesSince } from '../../supabase/functions/_shared/due';

/**
 * La Edge Function de recordatorios NO puede importar src/core (corre en Deno), así que tiene su propia copia
 * de `isDueOn`. Estas pruebas garantizan que ambas dicen SIEMPRE lo mismo.
 */

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const habit = (frequency: Frequency, over: Partial<Habit> = {}): Habit => ({
  id: 'h', title: 'h', frequency, measure: 'times', target: 1, xp: 10, reminder: null, steps: [], startDate: '2026-01-10', createdAt: '', ...over,
});

const FREQS: Frequency[] = [
  { type: 'daily' },
  { type: 'days', days: [0, 2, 4] },
  { type: 'days', days: [5, 6] },
  { type: 'every', every: 2 },
  { type: 'every', every: 3 },
  { type: 'every', every: 10 },
  { type: 'weekly' },
  { type: 'monthly' },
  { type: 'dates', dates: ['2026-03-01', '2026-06-15', '2028-02-29'] },
  { type: 'yearly', month: 3, day: 15 },
  { type: 'yearly', month: 2, day: 29 },
  { type: 'yearly', month: 12, day: 31 },
  { type: 'custom', times: 3, per: 'week' },
  { type: 'custom', times: 1, per: 'week' },
  { type: 'custom', times: 2, per: 'month' },
  { type: 'custom', times: 8, per: 'month' },
];

describe('paridad servidor ↔ cliente de "¿toca hoy?"', () => {
  it('coincide en miles de fechas y registros aleatorios', () => {
    const r = rng(2026);
    let checked = 0;
    for (const f of FREQS) {
      for (let trial = 0; trial < 40; trial++) {
        const h = habit(f, { startDate: addDays('2026-01-01', Math.floor(r() * 60)) });
        const logs: HabitLog[] = [];
        for (let i = 0; i < 120; i++) {
          if (r() < 0.35) logs.push({ id: String(i), habitId: 'h', date: addDays('2025-12-01', i * 3 + Math.floor(r() * 3)), value: r() < 0.8 ? 1 : 0, stepsDone: [] });
        }
        for (let d = 0; d < 30; d++) {
          const date = addDays('2026-02-01', Math.floor(r() * 900)); // cubre años bisiestos (2028)
          const c = clientDue(h, date, logs);
          const s = serverDue({ id: h.id, frequency: h.frequency, target: h.target, startDate: h.startDate }, date, logs.map((l) => ({ habitId: l.habitId, date: l.date, value: l.value })));
          expect(s, `${JSON.stringify(f)} @ ${date}`).toBe(c);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(15_000);
  });

  it('isDoneOn respeta el objetivo del día', () => {
    const h = { id: 'h', frequency: { type: 'daily' } as Frequency, target: 20, startDate: '2026-01-01' };
    expect(isDoneOn(h, [{ habitId: 'h', date: '2026-09-20', value: 12 }], '2026-09-20')).toBe(false);
    expect(isDoneOn(h, [{ habitId: 'h', date: '2026-09-20', value: 20 }], '2026-09-20')).toBe(true);
    expect(isDoneOn(h, [{ habitId: 'h', date: '2026-09-19', value: 20 }], '2026-09-20')).toBe(false);
  });
});

describe('hora local del recordatorio', () => {
  it('Lima (UTC-5): las 00:30 UTC del 21 son las 19:30 del 20', () => {
    expect(localParts(new Date('2026-09-21T00:30:00Z'), 'America/Lima')).toEqual({ date: '2026-09-20', minutes: 19 * 60 + 30 });
  });
  it('Madrid en verano (UTC+2)', () => {
    expect(localParts(new Date('2026-07-01T17:05:00Z'), 'Europe/Madrid')).toEqual({ date: '2026-07-01', minutes: 19 * 60 + 5 });
  });
  it('medianoche se representa como 00, no 24', () => {
    expect(localParts(new Date('2026-09-21T05:00:00Z'), 'America/Lima')).toEqual({ date: '2026-09-21', minutes: 0 });
  });
  it('una zona horaria inválida cae a UTC en vez de romper', () => {
    expect(localParts(new Date('2026-09-21T10:00:00Z'), 'No/Existe').minutes).toBe(600);
  });
  it('minutesSince: ventana desde la hora del recordatorio', () => {
    expect(minutesSince('19:00', 19 * 60)).toBe(0);
    expect(minutesSince('19:00', 19 * 60 + 7)).toBe(7);
    expect(minutesSince('19:00', 18 * 60 + 59)).toBe(-1);
    expect(minutesSince(null, 100)).toBeNull();
    expect(minutesSince('7pm', 100)).toBeNull();
  });
});
