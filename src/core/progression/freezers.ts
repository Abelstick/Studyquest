/**
 * Congeladores de racha. Se ganan con la constancia (uno por cada `FREEZERS.everyStreakDays` días seguidos, mientras
 * tengas menos de `FREEZERS.maxEarned`) y se gastan solos: si un día se pasó sin XP y la racha venía viva, se congela
 * ese día. No hay botón: la racha no debería depender de acordarse de protegerla.
 *
 * Funciones puras sobre el conjunto de días activos (los que dan `computeStreak`/`activeDays`).
 */
import type { ISODate } from '../domain';
import { addDays } from '../dates';
import { FREEZERS } from './config';

/** Primer día de la racha que llega hasta `now` (o hasta ayer, si hoy aún no hay XP). null si no hay racha. */
export function streakStart(days: ReadonlySet<ISODate>, now: ISODate): ISODate | null {
  let cursor = days.has(now) ? now : addDays(now, -1);
  if (!days.has(cursor)) return null;
  while (days.has(addDays(cursor, -1))) cursor = addDays(cursor, -1);
  return cursor;
}

/**
 * Días que hay que congelar para que la racha siga viva: el hueco sin XP que termina AYER (hoy aún se puede salvar
 * por las buenas), si la racha venía de antes y alcanzan los congeladores para cubrirlo entero. Si no alcanzan no se
 * gasta ninguno: no tiene sentido quemarlos en una racha que ya se perdió.
 */
export function daysToFreeze(days: ReadonlySet<ISODate>, now: ISODate, freezes: number): ISODate[] {
  if (freezes < 1) return [];
  const gap: ISODate[] = [];
  let cursor = addDays(now, -1);
  while (!days.has(cursor)) {
    gap.push(cursor);
    if (gap.length > freezes) return [];
    cursor = addDays(cursor, -1);
  }
  return gap.reverse();
}

/** Clave de un hito de racha ya premiado: la racha se reconoce por su primer día. */
export const freezerMilestoneKey = (start: ISODate, days: number) => `${start}+${days}`;

/** Hitos que se recuerdan (de sobra para no repetir premios en las rachas recientes). */
export const MAX_FREEZER_MILESTONES = 12;

/**
 * Congeladores ganados por la racha actual. Cada hito (7, 14, 21… días) se mira una sola vez: si al llegar a él
 * ya tenías el máximo, se marca igual y no se cobra después (gastar uno no devuelve un hito viejo).
 */
export function earnFreezers(current: number, start: ISODate | null, owned: number, seen: readonly string[] = []): { earned: number; seen: string[] } {
  if (!start || current < FREEZERS.everyStreakDays) return { earned: 0, seen: [...seen] };
  const marks = [...seen];
  let earned = 0;
  for (let d = FREEZERS.everyStreakDays; d <= current; d += FREEZERS.everyStreakDays) {
    const key = freezerMilestoneKey(start, d);
    if (marks.includes(key)) continue;
    marks.push(key);
    if (owned + earned < FREEZERS.maxEarned) earned++;
  }
  return { earned, seen: marks.slice(-MAX_FREEZER_MILESTONES) };
}
