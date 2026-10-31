/**
 * El ledger de XP como fuente de verdad: claves idempotentes, otorgar, revertir y totales derivados.
 * Funciones puras; el store aplica lo que devuelven y el adaptador lo guarda con la misma semántica.
 */
import type { AttributeId, ISODate, XpEvent, XpSource } from '../domain';
import { addDays, diffDays } from '../dates';
import { ATTRIBUTE_IDS, perAttribute } from './attributes';

/** Clave única de una fila: otorgar dos veces lo mismo la reemplaza en vez de duplicarla. */
export const xpKey = (e: Pick<XpEvent, 'source' | 'sourceId' | 'date' | 'attribute'>): string => `${e.source}|${e.sourceId}|${e.date}|${e.attribute}`;

/** Qué se revierte: todo lo de un origen, o solo lo de un día (un hábito se deshace por día). */
export interface XpRef {
  source: XpSource;
  sourceId: string;
  date?: ISODate;
}

export const matchesRef = (e: XpEvent, ref: XpRef): boolean => e.source === ref.source && e.sourceId === ref.sourceId && (ref.date === undefined || e.date === ref.date);

/** Aplica filas nuevas: cada una reemplaza a la que tenga su misma clave (y conserva el id de la que ya estaba). */
export function applyGrant(events: XpEvent[], rows: XpEvent[]): XpEvent[] {
  if (!rows.length) return events;
  const incoming = new Map(rows.map((r) => [xpKey(r), r]));
  const out: XpEvent[] = [];
  for (const e of events) {
    const k = xpKey(e);
    const r = incoming.get(k);
    if (!r) out.push(e);
    else {
      out.push({ ...r, id: e.id });
      incoming.delete(k);
    }
  }
  return [...out, ...incoming.values()];
}

/** Separa lo que se queda de lo que se revierte. */
export function splitRevert(events: XpEvent[], ref: XpRef): { kept: XpEvent[]; removed: XpEvent[] } {
  const kept: XpEvent[] = [];
  const removed: XpEvent[] = [];
  for (const e of events) (matchesRef(e, ref) ? removed : kept).push(e);
  return { kept, removed };
}

/** ¿Dos grupos de filas dicen lo mismo (mismas claves y montos)? Sirve para no guardar un cambio que no cambia nada. */
export function sameRows(a: readonly XpEvent[], b: readonly XpEvent[]): boolean {
  if (a.length !== b.length) return false;
  const amounts = new Map(a.map((e) => [xpKey(e), e.amount]));
  return b.every((e) => amounts.get(xpKey(e)) === e.amount);
}

export const sumXp =(events: readonly Pick<XpEvent, 'amount'>[]): number => events.reduce((a, e) => a + e.amount, 0);

/** XP total del personaje (la suma de todos los atributos). */
export const totalXp = (events: readonly XpEvent[]): number => sumXp(events);

export function attributeTotals(events: readonly XpEvent[]): Record<AttributeId, number> {
  const out = perAttribute(() => 0);
  for (const e of events) if (e.attribute in out) out[e.attribute] += e.amount;
  return out;
}

/** Diferencia por atributo entre dos estados del ledger (para el toast «+14 XP Intelecto · +6 XP Disciplina»). */
export function attributeDelta(before: readonly XpEvent[], after: readonly XpEvent[]): Partial<Record<AttributeId, number>> {
  const a = attributeTotals(before);
  const b = attributeTotals(after);
  const out: Partial<Record<AttributeId, number>> = {};
  for (const id of ATTRIBUTE_IDS) if (b[id] !== a[id]) out[id] = b[id] - a[id];
  return out;
}

/** Días (locales) con actividad en un atributo, sin repetir. */
export const activeDaysOf = (events: readonly XpEvent[], attribute: AttributeId): Set<ISODate> =>
  new Set(events.filter((e) => e.attribute === attribute && e.amount > 0).map((e) => e.date));

/** Último día con actividad en el atributo ANTES de `before` (exclusivo), o null. */
export function lastActiveBefore(events: readonly XpEvent[], attribute: AttributeId, before: ISODate): ISODate | null {
  let last: ISODate | null = null;
  for (const e of events) if (e.attribute === attribute && e.amount > 0 && e.date < before && (!last || e.date > last)) last = e.date;
  return last;
}

/** Días completos sin actividad entre el último día activo y `day` (0 si fue ayer). null si nunca hubo actividad. */
export function idleDaysBefore(events: readonly XpEvent[], attribute: AttributeId, day: ISODate): number | null {
  const last = lastActiveBefore(events, attribute, day);
  return last ? Math.max(0, diffDays(day, last) - 1) : null;
}

/** XP de cada día del rango [from, to], para el historial de un atributo (o de todos, sin atributo). */
export function dailyXp(events: readonly XpEvent[], from: ISODate, to: ISODate, attribute?: AttributeId): { date: ISODate; xp: number }[] {
  const per = new Map<ISODate, number>();
  for (const e of events) if ((!attribute || e.attribute === attribute) && e.date >= from && e.date <= to) per.set(e.date, (per.get(e.date) ?? 0) + e.amount);
  const out: { date: ISODate; xp: number }[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push({ date: d, xp: per.get(d) ?? 0 });
  return out;
}

/** Acciones distintas (una por origen y día), para contar logros sin que el reparto en atributos las duplique. */
export function distinctActions(events: readonly XpEvent[], pick: (e: XpEvent) => boolean = () => true): XpEvent[] {
  const seen = new Map<string, XpEvent>();
  for (const e of events) {
    if (!pick(e)) continue;
    const k = `${e.source}|${e.sourceId}|${e.date}`;
    if (!seen.has(k)) seen.set(k, e);
  }
  return [...seen.values()];
}

export const XP_SOURCES: readonly XpSource[] = ['task', 'habit', 'topic', 'session', 'milestone', 'checkpoint', 'bonus', 'review', 'combo', 'certification'];
export const isXpSource = (v: unknown): v is XpSource => typeof v === 'string' && (XP_SOURCES as readonly string[]).includes(v);
