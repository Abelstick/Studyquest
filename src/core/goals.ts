/**
 * Metas con criterio SMART (específica, medible, alcanzable, relevante y con plazo) sobre el modelo que ya existe.
 * Una meta guarda su plazo, cómo se mide y por qué importa; las acciones que la ejecutan son tareas y hábitos
 * normales que apuntan a ella con `goalId`. Nada se copia: el avance de la meta sigue siendo el de sus hitos y
 * el de cada acción, el de su tarea o su hábito. Lógica pura.
 */
import type { Goal, Habit, HabitLog, ISODate, Task } from './domain';
import { diffDays, today } from './dates';
import { monthlyCompliance } from './game';

export interface GoalActions {
  tasks: Task[];
  habits: Habit[];
}

/** Tareas y hábitos que aportan a la meta. Los hábitos de dejar un vicio cuentan igual: también son acciones. */
export function goalActions(goalId: string, s: { tasks: Task[]; habits: Habit[] }): GoalActions {
  return { tasks: s.tasks.filter((t) => t.goalId === goalId), habits: s.habits.filter((h) => h.goalId === goalId) };
}

export interface MilestoneProgress {
  done: number;
  total: number;
  pct: number;
}

export function milestoneProgress(goal: Pick<Goal, 'milestones'>): MilestoneProgress {
  const total = goal.milestones.length;
  const done = goal.milestones.filter((m) => m.done).length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

export const isGoalComplete = (goal: Pick<Goal, 'milestones'>): boolean => goal.milestones.length > 0 && goal.milestones.every((m) => m.done);

/** Resumen del ritmo de las acciones de una meta, con los indicadores de siempre (tareas hechas, cumplimiento de hábitos a 30 días). */
export function actionsSummary(a: GoalActions, logs: HabitLog[], now: ISODate = today()) {
  const tasksDone = a.tasks.filter((t) => t.status === 'done').length;
  const habits = a.habits.map((h) => ({ habit: h, pct: monthlyCompliance(h, logs, now) }));
  return { tasksDone, tasksTotal: a.tasks.length, habits };
}

export type PaceState = 'none' | 'done' | 'overdue' | 'ahead' | 'on-track' | 'behind';

export interface GoalPace {
  state: PaceState;
  /** Qué parte del plazo ya pasó (0-100). */
  elapsedPct: number;
  /** Qué parte de los hitos está hecha (0-100). */
  donePct: number;
  /** Días hasta el plazo (negativo si ya pasó). */
  daysLeft: number | null;
}

/** Margen de tolerancia, en puntos porcentuales, antes de decir que vas adelantado o atrasado. */
const PACE_MARGIN = 10;

/**
 * Ritmo frente al plazo: compara cuánto del tiempo pasó con cuántos hitos llevas. Es un aviso, no una nota:
 * sin plazo (o sin hitos) no hay ritmo que juzgar.
 */
export function goalPace(goal: Pick<Goal, 'milestones' | 'deadline' | 'createdAt'>, now: ISODate = today()): GoalPace {
  const { pct: donePct } = milestoneProgress(goal);
  const daysLeft = goal.deadline ? diffDays(goal.deadline, now) : null;
  if (isGoalComplete(goal)) return { state: 'done', elapsedPct: 100, donePct, daysLeft };
  if (!goal.deadline || !goal.milestones.length) return { state: 'none', elapsedPct: 0, donePct, daysLeft };
  if ((daysLeft ?? 0) < 0) return { state: 'overdue', elapsedPct: 100, donePct, daysLeft };
  const start = goal.createdAt.slice(0, 10) <= goal.deadline ? goal.createdAt : goal.deadline;
  const span = Math.max(1, diffDays(goal.deadline, start));
  const elapsedPct = Math.min(100, Math.max(0, Math.round((diffDays(now, start) / span) * 100)));
  const state: PaceState = donePct >= elapsedPct + PACE_MARGIN ? 'ahead' : donePct >= elapsedPct - PACE_MARGIN ? 'on-track' : 'behind';
  return { state, elapsedPct, donePct, daysLeft };
}

export const PACE_TEXT: Record<PaceState, string> = {
  none: 'Sin plazo',
  done: 'Meta conquistada',
  overdue: 'Plazo vencido',
  ahead: 'Vas por delante',
  'on-track': 'Vas a tiempo',
  behind: 'Vas algo atrasado',
};

export interface SmartItem {
  letter: 'S' | 'M' | 'A' | 'R' | 'T';
  label: string;
  ok: boolean;
  /** Qué falta, dicho como invitación. */
  todo: string;
}

/** Qué criterios SMART tiene ya la meta. Orienta, no bloquea: una meta sin completar sigue siendo válida. */
export function smartChecklist(goal: Goal, actions: GoalActions): SmartItem[] {
  const has = (v?: string) => !!v?.trim();
  return [
    { letter: 'S', label: 'Específica', ok: goal.title.trim().length >= 3 && goal.milestones.length > 0, todo: 'Divídela en hitos concretos.' },
    { letter: 'M', label: 'Medible', ok: has(goal.measure), todo: 'Di cómo vas a medir el avance (horas, entregables, cifras).' },
    { letter: 'A', label: 'Alcanzable', ok: actions.tasks.length + actions.habits.length > 0, todo: 'Enlaza al menos una tarea o un hábito que la haga avanzar.' },
    { letter: 'R', label: 'Relevante', ok: has(goal.why), todo: 'Escribe por qué te importa.' },
    { letter: 'T', label: 'Con plazo', ok: !!goal.deadline, todo: 'Ponle una fecha límite.' },
  ];
}

export const smartScore = (items: SmartItem[]): number => items.filter((i) => i.ok).length;

/** Quita el vínculo con una meta de las tareas y hábitos que la tenían (al borrarla). Devuelve solo lo que cambia. */
export function unlinkGoal(goalId: string, s: { tasks: Task[]; habits: Habit[] }): { tasks: Task[]; habits: Habit[] } {
  const drop = <T extends { goalId?: string }>(x: T): T => {
    const { goalId: _omit, ...rest } = x;
    return rest as T;
  };
  return { tasks: s.tasks.filter((t) => t.goalId === goalId).map(drop), habits: s.habits.filter((h) => h.goalId === goalId).map(drop) };
}
