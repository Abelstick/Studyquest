/**
 * La ficha del personaje: lo que muestra su pantalla, calculado del ledger y de lo que alimenta cada atributo.
 * Funciones puras; la pantalla solo las pinta.
 */
import type { AttributeId, Course, Goal, Habit, ID, ISODate, Project, Task, XpEvent } from '../domain';
import { addDays } from '../dates';
import { ATTRIBUTES, type AttributeDef } from './attributes';
import { attributeLevel, characterLevel, type LevelInfo } from './curve';
import { formaOn, isFormaLow } from './forma';
import { attributeTotals, dailyXp, idleDaysBefore, totalXp } from './ledger';
import { categoryIdOf } from './suggest';
import { categoryOf } from './categories';
import { courseMapping, goalMapping, habitMapping, projectMapping, taskMapping } from './sources';
import { titleFor, type TitleInfo } from './titles';
import { nextUnlock, type UnlockDef } from './unlocks';

export interface AttributeState {
  def: AttributeDef;
  xp: number;
  level: LevelInfo;
  /** Forma de hoy, 0–100. */
  forma: number;
  formaLow: boolean;
  /** Días completos sin actividad antes de hoy (0 si hubo ayer o hay hoy). null si nunca tuvo actividad. */
  idleDays: number | null;
  /** XP de los últimos 7 días (hoy incluido). */
  week: number;
  /** Título actual y el siguiente. */
  title: TitleInfo;
  /** Próximo desbloqueo (null si ya los tiene todos). */
  nextUnlock: UnlockDef | null;
}

export interface CharacterSheet {
  totalXp: number;
  level: LevelInfo;
  attributes: AttributeState[];
}

export function characterSheet(events: readonly XpEvent[], now: ISODate): CharacterSheet {
  const totals = attributeTotals(events);
  const from = addDays(now, -6);
  return {
    totalXp: totalXp(events),
    level: characterLevel(totalXp(events)),
    attributes: ATTRIBUTES.map((def) => {
      const forma = formaOn(events, def.id, now);
      const activeToday = events.some((e) => e.attribute === def.id && e.date === now && e.amount > 0);
      return {
        def,
        xp: totals[def.id],
        level: attributeLevel(totals[def.id]),
        forma,
        formaLow: isFormaLow(forma),
        idleDays: activeToday ? 0 : idleDaysBefore(events, def.id, now),
        week: events.filter((e) => e.attribute === def.id && e.date >= from && e.date <= now).reduce((a, e) => a + e.amount, 0),
        title: titleFor(def.id, attributeLevel(totals[def.id]).level),
        nextUnlock: nextUnlock(def.id, attributeLevel(totals[def.id]).level),
      };
    }),
  };
}

export type FeederKind = 'habit' | 'task' | 'course' | 'goal' | 'project';

export interface Feeder {
  kind: FeederKind;
  id: ID;
  title: string;
  /** Parte del XP de esa cosa que va a este atributo (0,7 · 0,3 · 1). */
  share: number;
  /** Nombre de la categoría (o «A mano» si el reparto es propio). */
  category: string;
}

interface Sources {
  tasks: readonly Task[];
  habits: readonly Habit[];
  courses: readonly Course[];
  goals: readonly Goal[];
  projects: readonly Project[];
}

const KIND_ORDER: Record<FeederKind, number> = { habit: 0, task: 1, course: 2, goal: 3, project: 4 };

/**
 * Qué alimenta a un atributo ahora mismo: los hábitos, las tareas ABIERTAS, los cursos, las metas y los proyectos
 * cuyo reparto lo incluye. Primero lo que más le da.
 */
export function feedersOf(attribute: AttributeId, s: Sources): Feeder[] {
  const out: Feeder[] = [];
  const add = (kind: FeederKind, item: { id: ID; title: string; attributes?: unknown }, primary: AttributeId, secondary: AttributeId | null, category: string) => {
    const share = primary === attribute ? (secondary && secondary !== primary ? 0.7 : 1) : secondary === attribute ? 0.3 : 0;
    if (share > 0) out.push({ kind, id: item.id, title: item.title, share, category: item.attributes ? 'A mano' : category });
  };
  const label = (item: Parameters<typeof categoryIdOf>[0]) => categoryOf(categoryIdOf(item)).label;
  for (const h of s.habits) {
    const m = habitMapping(h, s.courses);
    add('habit', h, m.primary, m.secondary, label(h));
  }
  for (const t of s.tasks) {
    if (t.status === 'done') continue;
    const m = taskMapping(t, s.courses);
    add('task', t, m.primary, m.secondary, label(t));
  }
  for (const c of s.courses) {
    const m = courseMapping(c);
    add('course', c, m.primary, m.secondary, label(c));
  }
  for (const g of s.goals) {
    const m = goalMapping(g);
    add('goal', g, m.primary, m.secondary, label(g));
  }
  for (const p of s.projects) {
    const m = projectMapping(p);
    add('project', p, m.primary, m.secondary, label(p));
  }
  return out.sort((a, b) => b.share - a.share || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.title.localeCompare(b.title));
}

/** XP diario de un atributo en los últimos `days` días (hoy incluido), del más antiguo al de hoy. */
export const attributeHistory = (events: readonly XpEvent[], attribute: AttributeId, days: number, now: ISODate) =>
  dailyXp(events, addDays(now, -(days - 1)), now, attribute);

/** Últimos movimientos de un atributo, del más reciente al más antiguo. */
export const recentOf = (events: readonly XpEvent[], attribute: AttributeId, limit = 8): XpEvent[] =>
  events
    .filter((e) => e.attribute === attribute && e.amount > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
