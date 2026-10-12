/**
 * Agenda: actividades con horario (bloques, recordatorios y bloques vinculados a hábitos o tareas).
 * Funciones puras: expandir repeticiones, validar, editar una ocurrencia o la serie, repartir los
 * bloques en columnas cuando se solapan y decidir cuándo avisar. La pantalla y el store solo aplican el resultado.
 *
 * Las horas son siempre de reloj local («HH:MM») sobre el día local `YYYY-MM-DD`: así un desayuno a las
 * 07:30 sigue a las 07:30 aunque cambie el horario de verano. La zona horaria solo entra al exportar.
 */
import type { AgendaCategory, AgendaEvent, AgendaException, AgendaRepeat, Habit, HabitLog, ID, ISODate, Task } from './domain';
import { addDays, clockToMinutes, diffDays, fromISODate, isClockTime, weekdayIndex, weekStart } from './dates';
import { isDueOn, isHabitDone, logFor } from './game';

export const DAY_MIN = 1440;
/** Una actividad dura como mucho 24 h (puede terminar al día siguiente). */
export const MAX_EVENT_MIN = DAY_MIN;
export const MIN_BLOCK_MIN = 5;
/** Margen para disparar un aviso si la app estaba cerrada justo en ese minuto. */
export const AGENDA_REMINDER_WINDOW_MIN = 10;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n: number) => String(n).padStart(2, '0');

export const CATEGORIES: { value: AgendaCategory; label: string; icon: string }[] = [
  { value: 'study', label: 'Estudio', icon: '📚' },
  { value: 'work', label: 'Trabajo', icon: '💼' },
  { value: 'meeting', label: 'Reunión o cita', icon: '👥' },
  { value: 'health', label: 'Salud y ejercicio', icon: '💪' },
  { value: 'meal', label: 'Comida', icon: '🍳' },
  { value: 'rest', label: 'Descanso', icon: '😴' },
  { value: 'personal', label: 'Personal', icon: '🏠' },
  { value: 'other', label: 'Otro', icon: '📌' },
];
const CATEGORY_IDS = CATEGORIES.map((c) => c.value);
export const categoryInfo = (c: AgendaCategory) => CATEGORIES.find((x) => x.value === c) ?? CATEGORIES[CATEGORIES.length - 1];

/** Colores opcionales: un nombre de la paleta, nunca un CSS libre (así un dato manipulado no inyecta estilos). */
export const AGENDA_COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'gray'] as const;
export type AgendaColor = (typeof AGENDA_COLORS)[number];
export const isAgendaColor = (v: unknown): v is AgendaColor => typeof v === 'string' && (AGENDA_COLORS as readonly string[]).includes(v);

/** «HH:MM» de unos minutos desde medianoche (pasa de 24 h a la hora del día siguiente). */
export const toClock = (min: number): string => {
  const m = ((Math.round(min) % DAY_MIN) + DAY_MIN) % DAY_MIN;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
};

/** Hora de fin de un bloque y si cae al día siguiente. */
export const endOf = (start: string, minutes: number): { clock: string; nextDay: boolean } => {
  const end = clockToMinutes(start) + minutes;
  return { clock: toClock(end), nextDay: end > DAY_MIN || (end === DAY_MIN && minutes > 0) };
};

/**
 * Duración a partir de inicio y fin. El fin debe ser posterior al inicio, salvo que se marque
 * que termina al día siguiente. Devuelve null si no es válida.
 */
export function durationBetween(start: string, end: string, nextDay: boolean): number | null {
  if (!isClockTime(start) || !isClockTime(end)) return null;
  const m = clockToMinutes(end) - clockToMinutes(start) + (nextDay ? DAY_MIN : 0);
  return m > 0 && m <= MAX_EVENT_MIN ? m : null;
}

export const durationLabel = (min: number): string => {
  if (min <= 0) return 'Recordatorio';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
};

/* ---------- Qué es cada actividad ---------- */

export type AgendaKind = 'habit' | 'task' | 'reminder' | 'allday' | 'block';
export const eventKind = (e: Pick<AgendaEvent, 'habitId' | 'taskId' | 'start' | 'minutes'>): AgendaKind =>
  e.habitId ? 'habit' : e.taskId ? 'task' : e.start === null ? 'allday' : e.minutes === 0 ? 'reminder' : 'block';

export interface AgendaContext {
  habits: Habit[];
  tasks: Task[];
  logs: HabitLog[];
}

/**
 * Días en que un hábito «tiene cita». Igual que `isDueOn` para los de calendario fijo; los semanales y
 * mensuales caen el mismo día de la semana o del mes en que empezaron, y los de cuota («N veces por
 * semana») no tienen días fijos: hay que elegirlos a mano.
 */
export function habitScheduledOn(h: Habit, date: ISODate): boolean {
  if (date < h.startDate) return false;
  const f = h.frequency;
  switch (f.type) {
    case 'weekly':
      return weekdayIndex(date) === weekdayIndex(h.startDate);
    case 'monthly': {
      const d = fromISODate(date);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      return d.getDate() === Math.min(Number(h.startDate.slice(8)), last);
    }
    case 'custom':
      return false;
    default:
      return isDueOn(h, date, []);
  }
}

export const habitHasFixedDays = (h: Habit): boolean => h.frequency.type !== 'custom';

/** ¿La serie tiene una ocurrencia (original) ese día? */
export function occursOn(ev: Pick<AgendaEvent, 'date' | 'until' | 'repeat' | 'habitId'>, d: ISODate, habits: Habit[]): boolean {
  if (d < ev.date || (ev.until && d > ev.until)) return false;
  const r = ev.repeat;
  if (!r) return d === ev.date;
  switch (r.type) {
    case 'daily':
      return diffDays(d, ev.date) % Math.max(1, r.every) === 0;
    case 'weekly':
      return r.days.includes(weekdayIndex(d)) && (diffDays(weekStart(d), weekStart(ev.date)) / 7) % Math.max(1, r.every) === 0;
    case 'habit': {
      const h = habits.find((x) => x.id === ev.habitId);
      return !!h && habitScheduledOn(h, d);
    }
  }
}

export function repeatLabel(r: AgendaRepeat | undefined, habit?: Habit): string {
  if (!r) return 'Una sola vez';
  if (r.type === 'habit') return habit ? `Según el hábito «${habit.title}»` : 'Según el hábito';
  const n = Math.max(1, r.every);
  if (r.type === 'daily') return n === 1 ? 'Todos los días' : `Cada ${n} días`;
  const names = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
  const days = [...r.days].sort((a, b) => a - b);
  const which = days.length === 7 ? 'todos los días' : days.join() === '0,1,2,3,4' ? 'de lunes a viernes' : days.map((d) => names[d]).join(', ');
  return n === 1 ? `Cada semana: ${which}` : `Cada ${n} semanas: ${which}`;
}

/* ---------- Ocurrencias ---------- */

export type OccurrenceStatus = 'pending' | 'done' | 'cancelled';

export interface Occurrence {
  /** `<id del evento>:<fecha original>`: identifica la ocurrencia aunque se mueva. */
  key: string;
  event: AgendaEvent;
  /** Fecha original en la serie (la que usa la excepción y el RECURRENCE-ID del .ics). */
  original: ISODate;
  /** Día en que ocurre de verdad (distinto si se movió). */
  date: ISODate;
  /** Minutos desde medianoche; null = todo el día. */
  start: number | null;
  minutes: number;
  title: string;
  status: OccurrenceStatus;
  recurring: boolean;
  exception?: AgendaException;
}

/** Título que se enseña: el propio o, si se dejó vacío, el del hábito o la tarea vinculada. */
export function displayTitle(ev: Pick<AgendaEvent, 'title' | 'habitId' | 'taskId'>, ctx: Pick<AgendaContext, 'habits' | 'tasks'>): string {
  if (ev.title.trim()) return ev.title;
  const linked = (ev.habitId && ctx.habits.find((h) => h.id === ev.habitId)?.title) || (ev.taskId && ctx.tasks.find((t) => t.id === ev.taskId)?.title);
  return linked || 'Actividad';
}

/**
 * Estado de una ocurrencia. Lo marcado a mano manda; si no, el bloque de un hábito está hecho cuando el
 * hábito alcanzó su objetivo ese día y el de una tarea cuando la tarea está superada. Nunca al revés:
 * la agenda no registra hábitos ni cierra tareas por su cuenta.
 */
export function occurrenceStatus(ev: AgendaEvent, date: ISODate, ex: AgendaException | undefined, ctx: AgendaContext): OccurrenceStatus {
  if (ex?.status) return ex.status;
  if (ev.habitId) {
    const h = ctx.habits.find((x) => x.id === ev.habitId);
    if (h && isHabitDone(h, logFor(ctx.logs, h.id, date))) return 'done';
  }
  if (ev.taskId && ctx.tasks.find((t) => t.id === ev.taskId)?.status === 'done') return 'done';
  return 'pending';
}

function buildOccurrence(ev: AgendaEvent, original: ISODate, ctx: AgendaContext): Occurrence {
  const ex = ev.exceptions?.[original];
  const date = ex?.date ?? original;
  const startClock = ex && ex.start !== undefined ? ex.start : ev.start;
  return {
    key: `${ev.id}:${original}`,
    event: ev,
    original,
    date,
    start: startClock === null ? null : clockToMinutes(startClock),
    minutes: ex?.minutes ?? ev.minutes,
    title: ex?.title?.trim() || displayTitle(ev, ctx),
    status: occurrenceStatus(ev, date, ex, ctx),
    recurring: !!ev.repeat,
    exception: ex,
  };
}

/** Último día que toca una ocurrencia (el siguiente si pasa de medianoche). */
export const lastDayOf = (o: Pick<Occurrence, 'date' | 'start' | 'minutes'>): ISODate =>
  o.start === null || o.minutes <= 0 ? o.date : addDays(o.date, Math.floor((o.start + o.minutes - 1) / DAY_MIN));

/** Todas las ocurrencias que tocan algún día entre `from` y `to` (inclusive), en orden cronológico. */
export function occurrencesBetween(events: AgendaEvent[], from: ISODate, to: ISODate, ctx: AgendaContext): Occurrence[] {
  const out: Occurrence[] = [];
  for (const ev of events) {
    const candidates = new Set<ISODate>();
    if (!ev.repeat) candidates.add(ev.date);
    else {
      // Un día antes: una ocurrencia de la noche anterior puede terminar dentro del rango.
      const first = addDays(from, -1) > ev.date ? addDays(from, -1) : ev.date;
      const last = ev.until && ev.until < to ? ev.until : to;
      for (let d = first; d <= last; d = addDays(d, 1)) if (occursOn(ev, d, ctx.habits)) candidates.add(d);
    }
    // Ocurrencias movidas desde fuera del rango.
    for (const [orig, ex] of Object.entries(ev.exceptions ?? {})) if (ex.date && !ex.deleted && occursOn(ev, orig, ctx.habits)) candidates.add(orig);
    for (const original of candidates) {
      if (ev.exceptions?.[original]?.deleted) continue;
      const occ = buildOccurrence(ev, original, ctx);
      if (occ.date <= to && lastDayOf(occ) >= from) out.push(occ);
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? -1) - (b.start ?? -1) || a.title.localeCompare(b.title, 'es'));
}

/* ---------- Cuadrícula horaria ---------- */

/** Trozo de una ocurrencia dentro de un día (las que cruzan medianoche se parten en dos). */
export interface Segment {
  occ: Occurrence;
  start: number;
  end: number;
  /** Empezó el día anterior. */
  continued: boolean;
  /** Sigue al día siguiente. */
  continues: boolean;
}

export function segmentsOn(occs: Occurrence[], date: ISODate): Segment[] {
  const out: Segment[] = [];
  for (const occ of occs) {
    if (occ.start === null) continue;
    if (occ.minutes <= 0) {
      if (occ.date === date) out.push({ occ, start: occ.start, end: occ.start, continued: false, continues: false });
      continue;
    }
    let d = occ.date;
    let s = occ.start;
    let left = occ.minutes;
    while (left > 0 && d <= date) {
      const end = Math.min(DAY_MIN, s + left);
      if (d === date) out.push({ occ, start: s, end, continued: d !== occ.date, continues: s + left > DAY_MIN });
      left -= end - s;
      s = 0;
      d = addDays(d, 1);
    }
  }
  return out;
}

export interface Placed<T> {
  item: T;
  /** Columna dentro de su grupo de solapes. */
  col: number;
  /** Columnas del grupo: el ancho de cada bloque es 1/cols. */
  cols: number;
}

/**
 * Reparte en columnas los bloques que se solapan, para que ninguno tape a otro.
 * `minLen` da altura mínima a los bloques muy cortos (y a los recordatorios) al calcular solapes.
 */
export function layoutColumns<T extends { start: number; end: number }>(items: T[], minLen = 20): Placed<T>[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Placed<T>[] = [];
  let group: Placed<T>[] = [];
  let colsEnd: number[] = [];
  let groupEnd = -1;
  const flush = () => {
    for (const p of group) p.cols = colsEnd.length;
    out.push(...group);
    group = [];
    colsEnd = [];
    groupEnd = -1;
  };
  for (const item of sorted) {
    const end = Math.max(item.end, item.start + minLen);
    if (group.length && item.start >= groupEnd) flush();
    let col = colsEnd.findIndex((e) => e <= item.start);
    if (col === -1) {
      col = colsEnd.length;
      colsEnd.push(end);
    } else colsEnd[col] = end;
    group.push({ item, col, cols: 0 });
    groupEnd = Math.max(groupEnd, end);
  }
  flush();
  return out;
}

/** Minutos sin nada programado entre `from` y `to` (minutos del día), uniendo los solapes. */
export function freeMinutes(busy: { start: number; end: number }[], from: number, to: number): number {
  const parts = busy
    .map((b) => ({ start: Math.max(from, b.start), end: Math.min(to, b.end) }))
    .filter((b) => b.end > b.start)
    .sort((a, b) => a.start - b.start);
  let taken = 0;
  let cur = from;
  for (const p of parts) {
    if (p.end <= cur) continue;
    taken += p.end - Math.max(cur, p.start);
    cur = p.end;
  }
  return Math.max(0, to - from - taken);
}

/* ---------- Validación ---------- */

export type EventDraft = Omit<AgendaEvent, 'id' | 'rev' | 'createdAt' | 'updatedAt' | 'exceptions' | 'external'>;

export function validateEvent(d: EventDraft, habits: Habit[] = []): string | null {
  if (!d.title.trim() && !d.habitId && !d.taskId) return 'Ponle un nombre a la actividad.';
  if (!DATE.test(d.date)) return 'Elige una fecha válida.';
  if (d.start !== null) {
    if (!isClockTime(d.start)) return 'La hora de inicio no es válida.';
    if (!Number.isInteger(d.minutes) || d.minutes < 0) return 'La hora de fin debe ser posterior a la de inicio.';
    if (d.minutes > MAX_EVENT_MIN) return 'Una actividad puede durar como máximo 24 horas.';
    if (d.minutes > 0 && d.minutes < MIN_BLOCK_MIN) return `Un bloque debe durar al menos ${MIN_BLOCK_MIN} minutos.`;
  }
  const r = d.repeat;
  if (r) {
    if (r.type !== 'habit' && (!Number.isInteger(r.every) || r.every < 1 || r.every > 365)) return 'El intervalo de repetición debe estar entre 1 y 365.';
    if (r.type === 'weekly' && !r.days.length) return 'Elige al menos un día de la semana.';
    if (r.type === 'habit') {
      const h = habits.find((x) => x.id === d.habitId);
      if (!h) return 'Para repetir según un hábito, vincula uno.';
      if (!habitHasFixedDays(h)) return 'Ese hábito es de «N veces por semana o mes» y no tiene días fijos: elige tú los días.';
    }
  }
  if (d.until && d.until < d.date) return 'La repetición no puede terminar antes de empezar.';
  if (d.reminderMin != null && (d.reminderMin < 0 || d.reminderMin > 10080)) return 'El aviso debe ser entre 0 minutos y 7 días antes.';
  if (d.pulseMin != null) {
    if (d.start === null || d.minutes <= 0) return 'Los avisos periódicos necesitan un bloque con hora de inicio y fin.';
    if (d.pulseMin < 5 || d.pulseMin >= d.minutes) return 'El intervalo de los avisos debe ser de al menos 5 minutos y menor que la duración del bloque.';
  }
  return null;
}

/* ---------- Editar y borrar por alcance ---------- */

export type EditScope = 'one' | 'following' | 'all';
export interface OccurrenceChange {
  date?: ISODate;
  start?: string | null;
  minutes?: number;
  title?: string;
}
export interface SeriesResult {
  update?: AgendaEvent;
  create?: AgendaEvent;
  remove?: boolean;
}

const touch = (ev: AgendaEvent, now: string): AgendaEvent => ({ ...ev, rev: ev.rev + 1, updatedAt: now });

const filterExceptions = (ex: AgendaEvent['exceptions'], keep: (d: ISODate) => boolean, shift = 0): AgendaEvent['exceptions'] => {
  const entries = Object.entries(ex ?? {})
    .filter(([d]) => keep(d))
    .map(([d, v]): [ISODate, AgendaException] => [shift ? addDays(d, shift) : d, v]);
  return entries.length ? Object.fromEntries(entries) : undefined;
};

/** Aplica el cambio a toda la serie. Mover de día desplaza la serie entera (y sus días de la semana). */
function changeSeries(ev: AgendaEvent, original: ISODate, change: OccurrenceChange, now: string): AgendaEvent {
  const next: AgendaEvent = {
    ...ev,
    start: change.start !== undefined ? change.start : ev.start,
    minutes: change.minutes ?? ev.minutes,
    title: change.title ?? ev.title,
  };
  // Una serie que sigue a un hábito no se puede mover de día: sus días los decide el hábito.
  const delta = change.date && ev.repeat?.type !== 'habit' ? diffDays(change.date, original) : 0;
  if (delta) {
    next.date = addDays(ev.date, delta);
    if (ev.until) next.until = addDays(ev.until, delta);
    if (ev.repeat?.type === 'weekly') next.repeat = { ...ev.repeat, days: [...new Set(ev.repeat.days.map((x) => (((x + delta) % 7) + 7) % 7))].sort((a, b) => a - b) };
    next.exceptions = filterExceptions(ev.exceptions, () => true, delta);
  }
  return touch(next, now);
}

/** Parte la serie: la original termina el día anterior y nace una nueva desde `original`. */
function splitSeries(ev: AgendaEvent, original: ISODate, now: string, makeId: () => ID): [AgendaEvent, AgendaEvent] {
  const head = touch({ ...ev, until: addDays(original, -1), exceptions: filterExceptions(ev.exceptions, (d) => d < original) }, now);
  const tail: AgendaEvent = { ...ev, id: makeId(), date: original, exceptions: filterExceptions(ev.exceptions, (d) => d >= original), external: undefined, rev: 0, createdAt: now, updatedAt: now };
  return [head, tail];
}

/** Quita de la excepción lo que coincide con la serie, para no guardar datos repetidos. */
function cleanException(ex: AgendaException, ev: AgendaEvent, original: ISODate): AgendaException | null {
  const out: AgendaException = {};
  if (ex.deleted) out.deleted = true;
  if (ex.status) out.status = ex.status;
  if (ex.date && ex.date !== original) out.date = ex.date;
  if (ex.start !== undefined && ex.start !== ev.start) out.start = ex.start;
  if (ex.minutes !== undefined && ex.minutes !== ev.minutes) out.minutes = ex.minutes;
  if (ex.title !== undefined && ex.title.trim() && ex.title !== ev.title) out.title = ex.title;
  return Object.keys(out).length ? out : null;
}

const withException = (ev: AgendaEvent, original: ISODate, ex: AgendaException | null): AgendaEvent['exceptions'] => {
  const rest = { ...(ev.exceptions ?? {}) };
  if (ex) rest[original] = ex;
  else delete rest[original];
  return Object.keys(rest).length ? rest : undefined;
};

/** Mueve, alarga o renombra una ocurrencia: solo esa, esa y las siguientes, o toda la serie. */
export function changeOccurrence(ev: AgendaEvent, original: ISODate, change: OccurrenceChange, scope: EditScope, now: string, makeId: () => ID): SeriesResult {
  if (!ev.repeat || scope === 'all' || (scope === 'following' && original <= ev.date)) {
    if (!ev.repeat) return { update: touch({ ...ev, date: change.date ?? ev.date, start: change.start !== undefined ? change.start : ev.start, minutes: change.minutes ?? ev.minutes, title: change.title ?? ev.title }, now) };
    return { update: changeSeries(ev, original, change, now) };
  }
  if (scope === 'one') {
    const ex = cleanException({ ...(ev.exceptions?.[original] ?? {}), ...change }, ev, original);
    return { update: touch({ ...ev, exceptions: withException(ev, original, ex) }, now) };
  }
  const [head, tail] = splitSeries(ev, original, now, makeId);
  return { update: head, create: changeSeries(tail, original, change, now) };
}

/** Sustituye la serie desde una ocurrencia con los datos del formulario («esta y las siguientes»). */
export function replaceFrom(ev: AgendaEvent, original: ISODate, draft: EventDraft, now: string, makeId: () => ID): SeriesResult {
  if (!ev.repeat || original <= ev.date) return { update: touch({ ...ev, ...draft }, now) };
  const [head, tail] = splitSeries(ev, original, now, makeId);
  // Las excepciones de días que ya no encajan con la nueva regla se descartan solas al expandir.
  return { update: head, create: { ...tail, ...draft } };
}

export function removeOccurrence(ev: AgendaEvent, original: ISODate, scope: EditScope, now: string): SeriesResult {
  if (!ev.repeat || scope === 'all' || (scope === 'following' && original <= ev.date)) return { remove: true };
  if (scope === 'one') return { update: touch({ ...ev, exceptions: withException(ev, original, { ...(ev.exceptions?.[original] ?? {}), deleted: true }) }, now) };
  return { update: touch({ ...ev, until: addDays(original, -1), exceptions: filterExceptions(ev.exceptions, (d) => d < original) }, now) };
}

/** Marca una ocurrencia como hecha o cancelada (null la devuelve a pendiente). */
export function setOccurrenceStatus(ev: AgendaEvent, original: ISODate, status: 'done' | 'cancelled' | null, now: string): AgendaEvent {
  const rest: AgendaException = { ...(ev.exceptions?.[original] ?? {}) };
  delete rest.status;
  const ex = cleanException(status ? { ...rest, status } : rest, ev, original);
  return touch({ ...ev, exceptions: withException(ev, original, ex) }, now);
}

/** Al borrar un hábito o una tarea, sus bloques se quedan como actividades sueltas (con su nombre). */
export function unlinkEvents(events: AgendaEvent[], ref: { habitId?: ID; taskId?: ID }, ctx: Pick<AgendaContext, 'habits' | 'tasks'>, now: string): AgendaEvent[] {
  return events
    .filter((e) => (ref.habitId && e.habitId === ref.habitId) || (ref.taskId && e.taskId === ref.taskId))
    .map((e) =>
      touch(
        {
          ...e,
          title: displayTitle(e, ctx),
          habitId: ref.habitId ? null : e.habitId,
          taskId: ref.taskId ? null : e.taskId,
          ...(ref.habitId && e.repeat?.type === 'habit' ? { repeat: { type: 'daily', every: 1 } as AgendaRepeat } : {}),
        },
        now,
      ),
    );
}

/* ---------- Valores por defecto y plantillas ---------- */

/** Duración y hora propuestas al programar un hábito: su objetivo si se mide en tiempo; si no, 15 min. */
export function habitDefaults(h: Habit): { minutes: number; start: string; repeat: AgendaRepeat } {
  const minutes = h.measure === 'minutes' ? h.target : h.measure === 'hours' ? h.target * 60 : 15;
  return {
    minutes: Math.min(MAX_EVENT_MIN, Math.max(MIN_BLOCK_MIN, Math.round(minutes))),
    start: isClockTime(h.reminder) ? h.reminder : '08:00',
    repeat: habitHasFixedDays(h) ? { type: 'habit' } : { type: 'weekly', every: 1, days: [0, 2, 4] },
  };
}

/** Duración propuesta al reservar tiempo para una tarea: su estimación, o 30 min. */
export const taskDefaultMinutes = (t: Task): number => Math.min(MAX_EVENT_MIN, Math.max(MIN_BLOCK_MIN, t.estimateMin || 30));

export interface AgendaTemplate {
  id: string;
  title: string;
  category: AgendaCategory;
  start: string;
  minutes: number;
  repeat?: AgendaRepeat;
}
const WEEKDAYS = [0, 1, 2, 3, 4];
export const AGENDA_TEMPLATES: AgendaTemplate[] = [
  { id: 'work', title: 'Jornada laboral', category: 'work', start: '09:00', minutes: 540, repeat: { type: 'weekly', every: 1, days: WEEKDAYS } },
  { id: 'breakfast', title: 'Desayuno', category: 'meal', start: '07:30', minutes: 30, repeat: { type: 'daily', every: 1 } },
  { id: 'lunch', title: 'Almuerzo', category: 'meal', start: '13:00', minutes: 60, repeat: { type: 'daily', every: 1 } },
  { id: 'dinner', title: 'Cena', category: 'meal', start: '20:00', minutes: 45, repeat: { type: 'daily', every: 1 } },
  { id: 'break', title: 'Pausa', category: 'rest', start: '11:00', minutes: 15, repeat: { type: 'weekly', every: 1, days: WEEKDAYS } },
  { id: 'exercise', title: 'Actividad física', category: 'health', start: '18:30', minutes: 45, repeat: { type: 'weekly', every: 1, days: [0, 2, 4] } },
  { id: 'study', title: 'Bloque de estudio', category: 'study', start: '19:30', minutes: 90, repeat: { type: 'weekly', every: 1, days: WEEKDAYS } },
  { id: 'free', title: 'Tiempo libre', category: 'personal', start: '21:00', minutes: 60 },
  { id: 'sleep', title: 'Prepararse para dormir', category: 'rest', start: '22:30', minutes: 30, repeat: { type: 'daily', every: 1 } },
  { id: 'meeting', title: 'Reunión', category: 'meeting', start: '10:00', minutes: 60 },
];

/* ---------- Avisos ---------- */

export interface AgendaNotice {
  key: string;
  title: string;
  body: string;
}

/**
 * Avisos que tocan ahora: `reminderMin` antes del inicio y, si el bloque lo pide, cada `pulseMin` minutos
 * mientras dura. `occs` deben ser las de hoy y mañana (un aviso puede caer antes de medianoche).
 * Nunca se avisa de lo hecho o cancelado; `sent` evita repetir el mismo aviso.
 */
export function agendaNotices(occs: Occurrence[], today: ISODate, nowMin: number, sent: Set<string>, windowMin = AGENDA_REMINDER_WINDOW_MIN): AgendaNotice[] {
  const out: AgendaNotice[] = [];
  const due = (at: number) => nowMin - at >= 0 && nowMin - at <= windowMin;
  for (const o of occs) {
    if (o.status !== 'pending' || o.start === null) continue;
    const base = diffDays(o.date, today) * DAY_MIN + o.start;
    const range = o.minutes > 0 ? `${toClock(o.start)}–${toClock(o.start + o.minutes)}` : toClock(o.start);
    const rem = o.event.reminderMin;
    if (rem != null && due(base - rem)) {
      const key = `agenda:${o.key}`;
      if (!sent.has(key)) out.push({ key, title: rem === 0 ? `Ahora: ${o.title}` : `En ${durationLabel(rem)}: ${o.title}`, body: `${range} · ${categoryInfo(o.event.category).label}` });
    }
    const pulse = o.event.pulseMin;
    if (pulse && o.minutes > 0) {
      for (let k = 0, at = base; at < base + o.minutes; k++, at += pulse) {
        if (!due(at)) continue;
        const key = `agenda:${o.key}:${k}`;
        if (!sent.has(key)) out.push({ key, title: o.title, body: `Recordatorio ${k + 1} · cada ${pulse} min hasta las ${toClock(o.start + o.minutes)}` });
      }
    }
  }
  return out;
}

/* ---------- Lectura segura (copias de seguridad) ---------- */

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const int = (v: unknown, min: number, max: number): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null);
const days = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is number => int(x, 0, 6) !== null))].sort((a, b) => a - b) : []);

function parseRepeat(v: unknown): AgendaRepeat | undefined {
  if (!isObj(v)) return undefined;
  if (v.type === 'habit') return { type: 'habit' };
  const every = int(v.every, 1, 365) ?? 1;
  if (v.type === 'daily') return { type: 'daily', every };
  if (v.type === 'weekly') {
    const d = days(v.days);
    return d.length ? { type: 'weekly', every, days: d } : undefined;
  }
  return undefined;
}

function parseException(v: unknown): AgendaException | null {
  if (!isObj(v)) return null;
  const out: AgendaException = {};
  if (v.deleted === true) out.deleted = true;
  if (v.status === 'done' || v.status === 'cancelled') out.status = v.status;
  if (DATE.test(str(v.date))) out.date = str(v.date);
  if (v.start === null || isClockTime(v.start)) out.start = v.start as string | null;
  const m = int(v.minutes, 0, MAX_EVENT_MIN);
  if (m !== null) out.minutes = m;
  if (str(v.title)) out.title = str(v.title).slice(0, 120);
  return Object.keys(out).length ? out : null;
}

/**
 * Convierte un objeto cualquiera (de una copia de seguridad) en una actividad válida, o null.
 * `id` y `ref` reescriben los identificadores igual que el resto de la copia.
 */
export function parseAgendaEvent(o: Obj, ids: { id: (v: unknown) => string; ref: (v: unknown) => string | null }, known: { habits: Set<string>; tasks: Set<string> }): AgendaEvent | null {
  if (!DATE.test(str(o.date))) return null;
  const start = o.start === null ? null : isClockTime(o.start) ? (o.start as string) : null;
  const habitId = ids.ref(o.habitId);
  const taskId = ids.ref(o.taskId);
  const now = new Date().toISOString();
  const exceptions = isObj(o.exceptions)
    ? Object.fromEntries(Object.entries(o.exceptions).flatMap(([k, v]) => {
        const ex = DATE.test(k) ? parseException(v) : null;
        return ex ? [[k, ex]] : [];
      }))
    : {};
  let repeat = parseRepeat(o.repeat);
  const linkedHabit = habitId && known.habits.has(habitId) ? habitId : null;
  if (repeat?.type === 'habit' && !linkedHabit) repeat = { type: 'daily', every: 1 };
  const ev: AgendaEvent = {
    id: ids.id(o.id),
    title: str(o.title).slice(0, 120),
    category: CATEGORY_IDS.includes(o.category as AgendaCategory) ? (o.category as AgendaCategory) : 'other',
    date: str(o.date),
    start,
    minutes: start === null ? 0 : (int(o.minutes, 0, MAX_EVENT_MIN) ?? 30),
    ...(repeat ? { repeat } : {}),
    ...(DATE.test(str(o.until)) ? { until: str(o.until) } : {}),
    ...(Object.keys(exceptions).length ? { exceptions } : {}),
    habitId: linkedHabit,
    taskId: taskId && known.tasks.has(taskId) ? taskId : null,
    ...(isAgendaColor(o.color) ? { color: o.color } : {}),
    ...(str(o.description) ? { description: str(o.description).slice(0, 2000) } : {}),
    ...(str(o.location) ? { location: str(o.location).slice(0, 200) } : {}),
    reminderMin: int(o.reminderMin, 0, 10080),
    pulseMin: start !== null ? int(o.pulseMin, 5, MAX_EVENT_MIN) : null,
    rev: int(o.rev, 0, Number.MAX_SAFE_INTEGER) ?? 0,
    createdAt: str(o.createdAt) || now,
    updatedAt: str(o.updatedAt) || now,
  };
  if (!ev.title.trim() && !ev.habitId && !ev.taskId) return null;
  return ev;
}
