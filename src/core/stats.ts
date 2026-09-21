import type { Course, ISODate, Snapshot } from './domain';
import { addDays, today, weekStart } from './dates';
import { POMODORO_LABEL, computeStreak, hoursInWeek, isCourseComplete, levelFromXp } from './game';

export interface Stats {
  xp: number;
  level: number;
  tasksDone: number;
  habitCompletions: number;
  streak: number;
  bestStreak: number;
  coursesCompleted: number;
  projectsCompleted: number;
  milestonesDone: number;
  purchases: number;
  hoursTotal: number;
  reviews: number;
  mastered: number;
  bosses: number;
  pomodoros: number;
  combos: number;
  weekendBonuses: number;
  recurringDone: number;
  worlds: number;
  avatars: number;
  chests: number;
  topicsDone: number;
  modulesDone: number;
  checkpointsDone: number;
  weeklyChallenges: number;
  achievementsCount: number;
}

export function computeStats(s: Snapshot, now: ISODate = today()): Stats {
  const habitTarget = new Map(s.habits.map((h) => [h.id, h.target]));
  const streak = computeStreak(s.xpEvents, s.profile.frozenDates, now);
  return {
    xp: s.profile.xp,
    level: levelFromXp(s.profile.xp),
    tasksDone: s.tasks.filter((t) => t.status === 'done').length,
    habitCompletions: s.habitLogs.filter((l) => l.value >= (habitTarget.get(l.habitId) ?? Infinity)).length,
    streak: streak.current,
    bestStreak: streak.best,
    coursesCompleted: s.courses.filter(isCourseComplete).length,
    projectsCompleted: s.projects.filter((p) => p.checkpoints.length > 0 && p.checkpoints.every((c) => c.done)).length,
    milestonesDone: s.goals.reduce((a, g) => a + g.milestones.filter((m) => m.done).length, 0),
    purchases: s.profile.inventory.length,
    hoursTotal: s.sessions.reduce((a, x) => a + x.minutes, 0) / 60,
    reviews: s.xpEvents.filter((e) => e.source === 'review' && e.amount > 0).length,
    mastered: s.xpEvents.filter((e) => e.source === 'review' && e.amount > 0 && e.label.startsWith('Dominado')).length,
    bosses: s.tasks.filter((t) => t.priority === 'boss' && t.status === 'done').length,
    pomodoros: s.sessions.filter((x) => x.label === POMODORO_LABEL).length,
    combos: s.xpEvents.filter((e) => e.source === 'combo' && e.amount > 0 && e.label.startsWith('Combo')).length,
    weekendBonuses: s.xpEvents.filter((e) => e.source === 'combo' && e.amount > 0 && e.label.startsWith('Bonus de fin')).length,
    recurringDone: s.tasks.filter((t) => t.status === 'done' && t.recurrence).length,
    worlds: s.profile.inventory.filter((i) => i.startsWith('world-')).length,
    avatars: s.profile.inventory.filter((i) => i.startsWith('avatar-')).length,
    chests: s.profile.chests ?? 0,
    topicsDone: s.courses.reduce((a, c) => a + c.modules.reduce((b, m) => b + m.topics.filter((t) => t.status === 'done').length, 0), 0),
    modulesDone: s.courses.reduce((a, c) => a + c.modules.filter((m) => m.topics.length > 0 && m.topics.every((t) => t.status === 'done')).length, 0),
    checkpointsDone: s.projects.reduce((a, p) => a + p.checkpoints.filter((c) => c.done).length, 0),
    weeklyChallenges: s.xpEvents.filter((e) => e.source === 'bonus' && e.amount > 0 && e.label === 'Reto semanal completado').length,
    achievementsCount: s.profile.achievements.length,
  };
}

/** Horas por semana, de la más antigua a la actual. */
export function weeklyHours(s: Snapshot, weeks: number, now: ISODate = today()) {
  const start = weekStart(now);
  return Array.from({ length: weeks }, (_, i) => {
    const from = addDays(start, -7 * (weeks - 1 - i));
    return { from, hours: hoursInWeek(s.sessions, from) };
  });
}

/** Distribución del tiempo de estudio por curso. */
export function timeDistribution(s: Snapshot, since: ISODate | null) {
  const byCourse = new Map<string, number>();
  for (const x of s.sessions) {
    if (since && x.date < since) continue;
    const key = x.courseId ?? 'other';
    byCourse.set(key, (byCourse.get(key) ?? 0) + x.minutes);
  }
  const total = [...byCourse.values()].reduce((a, b) => a + b, 0) || 1;
  const title = (id: string) => (id === 'other' ? 'Libre' : (s.courses.find((c) => c.id === id)?.title ?? 'Curso borrado'));
  return [...byCourse.entries()]
    .map(([id, min]) => ({ id, label: title(id), minutes: min, pct: Math.round((min / total) * 100), hours: min / 60 }))
    .sort((a, b) => b.minutes - a.minutes);
}

export function xpByDay(s: Snapshot): Map<ISODate, number> {
  const m = new Map<ISODate, number>();
  for (const e of s.xpEvents) m.set(e.date, (m.get(e.date) ?? 0) + e.amount);
  return m;
}

export function weeklyReport(s: Snapshot, now: ISODate = today()) {
  const from = weekStart(now);
  const to = addDays(from, 7);
  const inWeek = (d: ISODate) => d >= from && d < to;
  const tasks = s.tasks.filter((t) => t.completedAt && inWeek(t.completedAt)).length;
  const xp = s.xpEvents.filter((e) => inWeek(e.date) && e.amount > 0).reduce((a, e) => a + e.amount, 0);
  const days = new Set(s.xpEvents.filter((e) => inWeek(e.date) && e.amount > 0).map((e) => e.date)).size;
  const habitTarget = new Map(s.habits.map((h) => [h.id, h.target]));
  const habitsDone = s.habitLogs.filter((l) => inWeek(l.date) && l.value >= (habitTarget.get(l.habitId) ?? Infinity)).length;
  return { from, hours: hoursInWeek(s.sessions, from), tasks, xp, days, habitsDone };
}

export const lastActivityByCourse = (s: Snapshot): Map<string, ISODate> => {
  const m = new Map<string, ISODate>();
  for (const x of s.sessions) if (x.courseId && (!m.has(x.courseId) || x.date > m.get(x.courseId)!)) m.set(x.courseId, x.date);
  return m;
};

export const courseHours = (s: Snapshot, c: Course): number =>
  s.sessions.filter((x) => x.courseId === c.id).reduce((a, x) => a + x.minutes, 0) / 60;

export const courseStreak = (s: Snapshot, c: Course, now: ISODate = today()): number => {
  const days = new Set(s.sessions.filter((x) => x.courseId === c.id).map((x) => x.date));
  let n = 0;
  let cur = days.has(now) ? now : addDays(now, -1);
  while (days.has(cur)) {
    n++;
    cur = addDays(cur, -1);
  }
  return n;
};
