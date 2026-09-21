/**
 * Eventos de racha: bonus de fin de semana, combo ×2 y cofre diario.
 * Los bonos se cobran una vez (y se anotan en el perfil), así que deshacer y rehacer un hábito no los repite.
 */
import type { DayBonus, Habit, HabitLog, ISODate, Profile } from './domain';
import { isWeekend, today } from './dates';
import { isHabitDone, logFor } from './game';

export const WEEKEND_BONUS_RATE = 0.5;
export const COMBO_THRESHOLD = 3;
export const COMBO_CAP = 200;

export const weekendBonus = (xp: number) => Math.max(1, Math.round(xp * WEEKEND_BONUS_RATE));
/** Combo ×2: el XP de los hábitos de hoy se duplica (con tope). */
export const comboBonus = (xps: number[]) => Math.min(COMBO_CAP, xps.reduce((a, b) => a + b, 0));

export const freshDayBonus = (date: ISODate): DayBonus => ({ date, weekend: [], combo: false });
export const dayBonusOf = (p: Pick<Profile, 'dayBonus'>, date: ISODate = today()): DayBonus => (p.dayBonus?.date === date ? p.dayBonus : freshDayBonus(date));

export const habitsDoneOn = (habits: Habit[], logs: HabitLog[], date: ISODate = today()): Habit[] => habits.filter((h) => isHabitDone(h, logFor(logs, h.id, date)));

export interface HabitBonus {
  xp: number;
  weekend: number;
  combo: number;
  next: DayBonus;
}

/** Bonos que corresponden al acabar de completar `habit` (los hábitos ya hechos hoy incluyen a `habit`). */
export function habitBonus(habit: Habit, doneToday: Habit[], claimed: DayBonus, date: ISODate = today()): HabitBonus {
  const next: DayBonus = { ...claimed, weekend: [...claimed.weekend] };
  let weekend = 0;
  let combo = 0;
  if (isWeekend(date) && !next.weekend.includes(habit.id)) {
    weekend = weekendBonus(habit.xp);
    next.weekend.push(habit.id);
  }
  if (!next.combo && doneToday.length >= COMBO_THRESHOLD) {
    combo = comboBonus(doneToday.map((h) => h.xp));
    next.combo = true;
  }
  return { xp: weekend + combo, weekend, combo, next };
}

export interface GameEvent {
  id: 'weekend' | 'combo';
  title: string;
  body: string;
  /** 0-100 si el evento es una barra de progreso. */
  pct?: number;
  active: boolean;
}

/** Eventos visibles hoy en Inicio. */
export function activeEvents(habits: Habit[], logs: HabitLog[], profile: Pick<Profile, 'dayBonus'>, date: ISODate = today()): GameEvent[] {
  const out: GameEvent[] = [];
  if (isWeekend(date)) out.push({ id: 'weekend', title: '¡Bonus de fin de semana!', body: `Cada hábito que completes hoy da +${Math.round(WEEKEND_BONUS_RATE * 100)}% de XP.`, active: true });
  const done = habitsDoneOn(habits, logs, date).length;
  if (dayBonusOf(profile, date).combo) {
    out.push({ id: 'combo', title: '¡Combo ×2 cobrado!', body: 'Hoy ya has duplicado el XP de tus hábitos. Mañana, otra vez.', pct: 100, active: true });
  } else if (habits.length >= COMBO_THRESHOLD) {
    const left = COMBO_THRESHOLD - done;
    out.push({
      id: 'combo',
      title: 'Combo ×2',
      body: left <= 0 ? 'Completa un hábito más para cobrarlo.' : `Completa ${COMBO_THRESHOLD} hábitos hoy y su XP se duplica${done ? ` (te ${left === 1 ? 'falta 1' : `faltan ${left}`})` : ''}.`,
      pct: Math.min(100, Math.round((done / COMBO_THRESHOLD) * 100)),
      active: false,
    });
  }
  return out;
}

/* ---------- Cofre diario ---------- */

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

export interface ChestReward {
  coins: number;
  xp: number;
}

/** El botín de un día es siempre el mismo (no se puede «rerollear»); la racha lo mejora. */
export function chestReward(date: ISODate, streak: number): ChestReward {
  const h = hash(date);
  return { coins: 20 + (h % 41) + Math.min(30, Math.max(0, streak)) * 2, xp: h % 5 === 0 ? 25 : 0 };
}

export const canOpenChest = (p: Pick<Profile, 'lastChest'>, date: ISODate = today()) => p.lastChest !== date;
