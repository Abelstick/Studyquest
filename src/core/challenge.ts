/**
 * Reto del mes: una meta numérica que te pones (días de estudio, horas, tareas o XP) con premio en monedas.
 * El avance se calcula de tus datos; lo único que se guarda es el reto y si ya cobraste el premio. Un reto
 * solo cuenta durante su mes. Funciones puras.
 */
import type { ChallengeKind, ISODate, MonthChallenge, StudySession, Task, XpEvent } from './domain';
import { fromISODate, monthKey, today, toISODate } from './dates';

export interface ChallengeOption {
  kind: ChallengeKind;
  label: string;
  unit: string;
  /** Metas sugeridas, de menos a más exigente. */
  presets: number[];
  /** Monedas de premio por cada unidad de la meta. */
  coinsPerUnit: number;
}

export const CHALLENGES: ChallengeOption[] = [
  { kind: 'studyDays', label: 'Días de estudio', unit: 'días', presets: [10, 15, 20], coinsPerUnit: 10 },
  { kind: 'studyHours', label: 'Horas de estudio', unit: 'h', presets: [10, 20, 30], coinsPerUnit: 12 },
  { kind: 'tasks', label: 'Tareas completadas', unit: 'tareas', presets: [10, 20, 30], coinsPerUnit: 6 },
  { kind: 'xp', label: 'XP ganado', unit: 'XP', presets: [1000, 2000, 3000], coinsPerUnit: 0.1 },
];

export const challengeOption = (kind: ChallengeKind): ChallengeOption => CHALLENGES.find((c) => c.kind === kind) ?? CHALLENGES[0];

/** Un reto nuevo para el mes de `now`, con el premio ya calculado. `base` es lo que ya llevas del mes (no cuenta). */
export function newChallenge(kind: ChallengeKind, target: number, now: ISODate = today(), base = 0): MonthChallenge {
  const t = Math.max(1, Math.round(target));
  return { month: monthKey(now), kind, target: t, reward: Math.round(t * challengeOption(kind).coinsPerUnit), ...(base > 0 ? { base } : {}) };
}

export interface ChallengeProgress {
  /** Lo logrado este mes, en la unidad del reto (las horas con un decimal). */
  value: number;
  /** 0-100, sin pasar de 100. */
  pct: number;
  done: boolean;
  /** El reto es de este mes. Uno de un mes anterior queda como historial y no se puede cobrar. */
  current: boolean;
  /** Días que quedan del mes, hoy incluido. */
  daysLeft: number;
  /** Cumplido y con el premio sin cobrar. */
  claimable: boolean;
}

interface Source {
  sessions: StudySession[];
  tasks: Task[];
  xpEvents: XpEvent[];
}

/** Lo que llevas de un tipo de reto en un mes, sin descontar nada. */
export function monthValue(kind: ChallengeKind, month: string, s: Source): number {
  const inMonth = (d: ISODate | null) => !!d && monthKey(d) === month;
  if (kind === 'studyDays') return new Set(s.sessions.filter((x) => inMonth(x.date)).map((x) => x.date)).size;
  if (kind === 'studyHours') return Math.round((s.sessions.filter((x) => inMonth(x.date)).reduce((a, x) => a + x.minutes, 0) / 60) * 10) / 10;
  if (kind === 'tasks') return s.tasks.filter((t) => t.status === 'done' && inMonth(t.completedAt)).length;
  return Math.max(0, s.xpEvents.filter((e) => inMonth(e.date)).reduce((a, e) => a + e.amount, 0));
}

export function challengeProgress(c: MonthChallenge, s: Source, now: ISODate = today()): ChallengeProgress {
  // Solo cuenta lo logrado desde que fijaste el reto.
  const value = Math.max(0, Math.round((monthValue(c.kind, c.month, s) - (c.base ?? 0)) * 10) / 10);

  const current = c.month === monthKey(now);
  const done = value >= c.target;
  const d = fromISODate(now);
  const daysLeft = current ? new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate() + 1 : 0;
  return { value, pct: Math.min(100, Math.round((value / c.target) * 100)), done, current, daysLeft, claimable: current && done && !c.claimed };
}

/** Un reto leído de una copia de seguridad o de datos viejos, o undefined si no es válido. */
export function cleanChallenge(raw: unknown): MonthChallenge | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const o = raw as Record<string, unknown>;
  const kind = CHALLENGES.find((c) => c.kind === o.kind)?.kind;
  if (!kind || typeof o.month !== 'string' || !/^\d{4}-\d{2}$/.test(o.month)) return undefined;
  const target = typeof o.target === 'number' && Number.isFinite(o.target) ? Math.min(100_000, Math.max(1, Math.round(o.target))) : 0;
  const reward = typeof o.reward === 'number' && Number.isFinite(o.reward) ? Math.min(100_000, Math.max(0, Math.round(o.reward))) : 0;
  if (!target) return undefined;
  const base = typeof o.base === 'number' && Number.isFinite(o.base) && o.base > 0 ? Math.min(1_000_000, o.base) : 0;
  return { month: o.month, kind, target, reward, ...(base ? { base } : {}), ...(o.claimed === true ? { claimed: true } : {}) };
}

/** Texto de la meta: «15 días», «20 h», «2.000 XP». */
export const targetText = (c: Pick<MonthChallenge, 'kind' | 'target'>): string => `${c.target.toLocaleString('es')} ${challengeOption(c.kind).unit}`;

/** Último día del mes de un reto, útil para mostrar «hasta el 30». */
export const monthEnd = (month: string): ISODate => toISODate(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0));
