/**
 * Estadísticas de un curso a partir de sus sesiones de estudio y del día en que se completó cada tema.
 * Funciones puras. El ritmo real solo existe si algún tema guardó su `doneAt`; los temas hechos antes de que
 * se guardara no cuentan (no sabemos cuándo fueron).
 */
import type { Course, ISODate, StudySession } from './domain';
import { addDays, diffDays, today, weekStart } from './dates';
import { courseProgress } from './game';

/** Días hacia atrás que cuentan para medir el ritmo real (4 semanas: suaviza una semana floja o una buena). */
export const PACE_WINDOW_DAYS = 28;
/** Semanas que dibuja el gráfico de horas. */
export const STATS_WEEKS = 8;

/** Temas por semana que llevas de verdad, o null si ningún tema guardó su fecha todavía. */
export function topicPace(course: Course, now: ISODate = today()): number | null {
  const dated = course.modules.flatMap((m) => m.topics).filter((t) => t.status === 'done' && t.doneAt);
  if (dated.length === 0) return null;
  const from = addDays(now, -(PACE_WINDOW_DAYS - 1));
  const n = dated.filter((t) => (t.doneAt as ISODate) >= from && (t.doneAt as ISODate) <= now).length;
  return Math.round((n / (PACE_WINDOW_DAYS / 7)) * 10) / 10;
}

export interface WeekBar {
  /** Lunes de la semana. */
  from: ISODate;
  minutes: number;
  days: number;
}

export interface CourseStats {
  /** Las últimas semanas, de la más antigua a la actual. */
  weeks: WeekBar[];
  /** Días distintos con estudio en los últimos 30 días. */
  days30: number;
  minutes30: number;
  /** Temas por semana (ver `topicPace`). */
  pace: number | null;
  topicsLeft: number;
  /** Cuándo terminarías si sigues a ese ritmo, o null si no hay ritmo o ya terminaste. */
  projected: ISODate | null;
  /** Horas de la semana actual frente a la anterior: >0 mejora, <0 baja, 0 igual. */
  trend: number;
}

export function courseStats(course: Course, sessions: StudySession[], now: ISODate = today()): CourseStats {
  const mine = sessions.filter((s) => s.courseId === course.id && s.date <= now);
  const thisWeek = weekStart(now);
  const weeks: WeekBar[] = Array.from({ length: STATS_WEEKS }, (_, i) => {
    const from = addDays(thisWeek, (i - (STATS_WEEKS - 1)) * 7);
    const to = addDays(from, 6);
    const inside = mine.filter((s) => s.date >= from && s.date <= to);
    return { from, minutes: inside.reduce((a, s) => a + s.minutes, 0), days: new Set(inside.map((s) => s.date)).size };
  });
  const since = addDays(now, -29);
  const last30 = mine.filter((s) => s.date >= since);
  const pace = topicPace(course, now);
  const p = courseProgress(course);
  const topicsLeft = p.total - p.done;
  const projected = pace && pace > 0 && topicsLeft > 0 ? addDays(now, Math.ceil((topicsLeft / pace) * 7)) : null;
  const [prev, cur] = [weeks[STATS_WEEKS - 2].minutes, weeks[STATS_WEEKS - 1].minutes];
  return {
    weeks,
    days30: new Set(last30.map((s) => s.date)).size,
    minutes30: last30.reduce((a, s) => a + s.minutes, 0),
    pace,
    topicsLeft,
    projected,
    trend: Math.sign(cur - prev),
  };
}

/** Días hasta una fecha proyectada, para decir «dentro de 5 semanas». */
export const weeksUntil = (date: ISODate, now: ISODate = today()): number => Math.max(0, Math.round(diffDays(date, now) / 7));
