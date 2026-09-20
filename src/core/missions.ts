import type { Habit, ISODate, Snapshot, Task } from './domain';
import { diffDays, today } from './dates';
import { computeStreak, frequencyLabel, goalLabel, isDueOn, isHabitDone, logFor } from './game';
import { lastActivityByCourse, weeklyReport } from './stats';

export type Mission =
  | { kind: 'task'; id: string; title: string; subtitle: string; xp: number; done: boolean; task: Task }
  | { kind: 'habit'; id: string; title: string; subtitle: string; xp: number; done: boolean; habit: Habit };

const MAX_MISSIONS = 6;

/** Misión del día: hábitos que tocan hoy + las tareas más urgentes. */
export function dailyMissions(s: Snapshot, now: ISODate = today()): Mission[] {
  const courseName = (id: string | null) => s.courses.find((c) => c.id === id)?.title;

  const habits: Mission[] = s.habits
    .filter((h) => isDueOn(h, now, s.habitLogs) || isHabitDone(h, logFor(s.habitLogs, h.id, now)))
    .map((h) => ({
      kind: 'habit' as const,
      id: `h:${h.id}`,
      title: h.title,
      subtitle: `Hábito · ${frequencyLabel(h.frequency)} · ${goalLabel(h)}`,
      xp: h.xp,
      done: isHabitDone(h, logFor(s.habitLogs, h.id, now)),
      habit: h,
    }));

  const tasks: Mission[] = s.tasks
    .filter((t) => t.status !== 'done' || t.completedAt === now)
    .map((t) => ({
      kind: 'task' as const,
      id: `t:${t.id}`,
      title: t.title,
      subtitle: `${courseName(t.courseId) ?? 'Side quest'}${t.estimateMin ? ` · ${t.estimateMin} min` : ''}`,
      xp: t.xp,
      done: t.status === 'done',
      task: t,
    }));

  const urgency = (m: Mission) => (m.kind === 'task' && m.task.dueDate ? diffDays(m.task.dueDate, now) : 30);
  const pending = [...habits, ...tasks].filter((m) => !m.done).sort((a, b) => urgency(a) - urgency(b) || b.xp - a.xp);
  const done = [...habits, ...tasks].filter((m) => m.done);
  return [...done, ...pending.slice(0, Math.max(0, MAX_MISSIONS - done.length))].slice(0, MAX_MISSIONS).sort((a, b) => Number(a.done) - Number(b.done) || b.xp - a.xp);
}

export interface Tip {
  title: string;
  body: string;
}

/** Consejos "de la taberna" calculados con reglas simples sobre tus datos. */
export function tips(s: Snapshot, now: ISODate = today()): Tip[] {
  const out: Tip[] = [];
  const report = weeklyReport(s, now);
  const left = s.profile.weeklyGoalHours - report.hours;
  if (left > 0.05 && s.profile.weeklyGoalHours > 0) {
    const sessions = Math.max(1, Math.round(left / 1.5));
    out.push({ title: `Te faltan ${left.toFixed(1)} h para el reto semanal.`, body: `${sessions} ${sessions === 1 ? 'sesión' : 'sesiones'} de estudio y cae sola.` });
  } else if (s.profile.weeklyGoalHours > 0) {
    out.push({ title: '¡Reto semanal completado!', body: 'Reclama tu bono en la barra lateral antes de que acabe la semana.' });
  }

  const last = lastActivityByCourse(s);
  const stale = s.courses
    .map((c) => ({ c, days: last.has(c.id) ? diffDays(now, last.get(c.id)!) : null }))
    .filter((x) => x.days !== null && x.days >= 3)
    .sort((a, b) => b.days! - a.days!)[0];
  if (stale) out.push({ title: `Llevas ${stale.days} días sin tocar ${stale.c.title}.`, body: '15 minutos bastan para mantener ese mundo con vida.' });

  const review = s.courses.flatMap((c) => c.modules.flatMap((m) => m.topics.filter((t) => t.review).map((t) => ({ t, c }))));
  if (review.length) out.push({ title: `Repasa "${review[0].t.title}" antes de seguir.`, body: `${review.length} ${review.length === 1 ? 'tema espera' : 'temas esperan'} su jefe de repaso.` });

  const overdue = s.tasks.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate < now);
  if (overdue.length) out.push({ title: `${overdue.length} ${overdue.length === 1 ? 'tarea vencida' : 'tareas vencidas'}.`, body: `Empieza por "${overdue[0].title}": es la que más pesa.` });

  const streak = computeStreak(s.xpEvents, s.profile.frozenDates, now);
  if (streak.current > 0 && !streak.activeToday) out.push({ title: `Tu racha de ${streak.current} días peligra hoy.`, body: 'Cualquier misión la salva. También puedes congelarla desde el inicio.' });

  if (!out.length) out.push({ title: 'Todo en orden, jugador.', body: 'Crea una tarea nueva o inicia una sesión de estudio.' });
  return out.slice(0, 4);
}

export interface ReviewItem {
  courseId: string;
  topicId: string;
  title: string;
  course: string;
  daysAgo: number;
}

export function reviewQueue(s: Snapshot, now: ISODate = today()): ReviewItem[] {
  return s.courses
    .flatMap((c) =>
      c.modules.flatMap((m) =>
        m.topics.filter((t) => t.review).map((t) => ({ courseId: c.id, topicId: t.id, title: t.title, course: c.title, daysAgo: t.markedAt ? diffDays(now, t.markedAt) : 0 })),
      ),
    )
    .sort((a, b) => b.daysAgo - a.daysAgo);
}
