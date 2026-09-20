import type { Course, Habit, HabitLog, ISODate, Module, Priority, Profile, XpEvent } from './domain';
import { addDays, diffDays, fromISODate, monthKey, today, weekStart, weekdayIndex } from './dates';

/* ---------- Niveles ---------- */

/** XP acumulado necesario para *empezar* el nivel L. Cada nivel cuesta 250·L (nivel 12 → 3 000). */
export const xpAtLevelStart = (level: number): number => 125 * level * (level - 1);

export function levelFromXp(xp: number): number {
  const safe = Math.max(0, xp);
  return Math.max(1, Math.floor((1 + Math.sqrt(1 + (4 * safe) / 125)) / 2));
}

export interface LevelProgress {
  level: number;
  into: number;
  needed: number;
  left: number;
  pct: number;
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelFromXp(xp);
  const into = Math.max(0, xp) - xpAtLevelStart(level);
  const needed = 250 * level;
  return { level, into, needed, left: Math.max(0, needed - into), pct: Math.min(100, Math.round((into / needed) * 100)) };
}

const RANKS = [
  'Goomba despistado',
  'Koopa novato',
  'Toad aprendiz',
  'Pac-Man devorador',
  'Yoshi curioso',
  'Luigi estudioso',
  'Mario Bros',
  'Fire Mario',
  'Sonic veloz',
  'Link aventurero',
  'Samus cazadora',
  'Super Mario',
  'Mario Estrella',
  'Héroe del Tiempo',
  'Jefe del Reino Champiñón',
];
export const rankFor = (level: number): string => RANKS[level - 1] ?? 'Leyenda 8-bit';
/** Nivel 12 → "3-4": cada mundo tiene cuatro fases. */
export const worldFor = (level: number): string => `${Math.ceil(level / 4)}-${((level - 1) % 4) + 1}`;

export const XP_BY_PRIORITY: Record<Priority, number> = { low: 20, mid: 35, high: 50, boss: 120 };
export const coinsForXp = (amount: number): number => Math.trunc(amount / 4);
export const LEVEL_UP_BONUS = 500;
export const SESSION_XP_PER_MIN = 2;
export const WEEKLY_BONUS_XP = 200;

/* ---------- Racha ---------- */

export function activeDays(events: XpEvent[], frozenDates: ISODate[]): Set<ISODate> {
  const net = new Map<ISODate, number>();
  for (const e of events) net.set(e.date, (net.get(e.date) ?? 0) + e.amount);
  const days = new Set<ISODate>(frozenDates);
  for (const [d, v] of net) if (v > 0) days.add(d);
  return days;
}

export function computeStreak(events: XpEvent[], frozenDates: ISODate[], now: ISODate = today()) {
  const days = activeDays(events, frozenDates);
  let current = 0;
  let cursor = days.has(now) ? now : addDays(now, -1);
  while (days.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  for (let i = 0; i < sorted.length; i++) {
    run = i > 0 && diffDays(sorted[i], sorted[i - 1]) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return { current, best: Math.max(best, current), activeToday: days.has(now), days };
}

/* ---------- Hábitos ---------- */

export const logFor = (logs: HabitLog[], habitId: string, date: ISODate): HabitLog | undefined =>
  logs.find((l) => l.habitId === habitId && l.date === date);

export const isHabitDone = (habit: Habit, log?: HabitLog): boolean => !!log && log.value >= habit.target;

export function isDueOn(habit: Habit, date: ISODate, logs: HabitLog[]): boolean {
  const f = habit.frequency;
  switch (f.type) {
    case 'daily':
      return true;
    case 'days':
      return f.days.includes(weekdayIndex(date));
    case 'every': {
      const diff = diffDays(date, habit.startDate);
      return diff >= 0 && diff % Math.max(1, f.every) === 0;
    }
    case 'weekly': {
      const from = weekStart(date);
      return !logs.some((l) => l.habitId === habit.id && l.date >= from && l.date < date && l.value >= habit.target);
    }
    case 'monthly': {
      const key = monthKey(date);
      return !logs.some((l) => l.habitId === habit.id && monthKey(l.date) === key && l.date < date && l.value >= habit.target);
    }
  }
}

export type DayState = 'done' | 'today' | 'idle';
/** Semana en curso (lunes a domingo) para la tira de días de cada hábito. */
export function weekStrip(habit: Habit, logs: HabitLog[], now: ISODate = today()) {
  const start = weekStart(now);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    const done = isHabitDone(habit, logFor(logs, habit.id, date));
    const state: DayState = done ? 'done' : date === now && isDueOn(habit, date, logs) ? 'today' : 'idle';
    return { date, state };
  });
}

/** % de cumplimiento de los últimos 30 días. */
export function monthlyCompliance(habit: Habit, logs: HabitLog[], now: ISODate = today()): number {
  const from = addDays(now, -29);
  const done = logs.filter((l) => l.habitId === habit.id && l.date >= from && l.date <= now && l.value >= habit.target).length;
  let expected = 30;
  const f = habit.frequency;
  if (f.type === 'days') expected = Array.from({ length: 30 }, (_, i) => weekdayIndex(addDays(from, i))).filter((d) => f.days.includes(d)).length;
  if (f.type === 'every') expected = Math.floor(30 / Math.max(1, f.every));
  if (f.type === 'weekly') expected = 4;
  if (f.type === 'monthly') expected = 1;
  return Math.min(100, Math.round((done / Math.max(1, expected)) * 100));
}

export function frequencyLabel(f: Habit['frequency']): string {
  switch (f.type) {
    case 'daily':
      return 'Diario';
    case 'days':
      return f.days.length ? f.days.map((d) => ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][d]).join(' · ') : 'Sin días';
    case 'every':
      return `Cada ${f.every} días`;
    case 'weekly':
      return 'Semanal';
    case 'monthly':
      return 'Mensual';
  }
}

export const MEASURE_LABEL: Record<Habit['measure'], { unit: string; plural: string }> = {
  times: { unit: 'vez', plural: 'veces' },
  minutes: { unit: 'min', plural: 'min' },
  hours: { unit: 'h', plural: 'h' },
  pages: { unit: 'pág.', plural: 'pág.' },
  exercises: { unit: 'ejercicio', plural: 'ejercicios' },
  tasks: { unit: 'tarea', plural: 'tareas' },
  percent: { unit: '%', plural: '%' },
  boolean: { unit: '', plural: '' },
};

export function goalLabel(habit: Habit): string {
  if (habit.measure === 'boolean') return 'hecho / no hecho';
  const m = MEASURE_LABEL[habit.measure];
  return `${habit.target} ${habit.target === 1 ? m.unit : m.plural}`;
}

/* ---------- Cursos ---------- */

export type ModuleState = 'done' | 'active' | 'locked';

export function moduleStates(course: Course): ModuleState[] {
  let activeAssigned = false;
  return course.modules.map((m) => {
    const finished = m.topics.length > 0 && m.topics.every((t) => t.status === 'done');
    if (finished) return 'done';
    if (!activeAssigned) {
      activeAssigned = true;
      return 'active';
    }
    return 'locked';
  });
}

export const topicXp = (m: Module): number => Math.max(5, Math.round(m.xp / Math.max(1, m.topics.length)));

export function courseProgress(course: Course) {
  const topics = course.modules.flatMap((m) => m.topics);
  const done = topics.filter((t) => t.status === 'done').length;
  const xp = course.modules.reduce((a, m) => a + m.topics.filter((t) => t.status === 'done').length * topicXp(m), 0);
  return { total: topics.length, done, pct: topics.length ? Math.round((done / topics.length) * 100) : 0, xp };
}

export function courseRank(pct: number): string {
  if (pct >= 90) return 'S';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 55) return 'B';
  if (pct >= 35) return 'C';
  return 'D';
}

export const isCourseComplete = (c: Course): boolean => {
  const p = courseProgress(c);
  return p.total > 0 && p.done === p.total;
};

/* ---------- Semana ---------- */

export const hoursInWeek = (sessions: { date: ISODate; minutes: number }[], from: ISODate): number =>
  sessions.filter((s) => s.date >= from && s.date < addDays(from, 7)).reduce((a, s) => a + s.minutes, 0) / 60;

export const currentWeekStart = (now: ISODate = today()): ISODate => weekStart(now);

export const initials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '??';

export const isBefore = (a: ISODate, b: ISODate) => fromISODate(a).getTime() < fromISODate(b).getTime();

export const defaultProfile = (id: string, name = 'Jugador 1'): Profile => ({
  id,
  displayName: name,
  xp: 0,
  credits: 0,
  streakFreezes: 0,
  frozenDates: [],
  weeklyGoalHours: 15,
  weeklyBonusClaimed: null,
  inventory: [],
  equipped: { avatar: null, frame: null, world: null },
  achievements: [],
  onboarded: false,
  joinedAt: new Date().toISOString(),
});

/** Racha actual y mejor racha de un hábito, contando solo los días en que tocaba. */
export function habitStreaks(habit: Habit, logs: HabitLog[], now: ISODate = today()) {
  const doneOn = new Set(logs.filter((l) => l.habitId === habit.id && l.value >= habit.target).map((l) => l.date));
  let current = 0;
  for (let i = 0, d = now; i < 400; i++, d = addDays(now, -i)) {
    if (doneOn.has(d)) current++;
    else if (i === 0 || !isDueOn(habit, d, logs)) continue;
    else break;
  }
  let best = 0;
  let run = 0;
  for (let i = 400; i >= 0; i--) {
    const d = addDays(now, -i);
    if (doneOn.has(d)) best = Math.max(best, ++run);
    else if (isDueOn(habit, d, logs) && i !== 0) run = 0;
  }
  return { current, best: Math.max(best, current), completions: doneOn.size };
}

/** Días de la semana (0 = lunes) con más fallos en las últimas 12 semanas. */
export function weakestWeekday(habit: Habit, logs: HabitLog[], now: ISODate = today()) {
  const stats = Array.from({ length: 7 }, () => ({ due: 0, done: 0 }));
  for (let i = 1; i <= 84; i++) {
    const d = addDays(now, -i);
    if (d < habit.startDate || !isDueOn(habit, d, logs)) continue;
    const w = weekdayIndex(d);
    stats[w].due++;
    if (logFor(logs, habit.id, d) && (logFor(logs, habit.id, d)?.value ?? 0) >= habit.target) stats[w].done++;
  }
  const worst = stats
    .map((s, day) => ({ day, due: s.due, missRate: s.due ? 1 - s.done / s.due : 0 }))
    .filter((s) => s.due >= 3)
    .sort((a, b) => b.missRate - a.missRate)[0];
  return worst && worst.missRate >= 0.4 ? { day: worst.day, missPct: Math.round(worst.missRate * 100) } : null;
}
