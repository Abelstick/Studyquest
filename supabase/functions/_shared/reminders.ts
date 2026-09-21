/**
 * Planificador de recordatorios de hábitos: decide QUÉ avisos toca enviar ahora.
 *
 * Es lógica pura y sin dependencias, y la usan DOS sitios con el mismo resultado:
 *  - la Edge Function `send-reminders` (push, con la app cerrada), y
 *  - la propia web (aviso dentro de la app con sonido, mientras está abierta).
 * Así el servidor y la web nunca discrepan sobre cuándo avisar.
 *
 * Reglas:
 *  - El primer aviso sale a la hora del recordatorio (con 10 min de margen por si el cron se retrasa).
 *  - Si el hábito sigue sin hacerse, se repite cada `reminderRepeatMin` minutos (por defecto 30; 0 = no repetir).
 *  - Como mucho MAX_REMINDERS_PER_DAY avisos por hábito y día, y nunca cruzan la medianoche.
 *  - No se avisa si hoy no toca o si ya está hecho.
 */
import { isDoneOn, isDueOn, localParts, minutesSince, type Frequency, type LogLike } from './due.ts';

export const REMINDER_WINDOW_MIN = 10;
export const MAX_REMINDERS_PER_DAY = 6;
export const DEFAULT_REPEAT_MIN = 30;
/** Margen (min) para que un aviso no se retrase un ciclo entero por unos segundos de desfase del cron. */
const REPEAT_TOLERANCE_MIN = 0.5;

export interface SentState {
  /** Avisos ya enviados hoy para este hábito. */
  count: number;
  /** Instante (ms epoch) del último aviso. */
  lastSentAt: number;
}

export type Decision = 'first' | 'repeat' | 'wait';

export function reminderDecision(p: { sinceMin: number | null; repeatMin: number | undefined; state: SentState | null; nowMs: number }): Decision {
  if (p.sinceMin === null || p.sinceMin < 0) return 'wait';
  if (!p.state || p.state.count <= 0) return p.sinceMin < REMINDER_WINDOW_MIN ? 'first' : 'wait';
  const repeat = p.repeatMin ?? DEFAULT_REPEAT_MIN;
  if (repeat <= 0 || p.state.count >= MAX_REMINDERS_PER_DAY) return 'wait';
  const elapsedMin = (p.nowMs - p.state.lastSentAt) / 60_000;
  return elapsedMin >= repeat - REPEAT_TOLERANCE_MIN ? 'repeat' : 'wait';
}

/** Un hábito tal como lo guarda la base de datos (`habits.data`). */
export interface HabitRow {
  id: string;
  data: {
    title?: string;
    reminder?: string | null;
    reminderRepeatMin?: number;
    frequency: Frequency;
    target?: number;
    startDate?: string;
    xp?: number;
  };
}

export interface PlanInput {
  habits: HabitRow[];
  logs: LogLike[];
  /** Avisos ya enviados HOY (en la fecha local de `timeZone`), por id de hábito. */
  sent: Record<string, SentState>;
  now: Date;
  timeZone: string;
}

export interface PlannedReminder {
  habitId: string;
  kind: 'first' | 'repeat';
  /** Número de este aviso (1 = primero). */
  count: number;
  title: string;
  body: string;
  url: string;
  tag: string;
}

export function planReminders(input: PlanInput): PlannedReminder[] {
  const { date, minutes } = localParts(input.now, input.timeZone);
  const out: PlannedReminder[] = [];

  for (const h of input.habits) {
    const d = h.data;
    const since = minutesSince(d.reminder, minutes);
    if (since === null || since < 0) continue;

    const habit = { id: h.id, frequency: d.frequency, target: Number(d.target) || 1, startDate: d.startDate ?? '2000-01-01' };
    if (!isDueOn(habit, date, input.logs) || isDoneOn(habit, input.logs, date)) continue;

    const state = input.sent[h.id] ?? null;
    const decision = reminderDecision({ sinceMin: since, repeatMin: d.reminderRepeatMin, state, nowMs: input.now.getTime() });
    if (decision === 'wait') continue;

    const count = (state?.count ?? 0) + 1;
    const xp = d.xp ?? 0;
    out.push({
      habitId: h.id,
      kind: decision,
      count,
      title: `🔥 ${d.title ?? 'Tu hábito'}`,
      body: decision === 'first' ? `Son las ${d.reminder}. Regístralo y suma ${xp} XP.` : `Sigue pendiente (aviso ${count} de ${MAX_REMINDERS_PER_DAY}). Regístralo y suma ${xp} XP.`,
      url: `/habitos/${h.id}`,
      tag: `habit-${h.id}`,
    });
  }
  return out;
}
