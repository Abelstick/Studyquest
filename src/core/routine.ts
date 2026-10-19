/**
 * Tu semana de verdad: el horario fijo (trabajo, sueño), el tiempo libre que queda, qué toca AHORA y a qué hora
 * conviene hacer cada hábito. Todo se apoya en la agenda que ya existe: el horario son actividades normales del
 * calendario (una serie semanal por trabajo, una diaria para dormir) y la hora de un hábito es un bloque vinculado
 * a él. No hay almacenamiento nuevo, y por eso también viaja en el .ics hacia Google Calendar.
 *
 * Lógica pura, sin React ni base de datos.
 */
import type { AgendaCategory, AgendaEvent, Habit, ISODate, Snapshot, Task } from './domain';
import { addDays, clockToMinutes, diffDays, dueLabel, isClockTime, weekdayIndex } from './dates';
import { isDueOn, isHabitDone, logFor } from './game';
import { DAY_MIN, MAX_EVENT_MIN, MIN_BLOCK_MIN, habitDefaults, habitScheduledOn, occurrencesBetween, segmentsOn, toClock, type EventDraft, type Occurrence } from './agenda';
import { isQuit } from './quit';

type Ctx = Pick<Snapshot, 'events' | 'habits' | 'tasks' | 'habitLogs'>;

export interface Window {
  /** Minutos desde medianoche. */
  start: number;
  end: number;
}

/** Las horas en que se está despierto si no has dicho otra cosa. */
export const DEFAULT_WAKING: Window = { start: 6 * 60, end: 22 * 60 + 30 };

/* ---------- El horario fijo ---------- */

export const WORK_TITLE = 'Jornada laboral';
export const SLEEP_TITLE = 'Dormir';

export interface RoutineInput {
  /** 0 = lunes … 6 = domingo. */
  workDays: number[];
  workStart: string;
  workEnd: string;
  /** Hora de dormir y de despertar; ambas o ninguna. */
  sleep: string | null;
  wake: string | null;
}

export const DEFAULT_ROUTINE: RoutineInput = { workDays: [0, 1, 2, 3, 4], workStart: '09:00', workEnd: '18:00', sleep: '23:00', wake: '06:30' };

/** Minutos entre dos horas del reloj; si el fin es menor, cruza la medianoche. */
const span = (from: string, to: string): number => {
  const d = clockToMinutes(to) - clockToMinutes(from);
  return d > 0 ? d : d + DAY_MIN;
};

/** Problema del horario escrito, o null si es válido. */
export function validateRoutine(r: RoutineInput): string | null {
  if (!isClockTime(r.workStart) || !isClockTime(r.workEnd)) return 'Pon la hora de entrada y de salida.';
  if (r.workDays.length && clockToMinutes(r.workEnd) <= clockToMinutes(r.workStart)) return 'La salida debe ser posterior a la entrada.';
  if ((r.sleep === null) !== (r.wake === null)) return 'Para el sueño indica tanto la hora de dormir como la de despertar.';
  if (r.sleep !== null && (!isClockTime(r.sleep) || !isClockTime(r.wake))) return 'Revisa las horas de dormir y despertar.';
  return null;
}

/** El horario como actividades del calendario (series). Vacío si no trabaja ningún día y no define el sueño. */
export function routineDrafts(r: RoutineInput, from: ISODate): { work: EventDraft | null; sleep: EventDraft | null } {
  const work: EventDraft | null = r.workDays.length
    ? {
        title: WORK_TITLE, category: 'work', date: from, start: r.workStart, minutes: span(r.workStart, r.workEnd),
        repeat: { type: 'weekly', every: 1, days: [...r.workDays].sort((a, b) => a - b) }, reminderMin: null,
      }
    : null;
  const sleep: EventDraft | null =
    r.sleep && r.wake ? { title: SLEEP_TITLE, category: 'rest', date: from, start: r.sleep, minutes: Math.min(MAX_EVENT_MIN, span(r.sleep, r.wake)), repeat: { type: 'daily', every: 1 }, reminderMin: null } : null;
  return { work, sleep };
}

const isSeries = (e: AgendaEvent, title: string, category: AgendaCategory) => e.title === title && e.category === category && !!e.repeat && !e.habitId && !e.taskId;

/** Las series del horario que ya existen, para editarlas en vez de duplicarlas. */
export function findRoutine(events: AgendaEvent[]): { work?: AgendaEvent; sleep?: AgendaEvent } {
  return { work: events.find((e) => isSeries(e, WORK_TITLE, 'work')), sleep: events.find((e) => isSeries(e, SLEEP_TITLE, 'rest')) };
}

/** El horario guardado, o el de ejemplo si aún no hay. */
export function routineOf(events: AgendaEvent[]): RoutineInput {
  const { work, sleep } = findRoutine(events);
  const out: RoutineInput = { ...DEFAULT_ROUTINE };
  if (work?.start && work.repeat?.type === 'weekly') {
    out.workDays = work.repeat.days;
    out.workStart = work.start;
    out.workEnd = toClock(clockToMinutes(work.start) + work.minutes);
  }
  if (sleep?.start) {
    out.sleep = sleep.start;
    out.wake = toClock(clockToMinutes(sleep.start) + sleep.minutes);
  } else if (!sleep) {
    out.sleep = events.length ? null : DEFAULT_ROUTINE.sleep;
    out.wake = out.sleep ? DEFAULT_ROUTINE.wake : null;
  }
  return out;
}

/** Horas en que estás despierto: entre despertar y dormir si lo definiste; si no, las de siempre. */
export function wakingOf(events: AgendaEvent[]): Window {
  const { sleep } = findRoutine(events);
  if (!sleep?.start) return DEFAULT_WAKING;
  const start = clockToMinutes(sleep.start);
  const wake = (start + sleep.minutes) % DAY_MIN;
  return wake < start ? { start: wake, end: start } : DEFAULT_WAKING;
}

/* ---------- Tiempo libre y «ahora» ---------- */

/** Bloques con hora y duración de un día, sin lo cancelado. */
function blocksOn(ctx: Ctx, date: ISODate): Occurrence[] {
  const occs = occurrencesBetween(ctx.events, addDays(date, -1), date, { habits: ctx.habits, tasks: ctx.tasks, logs: ctx.habitLogs });
  return occs.filter((o) => o.start !== null && o.minutes > 0 && o.status !== 'cancelled');
}

/** Tramos del día sin nada programado dentro de las horas en que estás despierto (los de menos de `minLen` no cuentan). */
export function freeWindows(ctx: Ctx, date: ISODate, waking: Window = wakingOf(ctx.events), minLen = 15): Window[] {
  const busy = segmentsOn(blocksOn(ctx, date), date)
    .map((s) => ({ start: Math.max(waking.start, s.start), end: Math.min(waking.end, s.end) }))
    .filter((b) => b.end > b.start)
    .sort((a, b) => a.start - b.start);
  const out: Window[] = [];
  let cur = waking.start;
  for (const b of busy) {
    if (b.start - cur >= minLen) out.push({ start: cur, end: b.start });
    cur = Math.max(cur, b.end);
  }
  if (waking.end - cur >= minLen) out.push({ start: cur, end: waking.end });
  return out;
}

export type NowState =
  | { kind: 'empty' }
  | { kind: 'block'; occ: Occurrence; until: number; next: Occurrence | null }
  | { kind: 'free'; from: number; until: number; next: Occurrence | null }
  | { kind: 'rest' };

/** Qué hay ahora mismo: un bloque en curso, tiempo libre (hasta cuándo) o fuera de tus horas despiertas. */
export function nowState(ctx: Ctx, date: ISODate, nowMin: number): NowState {
  const blocks = segmentsOn(blocksOn(ctx, date), date);
  if (!blocks.length && !ctx.events.length) return { kind: 'empty' };
  const waking = wakingOf(ctx.events);
  const upcoming = blocks.filter((b) => b.start > nowMin).sort((a, b) => a.start - b.start);
  const next = upcoming[0]?.occ ?? null;
  // Entre varios bloques a la vez (trabajo y una reunión), el que empezó más tarde es el más concreto.
  const current = blocks.filter((b) => b.start <= nowMin && nowMin < b.end && b.occ.event.title !== SLEEP_TITLE).sort((a, b) => b.start - a.start)[0];
  if (current) return { kind: 'block', occ: current.occ, until: current.end, next };
  const win = freeWindows(ctx, date, waking, 1).find((w) => w.start <= nowMin && nowMin < w.end);
  if (win) return { kind: 'free', from: win.start, until: win.end, next };
  return { kind: 'rest' };
}

export interface Idea {
  kind: 'habit' | 'task';
  id: string;
  title: string;
  /** Hora a la que ya tienes programado el hábito hoy, si la hay. */
  at?: string;
  minutes?: number;
}

/**
 * Qué hacer en este rato libre: primero los hábitos de hoy que aún faltan (los que ya tienen hora dentro del rato, antes),
 * y después las tareas más urgentes que caben. Máximo `limit`; nada que no sea realmente de hoy.
 */
export function freeTimeIdeas(ctx: Ctx, date: ISODate, nowMin: number, until: number, limit = 3): Idea[] {
  const free = until - nowMin;
  const todayBlocks = blocksOn(ctx, date).filter((o) => o.date === date && o.event.habitId);
  const habits: Idea[] = ctx.habits
    .filter((h) => !isQuit(h) && isDueOn(h, date, ctx.habitLogs) && !isHabitDone(h, logFor(ctx.habitLogs, h.id, date)))
    .map((h) => {
      const occ = todayBlocks.find((o) => o.event.habitId === h.id);
      return { kind: 'habit' as const, id: h.id, title: h.title, at: occ?.start != null ? toClock(occ.start) : undefined, minutes: habitDefaults(h).minutes, order: occ?.start != null && occ.start >= nowMin - 30 && occ.start < until ? occ.start : 9999 };
    })
    .sort((a, b) => a.order - b.order)
    .map(({ order: _o, ...rest }) => rest);
  const tasks: Idea[] = ctx.tasks
    .filter((t: Task) => t.status !== 'done' && !!t.dueDate && diffDays(t.dueDate, date) <= 1 && (t.estimateMin === 0 || t.estimateMin <= free))
    .sort((a, b) => (a.dueDate as string).localeCompare(b.dueDate as string) || b.xp - a.xp)
    .map((t) => ({ kind: 'task' as const, id: t.id, title: t.title, minutes: t.estimateMin || undefined }));
  return [...habits, ...tasks].slice(0, limit);
}

/* ---------- A qué hora hacer un hábito ---------- */

export interface HabitTimes {
  /** Una hora de inicio por cada vez al día. */
  times: string[];
  minutes: number;
  /** Fracción de los días evaluados en que esas horas están libres (1 = todos). */
  coverage: number;
  /** Días de la semana (0 = lunes) que se evaluaron. */
  days: number[];
}

const STEP = 15;
const GAP = 60;

/** Los días de los próximos 14 en que le toca al hábito. */
function habitDays(h: Habit, from: ISODate): ISODate[] {
  const days: ISODate[] = [];
  for (let i = 0; i < 14; i++) {
    const d = addDays(from, i);
    const w = weekdayIndex(d);
    // Los de cuota («3 veces por semana») no tienen días fijos: se prueban los días laborables.
    if (h.frequency.type === 'custom' ? w <= 4 : habitScheduledOn(h, d)) days.push(d);
  }
  return days;
}

/** Hora ancla: la del recordatorio del hábito; si no, justo al salir del trabajo; si no, las 19:00. */
function anchorOf(h: Habit, ctx: Ctx, days: ISODate[]): number {
  if (isClockTime(h.reminder)) return clockToMinutes(h.reminder);
  const ends = days.flatMap((d) => blocksOn(ctx, d).filter((o) => o.event.category === 'work' && o.date === d).map((o) => (o.start as number) + o.minutes));
  return ends.length ? Math.max(...ends) : 19 * 60;
}

/**
 * Propone a qué hora hacer un hábito, `perDay` veces al día: las horas más cercanas a su ancla donde no tienes nada
 * (todos los días que toca). Con varias veces al día reparte las horas a lo largo del día. Es una sugerencia: nunca
 * se aplica sola.
 */
export function suggestHabitTimes(h: Habit, ctx: Ctx, from: ISODate, perDay = 1): HabitTimes | null {
  const days = habitDays(h, from);
  if (!days.length) return null;
  const minutes = Math.min(120, Math.max(MIN_BLOCK_MIN, habitDefaults(h).minutes));
  const waking = wakingOf(ctx.events);
  const free = days.map((d) => freeWindows(ctx, d, waking, minutes));
  const fits = (s: number) => free.filter((w) => w.some((x) => x.start <= s && s + minutes <= x.end)).length / days.length;
  const candidates: { s: number; cov: number }[] = [];
  for (let s = waking.start; s + minutes <= waking.end; s += STEP) candidates.push({ s, cov: fits(s) });
  const best = Math.max(0, ...candidates.map((c) => c.cov));
  if (best < 0.5) return null;
  const pool = candidates.filter((c) => c.cov >= Math.min(1, best));
  const n = Math.max(1, Math.min(3, perDay));
  const anchors = n === 1 ? [anchorOf(h, ctx, days)] : Array.from({ length: n }, (_, i) => Math.round((waking.start + ((i + 0.5) * (waking.end - waking.start)) / n) / STEP) * STEP);
  const chosen: number[] = [];
  for (const a of anchors) {
    // Antes del ancla pesa el doble: mejor un poco después de salir del trabajo que antes de tiempo.
    const pick = pool
      .filter((c) => chosen.every((x) => Math.abs(x - c.s) >= minutes + GAP))
      .sort((p, q) => (p.s >= a ? p.s - a : (a - p.s) * 2) - (q.s >= a ? q.s - a : (a - q.s) * 2))[0];
    if (pick) chosen.push(pick.s);
  }
  if (!chosen.length) return null;
  return { times: chosen.sort((x, y) => x - y).map(toClock), minutes, coverage: best, days: [...new Set(days.map(weekdayIndex))].sort((x, y) => x - y) };
}

const CATEGORY_BY_AREA: Partial<Record<NonNullable<Habit['area']>, AgendaCategory>> = { health: 'health', growth: 'study', career: 'work' };

/** Los bloques del calendario para un hábito a esas horas (uno por hora), vinculados a él y con aviso 10 minutos antes. */
export function habitBlockDrafts(h: Habit, times: string[], minutes: number, from: ISODate): EventDraft[] {
  const { repeat } = habitDefaults(h);
  return times.map((start) => ({
    title: '', category: (h.area && CATEGORY_BY_AREA[h.area]) || 'personal', date: from, start, minutes, repeat, habitId: h.id, taskId: null, reminderMin: 10,
  }));
}

/** Bloques del calendario que ya ponen hora a un hábito. */
export const habitBlocks = (events: AgendaEvent[], habitId: string): AgendaEvent[] => events.filter((e) => e.habitId === habitId);

/** Hábitos que todavía no tienen hora en el calendario (los de dejar un vicio no la necesitan). */
export const habitsWithoutTime = (habits: Habit[], events: AgendaEvent[]): Habit[] => habits.filter((h) => !isQuit(h) && habitBlocks(events, h.id).length === 0);

const DAY_ABBR = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/**
 * Tu tiempo libre habitual dicho en una frase para la IA («Lun–Vie 18:00–22:30; Sáb–Dom 06:00–22:30»), mirando la
 * semana que viene. Vacío si aún no has contado cómo es tu semana: sin horario no hay nada que decir.
 */
export function availabilityText(ctx: Ctx, from: ISODate): string {
  if (!ctx.events.length) return '';
  const rows = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(from, i);
    const wins = freeWindows(ctx, d, wakingOf(ctx.events), 30);
    return { w: weekdayIndex(d), text: wins.length ? wins.map((x) => `${toClock(x.start)}–${toClock(x.end)}`).join(' y ') : 'sin tiempo libre' };
  }).sort((a, b) => a.w - b.w);
  const groups: { from: number; to: number; text: string }[] = [];
  for (const r of rows) {
    const last = groups.at(-1);
    if (last && last.text === r.text && last.to === r.w - 1) last.to = r.w;
    else groups.push({ from: r.w, to: r.w, text: r.text });
  }
  return groups.map((g) => `${g.from === g.to ? DAY_ABBR[g.from] : `${DAY_ABBR[g.from]}–${DAY_ABBR[g.to]}`} ${g.text}`).join('; ');
}

/* ---------- Cuándo hacer cada tarea ---------- */

export interface TaskSlot {
  taskId: string;
  date: ISODate;
  /** «HH:MM». */
  start: string;
  minutes: number;
}

export interface TaskPlan {
  slots: TaskSlot[];
  /** Tareas a las que no les cabe todo el tiempo antes de su plazo, y cuántos minutos quedaron sin sitio. */
  unplaced: { task: PlannableTask; left: number }[];
}

export type PlannableTask = Pick<Task, 'id' | 'title' | 'dueDate' | 'dueTime' | 'estimateMin' | 'priority' | 'courseId' | 'area'>;

/** Una sesión de trabajo no pasa de esto: mejor varias sesiones cortas en días distintos que un bloque inabarcable. */
export const TASK_SESSION_MAX = 90;
const TASK_SESSION_MIN = 15;
/** Tiempo para una tarea sin estimación. */
const TASK_DEFAULT_MIN = 30;
/** Cuánto del tiempo libre de un día se reparte entre tareas: el resto queda para hábitos y para vivir. */
const DAY_SHARE = 0.6;
const HORIZON_DAYS = 14;
const PRIORITY_RANK: Record<Task['priority'], number> = { boss: 0, high: 1, mid: 2, low: 3 };

const ceil15 = (m: number) => Math.ceil(m / STEP) * STEP;

/** Nadie quiere estudiar a las 6 de la mañana: las tareas se proponen a partir de esta hora. */
const TASKS_FROM = 9 * 60;

/** Tiempo libre utilizable para tareas: el de siempre, pero sin madrugadas. */
const taskWindows = (ctx: Ctx, d: ISODate, minLen: number): Window[] =>
  freeWindows(ctx, d, wakingOf(ctx.events), minLen)
    .map((w) => ({ start: Math.max(w.start, TASKS_FROM), end: w.end }))
    .filter((w) => w.end - w.start >= minLen);

/**
 * Propone cuándo hacer cada tarea: en tus ratos libres (fuera de tu trabajo y de lo que ya tienes), antes de su plazo, la
 * más urgente primero, en sesiones de hasta 90 min en días distintos y sin llenar más del 60 % del tiempo libre de un día.
 * Hoy solo cuenta lo que queda desde ahora. Es una sugerencia: nunca se aplica sola.
 */
export function planTaskSlots(tasks: PlannableTask[], ctx: Ctx, from: ISODate, nowMin: number): TaskPlan {
  const placed: AgendaEvent[] = [];
  const used = new Map<ISODate, number>();
  const slots: TaskSlot[] = [];
  const unplaced: TaskPlan['unplaced'] = [];
  const order = [...tasks].sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);

  for (const task of order) {
    let need = task.estimateMin > 0 ? Math.min(task.estimateMin, 360) : TASK_DEFAULT_MIN;
    // Con plazo, hasta ese día; vencida o sin plazo, en los próximos días.
    const last = task.dueDate && task.dueDate >= from ? (task.dueDate < addDays(from, HORIZON_DAYS) ? task.dueDate : addDays(from, HORIZON_DAYS - 1)) : addDays(from, task.dueDate ? 2 : 6);
    for (let d = from; d <= last && need > 0; d = addDays(d, 1)) {
      const full = { ...ctx, events: [...ctx.events, ...placed] };
      const cap = Math.max(60, Math.floor(taskWindows(ctx, d, 1).reduce((a, w) => a + w.end - w.start, 0) * DAY_SHARE));
      const room = cap - (used.get(d) ?? 0);
      // El día del plazo, con hora límite, la sesión debe terminar antes.
      const limit = task.dueDate === d && isClockTime(task.dueTime) ? clockToMinutes(task.dueTime) : DAY_MIN;
      const win = taskWindows(full, d, TASK_SESSION_MIN)
        .map((w) => ({ start: d === from ? ceil15(Math.max(w.start, nowMin)) : w.start, end: Math.min(w.end, limit) }))
        .find((w) => w.end - w.start >= Math.min(TASK_SESSION_MIN, need) && room >= Math.min(TASK_SESSION_MIN, need));
      if (!win) continue;
      const minutes = Math.min(need, TASK_SESSION_MAX, win.end - win.start, room);
      if (minutes < MIN_BLOCK_MIN) continue;
      const start = toClock(win.start);
      slots.push({ taskId: task.id, date: d, start, minutes });
      placed.push({ id: `plan-${task.id}-${d}`, title: '', category: 'other', date: d, start, minutes, taskId: task.id, rev: 0, createdAt: '', updatedAt: '' });
      used.set(d, (used.get(d) ?? 0) + minutes);
      need -= minutes;
    }
    if (need > 0) unplaced.push({ task, left: need });
  }
  return { slots, unplaced };
}

const CATEGORY_BY_TASK_AREA: Partial<Record<NonNullable<Task['area']>, AgendaCategory>> = { health: 'health', growth: 'study', career: 'work' };

/** Los bloques del calendario para esas sesiones: vinculados a la tarea (que sigue siendo quien se completa) y con aviso 10 min antes. */
export function taskBlockDrafts(task: PlannableTask, slots: TaskSlot[]): EventDraft[] {
  const category: AgendaCategory = task.courseId ? 'study' : ((task.area && CATEGORY_BY_TASK_AREA[task.area]) || 'personal');
  return slots
    .filter((s) => s.taskId === task.id)
    .map((s) => ({ title: '', category, date: s.date, start: s.start, minutes: s.minutes, habitId: null, taskId: task.id, reminderMin: 10 }));
}

/** Tareas abiertas que todavía no tienen un rato reservado en el calendario. */
export const tasksWithoutTime = (tasks: Task[], events: AgendaEvent[]): Task[] => {
  const withBlock = new Set(events.flatMap((e) => (e.taskId ? [e.taskId] : [])));
  return tasks.filter((t) => t.status !== 'done' && !withBlock.has(t.id));
};

/** Los ratos reservados para una tarea, de más próximo a más lejano. */
export const taskBlocks = (events: AgendaEvent[], taskId: string): AgendaEvent[] => events.filter((e) => e.taskId === taskId).sort((a, b) => a.date.localeCompare(b.date));

/**
 * Minutos por día de la semana (0 = lunes) que puedes dedicar a estudiar según tu horario: la mitad del tiempo libre,
 * en múltiplos de 15 y con tope de 4 h. Es el punto de partida del planificador; tú lo ajustas.
 */
export function weekMinutesFromSchedule(ctx: Ctx, from: ISODate): number[] {
  const out = Array.from({ length: 7 }, () => 0);
  for (let i = 0; i < 7; i++) {
    const d = addDays(from, i);
    const free = taskWindows(ctx, d, 30).reduce((a, w) => a + w.end - w.start, 0);
    out[weekdayIndex(d)] = Math.min(240, Math.floor((free * 0.5) / STEP) * STEP);
  }
  return out;
}

/** «Hoy · 18:00–19:00», «Mañana · 18:00–18:30», «Vie 18 · 19:00–20:30». */
export const slotLabel = (s: Pick<TaskSlot, 'date' | 'start' | 'minutes'>, now: ISODate): string =>
  `${dueLabel(s.date, now)} · ${s.start}–${toClock(clockToMinutes(s.start) + s.minutes)}`;
