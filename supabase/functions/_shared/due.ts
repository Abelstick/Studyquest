/**
 * "¿Toca este hábito hoy?" para el servidor de recordatorios.
 *
 * Es un ESPEJO de `isDueOn` en src/core/game.ts, escrito sin dependencias para que la Edge Function (Deno)
 * pueda importarlo. Una prueba (src/core/due-parity.test.ts) compara ambas implementaciones con miles de
 * casos aleatorios, así que si cambias las reglas en un sitio y no en el otro, los tests fallan.
 *
 * Todas las fechas son días "YYYY-MM-DD" y se operan con Date.UTC: sin sorpresas por zona horaria.
 */

export type Frequency =
  | { type: 'daily' }
  | { type: 'days'; days: number[] }
  | { type: 'every'; every: number }
  | { type: 'weekly' }
  | { type: 'monthly' }
  | { type: 'dates'; dates: string[] }
  | { type: 'yearly'; month: number; day: number }
  | { type: 'custom'; times: number; per: 'week' | 'month' };

export interface HabitLike {
  id: string;
  frequency: Frequency;
  target: number;
  startDate: string;
}
export interface LogLike {
  habitId: string;
  date: string;
  value: number;
}

const toUtc = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => fromUtc(toUtc(s) + n * 86_400_000);
const diffDays = (a: string, b: string) => Math.round((toUtc(a) - toUtc(b)) / 86_400_000);
/** 0 = lunes … 6 = domingo. */
const weekdayIndex = (s: string) => (new Date(toUtc(s)).getUTCDay() + 6) % 7;
const weekStart = (s: string) => addDays(s, -weekdayIndex(s));
const monthKey = (s: string) => s.slice(0, 7);
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export function isDueOn(habit: HabitLike, date: string, logs: LogLike[]): boolean {
  const f = habit.frequency;
  const done = (l: LogLike) => l.habitId === habit.id && l.value >= habit.target;
  switch (f.type) {
    case 'daily':
      return true;
    case 'days':
      return f.days.includes(weekdayIndex(date));
    case 'every': {
      const diff = diffDays(date, habit.startDate);
      return diff >= 0 && diff % Math.max(1, f.every) === 0;
    }
    case 'weekly': {
      const from = weekStart(date);
      return !logs.some((l) => done(l) && l.date >= from && l.date < date);
    }
    case 'monthly':
      return !logs.some((l) => done(l) && monthKey(l.date) === monthKey(date) && l.date < date);
    case 'dates':
      return f.dates.includes(date);
    case 'yearly': {
      const [y, m, d] = date.split('-').map(Number);
      if (m === f.month && d === f.day) return true;
      return f.month === 2 && f.day === 29 && m === 2 && d === 28 && !isLeap(y);
    }
    case 'custom': {
      const from = f.per === 'week' ? weekStart(date) : `${monthKey(date)}-01`;
      return logs.filter((l) => done(l) && l.date >= from && l.date < date).length < Math.max(1, f.times);
    }
  }
}

export const isDoneOn = (habit: HabitLike, logs: LogLike[], date: string): boolean =>
  logs.some((l) => l.habitId === habit.id && l.date === date && l.value >= habit.target);

/** Fecha y hora local de un instante en una zona horaria IANA. */
export function localParts(now: Date, timeZone: string): { date: string; minutes: number } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

/** Minutos que han pasado desde la hora del recordatorio ("19:00"), o null si el formato no es válido. */
export function minutesSince(reminder: unknown, nowMinutes: number): number | null {
  if (typeof reminder !== 'string' || !/^\d{2}:\d{2}$/.test(reminder)) return null;
  const [h, m] = reminder.split(':').map(Number);
  return nowMinutes - (h * 60 + m);
}
