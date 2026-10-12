/**
 * Recordatorios DENTRO de la web (hábitos y hora límite de tareas): mientras la app está abierta avisa con un banner y un sonido.
 * No necesita servidor ni push, así que también funciona en modo local.
 *
 * Usa el mismo planificador que la Edge Function (`supabase/functions/_shared/reminders.ts`), de modo que
 * la web y el push coinciden siempre en cuándo avisar y cuándo repetir.
 */
import type { AgendaEvent, Habit, HabitLog, Task } from '@/core/domain';
import { addDays } from '@/core/dates';
import { agendaNotices, occurrencesBetween } from '@/core/agenda';
import { planReminders, type HabitRow, type PlannedReminder, type SentState } from '../../supabase/functions/_shared/reminders';
import { planTaskReminders, taskReminderKey, type TaskRow } from '../../supabase/functions/_shared/taskReminders';
import { localParts } from '../../supabase/functions/_shared/due';

export interface ReminderFile {
  /** Día local al que se refiere el estado; al cambiar de día se reinicia. */
  day: string;
  items: Record<string, SentState>;
}

/** Cómo se entrega un aviso según el estado de la pestaña. */
export type Effect =
  | 'inapp' // banner + sonido dentro de la app
  | 'system' // notificación del sistema (pestaña oculta y sin push)
  | 'silent'; // no se muestra: la pestaña está oculta y el push del servidor ya lo avisa

const KEY = 'sq:reminder-state';
/** Si el servidor y la web disparan el mismo aviso a la vez, solo se muestra uno. */
const DEDUPE_MS = 90_000;

export function loadReminderState(day: string, storage: Pick<Storage, 'getItem'> = localStorage): ReminderFile {
  try {
    const f = JSON.parse(storage.getItem(KEY) ?? 'null') as ReminderFile | null;
    if (f && f.day === day && f.items) return f;
  } catch {
    /* estado corrupto: se empieza de cero */
  }
  return { day, items: {} };
}

export function saveReminderState(file: ReminderFile, storage: Pick<Storage, 'setItem'> = localStorage) {
  try {
    storage.setItem(KEY, JSON.stringify(file));
  } catch {
    /* modo privado o cuota llena: se perderá el estado, sin más consecuencias */
  }
}

export const habitRows = (habits: Habit[]): HabitRow[] =>
  habits
    .filter((h) => h.reminder)
    .map((h) => ({ id: h.id, data: { title: h.title, reminder: h.reminder, reminderRepeatMin: h.reminderRepeatMin, frequency: h.frequency, target: h.target, startDate: h.startDate, xp: h.xp } }));

export interface TickInput {
  habits: Habit[];
  logs: HabitLog[];
  now: Date;
  timeZone: string;
  visible: boolean;
  /** Este dispositivo está suscrito a push (el servidor ya avisa aunque la app esté oculta). */
  pushActive: boolean;
  /** Hay permiso de notificaciones y service worker para mostrar una del sistema. */
  canNotify: boolean;
  state: ReminderFile;
  /** Tareas para el aviso de hora límite. Opcional: sin ellas solo se avisan hábitos. */
  tasks?: Task[];
  /** Actividades del calendario con aviso. Solo dentro de la web (el servidor de push aún no las conoce). */
  events?: AgendaEvent[];
}

export const taskRows = (tasks: Task[]): TaskRow[] =>
  tasks.filter((t) => t.dueDate && t.dueTime).map((t) => ({ id: t.id, data: { title: t.title, status: t.status, dueDate: t.dueDate, dueTime: t.dueTime, xp: t.xp } }));

/** Lo que se le enseña al usuario, venga de un hábito o de una tarea. */
export type Notice = Pick<PlannedReminder, 'title' | 'body' | 'url' | 'tag'>;

export function tickReminders(i: TickInput): { effects: { reminder: Notice; effect: Effect }[]; state: ReminderFile } {
  const day = localParts(i.now, i.timeZone).date;
  const state: ReminderFile = i.state.day === day ? { day, items: { ...i.state.items } } : { day, items: {} };
  const effectNow = (): Effect => (i.visible ? 'inapp' : i.pushActive ? 'silent' : i.canNotify ? 'system' : 'inapp');

  const plan = planReminders({
    habits: habitRows(i.habits),
    logs: i.logs.map((l) => ({ habitId: l.habitId, date: l.date, value: l.value })),
    sent: state.items,
    now: i.now,
    timeZone: i.timeZone,
  });

  const effects: { reminder: Notice; effect: Effect }[] = plan.map((reminder) => {
    state.items[reminder.habitId] = { count: reminder.count, lastSentAt: i.now.getTime() };
    return { reminder, effect: effectNow() };
  });

  // Tareas con hora límite: un aviso una hora antes. Se guardan con la clave `task:<id>` en el mismo estado.
  const sentTasks = new Set((i.tasks ?? []).map((t) => t.id).filter((id) => state.items[taskReminderKey(id)]));
  for (const reminder of planTaskReminders({ tasks: taskRows(i.tasks ?? []), sent: sentTasks, now: i.now, timeZone: i.timeZone })) {
    state.items[reminder.key] = { count: 1, lastSentAt: i.now.getTime() };
    effects.push({ reminder, effect: effectNow() });
  }
  // Actividades del calendario: aviso antes de empezar y avisos periódicos dentro del bloque.
  const withAlerts = (i.events ?? []).filter((e) => e.reminderMin != null || e.pulseMin);
  if (withAlerts.length) {
    const { minutes } = localParts(i.now, i.timeZone);
    const occs = occurrencesBetween(withAlerts, day, addDays(day, 1), { habits: i.habits, tasks: i.tasks ?? [], logs: i.logs });
    for (const n of agendaNotices(occs, day, minutes, new Set(Object.keys(state.items)))) {
      state.items[n.key] = { count: 1, lastSentAt: i.now.getTime() };
      effects.push({ reminder: { title: n.title, body: n.body, url: '/calendario', tag: n.key }, effect: i.visible ? 'inapp' : i.canNotify ? 'system' : 'inapp' });
    }
  }
  return { effects, state };
}

export interface PushMessage {
  title: string;
  body: string;
  url: string;
  tag: string;
  /** Identifica el aviso: id del hábito o `task:<id>`. Los push antiguos solo traen `habitId`. */
  key?: string;
  habitId?: string;
  count?: number;
}

/** El service worker avisa de un push mientras la app está visible: decide si hay que mostrarlo o ya se mostró. */
export function acceptPushMessage(msg: PushMessage, state: ReminderFile, nowMs: number): { show: boolean; state: ReminderFile } {
  const key = msg.key ?? msg.habitId;
  if (!key) return { show: true, state };
  const prev = state.items[key];
  if (prev && nowMs - prev.lastSentAt < DEDUPE_MS) return { show: false, state };
  return { show: true, state: { ...state, items: { ...state.items, [key]: { count: msg.count ?? (prev?.count ?? 0) + 1, lastSentAt: nowMs } } } };
}
