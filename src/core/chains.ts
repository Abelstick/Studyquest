/**
 * Cadenas de hábitos: «apilar hábitos». Cada eslabón es la SEÑAL del siguiente
 * (dormir temprano → levantarse temprano → ejercicio → estudio → proyecto).
 *
 * La cadena guía y premia, nunca bloquea: puedes registrar cualquier hábito cuando quieras.
 * Un día malo no debe impedirte apuntar lo que sí hiciste ni costarte la racha.
 *
 * Lógica pura, sin React ni base de datos.
 */
import type { Habit, HabitChain, HabitLog, ID, ISODate } from './domain';
import { today } from './dates';
import { isDueOn, isHabitDone, logFor } from './game';

/** XP por completar hoy todos los eslabones que tocaban. Se cobra una vez al día por cadena. */
export const CHAIN_BONUS_XP = 100;

/** Cuántos hábitos caben en una cadena: más de esto deja de leerse como una rutina. */
export const MAX_CHAIN_LINKS = 8;

export interface ChainLink {
  habit: Habit;
  /** ¿Toca hoy según su propia frecuencia? Los que no tocan no estorban ni cuentan. */
  due: boolean;
  done: boolean;
  /** El primero pendiente de los que tocan hoy: el que te toca ahora. */
  isNext: boolean;
  /** El eslabón anterior que sí toca hoy, que es la señal para este. */
  after: Habit | null;
}

export interface ChainState {
  chain: HabitChain;
  links: ChainLink[];
  /** Solo los que tocan hoy. */
  dueCount: number;
  doneCount: number;
  pct: number;
  /** Todos los de hoy hechos (y había al menos uno). */
  complete: boolean;
  next: Habit | null;
}

/** Los hábitos de la cadena, en orden, descartando los que ya no existen. */
export const chainHabits = (chain: HabitChain, habits: Habit[]): Habit[] =>
  chain.habitIds.flatMap((id) => {
    const h = habits.find((x) => x.id === id);
    return h ? [h] : [];
  });

/** Estado de hoy de una cadena: qué está hecho, qué toca ahora y si se completó. */
export function chainState(chain: HabitChain, habits: Habit[], logs: HabitLog[], now: ISODate = today()): ChainState {
  const list = chainHabits(chain, habits);
  const links: ChainLink[] = [];
  let prevDue: Habit | null = null;
  let nextTaken = false;

  for (const habit of list) {
    const due = isDueOn(habit, now, logs);
    const done = isHabitDone(habit, logFor(logs, habit.id, now));
    const isNext = due && !done && !nextTaken;
    if (isNext) nextTaken = true;
    links.push({ habit, due, done, isNext, after: prevDue });
    if (due) prevDue = habit;
  }

  const dueLinks = links.filter((l) => l.due);
  const doneCount = dueLinks.filter((l) => l.done).length;
  return {
    chain,
    links,
    dueCount: dueLinks.length,
    doneCount,
    pct: dueLinks.length ? Math.round((doneCount / dueLinks.length) * 100) : 0,
    complete: dueLinks.length > 0 && doneCount === dueLinks.length,
    next: links.find((l) => l.isNext)?.habit ?? null,
  };
}

/** La cadena a la que pertenece un hábito (un hábito está en una sola). */
export const chainOf = (chains: HabitChain[], habitId: ID): HabitChain | undefined => chains.find((c) => c.habitIds.includes(habitId));

/** Hábitos que aún no están en ninguna cadena: los candidatos al añadir eslabones. */
export const looseHabits = (habits: Habit[], chains: HabitChain[], exceptChain?: ID): Habit[] =>
  habits.filter((h) => {
    const owner = chainOf(chains, h.id);
    return !owner || owner.id === exceptChain;
  });

/**
 * Deja las cadenas coherentes: sin hábitos borrados, sin repetidos, sin pasarse de largo
 * y sin cadenas que se quedaron con menos de dos eslabones (una cadena de uno no es una cadena).
 */
export function cleanChains(chains: HabitChain[], habits: Habit[]): HabitChain[] {
  const alive = new Set(habits.map((h) => h.id));
  const used = new Set<ID>();
  const out: HabitChain[] = [];
  for (const c of chains) {
    const ids: ID[] = [];
    for (const id of c.habitIds) {
      if (!alive.has(id) || used.has(id) || ids.includes(id) || ids.length >= MAX_CHAIN_LINKS) continue;
      ids.push(id);
    }
    if (ids.length < 2) continue;
    ids.forEach((id) => used.add(id));
    out.push({ ...c, habitIds: ids });
  }
  return out;
}

/**
 * Cadenas que acaban de completarse al registrar `habitId` y aún no han pagado hoy.
 * `claimed` son los ids de cadena ya cobrados en el día.
 */
export function chainsToReward(chains: HabitChain[], habits: Habit[], logs: HabitLog[], habitId: ID, claimed: ID[], now: ISODate = today()): ChainState[] {
  const owner = chainOf(chains, habitId);
  if (!owner || claimed.includes(owner.id)) return [];
  const state = chainState(owner, habits, logs, now);
  return state.complete ? [state] : [];
}
