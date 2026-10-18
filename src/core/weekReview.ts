/**
 * Revisión semanal: lo planificado frente a lo hecho, hábitos, metas, bloques del calendario, equilibrio por área,
 * lo pendiente por reprogramar y la carga de la semana siguiente. Todo se calcula con los datos que ya existen
 * (tareas, hábitos, metas, agenda, sesiones): lo único que se guarda son las reflexiones del usuario y las
 * prioridades que elige (`profile.reviews`). Una tarea sin hacer no es un fracaso: aquí se mueve, se recorta o se quita.
 *
 * Lógica pura, sin React ni base de datos.
 */
import type { AgendaCategory, Goal, Habit, HabitLog, ID, ISODate, Profile, Snapshot, Task, WeekReview } from './domain';
import { addDays, isoNow, today, weekStart, weekdayIndex } from './dates';
import { hoursInWeek, isDueOn, logFor, weekSummary } from './game';
import { isMinimumMet } from './minimum';
import { isQuotaHabit } from './periods';
import { areaBalance, type AreaRow } from './areas';
import { occurrencesBetween, type Occurrence } from './agenda';
import { goalPace, isGoalComplete, type GoalPace } from './goals';

/* ---------- Lo que se guarda ---------- */

export const MAX_REVIEWS = 26;
export const MAX_PRIORITIES = 3;
const MAX_OBSTACLES = 8;

const squash = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

export const emptyReview = (week: ISODate): WeekReview => ({ week, obstacles: [], wins: '', adjustment: '', priorities: [], savedAt: isoNow() });

export const reviewOf = (p: Pick<Profile, 'reviews'>, week: ISODate): WeekReview | undefined => p.reviews?.find((r) => r.week === week);

/** Guarda la revisión de una semana (sustituye la anterior de la misma semana) y conserva solo las últimas. */
export function upsertReview(list: WeekReview[] | undefined, review: WeekReview): WeekReview[] {
  const rest = (list ?? []).filter((r) => r.week !== review.week);
  return [...rest, review].sort((a, b) => a.week.localeCompare(b.week)).slice(-MAX_REVIEWS);
}

/**
 * Revisión válida a partir de un objeto cualquiera (formulario o copia de seguridad), o null. `resolve` convierte
 * un id guardado en uno vigente (o null si ya no existe), igual que se hace con el resto de las copias.
 */
export function cleanReview(raw: unknown, resolve: (id: unknown) => string | null = (v) => (typeof v === 'string' && v ? v : null)): WeekReview | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.week !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.week)) return null;
  const obstacles = (Array.isArray(o.obstacles) ? o.obstacles : []).map((x) => squash(x, 200)).filter(Boolean).slice(0, MAX_OBSTACLES);
  const priorities = [...new Set((Array.isArray(o.priorities) ? o.priorities : []).map(resolve).filter((x): x is string => !!x))].slice(0, MAX_PRIORITIES);
  return {
    week: weekStart(o.week),
    obstacles,
    wins: squash(o.wins, 600),
    adjustment: squash(o.adjustment, 300),
    priorities,
    savedAt: typeof o.savedAt === 'string' && o.savedAt ? o.savedAt : isoNow(),
  };
}

/**
 * Qué semana toca revisar hoy. El domingo, la que termina; de lunes a miércoles, la que acaba de terminar
 * (por si el domingo no hubo tiempo). El resto de la semana no se insiste: se puede abrir cuando se quiera.
 */
export function reviewWeekFor(now: ISODate = today()): ISODate | null {
  const w = weekdayIndex(now);
  if (w === 6) return weekStart(now);
  if (w <= 2) return addDays(weekStart(now), -7);
  return null;
}

/** Tareas que se eligieron como prioridades de la semana que contiene `now` (en la revisión de la semana anterior). */
export const weeklyPriorityIds = (p: Pick<Profile, 'reviews'>, now: ISODate = today()): ID[] => reviewOf(p, addDays(weekStart(now), -7))?.priorities ?? [];

/* ---------- Lo que se calcula ---------- */

export interface HabitReviewRow {
  habit: Habit;
  /** Días que tocaba hasta hoy (en los de cuota, las veces que había que cumplirlo). */
  due: number;
  /** Con el objetivo completo. */
  done: number;
  /** Solo con la versión mínima. */
  minimum: number;
  /** A medias, sin llegar al mínimo. */
  partial: number;
  /** Tocaba, el día ya pasó y no hay nada registrado. Lo que no tocaba nunca cuenta como omisión. */
  missed: number;
  /** Cumplimiento proporcional (un día a medias cuenta en proporción). */
  pct: number;
  /** El de la semana anterior, para ver la tendencia; null si el hábito aún no existía. */
  prevPct: number | null;
}

type Counts = Omit<HabitReviewRow, 'habit' | 'prevPct'>;

/** Hábitos de días fijos: se cuenta día a día lo que tocaba. */
function fixedCounts(h: Habit, logs: HabitLog[], from: ISODate, now: ISODate): Counts {
  const c: Counts = { due: 0, done: 0, minimum: 0, partial: 0, missed: 0, pct: 0 };
  for (let d = from; d <= addDays(from, 6) && d <= now; d = addDays(d, 1)) {
    if (d < h.startDate || !isDueOn(h, d, logs)) continue;
    c.due++;
    const log = logFor(logs, h.id, d);
    const v = log?.value ?? 0;
    if (v >= h.target) c.done++;
    else if (isMinimumMet(h, log)) c.minimum++;
    else if (v > 0 || (log?.stepsDone.length ?? 0) > 0) c.partial++;
    else if (d < now) c.missed++;
  }
  c.pct = weekSummary(h, logs, from, now).pct;
  return c;
}

/** Hábitos de «N veces por semana»: se cuentan las veces cumplidas frente a la cuota. */
function quotaCounts(h: Habit, logs: HabitLog[], from: ISODate, now: ISODate): Counts | null {
  const f = h.frequency;
  let goal = 0;
  if (f.type === 'weekly') goal = 1;
  else if (f.type === 'custom' && f.per === 'week') goal = Math.max(1, f.times);
  if (!goal || addDays(from, 6) < h.startDate) return null;
  const week = logs.filter((l) => l.habitId === h.id && l.date >= from && l.date <= addDays(from, 6));
  const done = week.filter((l) => l.value >= h.target).length;
  const minimum = week.filter((l) => isMinimumMet(h, l)).length;
  const finished = addDays(from, 6) < now;
  const missed = finished ? Math.max(0, goal - done - minimum) : 0;
  return { due: goal, done, minimum, partial: 0, missed, pct: Math.min(100, Math.round((done / goal) * 100)) };
}

function habitCounts(h: Habit, logs: HabitLog[], from: ISODate, now: ISODate): Counts | null {
  if (isQuotaHabit(h)) return quotaCounts(h, logs, from, now);
  return fixedCounts(h, logs, from, now);
}

function habitRow(h: Habit, logs: HabitLog[], from: ISODate, now: ISODate): HabitReviewRow | null {
  const cur = habitCounts(h, logs, from, now);
  if (!cur || cur.due === 0) return null;
  const prev = habitCounts(h, logs, addDays(from, -7), now);
  return { habit: h, ...cur, prevPct: prev && prev.due > 0 ? prev.pct : null };
}

export interface GoalReviewRow {
  goal: Goal;
  /** Hitos conquistados esta semana. */
  milestones: number;
  /** Tareas enlazadas terminadas esta semana. */
  tasksDone: number;
  /** Días de hábito enlazado cumplidos esta semana. */
  habitDays: number;
  moved: boolean;
  pace: GoalPace;
}

function goalRows(s: Snapshot, from: ISODate, to: ISODate, now: ISODate): GoalReviewRow[] {
  const inWeek = (d: ISODate) => d >= from && d <= to;
  // XP de hitos de la semana, neto por título: un hito conquistado y luego deshecho no cuenta.
  const net = new Map<string, number>();
  for (const e of s.xpEvents) if (e.source === 'milestone' && inWeek(e.date)) net.set(e.label.replace(/^Deshacer: /, ''), (net.get(e.label.replace(/^Deshacer: /, '')) ?? 0) + e.amount);
  return s.goals
    .map((goal): GoalReviewRow => {
      const milestones = goal.milestones.filter((m) => m.done && (net.get(m.title) ?? 0) > 0).length;
      const tasksDone = s.tasks.filter((t) => t.goalId === goal.id && t.status === 'done' && !!t.completedAt && inWeek(t.completedAt)).length;
      const linked = new Map(s.habits.filter((h) => h.goalId === goal.id).map((h) => [h.id, h]));
      const habitDays = s.habitLogs.filter((l) => inWeek(l.date) && l.value >= (linked.get(l.habitId)?.target ?? Infinity)).length;
      return { goal, milestones, tasksDone, habitDays, moved: milestones + tasksDone + habitDays > 0, pace: goalPace(goal, now) };
    })
    .filter((r) => r.moved || !isGoalComplete(r.goal));
}

export interface AgendaReview {
  planned: number;
  done: number;
  cancelled: number;
  /** Ya pasaron y nadie las marcó (puede que se hicieran sin apuntarlo). */
  unmarked: number;
  minutesByCategory: Partial<Record<AgendaCategory, number>>;
}

function agendaReview(occs: Occurrence[], now: ISODate): AgendaReview {
  const blocks = occs.filter((o) => o.start !== null && o.minutes > 0);
  const minutesByCategory: AgendaReview['minutesByCategory'] = {};
  for (const o of blocks) if (o.status !== 'cancelled') minutesByCategory[o.event.category] = (minutesByCategory[o.event.category] ?? 0) + o.minutes;
  return {
    planned: blocks.length,
    done: blocks.filter((o) => o.status === 'done').length,
    cancelled: blocks.filter((o) => o.status === 'cancelled').length,
    unmarked: blocks.filter((o) => o.status === 'pending' && o.date < now).length,
    minutesByCategory,
  };
}

export interface TaskReview {
  /** Tareas con fecha dentro de la semana. */
  planned: number;
  plannedDone: number;
  /** Terminadas en la semana aunque no estaban previstas para ella. */
  extraDone: number;
  /** Abiertas con fecha hasta el final de la semana: lo que queda por mover, recortar o quitar. */
  pending: Task[];
}

const PRIORITY_RANK: Record<Task['priority'], number> = { boss: 0, high: 1, mid: 2, low: 3 };

/** Tareas a considerar como prioridades de la semana que empieza en `nextFrom`: primero lo que ya venció, luego lo de esa semana y por último lo importante sin fecha. */
export function suggestPriorities(tasks: Task[], nextFrom: ISODate): Task[] {
  const nextTo = addDays(nextFrom, 6);
  const band = (t: Task) => {
    if (t.dueDate && t.dueDate < nextFrom) return 0;
    return t.dueDate && t.dueDate <= nextTo ? 1 : 2;
  };
  return tasks
    .filter((t) => t.status !== 'done' && ((t.dueDate && t.dueDate <= nextTo) || t.priority === 'high' || t.priority === 'boss'))
    .sort((a, b) => band(a) - band(b) || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.xp - a.xp)
    .slice(0, 12);
}

export interface NextWeek {
  from: ISODate;
  to: ISODate;
  blocks: number;
  minutesByCategory: Partial<Record<AgendaCategory, number>>;
  tasksDue: number;
  tasksMinutes: number;
  /** Observaciones amables sobre la carga, nunca una nota. */
  notes: string[];
  candidates: Task[];
}

/** Más de esto en trabajo, estudio y reuniones deja poco margen para el resto de la vida. */
const HEAVY_WEEK_MIN = 60 * 60;

function nextWeek(s: Snapshot, from: ISODate): NextWeek {
  const to = addDays(from, 6);
  const occs = occurrencesBetween(s.events, from, to, { habits: s.habits, tasks: s.tasks, logs: s.habitLogs });
  const agenda = agendaReview(occs, from);
  const due = s.tasks.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate >= from && t.dueDate <= to);
  const m = agenda.minutesByCategory;
  const notes: string[] = [];
  if (agenda.planned === 0) notes.push('Aún no hay bloques en el calendario para esa semana.');
  else {
    if (!(m.rest ?? 0) && !(m.personal ?? 0)) notes.push('No hay descanso ni tiempo libre programado: reserva un rato para ti.');
    if ((m.work ?? 0) + (m.study ?? 0) + (m.meeting ?? 0) > HEAVY_WEEK_MIN) notes.push('Llevas más de 60 h entre trabajo, estudio y reuniones: quizá convenga aligerar algo.');
  }
  return { from, to, blocks: agenda.planned, minutesByCategory: m, tasksDue: due.length, tasksMinutes: due.reduce((a, t) => a + t.estimateMin, 0), notes, candidates: suggestPriorities(s.tasks, from) };
}

export interface WeekReviewData {
  from: ISODate;
  to: ISODate;
  /** La semana aún no terminó. */
  inProgress: boolean;
  tasks: TaskReview;
  habits: HabitReviewRow[];
  goals: GoalReviewRow[];
  agenda: AgendaReview;
  studyHours: number;
  studyGoalHours: number;
  areas: { rows: AreaRow[]; unassigned: number };
  next: NextWeek;
}

/** Todo lo que enseña la revisión de la semana que empieza el lunes `week`. */
export function buildWeekReview(s: Snapshot, week: ISODate, now: ISODate = today()): WeekReviewData {
  const from = weekStart(week);
  const to = addDays(from, 6);
  const inWeek = (d: ISODate | null) => !!d && d >= from && d <= to;

  const dueInWeek = s.tasks.filter((t) => inWeek(t.dueDate));
  const tasks: TaskReview = {
    planned: dueInWeek.length,
    plannedDone: dueInWeek.filter((t) => t.status === 'done').length,
    extraDone: s.tasks.filter((t) => t.status === 'done' && inWeek(t.completedAt) && !inWeek(t.dueDate)).length,
    pending: s.tasks.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate <= to).sort((a, b) => (a.dueDate as string).localeCompare(b.dueDate as string)),
  };

  const occs = occurrencesBetween(s.events, from, to, { habits: s.habits, tasks: s.tasks, logs: s.habitLogs });
  return {
    from,
    to,
    inProgress: to >= now,
    tasks,
    habits: s.habits.flatMap((h) => habitRow(h, s.habitLogs, from, now) ?? []),
    goals: goalRows(s, from, to, now),
    agenda: agendaReview(occs, now),
    studyHours: hoursInWeek(s.sessions, from),
    studyGoalHours: s.profile.weeklyGoalHours,
    areas: areaBalance(s, from, to),
    next: nextWeek(s, addDays(from, 7)),
  };
}

/** Obstáculos de uso corriente, para anotarlos de un toque. El usuario puede escribir los suyos. */
export const COMMON_OBSTACLES = ['Cansancio', 'Imprevisto en el trabajo', 'Falta de tiempo', 'Se me olvidó', 'Falta de ganas', 'Salud o energía baja', 'Demasiado ambicioso'] as const;

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Obstáculos que se repiten en al menos dos de las últimas `weeks` revisiones guardadas (antes de `before`):
 * la señal de que no es mala suerte sino algo que conviene diseñar (un «si… entonces…», otro horario, menos carga).
 */
export function recurringObstacles(reviews: WeekReview[] | undefined, before: ISODate, weeks = 4): { text: string; count: number }[] {
  const recent = (reviews ?? []).filter((r) => r.week < before).sort((a, b) => b.week.localeCompare(a.week)).slice(0, weeks);
  const seen = new Map<string, { text: string; count: number }>();
  for (const r of recent) {
    for (const key of new Set(r.obstacles.map(norm))) {
      const text = r.obstacles.find((o) => norm(o) === key) ?? key;
      seen.set(key, { text, count: (seen.get(key)?.count ?? 0) + 1 });
    }
  }
  return [...seen.values()].filter((o) => o.count >= 2).sort((a, b) => b.count - a.count);
}

export interface Shift {
  id: ID;
  dueDate: ISODate;
}

/**
 * Reparte tareas pendientes entre el lunes y el viernes de la semana siguiente (en orden de la fecha que tenían),
 * para no apilarlas todas en un día imposible de cumplir. Es la misma tarea con otra fecha: no se crea nada nuevo.
 */
export function spreadTasks(tasks: Pick<Task, 'id' | 'dueDate'>[], nextFrom: ISODate): Shift[] {
  if (!tasks.length) return [];
  const ordered = [...tasks].sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
  const perDay = Math.ceil(ordered.length / 5);
  return ordered.map((t, i) => ({ id: t.id, dueDate: addDays(nextFrom, Math.min(4, Math.floor(i / perDay))) }));
}
