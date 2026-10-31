/**
 * Los atributos en la semana: cuánto creció cada uno, cuál fue el fuerte y cuál se quedó quieto, con un mensaje que
 * anima en lugar de reñir (no se pierde nada por una semana floja). Puro: lo usan la revisión semanal y el push.
 */
import type { AttributeId, ISODate, XpEvent } from '../domain';
import { addDays } from '../dates';
import { ATTRIBUTES, type AttributeDef } from './attributes';
import { attributeLevel } from './curve';
import { attributeTotals } from './ledger';

export interface AttributeWeekRow {
  def: AttributeDef;
  /** XP ganado en la semana. */
  xp: number;
  /** El de la semana anterior, para la tendencia. */
  prevXp: number;
  /** Nivel al terminar la semana y cuántos subió en ella. */
  level: number;
  levelsUp: number;
}

export interface AttributeWeek {
  rows: AttributeWeekRow[];
  total: number;
  /** El que más creció (null si la semana no dio XP). */
  top: AttributeWeekRow | null;
  /** El más descuidado de los que ya habías entrenado (null si no hay uno que destaque). */
  neglected: AttributeWeekRow | null;
  /** Una o dos frases para leer de un vistazo. */
  message: string;
}

const sumIn = (events: readonly XpEvent[], from: ISODate, to: ISODate, attr: AttributeId) =>
  events.reduce((a, e) => (e.attribute === attr && e.date >= from && e.date <= to ? a + e.amount : a), 0);

/** Un atributo «descuidado» ganó menos de esta parte de lo que ganó el fuerte. */
const NEGLECT_RATIO = 0.25;

/** Resumen de los atributos en la semana `from`…`from + 6`. */
export function attributeWeek(events: readonly XpEvent[], from: ISODate): AttributeWeek {
  const to = addDays(from, 6);
  const before = attributeTotals(events.filter((e) => e.date < from));
  const after = attributeTotals(events.filter((e) => e.date <= to));
  const rows = ATTRIBUTES.map((def): AttributeWeekRow => {
    const level = attributeLevel(after[def.id]).level;
    return {
      def,
      xp: sumIn(events, from, to, def.id),
      prevXp: sumIn(events, addDays(from, -7), addDays(from, -1), def.id),
      level,
      levelsUp: level - attributeLevel(before[def.id]).level,
    };
  });
  const total = rows.reduce((a, r) => a + r.xp, 0);
  const top = total > 0 ? rows.reduce((a, r) => (r.xp > a.xp ? r : a), rows[0]) : null;
  // Solo cuenta como descuidado lo que ya habías entrenado antes: un atributo que nunca usaste no es una falta.
  const trained = top ? rows.filter((r) => r !== top && before[r.def.id] > 0 && r.xp < top.xp * NEGLECT_RATIO) : [];
  const neglected = trained.length ? trained.reduce((a, r) => (r.xp < a.xp || (r.xp === a.xp && r.prevXp > a.prevXp) ? r : a), trained[0]) : null;
  return { rows, total, top, neglected, message: weekMessage(top, neglected) };
}

function weekMessage(top: AttributeWeekRow | null, neglected: AttributeWeekRow | null): string {
  if (!top) return 'Semana tranquila: tus atributos siguen intactos. Cualquier hábito pequeño los vuelve a poner en marcha.';
  const lead = top.levelsUp > 0 ? `${top.def.emoji} ${top.def.name} fue tu fuerte: +${top.xp} XP y subió al nivel ${top.level}.` : `${top.def.emoji} ${top.def.name} fue tu fuerte: +${top.xp} XP.`;
  if (!neglected) return `${lead} Buen equilibrio en el resto.`;
  const nudge = neglected.xp > 0 ? `${neglected.def.name} creció poco (+${neglected.xp} XP)` : `${neglected.def.name} descansó esta semana`;
  return `${lead} ${nudge}. Para la próxima: ${neglected.def.hint.charAt(0).toLowerCase()}${neglected.def.hint.slice(1)}`;
}
