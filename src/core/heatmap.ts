/**
 * Mapa de calor de actividad: cada día de las últimas semanas con una intensidad según el XP neto que dejó.
 * Funciones puras. Las semanas empiezan en lunes y la última es la actual.
 */
import type { ISODate, XpEvent } from './domain';
import { addDays, today, weekStart } from './dates';

/** 0 = sin actividad; 1-4 de menos a más XP. */
export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export interface HeatCell {
  date: ISODate;
  level: HeatLevel;
  xp: number;
  frozen: boolean;
  future: boolean;
}

/** XP neto del día a partir del cual sube cada nivel (el primero es cualquier XP positivo). */
export const HEAT_STEPS = [1, 50, 150, 300] as const;

export const heatLevel = (xp: number): HeatLevel => {
  if (xp < HEAT_STEPS[0]) return 0;
  if (xp < HEAT_STEPS[1]) return 1;
  if (xp < HEAT_STEPS[2]) return 2;
  if (xp < HEAT_STEPS[3]) return 3;
  return 4;
};

export interface YearHeat {
  /** Una columna por semana, de lunes a domingo. */
  weeks: HeatCell[][];
  /** Días con actividad en el periodo. */
  activeDays: number;
  /** Mejor día del periodo, en XP. */
  best: number;
}

export function yearHeat(events: XpEvent[], frozen: ISODate[], now: ISODate = today(), weeks = 53): YearHeat {
  const byDay = new Map<ISODate, number>();
  for (const e of events) byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.amount);
  const frozenSet = new Set(frozen);
  const first = addDays(weekStart(now), -(weeks - 1) * 7);
  let activeDays = 0;
  let best = 0;
  const cols: HeatCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: HeatCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(first, w * 7 + d);
      const xp = byDay.get(date) ?? 0;
      const future = date > now;
      const isFrozen = frozenSet.has(date);
      const level = future ? 0 : heatLevel(xp);
      if (!future && (level > 0 || isFrozen)) activeDays++;
      if (!future) best = Math.max(best, xp);
      col.push({ date, level, xp, frozen: isFrozen, future });
    }
    cols.push(col);
  }
  return { weeks: cols, activeDays, best };
}
