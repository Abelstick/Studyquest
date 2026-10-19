/**
 * Cruces de horario: dos bloques del calendario que se pisan. Los hay normales (una reunión dentro de la jornada) y los
 * que conviene arreglar: el rato que reservaste para una tarea o un hábito justo cuando tienes otra cosa. Solo se
 * señalan estos últimos, porque son los que se pueden mover solos: el trabajo, una clase o una cita no se tocan nunca.
 *
 * Mover es un cambio de UNA ocurrencia (el bloque de ese día), nunca de toda la serie. Lógica pura, sin React ni base de datos.
 */
import type { AgendaEvent, ISODate, Snapshot } from './domain';
import { addDays, clockToMinutes, diffDays, isClockTime, today } from './dates';
import { DAY_MIN, occurrencesBetween, segmentsOn, toClock, type Occurrence } from './agenda';
import { SLEEP_TITLE, freeWindows, wakingOf, type Window } from './routine';

type Ctx = Pick<Snapshot, 'events' | 'habits' | 'tasks' | 'habitLogs'>;

export interface Conflict {
  /** Identifica el cruce: el bloque movible y el día. */
  key: string;
  date: ISODate;
  /** El bloque que se puede mover: el de una tarea o un hábito. */
  movable: Occurrence;
  /** Con qué se cruza. */
  others: Occurrence[];
  /** Tramo del día en que se pisan (minutos desde medianoche). */
  overlap: Window;
}

const linked = (o: Occurrence) => !!(o.event.taskId || o.event.habitId);
const isSleep = (o: Occurrence) => o.event.title === SLEEP_TITLE && o.event.category === 'rest';

/**
 * Los cruces entre `from` y `to` que involucran un bloque de tarea o de hábito aún pendiente. Si dos bloques movibles se
 * pisan, se propone mover el de la tarea (o, si son del mismo tipo, el que empieza más tarde). Un bloque que se pisa
 * con varios sale una sola vez, con todos ellos.
 */
export function findConflicts(ctx: Ctx, from: ISODate, to: ISODate): Conflict[] {
  const occs = occurrencesBetween(ctx.events, addDays(from, -1), to, { habits: ctx.habits, tasks: ctx.tasks, logs: ctx.habitLogs }).filter(
    (o) => o.start !== null && o.minutes > 0 && o.status !== 'cancelled' && !isSleep(o),
  );
  const found = new Map<string, Conflict>();
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const segs = segmentsOn(occs, d).sort((a, b) => a.start - b.start);
    for (let i = 0; i < segs.length; i++) {
      for (let j = i + 1; j < segs.length; j++) {
        const a = segs[i];
        const b = segs[j];
        if (b.start >= a.end) break;
        if (a.occ.key === b.occ.key) continue;
        const pending = [a, b].filter((s) => linked(s.occ) && s.occ.status === 'pending');
        if (!pending.length) continue;
        // De dos movibles, se mueve el de la tarea; si son iguales, el que empieza más tarde.
        const mover = pending.length === 1 ? pending[0] : (pending.find((s) => s.occ.event.taskId) ?? pending.sort((x, y) => y.start - x.start)[0]);
        const other = mover === a ? b : a;
        const key = `${mover.occ.key}@${d}`;
        const cur = found.get(key);
        if (cur) cur.others.push(other.occ);
        else found.set(key, { key, date: d, movable: mover.occ, others: [other.occ], overlap: { start: Math.max(a.start, b.start), end: Math.min(a.end, b.end) } });
      }
    }
  }
  return [...found.values()].sort((x, y) => x.date.localeCompare(y.date) || x.overlap.start - y.overlap.start);
}

export interface Move {
  date: ISODate;
  /** «HH:MM». */
  start: string;
}

/** Nadie quiere estudiar de madrugada: una tarea se mueve a partir de esta hora. */
const TASK_FROM = 9 * 60;
const STEP = 15;

/**
 * Dónde poner el bloque en vez de donde está: el hueco libre más cercano a su hora, el mismo día si cabe y, si no, el
 * siguiente (hasta el plazo de la tarea, o 2 días para un hábito). Null si no hay dónde. Hoy solo cuenta lo que queda
 * desde ahora. No toca nada: devuelve la propuesta.
 */
export function suggestMove(ctx: Ctx, c: Conflict, now: ISODate = today(), nowMin = 0): Move | null {
  const m = c.movable;
  const ev = m.event;
  // Sin el propio bloque, que si no se estorbaría a sí mismo.
  const events: AgendaEvent[] = ctx.events.map((e) => (e.id === ev.id ? { ...e, exceptions: { ...e.exceptions, [m.original]: { ...(e.exceptions?.[m.original] ?? {}), deleted: true } } } : e));
  const rest: Ctx = { ...ctx, events };
  const task = ev.taskId ? ctx.tasks.find((t) => t.id === ev.taskId) : undefined;
  const limit = task?.dueDate && task.dueDate >= c.date ? task.dueDate : addDays(c.date, 2);
  const origin = m.start as number;

  for (let d = c.date, i = 0; d <= limit && i < 14; d = addDays(d, 1), i++) {
    if (d < now) continue;
    let best: { start: number; dist: number } | null = null;
    for (const w of freeWindows(rest, d, wakingOf(ctx.events), m.minutes)) {
      const lo = Math.max(w.start, ev.taskId ? TASK_FROM : 0, d === now ? Math.ceil(nowMin / STEP) * STEP : 0);
      let hi = w.end - m.minutes;
      // El último día, con hora límite, la sesión debe terminar antes.
      if (task?.dueDate === d && isClockTime(task.dueTime)) hi = Math.min(hi, clockToMinutes(task.dueTime) - m.minutes);
      if (hi < lo) continue;
      const start = Math.min(hi, Math.max(lo, Math.round(origin / STEP) * STEP));
      const aligned = Math.min(hi, Math.ceil(start / STEP) * STEP);
      const dist = Math.abs(aligned - origin) + (d === c.date ? 0 : DAY_MIN * diffDays(d, c.date));
      if (!best || dist < best.dist) best = { start: aligned, dist };
    }
    if (best && best.start >= 0) return { date: d, start: toClock(best.start) };
  }
  return null;
}
