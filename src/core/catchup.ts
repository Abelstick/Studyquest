/**
 * Ponerse al día: marcar un hábito de un día que ya pasó, por si se te olvidó marcarlo.
 *
 * Solo se puede rellenar hacia atrás y dentro de una ventana corta. El límite es a propósito:
 * si se pudiera rellenar cualquier día, la racha y las estadísticas dejarían de significar nada.
 *
 * Lógica pura, sin React ni base de datos.
 */
import type { Habit, HabitLog, ISODate } from './domain';
import { addDays, diffDays, today } from './dates';
import { isDueOn, isHabitDone, logFor } from './game';

/** Cuántos días atrás se puede rellenar. Una semana cubre el olvido normal sin falsear el historial. */
export const CATCH_UP_DAYS = 7;

export interface CatchUpDay {
  date: ISODate;
  /** Tocaba ese día, según la frecuencia del hábito. */
  due: boolean;
  done: boolean;
  /** Hoy mismo (se marca como siempre, no es «ponerse al día»). */
  isToday: boolean;
  /** Se puede marcar o desmarcar. */
  editable: boolean;
  /** Por qué no se puede, para decírselo a quien lo intente. */
  reason?: 'futuro' | 'no-tocaba' | 'demasiado-atras' | 'antes-de-crearlo';
}

/** Estado de un día concreto para un hábito. */
export function catchUpDay(habit: Habit, logs: HabitLog[], date: ISODate, now: ISODate = today()): CatchUpDay {
  const done = isHabitDone(habit, logFor(logs, habit.id, date));
  const due = isDueOn(habit, date, logs);
  const back = diffDays(now, date);
  const base = { date, due, done, isToday: date === now };

  if (back < 0) return { ...base, editable: false, reason: 'futuro' };
  if (date < habit.startDate) return { ...base, editable: false, reason: 'antes-de-crearlo' };
  if (back > CATCH_UP_DAYS) return { ...base, editable: false, reason: 'demasiado-atras' };
  // Un día que no tocaba no se rellena: el hábito no se incumplió.
  if (!due && !done) return { ...base, editable: false, reason: 'no-tocaba' };
  return { ...base, editable: true };
}

/** ¿Se puede tocar ese día? Lo usa también el store, para no fiarse solo de la pantalla. */
export const canCatchUp = (habit: Habit, logs: HabitLog[], date: ISODate, now: ISODate = today()): boolean =>
  catchUpDay(habit, logs, date, now).editable;

/** Los últimos días, del más antiguo al de hoy. */
export function catchUpWindow(habit: Habit, logs: HabitLog[], now: ISODate = today(), days = CATCH_UP_DAYS): CatchUpDay[] {
  return Array.from({ length: days + 1 }, (_, i) => catchUpDay(habit, logs, addDays(now, i - days), now));
}

/** Días que tocaban, ya pasaron y siguen sin marcar: lo que de verdad te falta por ponerte al día. */
export const pendingCatchUp = (habit: Habit, logs: HabitLog[], now: ISODate = today()): CatchUpDay[] =>
  catchUpWindow(habit, logs, now).filter((d) => d.editable && !d.done && !d.isToday);

/** Cuántos olvidos hay en total, para avisar en la pantalla de hábitos. */
export const totalPending = (habits: Habit[], logs: HabitLog[], now: ISODate = today()): number =>
  habits.reduce((a, h) => a + pendingCatchUp(h, logs, now).length, 0);
