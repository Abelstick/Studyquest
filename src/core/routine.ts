/**
 * Tu semana de verdad: el horario fijo (trabajo, sueño), el tiempo libre que queda, qué toca AHORA y a qué hora
 * conviene hacer cada hábito. Todo se apoya en la agenda que ya existe: el horario son actividades normales del
 * calendario (una serie semanal por trabajo, una diaria para dormir) y la hora de un hábito es un bloque vinculado
 * a él. No hay almacenamiento nuevo, y por eso también viaja en el .ics hacia Google Calendar.
 *
 * Lógica pura, sin React ni base de datos.
 */
import type { AgendaCategory, AgendaEvent, Habit, ISODate, Snapshot, Task } from './domain';
import { addDays, clockToMinutes, diffDays, isClockTime, weekdayIndex } from './dates';
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
