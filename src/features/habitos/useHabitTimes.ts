import { useMemo } from 'react';
import { useData } from '@/state';
import { today } from '@/core/dates';
import { calendarTimesMap, habitTimesMap } from '@/core/habitTime';

/**
 * Las horas de hoy de todos los hábitos (de sus bloques del calendario o, si no tienen, su hora propia), calculadas
 * una sola vez para toda la pantalla. Un hábito sin hora no aparece en el mapa.
 */
export function useHabitTimes(date = today()): Map<string, string[]> {
  const habits = useData((s) => s.habits);
  const events = useData((s) => s.events);
  const tasks = useData((s) => s.tasks);
  const logs = useData((s) => s.habitLogs);
  return useMemo(() => habitTimesMap(habits, events, { habits, tasks, logs }, date), [habits, events, tasks, logs, date]);
}

/** Solo las horas de los bloques reservados en el calendario, por hábito. */
export function useHabitCalendarTimes(date = today()): Map<string, string[]> {
  const habits = useData((s) => s.habits);
  const events = useData((s) => s.events);
  const tasks = useData((s) => s.tasks);
  const logs = useData((s) => s.habitLogs);
  return useMemo(() => calendarTimesMap(habits, events, { habits, tasks, logs }, date), [habits, events, tasks, logs, date]);
}
