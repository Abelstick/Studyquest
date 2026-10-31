/** XP base de cada cosa que se puede completar, y las monedas que salen del XP. Lee solo config.ts. */
import type { AttributeId, AttributeMapping, Difficulty, Habit, ISODate, Task } from '../domain';
import { BASE_XP_BY_DIFFICULTY, COINS, SOURCE_BASE_XP, SPLIT } from './config';

const difficulty = (x: { difficulty?: Difficulty }): Difficulty => x.difficulty ?? 'normal';

export const baseXpFor = (d: Difficulty): number => BASE_XP_BY_DIFFICULTY[d];

/** Una tarea da el XP de su dificultad; un jefe final, un poco más. */
export const taskBaseXp = (t: Pick<Task, 'difficulty' | 'priority'>): number => baseXpFor(difficulty(t)) + (t.priority === 'boss' ? SOURCE_BASE_XP.boss : 0);

export const habitBaseXp = (h: Pick<Habit, 'difficulty'>): number => baseXpFor(difficulty(h));

export const sessionBaseXp = (minutes: number): number => Math.min(SOURCE_BASE_XP.sessionMax, Math.round(Math.max(0, minutes) * SOURCE_BASE_XP.sessionPerMinute));

/** Cumplida a tiempo: tenía fecha límite y se cerró ese día o antes. Sin fecha no hay «a tiempo». */
export const isOnTime = (t: Pick<Task, 'dueDate'>, completedOn: ISODate): boolean => !!t.dueDate && completedOn <= t.dueDate;

/**
 * Lo que se ve antes de completar algo: el XP base repartido entre sus atributos, SIN multiplicadores
 * (racha, primera del día…), que dependen del momento. Lo que se cobra puede ser algo más.
 */
export function previewGains(base: number, mapping: AttributeMapping): { attribute: AttributeId; xp: number }[] {
  if (!mapping.secondary || mapping.secondary === mapping.primary) return [{ attribute: mapping.primary, xp: base }];
  return [
    { attribute: mapping.primary, xp: Math.round(base * SPLIT.primary) },
    { attribute: mapping.secondary, xp: Math.round(base * SPLIT.secondary) },
  ];
}

/** Monedas que da un XP (se redondea hacia cero, también al devolverlas). */
export const coinsForXp = (xp: number): number => Math.trunc(xp * COINS.perXp);
