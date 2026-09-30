/**
 * Hábitos que no son «cada día»: los de cuota (1 vez por semana, 3 por semana, 1 al mes) y los de
 * calendario (cada N días, fechas, anual). Para ellos lo que importa no es cada día suelto, sino el
 * periodo: cuántas veces llevas, cuántas te faltan, cuánto queda y cuándo toca la próxima.
 *
 * Lógica pura, sin React ni base de datos.
 */
import type { Habit, HabitLog, ISODate } from './domain';
import { addDays, diffDays, fromISODate, monthKey, today, weekStart } from './dates';
import { isDueOn, isHabitDone, logFor } from './game';

/** Hábitos de cuota: se cumplen «N veces en el periodo», el día que quieras. */
export const isQuotaHabit = (h: Habit): boolean => h.frequency.type === 'weekly' || h.frequency.type === 'monthly' || h.frequency.type === 'custom';

/** Hábitos de calendario: tocan en días concretos (cada N días, fechas, anual). */
export const isCalendarHabit = (h: Habit): boolean => h.frequency.type === 'every' || h.frequency.type === 'dates' || h.frequency.type === 'yearly';

export interface QuotaInfo {
  per: 'week' | 'month';
  /** Veces que hay que cumplirlo en el periodo. */
  goal: number;
  /** Veces ya cumplidas en este periodo (días completos). */
  done: number;
  /** Cuánto de otra vez llevas a medias hoy, de 0 a 1 (6 de 10 = 0,6). */
  partialToday: number;
  from: ISODate;
  to: ISODate;
  /** Días que quedan, contando hoy. */
  daysLeft: number;
  met: boolean;
  /** Ya no hay margen: hay que hacerlo cada día que queda para llegar. */
  tight: boolean;
}

function periodOf(h: Habit): { per: 'week' | 'month'; goal: number } {
  const f = h.frequency;
  if (f.type === 'weekly') return { per: 'week', goal: 1 };
  if (f.type === 'monthly') return { per: 'month', goal: 1 };
  if (f.type === 'custom') return { per: f.per, goal: Math.max(1, f.times) };
  return { per: 'week', goal: 1 };
}

const lastDayOfMonth = (d: ISODate): ISODate => {
  const x = fromISODate(d);
  const last = new Date(x.getFullYear(), x.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
};

/** Progreso de un hábito de cuota en el periodo en curso; null si no es de cuota. */
export function quotaInfo(h: Habit, logs: HabitLog[], now: ISODate = today()): QuotaInfo | null {
  if (!isQuotaHabit(h)) return null;
  const { per, goal } = periodOf(h);
  const from = per === 'week' ? weekStart(now) : `${monthKey(now)}-01`;
  const to = per === 'week' ? addDays(from, 6) : lastDayOfMonth(now);
  const inPeriod = logs.filter((l) => l.habitId === h.id && l.date >= from && l.date <= to);
  const done = inPeriod.filter((l) => l.value >= h.target).length;
  const today_ = logFor(logs, h.id, now);
  const partialToday = today_ && !isHabitDone(h, today_) && h.target > 0 ? Math.min(1, Math.max(0, today_.value) / h.target) : 0;
  const daysLeft = diffDays(to, now) + 1;
  const met = done >= goal;
  return { per, goal, done, partialToday, from, to, daysLeft, met, tight: !met && goal - done >= daysLeft };
}

/** Próxima fecha en que toca (después de hoy, o hoy mismo si aún no está hecho); null si no hay. */
export function nextDueDate(h: Habit, logs: HabitLog[], now: ISODate = today()): ISODate | null {
  // Los de cuota tocan «cuando quieras» mientras falte cuota; cumplida, la próxima es el inicio del periodo siguiente.
  const q = quotaInfo(h, logs, now);
  if (q) return q.met ? addDays(q.to, 1) : now;
  const doneToday = isHabitDone(h, logFor(logs, h.id, now));
  for (let i = doneToday ? 1 : 0; i <= 400; i++) {
    const d = addDays(now, i);
    if (d >= h.startDate && isDueOn(h, d, logs)) return d;
  }
  return null;
}

/** «Hoy», «Mañana» o «En 3 días»: cuánto falta para una fecha. */
export function inDaysLabel(date: ISODate, now: ISODate = today()): string {
  const n = diffDays(date, now);
  if (n === 0) return 'hoy';
  if (n === 1) return 'mañana';
  if (n === -1) return 'ayer';
  return n > 0 ? `en ${n} días` : `hace ${-n} días`;
}

/** Texto corto del estado del periodo, para tarjetas y misiones: «1/3 esta semana · quedan 4 días». */
export function quotaText(h: Habit, logs: HabitLog[], now: ISODate = today()): string | null {
  const q = quotaInfo(h, logs, now);
  if (!q) return null;
  const unit = q.per === 'week' ? 'esta semana' : 'este mes';
  if (q.met) return `Cumplido ${unit} (${q.done}/${q.goal})`;
  const left = q.daysLeft === 1 ? 'último día' : `quedan ${q.daysLeft} días`;
  return `${q.done}/${q.goal} ${unit} · ${left}`;
}
