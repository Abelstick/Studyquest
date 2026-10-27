/**
 * A qué hora se hace un hábito hoy. Una sola fuente de verdad para Hoy, la tarjeta de «Siguiente paso» y la pantalla
 * de hábitos: primero las horas de los bloques que le reservaste en el calendario (puede haber varios al día) y, si no
 * tiene ninguno, la hora propia del hábito (`reminder`, la que fijas al crearlo o editarlo). Funciones puras.
 */
import type { AgendaEvent, Habit, HabitLog, ISODate, Task } from './domain';
import { occurrencesBetween, toClock } from './agenda';
import { isClockTime, clockToMinutes, today } from './dates';

type Ctx = { habits: Habit[]; tasks: Task[]; logs: HabitLog[] };

/** Las horas «HH:MM» de un hábito en un día, de la más temprana a la más tarde y sin repetir; vacío si no tiene hora. */
export function habitTimesOn(habit: Habit, events: AgendaEvent[], ctx: Ctx, date: ISODate = today()): string[] {
  return habitTimesMap([habit], events, ctx, date).get(habit.id) ?? [];
}

/** Solo las horas de los bloques del calendario (sin la hora propia del hábito), por hábito y ordenadas. */
export function calendarTimesMap(habits: Habit[], events: AgendaEvent[], ctx: Ctx, date: ISODate = today()): Map<string, string[]> {
  const ids = new Set(habits.map((h) => h.id));
  const linked = events.filter((e) => e.habitId && ids.has(e.habitId));
  const byHabit = new Map<string, Set<string>>();
  if (linked.length) {
    for (const o of occurrencesBetween(linked, date, date, ctx)) {
      if (o.status === 'cancelled' || o.date !== date || o.start === null || !o.event.habitId) continue;
      const set = byHabit.get(o.event.habitId) ?? new Set<string>();
      set.add(toClock(o.start));
      byHabit.set(o.event.habitId, set);
    }
  }
  return new Map([...byHabit].map(([id, set]) => [id, [...set].sort()]));
}

/** Lo mismo para varios hábitos de una pasada (una sola lectura del calendario). Solo trae los que tienen hora. */
export function habitTimesMap(habits: Habit[], events: AgendaEvent[], ctx: Ctx, date: ISODate = today()): Map<string, string[]> {
  const calendar = calendarTimesMap(habits, events, ctx, date);
  const out = new Map<string, string[]>();
  for (const h of habits) {
    const fromCalendar = calendar.get(h.id);
    if (fromCalendar?.length) out.set(h.id, fromCalendar);
    else if (isClockTime(h.reminder)) out.set(h.id, [h.reminder]);
  }
  return out;
}

/** «07:30» o «07:30 · 19:00». */
export const timesText = (times: string[]): string => times.join(' · ');

/** Minuto del día de la primera hora, o null si no tiene: sirve para ordenar los hábitos por hora. */
export const firstMinute = (times: string[] | undefined): number | null => (times && times.length ? clockToMinutes(times[0]) : null);
