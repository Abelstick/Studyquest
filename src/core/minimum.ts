/**
 * Versión mínima de un hábito: una cantidad menor que el objetivo (5 min de los 30) que basta para no cortar
 * la racha del propio hábito en un día malo. No es un registro aparte: se anota en el mismo registro del día
 * (`habitLogs` es único por hábito y día) y el XP sigue siendo el proporcional de siempre, así que no hay
 * recompensa extra ni registros duplicados. Los bonos (fin de semana, combo, cadena) piden el objetivo completo.
 *
 * Lógica pura, sin React ni base de datos.
 */
import type { Habit, HabitLog } from './domain';

type MinimumFields = Pick<Habit, 'minTarget' | 'target' | 'measure' | 'kind'>;

/** La versión mínima del hábito, o null si no tiene (o no tiene sentido: hecho/no hecho, dejar un mal hábito, mínimo ≥ objetivo). */
export const minimumOf = (h: MinimumFields): number | null =>
  h.kind !== 'quit' && h.measure !== 'boolean' && typeof h.minTarget === 'number' && Number.isFinite(h.minTarget) && h.minTarget > 0 && h.minTarget < h.target ? h.minTarget : null;

/** El día quedó en el mínimo: lo bastante para mantener la racha, sin llegar al objetivo. */
export const isMinimumMet = (h: MinimumFields, log?: Pick<HabitLog, 'value'>): boolean => {
  const min = minimumOf(h);
  return min !== null && !!log && log.value >= min && log.value < h.target;
};

/** Valor desde el cual el día cuenta para la racha del hábito: el mínimo si lo hay y, si no, el objetivo. */
export const keepsStreakAt = (h: MinimumFields): number => minimumOf(h) ?? h.target;

/** Mínimo válido a partir de lo escrito en un formulario o leído de una copia; undefined si no hay uno coherente. */
export function cleanMinimum(raw: unknown, h: Pick<Habit, 'target' | 'measure' | 'kind'>): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined;
  const min = Math.round(raw * 100) / 100;
  return minimumOf({ ...h, minTarget: min }) ?? undefined;
}
