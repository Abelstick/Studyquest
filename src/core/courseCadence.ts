/**
 * Ritmo de estudio de un curso: cuántos días de esta semana ya lo estudiaste, cuántos querías y si hoy toca.
 * La meta es opcional (`studyDaysPerWeek`); sin ella solo se informa lo hecho. Funciones puras.
 */
import type { Course, ISODate, StudySession } from './domain';
import { diffDays, today, weekStart } from './dates';

export interface CourseWeek {
  /** Meta de días por semana, o 0 si no hay. */
  target: number;
  /** Días distintos de esta semana con estudio (varias sesiones el mismo día cuentan una vez). */
  days: number;
  minutes: number;
  minutesToday: number;
  studiedToday: boolean;
  /** Último día que se estudió, o null si nunca. */
  last: ISODate | null;
  /** Días desde la última vez, o null si nunca. */
  daysSince: number | null;
  /** Días que deberían llevarse ya por el ritmo de la meta (reparte la meta a lo largo de la semana). */
  expected: number;
  /** Con meta, aún no estudiado hoy y por debajo del ritmo: hoy toca. */
  dueToday: boolean;
  /** Días que faltan para cumplir la meta (0 sin meta o si ya se cumplió). */
  remaining: number;
}

export function courseWeek(course: Course, sessions: StudySession[], now: ISODate = today()): CourseWeek {
  const from = weekStart(now);
  const mine = sessions.filter((s) => s.courseId === course.id);
  const inWeek = mine.filter((s) => s.date >= from && s.date <= now);
  const days = new Set(inWeek.map((s) => s.date)).size;
  const minutesToday = mine.filter((s) => s.date === now).reduce((a, s) => a + s.minutes, 0);
  const last = mine.reduce<ISODate | null>((m, s) => (s.date <= now && (!m || s.date > m) ? s.date : m), null);
  const target = Math.min(7, Math.max(0, course.studyDaysPerWeek ?? 0));
  const studiedToday = minutesToday > 0;
  const elapsed = diffDays(now, from) + 1;
  const expected = target ? Math.ceil((target * elapsed) / 7) : 0;
  return {
    target,
    days,
    minutes: inWeek.reduce((a, s) => a + s.minutes, 0),
    minutesToday,
    studiedToday,
    last,
    daysSince: last ? diffDays(now, last) : null,
    expected,
    dueToday: target > 0 && !studiedToday && days < expected,
    remaining: Math.max(0, target - days),
  };
}
