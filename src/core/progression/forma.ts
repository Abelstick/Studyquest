/**
 * Forma de un atributo (0–100). Baja despacio si el atributo pasa días sin actividad y se recupera
 * rápido al volver. Se calcula al leer a partir del ledger, nunca se guarda, y nunca resta XP ni niveles:
 * como mucho rebaja un poco el XP que se gana mientras está baja.
 */
import type { AttributeId, ISODate, XpEvent } from '../domain';
import { addDays } from '../dates';
import { FORMA } from './config';
import { activeDaysOf } from './ledger';

/**
 * Forma al TERMINAR el día `on`. Se recorre desde el primer día con actividad: cada día activo recupera,
 * cada día inactivo pasada la gracia descuenta. Sin actividad nunca, la Forma está llena (no se castiga empezar).
 */
export function formaOn(events: readonly XpEvent[], attribute: AttributeId, on: ISODate): number {
  const days = activeDaysOf(events, attribute);
  let first: ISODate | null = null;
  for (const d of days) if (d <= on && (!first || d < first)) first = d;
  if (!first) return FORMA.max;
  let forma: number = FORMA.max;
  let idle = 0;
  for (let d = first; d <= on; d = addDays(d, 1)) {
    if (days.has(d)) {
      idle = 0;
      forma = Math.min(FORMA.max, forma + FORMA.recoverPerDay);
    } else if (++idle > FORMA.graceDays) forma = Math.max(FORMA.min, forma - FORMA.decayPerDay);
  }
  return forma;
}

/** Forma con la que se empieza `day` (la del final del día anterior): es la que afecta al XP ganado ese día. */
export const formaBefore = (events: readonly XpEvent[], attribute: AttributeId, day: ISODate): number => formaOn(events, attribute, addDays(day, -1));

export const isFormaLow = (forma: number): boolean => forma < FORMA.lowThreshold;
