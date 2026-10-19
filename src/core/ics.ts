/**
 * Exporta la planificación a iCalendar (.ics, RFC 5545) para importarla en Google Calendar,
 * Outlook, Calendario de Apple u otro cliente compatible. Funciones puras: la pantalla solo descarga el texto.
 *
 * Es una EXPORTACIÓN, no una sincronización: el archivo es una foto del momento. Los UID son estables
 * (el id de la actividad o de la tarea), así que los clientes que lo admiten actualizan el evento al
 * reimportarlo en vez de duplicarlo, y SEQUENCE sube con cada cambio.
 *
 * - Actividades con hora: DTSTART/DTEND con TZID y un VTIMEZONE calculado para esa zona (con sus
 *   cambios de horario). Si no se conoce la zona, se usan horas «flotantes» (locales).
 * - Repeticiones: RRULE (+ EXDATE para las quitadas y VEVENT con RECURRENCE-ID para las cambiadas).
 * - Tareas con fecha límite: no se les inventa una duración. Sin hora, un evento de día completo;
 *   con hora, un evento puntual (sin DTEND) a esa hora, con aviso una hora antes.
 */
import type { AgendaEvent, Course, Habit, ISODate, Task } from './domain';
import { addDays, clockToMinutes, fromISODate, weekdayIndex } from './dates';
import { DAY_MIN, categoryInfo, displayTitle, occurrencesBetween, occursOn, repeatLabel, type AgendaContext } from './agenda';
import { dueTimeOf } from './tasks';

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
const icsDate = (d: string) => d.replaceAll('-', '');
const icsLocal = (d: string, minutes: number) => `${icsDate(d)}T${pad(Math.floor(minutes / 60))}${pad(minutes % 60)}00`;
const icsUtc = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
const BYDAY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

/** Escapa texto según RFC 5545: barra invertida, punto y coma, coma y saltos de línea. */
export const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Pliega una línea a 75 octetos como pide el estándar, sin partir un carácter UTF-8 por la mitad. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    // La primera línea admite 75 octetos; las de continuación, 74 más el espacio inicial.
    if (bytes + n > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

/* ---------- Zonas horarias ---------- */

const formatters = new Map<string, Intl.DateTimeFormat>();
const formatter = (tz: string) => {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    formatters.set(tz, f);
  }
  return f;
};

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz) return false;
  try {
    formatter(tz);
    return true;
  } catch {
    return false;
  }
}

/** Diferencia en minutos entre la hora local de `tz` y UTC en un instante dado (Lima = −300). */
export function tzOffsetMin(tz: string, ms: number): number {
  const p = Object.fromEntries(formatter(tz).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  const wall = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return Math.round((wall - Math.floor(ms / 1000) * 1000) / 60000);
}

/** Instante UTC de una hora local (`date` + minutos) en la zona `tz`. */
export function localToUtcMs(date: ISODate, minutes: number, tz: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  const first = guess - tzOffsetMin(tz, guess) * 60000;
  return guess - tzOffsetMin(tz, first) * 60000;
}

const offsetText = (min: number) => `${min < 0 ? '-' : '+'}${pad(Math.floor(Math.abs(min) / 60))}${pad(Math.abs(min) % 60)}`;

/**
 * VTIMEZONE de `tz` entre dos años: cada cambio de horario con su fecha exacta, y los del último año
 * con una regla anual para que las series sin fin sigan siendo correctas después.
 */
export function vtimezone(tz: string, fromYear: number, toYear: number): string[] {
  const DAY = 86_400_000;
  const start = Date.UTC(fromYear, 0, 1);
  const end = Date.UTC(toYear + 1, 0, 1);
  const initial = tzOffsetMin(tz, start);
  const changes: { ms: number; from: number; to: number }[] = [];
  let prev = initial;
  for (let t = start; t < end; t += DAY) {
    const next = tzOffsetMin(tz, t + DAY);
    if (next === prev) continue;
    let lo = t;
    let hi = t + DAY;
    while (hi - lo > 60_000) {
      const mid = lo + Math.floor((hi - lo) / 120_000) * 60_000;
      if (tzOffsetMin(tz, mid) === prev) lo = mid;
      else hi = mid;
    }
    changes.push({ ms: hi, from: prev, to: next });
    prev = next;
  }
  const standard = Math.min(initial, ...changes.map((c) => c.to));
  const block = (from: number, to: number, dtstart: string, rrule?: string) => {
    const type = to > standard ? 'DAYLIGHT' : 'STANDARD';
    return [`BEGIN:${type}`, `DTSTART:${dtstart}`, `TZOFFSETFROM:${offsetText(from)}`, `TZOFFSETTO:${offsetText(to)}`, ...(rrule ? [rrule] : []), `END:${type}`];
  };
  const lines = ['BEGIN:VTIMEZONE', `TZID:${tz}`, ...block(initial, initial, '19700101T000000')];
  for (const c of changes) {
    // DTSTART del cambio en la hora local de ANTES del cambio, como pide el estándar.
    const local = new Date(c.ms + c.from * 60000);
    const dtstart = icsUtc(local).slice(0, -1);
    let rrule: string | undefined;
    if (local.getUTCFullYear() === toYear) {
      const day = local.getUTCDate();
      const monthDays = new Date(Date.UTC(toYear, local.getUTCMonth() + 1, 0)).getUTCDate();
      const nth = day + 7 > monthDays ? -1 : Math.ceil(day / 7);
      rrule = `RRULE:FREQ=YEARLY;BYMONTH=${local.getUTCMonth() + 1};BYDAY=${nth}${BYDAY[(local.getUTCDay() + 6) % 7]}`;
    }
    lines.push(...block(c.from, c.to, dtstart, rrule));
  }
  lines.push('END:VTIMEZONE');
  return lines;
}

/* ---------- Representación neutra (sirve para .ics y, más adelante, para una API de calendario) ---------- */

export interface ExportOverride {
  original: ISODate;
  date: ISODate;
  start: number | null;
  minutes: number;
  title: string;
  cancelled: boolean;
}

export interface ExportEvent {
  kind: 'event';
  uid: string;
  title: string;
  description: string;
  location?: string;
  categories: string[];
  /** Actividad de la que sale (una serie expandida comparte grupo). */
  group?: string;
  /** Primera ocurrencia. */
  date: ISODate;
  start: number | null;
  minutes: number;
  rrule?: { freq: 'DAILY' | 'WEEKLY'; interval: number; byDay?: number[]; until?: ISODate };
  /** Fechas sueltas (para hábitos sin regla expresable): se exportan como RDATE. */
  rdates?: ISODate[];
  exdates?: ISODate[];
  overrides?: ExportOverride[];
  cancelled?: boolean;
  reminderMin?: number | null;
  pulseMin?: number | null;
  sequence: number;
  lastModified?: string;
}

export interface ExportDeadline {
  kind: 'deadline';
  uid: string;
  title: string;
  description: string;
  categories: string[];
  date: ISODate;
  /** Minutos del día de la hora límite; null = vence al terminar el día. */
  time: number | null;
}

export type ExportItem = ExportEvent | ExportDeadline;

export interface IcsOptions {
  /** Zona IANA («America/Lima»). Sin ella (o si no es válida), horas flotantes. */
  timeZone?: string | null;
  stamp?: Date;
  name?: string;
}

/* ---------- De la app a la representación neutra ---------- */

/** Tareas que van al calendario: abiertas y con fecha. */
export const exportableTasks = (tasks: Task[]): Task[] => tasks.filter((t) => t.status !== 'done' && !!t.dueDate);

export function taskDeadline(t: Task, courses: Pick<Course, 'id' | 'title'>[]): ExportDeadline {
  const time = dueTimeOf(t);
  const course = courses.find((c) => c.id === t.courseId)?.title ?? 'Side quest';
  return {
    kind: 'deadline',
    uid: `${t.id}@studyquest`,
    title: `${time ? '⏰' : '📌'} ${t.title}`,
    description: [`Fecha límite · ${course} · +${t.xp} XP`, ...t.subtasks.filter((s) => !s.done).map((s) => `- ${s.title}`)].join('\n'),
    categories: ['Fecha límite', ...t.tags],
    date: t.dueDate as string,
    time: time ? clockToMinutes(time) : null,
  };
}

/** Primera ocurrencia real de la serie (DTSTART debe ser una de ellas). */
function firstOccurrence(ev: AgendaEvent, habits: Habit[]): ISODate | null {
  for (let d = ev.date, i = 0; i < 800 && (!ev.until || d <= ev.until); d = addDays(d, 1), i++) if (occursOn(ev, d, habits)) return d;
  return null;
}

/** Lo común a todas las ocurrencias de una actividad: descripción, categorías, avisos y versión. */
function baseOf(ev: AgendaEvent, ctx: AgendaContext) {
  const habit = ev.habitId ? ctx.habits.find((h) => h.id === ev.habitId) : undefined;
  const task = ev.taskId ? ctx.tasks.find((t) => t.id === ev.taskId) : undefined;
  const cat = categoryInfo(ev.category);
  const description = [
    ev.description?.trim(),
    `${cat.icon} ${cat.label}${ev.repeat ? ` · ${repeatLabel(ev.repeat, habit)}` : ''}`,
    habit ? `Hábito: ${habit.title}` : '',
    task ? `Tarea: ${task.title}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const base = {
    kind: 'event' as const,
    group: ev.id,
    uid: `${ev.id}@studyquest`,
    title: displayTitle(ev, ctx),
    description,
    ...(ev.location?.trim() ? { location: ev.location.trim() } : {}),
    categories: [cat.label, ...(habit ? ['Hábito'] : []), ...(task ? ['Tarea'] : [])],
    start: ev.start === null ? null : clockToMinutes(ev.start),
    minutes: ev.minutes,
    reminderMin: ev.reminderMin ?? null,
    pulseMin: ev.pulseMin ?? null,
    sequence: ev.rev,
    lastModified: ev.updatedAt,
  };
  return { habit, base };
}

/**
 * Cada ocurrencia de la actividad dentro del rango como un evento suelto, sin regla de repetición. Es lo que entiende
 * cualquier calendario aunque no sepa expandir repeticiones: si trabajas de lunes a viernes, salen cinco eventos esa semana.
 * Cada uno lleva un id fijo (actividad + fecha), así que volver a importarlo actualiza en vez de duplicar. Lo cancelado no sale.
 */
export function expandEvent(ev: AgendaEvent, ctx: AgendaContext, range: { from: ISODate; to: ISODate }): ExportEvent[] {
  const { base } = baseOf(ev, ctx);
  return occurrencesBetween([ev], range.from, range.to, ctx)
    .filter((o) => o.status !== 'cancelled')
    .map((o) => ({ ...base, uid: `${ev.id}-${o.original}@studyquest`, title: o.title, date: o.date, start: o.start, minutes: o.minutes }));
}

export function eventToExport(ev: AgendaEvent, ctx: AgendaContext, range: { from: ISODate; to: ISODate }): ExportEvent | null {
  const { habit, base } = baseOf(ev, ctx);

  if (!ev.repeat) {
    const ex = ev.exceptions?.[ev.date];
    if (ex?.deleted) return null;
    return {
      ...base,
      date: ex?.date ?? ev.date,
      start: ex && ex.start !== undefined ? (ex.start === null ? null : clockToMinutes(ex.start)) : base.start,
      minutes: ex?.minutes ?? base.minutes,
      title: ex?.title || base.title,
      cancelled: ex?.status === 'cancelled',
    };
  }

  let rrule: ExportEvent['rrule'];
  let rdates: ISODate[] | undefined;
  const r = ev.repeat;
  if (r.type === 'daily') rrule = { freq: 'DAILY', interval: r.every };
  else if (r.type === 'weekly') rrule = { freq: 'WEEKLY', interval: r.every, byDay: r.days };
  else if (habit) {
    const f = habit.frequency;
    if (f.type === 'daily') rrule = { freq: 'DAILY', interval: 1 };
    else if (f.type === 'days') rrule = { freq: 'WEEKLY', interval: 1, byDay: f.days };
    else if (f.type === 'every') rrule = { freq: 'DAILY', interval: Math.max(1, f.every) };
    else if (f.type === 'weekly') rrule = { freq: 'WEEKLY', interval: 1, byDay: [weekdayIndex(habit.startDate)] };
    // Mensual, anual o fechas concretas: se exportan las fechas del rango, una a una.
    else rdates = [...new Set(occurrencesBetween([{ ...ev, exceptions: undefined }], range.from, range.to, ctx).map((o) => o.original))];
  }
  if (rrule && ev.until) rrule.until = ev.until;

  const first = rdates ? rdates[0] : firstOccurrence(ev, ctx.habits);
  if (!first) return null;
  const exdates: ISODate[] = [];
  const overrides: ExportOverride[] = [];
  for (const [original, ex] of Object.entries(ev.exceptions ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
    if (!occursOn(ev, original, ctx.habits)) continue;
    if (ex.deleted) exdates.push(original);
    else if (ex.date || ex.start !== undefined || ex.minutes !== undefined || ex.title || ex.status === 'cancelled') {
      const start = ex.start !== undefined ? ex.start : ev.start;
      overrides.push({
        original,
        date: ex.date ?? original,
        start: start === null ? null : clockToMinutes(start),
        minutes: ex.minutes ?? ev.minutes,
        title: ex.title || base.title,
        cancelled: ex.status === 'cancelled',
      });
    }
  }
  return {
    ...base,
    date: first,
    ...(rrule ? { rrule } : {}),
    ...(rdates && rdates.length > 1 ? { rdates: rdates.slice(1) } : {}),
    ...(exdates.length ? { exdates } : {}),
    ...(overrides.length ? { overrides } : {}),
  };
}

export interface ExportSelection {
  from: ISODate;
  to: ISODate;
  /** Incluir actividades programadas. */
  events: boolean;
  /** Incluir las fechas límite de tareas abiertas. */
  deadlines: boolean;
  /** Si se indica, solo estos ids (de actividades o de tareas), aunque estén fuera del rango. */
  ids?: Set<string>;
  /** Cada repetición como un evento propio dentro del rango, en vez de una regla de repetición. */
  expand?: boolean;
}

export interface ExportSource extends AgendaContext {
  events: AgendaEvent[];
  courses: Pick<Course, 'id' | 'title'>[];
}

/** Lo que entra en una exportación: actividades con alguna ocurrencia en el rango y fechas límite del rango. */
export function selectExport(src: ExportSource, sel: ExportSelection): ExportItem[] {
  const ctx: AgendaContext = { habits: src.habits, tasks: src.tasks, logs: src.logs };
  const out: ExportItem[] = [];
  if (sel.events) {
    for (const ev of src.events) {
      const picked = sel.ids ? sel.ids.has(ev.id) : occurrencesBetween([ev], sel.from, sel.to, ctx).length > 0;
      if (!picked) continue;
      if (sel.expand && ev.repeat) {
        out.push(...expandEvent(ev, ctx, sel));
        continue;
      }
      const item = eventToExport(ev, ctx, sel);
      if (item) out.push(item);
    }
  }
  if (sel.deadlines) {
    for (const t of exportableTasks(src.tasks)) {
      const picked = sel.ids ? sel.ids.has(t.id) : (t.dueDate as string) >= sel.from && (t.dueDate as string) <= sel.to;
      if (picked) out.push(taskDeadline(t, src.courses));
    }
  }
  return out;
}

/* ---------- Escritura del .ics ---------- */

const endOf = (date: ISODate, start: number, minutes: number) => ({ date: addDays(date, Math.floor((start + minutes) / DAY_MIN)), min: (start + minutes) % DAY_MIN });
const yearOf = (d: ISODate) => fromISODate(d).getFullYear();

export function buildCalendarIcs(items: ExportItem[], opts: IcsOptions = {}): string {
  const stamp = opts.stamp ?? new Date();
  const tz = isValidTimeZone(opts.timeZone) ? opts.timeZone : null;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//StudyQuest//Agenda//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${icsText(opts.name ?? 'StudyQuest')}`];
  if (tz) lines.push(`X-WR-TIMEZONE:${tz}`);

  const timed = items.some((i) => (i.kind === 'event' ? i.start !== null : i.time !== null));
  if (tz && timed) {
    const dates = items.flatMap((i) => [i.date, ...(i.kind === 'event' ? [i.rrule?.until ?? i.date, ...(i.rdates ?? []), ...(i.overrides ?? []).map((o) => o.date)] : [])]);
    const years = dates.map(yearOf);
    lines.push(...vtimezone(tz, Math.min(...years), Math.max(...years, stamp.getFullYear()) + 1));
  }

  /** «DTSTART;TZID=…:20261013T090000» o la versión de día completo / flotante. */
  const dt = (prop: string, date: ISODate, min: number | null) =>
    min === null ? `${prop};VALUE=DATE:${icsDate(date)}` : tz ? `${prop};TZID=${tz}:${icsLocal(date, min)}` : `${prop}:${icsLocal(date, min)}`;
  const until = (date: ISODate, allDay: boolean) => (allDay ? icsDate(date) : tz ? icsUtc(new Date(localToUtcMs(date, DAY_MIN - 1, tz) + 59_000)) : `${icsDate(date)}T235959`);
  const timing = (date: ISODate, start: number | null, minutes: number) => {
    if (start === null) return [dt('DTSTART', date, null), dt('DTEND', addDays(date, 1), null)];
    if (minutes <= 0) return [dt('DTSTART', date, start)];
    const end = endOf(date, start, minutes);
    return [dt('DTSTART', date, start), dt('DTEND', end.date, end.min)];
  };
  const alarms = (e: ExportEvent, title: string) => {
    const out: string[] = [];
    if (e.reminderMin != null) out.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(title)}`, e.reminderMin ? `TRIGGER:-PT${e.reminderMin}M` : 'TRIGGER:PT0M', 'END:VALARM');
    if (e.pulseMin && e.start !== null) {
      for (let k = 1, at = e.pulseMin; at < e.minutes && k <= 24; k++, at += e.pulseMin) out.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(title)}`, `TRIGGER:PT${at}M`, 'END:VALARM');
    }
    return out;
  };
  const common = (e: ExportEvent, title: string) => [
    `SUMMARY:${icsText(title)}`,
    ...(e.description ? [`DESCRIPTION:${icsText(e.description)}`] : []),
    ...(e.location ? [`LOCATION:${icsText(e.location)}`] : []),
    ...(e.categories.length ? [`CATEGORIES:${e.categories.map(icsText).join(',')}`] : []),
    `SEQUENCE:${e.sequence}`,
    ...(e.lastModified && !Number.isNaN(Date.parse(e.lastModified)) ? [`LAST-MODIFIED:${icsUtc(new Date(e.lastModified))}`] : []),
    `TRANSP:${e.start === null || e.minutes <= 0 ? 'TRANSPARENT' : 'OPAQUE'}`,
  ];

  for (const item of items) {
    lines.push('BEGIN:VEVENT', `UID:${item.uid}`, `DTSTAMP:${icsUtc(stamp)}`);
    if (item.kind === 'deadline') {
      lines.push(...(item.time === null ? [dt('DTSTART', item.date, null)] : [dt('DTSTART', item.date, item.time)]));
      lines.push(`SUMMARY:${icsText(item.title)}`, `DESCRIPTION:${icsText(item.description)}`, 'TRANSP:TRANSPARENT');
      if (item.categories.length) lines.push(`CATEGORIES:${item.categories.map(icsText).join(',')}`);
      if (item.time !== null) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(item.title)}`, 'TRIGGER:-PT1H', 'END:VALARM');
      lines.push('END:VEVENT');
      continue;
    }
    const e = item;
    lines.push(...timing(e.date, e.start, e.minutes), ...common(e, e.title));
    if (e.cancelled) lines.push('STATUS:CANCELLED');
    if (e.rrule) {
      const parts = [`FREQ=${e.rrule.freq}`];
      if (e.rrule.interval > 1) parts.push(`INTERVAL=${e.rrule.interval}`);
      if (e.rrule.byDay?.length) parts.push(`BYDAY=${[...e.rrule.byDay].sort((a, b) => a - b).map((d) => BYDAY[d]).join(',')}`);
      if (e.rrule.until) parts.push(`UNTIL=${until(e.rrule.until, e.start === null)}`);
      lines.push(`RRULE:${parts.join(';')}`);
    }
    for (const d of e.rdates ?? []) lines.push(dt('RDATE', d, e.start));
    for (const d of e.exdates ?? []) lines.push(dt('EXDATE', d, e.start));
    lines.push(...alarms(e, e.title), 'END:VEVENT');

    // Ocurrencias cambiadas: mismo UID y RECURRENCE-ID con la fecha (y hora) original.
    for (const o of e.overrides ?? []) {
      lines.push('BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${icsUtc(stamp)}`, dt('RECURRENCE-ID', o.original, e.start));
      lines.push(...timing(o.date, o.start, o.minutes), ...common({ ...e, start: o.start, minutes: o.minutes }, o.title));
      if (o.cancelled) lines.push('STATUS:CANCELLED');
      lines.push(...alarms({ ...e, start: o.start, minutes: o.minutes }, o.title), 'END:VEVENT');
    }
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/** Atajo: solo las fechas límite de las tareas abiertas. */
export function buildIcs(tasks: Task[], courses: Pick<Course, 'id' | 'title'>[], stamp: Date = new Date(), timeZone: string | null = null): string {
  return buildCalendarIcs(exportableTasks(tasks).map((t) => taskDeadline(t, courses)), { stamp, timeZone, name: 'StudyQuest · Tareas' });
}

/** Una sola actividad (con su serie completa). */
export function buildEventIcs(ev: AgendaEvent, src: Omit<ExportSource, 'events'>, opts: IcsOptions = {}): string | null {
  // El rango solo importa para los hábitos sin regla expresable (se exportan sus fechas una a una): hasta fin del año que viene.
  const to = ev.until ?? `${new Date().getFullYear() + 1}-12-31`;
  const item = eventToExport(ev, { habits: src.habits, tasks: src.tasks, logs: src.logs }, { from: ev.date, to });
  return item ? buildCalendarIcs([item], { ...opts, name: opts.name ?? displayTitle(ev, src) }) : null;
}

