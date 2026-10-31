/**
 * Cuánto XP da una acción y a qué atributos. Devuelve las filas del ledger que deben existir para esa
 * acción; el store las aplica con `applyGrant` (idempotente por clave) y las deshace con `splitRevert`.
 *
 * Fórmula por atributo:  round(base · reparto · avance · (1 + racha + primera + regreso + forma)) + fijo
 * - reparto: 70 % primario / 30 % secundario (100 % si no hay secundario).
 * - racha: +5 % por cada 7 días, con tope +25 %.
 * - primera: +10 % si es la primera acción del día en ese atributo.
 * - regreso: +20 % si el atributo llevaba 3 días completos o más sin actividad.
 * - forma: −10 % si la Forma del atributo empezó el día por debajo del 50 %.
 * - fijo (solo Disciplina y solo al completar): +2 con la racha viva, +5 si una tarea se cumplió a tiempo.
 */
import type { AttributeId, AttributeMapping, ISODate, XpEvent, XpMultipliers, XpSource } from '../domain';
import { DISCIPLINE, FORMA, MULTIPLIERS, SPLIT } from './config';
import { formaBefore, isFormaLow } from './forma';
import { idleDaysBefore } from './ledger';

export interface ActionSpec {
  source: XpSource;
  sourceId: string;
  date: ISODate;
  label: string;
  /** XP base antes de repartir (el de la dificultad, el de un tema…). */
  base: number;
  mapping: AttributeMapping;
  /** 0–1. Un hábito a medias da su parte; el resto de acciones, 1. */
  progress?: number;
  /** Tarea cumplida sin pasarse de la fecha límite. */
  onTime?: boolean;
}

export interface GrantContext {
  /** El ledger actual. */
  events: readonly XpEvent[];
  /** Racha global actual (días seguidos con XP). */
  streak: number;
  newId: () => string;
}

/** Bonus de racha: +5 % por cada 7 días, con tope. */
export const streakMultiplier = (streak: number): number =>
  Math.min(MULTIPLIERS.streakCap, Math.floor(Math.max(0, streak) / 7) * MULTIPLIERS.streakPerWeek);

/** Reparto del XP base entre atributos. */
export function shares(mapping: AttributeMapping): { attribute: AttributeId; share: number }[] {
  if (!mapping.secondary || mapping.secondary === mapping.primary) return [{ attribute: mapping.primary, share: 1 }];
  return [
    { attribute: mapping.primary, share: SPLIT.primary },
    { attribute: mapping.secondary, share: SPLIT.secondary },
  ];
}

const sameAction = (e: XpEvent, s: Pick<ActionSpec, 'source' | 'sourceId' | 'date'>) => e.source === s.source && e.sourceId === s.sourceId && e.date === s.date;

/** Multiplicadores de un atributo para una acción, mirando solo el resto del ledger (no la acción misma). */
export function multipliersFor(attribute: AttributeId, date: ISODate, others: readonly XpEvent[], streak: number): Pick<XpMultipliers, 'streak' | 'first' | 'comeback' | 'forma'> {
  const first = others.some((e) => e.attribute === attribute && e.date === date && e.amount > 0) ? 0 : MULTIPLIERS.firstOfDay;
  const idle = idleDaysBefore(others, attribute, date);
  const comeback = idle !== null && idle >= MULTIPLIERS.comebackIdleDays ? MULTIPLIERS.comeback : 0;
  const forma = isFormaLow(formaBefore(others, attribute, date)) ? FORMA.lowPenalty : 0;
  return { streak: streakMultiplier(streak), first, comeback, forma };
}

export const totalMultiplier = (m: Pick<XpMultipliers, 'streak' | 'first' | 'comeback' | 'forma'>): number => Math.max(0, 1 + m.streak + m.first + m.comeback + m.forma);

/**
 * Filas que debe tener el ledger para esta acción. Si la acción ya tenía filas (un hábito que avanza),
 * se reutilizan sus multiplicadores: subir de 6 a 8 vasos no cambia si fue «la primera del día».
 * Una acción sin XP (avance 0) devuelve [] y el store borra lo que hubiera.
 */
export function planAction(spec: ActionSpec, ctx: GrantContext): XpEvent[] {
  const progress = Math.max(0, Math.min(1, spec.progress ?? 1));
  const others = ctx.events.filter((e) => !sameAction(e, spec));
  const previous = new Map(ctx.events.filter((e) => sameAction(e, spec)).map((e) => [e.attribute, e]));
  const complete = progress >= 1;
  const flatDis = complete ? (ctx.streak > 0 ? DISCIPLINE.streakBonus : 0) + (spec.onTime ? DISCIPLINE.onTimeBonus : 0) : 0;

  const parts = shares(spec.mapping);
  if (flatDis > 0 && !parts.some((p) => p.attribute === 'dis')) parts.push({ attribute: 'dis', share: 0 });

  const rows: XpEvent[] = [];
  for (const { attribute, share } of parts) {
    const prev = previous.get(attribute)?.mult;
    const m = prev ?? multipliersFor(attribute, spec.date, others, ctx.streak);
    const flat = attribute === 'dis' ? flatDis : 0;
    const amount = Math.round(spec.base * share * progress * totalMultiplier(m)) + flat;
    if (amount <= 0) continue;
    rows.push({
      id: previous.get(attribute)?.id ?? ctx.newId(),
      date: spec.date,
      attribute,
      amount,
      source: spec.source,
      sourceId: spec.sourceId,
      label: spec.label,
      mult: { share, streak: m.streak, first: m.first, comeback: m.comeback, forma: m.forma, progress, flat },
    });
  }
  return rows;
}

export interface BonusSpec {
  source: XpSource;
  sourceId: string;
  date: ISODate;
  label: string;
  attribute: AttributeId;
  amount: number;
}

/** Un bono fijo (combo, cadena, cofre…): va entero a un atributo, sin reparto ni multiplicadores. */
export function planBonus(spec: BonusSpec, ctx: Pick<GrantContext, 'events' | 'newId'>): XpEvent[] {
  if (spec.amount <= 0) return [];
  const prev = ctx.events.find((e) => sameAction(e, spec) && e.attribute === spec.attribute);
  return [{ id: prev?.id ?? ctx.newId(), date: spec.date, attribute: spec.attribute, amount: Math.round(spec.amount), source: spec.source, sourceId: spec.sourceId, label: spec.label }];
}
