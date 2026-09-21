/**
 * Copia de seguridad de la partida en un JSON portable.
 * Sirve como respaldo, para pasar de un dispositivo a otro y para migrar de base de datos:
 * no depende de ningún adaptador, solo del modelo de dominio.
 */
import type { Snapshot } from './domain';
import { defaultProfile } from './game';
import { newId } from './dates';

export const BACKUP_APP = 'studyquest';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  data: Snapshot;
}

export const backupFileName = (now = new Date()) => `studyquest-${now.toISOString().slice(0, 10)}.json`;

export function buildBackup(data: Snapshot, now = new Date()): BackupFile {
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), data };
}

export type ParseResult = { ok: true; snapshot: Snapshot; warnings: string[] } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
const num = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/**
 * Lee y valida un archivo de copia. Nunca lanza: devuelve el error o la partida más advertencias
 * (elementos descartados, ids arreglados…). Todo id se convierte en UUID válido para que cualquier
 * base de datos lo acepte; las referencias (curso ↔ tarea, hábito ↔ registro) se reescriben a juego.
 */
export function parseBackup(text: string, userId = 'imported'): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'El archivo no es un JSON válido.' };
  }
  if (!isObj(raw) || raw.app !== BACKUP_APP) return { ok: false, error: 'Este archivo no parece una copia de StudyQuest.' };
  if (typeof raw.version !== 'number' || raw.version > BACKUP_VERSION) {
    return { ok: false, error: 'La copia es de una versión más nueva de StudyQuest. Actualiza la app e inténtalo otra vez.' };
  }
  if (!isObj(raw.data)) return { ok: false, error: 'La copia no contiene datos.' };
  const d = raw.data;

  const warnings: string[] = [];
  const dropped: Record<string, number> = {};
  const drop = (what: string) => void (dropped[what] = (dropped[what] ?? 0) + 1);
  let fixedIds = 0;

  const idMap = new Map<string, string>();
  const fixId = (v: unknown): string => {
    const id = str(v);
    if (UUID.test(id)) return id;
    if (!id) {
      fixedIds++;
      return newId();
    }
    const known = idMap.get(id);
    if (known) return known;
    const fresh = newId();
    idMap.set(id, fresh);
    fixedIds++;
    return fresh;
  };
  const ref = (v: unknown): string | null => (typeof v === 'string' && v ? (UUID.test(v) ? v : (idMap.get(v) ?? null)) : null);

  /** Convierte una lista cruda: cada elemento pasa por `fn`, que devuelve null para descartarlo. */
  const list = <T>(key: string, label: string, fn: (o: Obj) => T | null): T[] =>
    asArray(d[key]).flatMap((x) => {
      const out = isObj(x) ? fn(x) : null;
      if (!out) drop(label);
      return out ? [out] : [];
    });

  const subs = (v: unknown, fn: (o: Obj) => Obj | null) =>
    asArray(v).flatMap((x) => {
      const out = isObj(x) ? fn(x) : null;
      return out ? [out] : [];
    });

  // Primero cursos y hábitos: sus ids los referencian otras colecciones.
  const courses = list('courses', 'cursos', (o) => {
    if (!str(o.title)) return null;
    const mentor = isObj(o.mentor) ? { name: str(o.mentor.name), skills: str(o.mentor.skills), feedback: str(o.mentor.feedback), feedbackAt: DATE.test(str(o.mentor.feedbackAt)) ? str(o.mentor.feedbackAt) : null } : null;
    return {
      id: fixId(o.id), title: str(o.title), professor: str(o.professor), field: str(o.field), mentor, createdAt: str(o.createdAt, new Date().toISOString()),
      modules: subs(o.modules, (m) => ({
        id: fixId(m.id), title: str(m.title, 'Módulo'), summary: str(m.summary), xp: num(m.xp, 100),
        topics: subs(m.topics, (t) => ({
          id: fixId(t.id), title: str(t.title, 'Tema'), status: ['todo', 'doing', 'done'].includes(str(t.status)) ? str(t.status) : 'todo', review: t.review === true, markedAt: DATE.test(str(t.markedAt)) ? str(t.markedAt) : null,
          ...(typeof t.reviewStage === 'number' && t.reviewStage >= 0 && t.reviewStage <= 3 ? { reviewStage: Math.floor(t.reviewStage) } : {}),
          ...(DATE.test(str(t.nextReview)) ? { nextReview: str(t.nextReview) } : {}),
          ...(asArray(t.cards).length ? { cards: subs(t.cards, (c) => (str(c.q) ? { id: fixId(c.id), q: str(c.q).slice(0, 300), a: str(c.a).slice(0, 600) } : null)) } : {}),
        })),
      })),
    };
  });
  const habits = list('habits', 'hábitos', (o) => {
    if (!str(o.title) || !isObj(o.frequency) || typeof o.frequency.type !== 'string') return null;
    return {
      id: fixId(o.id), title: str(o.title), frequency: o.frequency, measure: str(o.measure, 'times'), target: Math.max(1, num(o.target, 1)), xp: num(o.xp, 10),
      reminder: /^\d{2}:\d{2}$/.test(str(o.reminder)) ? str(o.reminder) : null,
      ...(typeof o.reminderRepeatMin === 'number' && o.reminderRepeatMin >= 0 && o.reminderRepeatMin <= 240 ? { reminderRepeatMin: o.reminderRepeatMin } : {}),
      steps: subs(o.steps, (s) => ({ id: fixId(s.id), title: str(s.title, 'Paso'), minutes: num(s.minutes) })),
      startDate: DATE.test(str(o.startDate)) ? str(o.startDate) : str(o.createdAt).slice(0, 10) || '2000-01-01', createdAt: str(o.createdAt, new Date().toISOString()),
    };
  });
  const habitIds = new Set(habits.map((h) => (h as Obj).id as string));
  const courseIds = new Set(courses.map((c) => (c as Obj).id as string));

  const tasks = list('tasks', 'tareas', (o) => {
    if (!str(o.title)) return null;
    const courseId = ref(o.courseId);
    return {
      id: fixId(o.id), title: str(o.title), courseId: courseId && courseIds.has(courseId) ? courseId : null,
      priority: ['low', 'mid', 'high', 'boss'].includes(str(o.priority)) ? str(o.priority) : 'mid',
      status: ['todo', 'doing', 'done'].includes(str(o.status)) ? str(o.status) : 'todo',
      dueDate: DATE.test(str(o.dueDate)) ? str(o.dueDate) : null, estimateMin: num(o.estimateMin), xp: num(o.xp, 20),
      subtasks: subs(o.subtasks, (s) => ({ id: fixId(s.id), title: str(s.title, 'Subtarea'), done: s.done === true })),
      tags: asArray(o.tags).filter((t): t is string => typeof t === 'string'), createdAt: str(o.createdAt, new Date().toISOString()),
      completedAt: DATE.test(str(o.completedAt)) ? str(o.completedAt) : null,
      ...(isObj(o.recurrence) && ['day', 'week', 'month'].includes(str(o.recurrence.unit)) ? { recurrence: { unit: str(o.recurrence.unit), interval: Math.min(365, Math.max(1, Math.floor(num(o.recurrence.interval, 1)))) } } : {}),
      spawnedRaw: str(o.spawnedId),
    };
  }).map(({ spawnedRaw, ...t }) => ({ ...t, ...(ref(spawnedRaw) ? { spawnedId: ref(spawnedRaw) as string } : {}) }));
  const taskIds = new Set(tasks.map((t) => (t as Obj).id as string));
  for (const t of tasks as Obj[]) if (t.spawnedId && !taskIds.has(t.spawnedId as string)) delete t.spawnedId;
  const habitLogs = list('habitLogs', 'registros de hábitos', (o) => {
    const habitId = ref(o.habitId);
    if (!habitId || !habitIds.has(habitId) || !DATE.test(str(o.date))) return null;
    return { id: fixId(o.id), habitId, date: str(o.date), value: num(o.value), stepsDone: asArray(o.stepsDone).map(ref).filter((x): x is string => !!x) };
  });
  const goals = list('goals', 'metas', (o) =>
    str(o.title)
      ? {
          id: fixId(o.id), title: str(o.title), rewardTitle: str(o.rewardTitle), rewardDescription: str(o.rewardDescription), createdAt: str(o.createdAt, new Date().toISOString()),
          milestones: subs(o.milestones, (m) => ({
            id: fixId(m.id), title: str(m.title, 'Hito'), summary: str(m.summary), xp: num(m.xp, 100), done: m.done === true,
            skills: subs(m.skills, (k) => ({ id: fixId(k.id), label: str(k.label, 'Habilidad'), done: k.done === true })),
          })),
        }
      : null,
  );
  const projects = list('projects', 'proyectos', (o) =>
    str(o.title)
      ? {
          id: fixId(o.id), title: str(o.title), summary: str(o.summary), kind: o.kind === 'main' ? 'main' : 'side', createdAt: str(o.createdAt, new Date().toISOString()),
          checkpoints: subs(o.checkpoints, (c) => ({ id: fixId(c.id), title: str(c.title, 'Checkpoint'), summary: str(c.summary), xp: num(c.xp, 100), done: c.done === true })),
        }
      : null,
  );
  const personalRewards = list('personalRewards', 'recompensas personales', (o) =>
    str(o.title) ? { id: fixId(o.id), title: str(o.title), condition: str(o.condition), current: num(o.current), target: Math.max(1, num(o.target, 1)), claimed: o.claimed === true } : null,
  );
  const sessions = list('sessions', 'sesiones de estudio', (o) => {
    if (!DATE.test(str(o.date)) || num(o.minutes) <= 0) return null;
    const courseId = ref(o.courseId);
    return { id: fixId(o.id), date: str(o.date), minutes: num(o.minutes), courseId: courseId && courseIds.has(courseId) ? courseId : null, label: str(o.label, 'Sesión de estudio') };
  });
  const xpEvents = list('xpEvents', 'eventos de XP', (o) =>
    DATE.test(str(o.date)) && typeof o.amount === 'number' ? { id: fixId(o.id), date: str(o.date), amount: num(o.amount), source: str(o.source, 'bonus'), label: str(o.label) } : null,
  );
  const notifications = list('notifications', 'notificaciones', (o) =>
    str(o.title) ? { id: fixId(o.id), category: str(o.category, 'alert'), title: str(o.title), body: str(o.body), createdAt: str(o.createdAt, new Date().toISOString()), read: o.read === true } : null,
  );

  const p = isObj(d.profile) ? d.profile : {};
  const base = defaultProfile(userId);
  const profile = {
    ...base,
    displayName: str(p.displayName, base.displayName), xp: Math.max(0, num(p.xp)), credits: Math.max(0, num(p.credits)), streakFreezes: Math.max(0, num(p.streakFreezes)),
    frozenDates: asArray(p.frozenDates).filter((x): x is string => DATE.test(str(x))), weeklyGoalHours: Math.max(1, num(p.weeklyGoalHours, 15)),
    weeklyBonusClaimed: DATE.test(str(p.weeklyBonusClaimed)) ? str(p.weeklyBonusClaimed) : null,
    inventory: asArray(p.inventory).filter((x): x is string => typeof x === 'string'),
    equipped: { avatar: isObj(p.equipped) ? (str(p.equipped.avatar) || null) : null, frame: isObj(p.equipped) ? (str(p.equipped.frame) || null) : null, world: isObj(p.equipped) ? (str(p.equipped.world) || null) : null },
    achievements: subs(p.achievements, (a) => (str(a.id) ? { id: str(a.id), at: str(a.at, new Date().toISOString()) } : null)),
    onboarded: true, joinedAt: str(p.joinedAt, base.joinedAt),
    ...(isObj(p.dayBonus) && DATE.test(str(p.dayBonus.date))
      ? { dayBonus: { date: str(p.dayBonus.date), weekend: asArray(p.dayBonus.weekend).map(ref).filter((x): x is string => !!x), combo: p.dayBonus.combo === true } }
      : {}),
    ...(DATE.test(str(p.lastChest)) ? { lastChest: str(p.lastChest) } : {}),
    ...(isObj(p.city) ? { city: Object.fromEntries(Object.entries(p.city).filter(([k, v]) => ['casa', 'biblioteca', 'academia', 'laboratorio', 'arena', 'museo'].includes(k) && typeof v === 'number').map(([k, v]) => [k, Math.max(0, Math.min(5, Math.floor(v as number)))])) } : {}),
    ...(typeof p.chests === 'number' && p.chests > 0 ? { chests: Math.floor(p.chests) } : {}),
  };

  for (const [what, n] of Object.entries(dropped)) warnings.push(`${n} ${what} descartados por datos inválidos.`);
  if (fixedIds) warnings.push(`${fixedIds} identificadores se regeneraron.`);

  // Los tipos exactos ya se validaron arriba; el cast evita repetirlos en cada colección.
  const snapshot = { profile, tasks, habits, habitLogs, courses, goals, projects, personalRewards, sessions, xpEvents, notifications } as unknown as Snapshot;
  return { ok: true, snapshot, warnings };
}

export const summarize = (s: Snapshot) => ({
  tareas: s.tasks.length, hábitos: s.habits.length, cursos: s.courses.length, metas: s.goals.length, proyectos: s.projects.length,
  'sesiones de estudio': s.sessions.length, 'registros de XP': s.xpEvents.length,
});
