/**
 * Dejar un mal hábito. Es un hábito diario de «hecho / no hecho» donde hecho significa «hoy resistí»:
 * el XP, la racha y los recordatorios son los de cualquier hábito. Lo propio de aquí son las recaídas
 * (`slips`) y el contador de días limpio, que se mide desde la última recaída (o desde que empezó).
 *
 * Lógica pura, sin React ni base de datos.
 */
import type { Habit, ISODate } from './domain';
import { diffDays, today } from './dates';

export const isQuit = (h: Pick<Habit, 'kind'>): boolean => h.kind === 'quit';

/** Última recaída, si la hay. */
export const lastSlip = (h: Pick<Habit, 'slips'>): ISODate | null => (h.slips?.length ? [...h.slips].sort().at(-1) ?? null : null);

export const slippedOn = (h: Pick<Habit, 'slips'>, date: ISODate): boolean => !!h.slips?.includes(date);

/** Días completos desde la última recaída (o desde que empezó). Recaer hoy deja el contador en 0. */
export function cleanDays(h: Pick<Habit, 'slips' | 'startDate'>, now: ISODate = today()): number {
  return Math.max(0, diffDays(now, lastSlip(h) ?? h.startDate));
}

/** La racha limpia más larga, contando la actual. */
export function bestCleanStreak(h: Pick<Habit, 'slips' | 'startDate'>, now: ISODate = today()): number {
  const marks = [h.startDate, ...[...(h.slips ?? [])].sort().filter((d) => d >= h.startDate && d <= now), now];
  let best = 0;
  for (let i = 1; i < marks.length; i++) best = Math.max(best, diffDays(marks[i], marks[i - 1]));
  return best;
}

/** Añade una recaída sin duplicarla y en orden. */
export const withSlip = (slips: readonly ISODate[] | undefined, date: ISODate): ISODate[] => [...new Set([...(slips ?? []), date])].sort();

export const withoutSlip = (slips: readonly ISODate[] | undefined, date: ISODate): ISODate[] => (slips ?? []).filter((d) => d !== date);

/** Hitos de días limpio que se celebran. */
export const CLEAN_MILESTONES = [1, 3, 7, 14, 30, 60, 90, 180, 365] as const;

/** Próximo hito por alcanzar y cuántos días faltan; null si ya pasó el último. */
export function nextMilestone(days: number): { target: number; left: number } | null {
  const target = CLEAN_MILESTONES.find((m) => m > days);
  return target ? { target, left: target - days } : null;
}
