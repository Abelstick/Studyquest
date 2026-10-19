/**
 * «Pack de aprendizaje»: un JSON que le pides a una IA (la tuya vía Gemini dentro de la app, o ChatGPT, Claude… por
 * copiar y pegar) para crear de golpe cursos, metas, proyectos, hábitos y tareas ya enlazados entre sí.
 *
 * El formato no lleva ids ni fechas absolutas (la IA no conoce el día de hoy): las tareas usan `dueInDays`, la meta
 * `deadlineInDays`, y todo se enlaza por título (la tarea a su curso y a su meta, el hábito a su meta). Aquí se lee,
 * valida y convierte a entidades de la app. Nada de lo que venga de la IA se usa sin pasar por `parsePack`: los números
 * se acotan (la IA no puede regalar miles de XP) y los enlaces se comprueban. Lógica pura, sin React ni base de datos.
 */
import { safeUrl } from './certifications';
import type { AreaId, Course, Frequency, Goal, Habit, IfThen, ISODate, Measure, Priority, Project, Task } from './domain';
import { addDays, isoNow, newId, today } from './dates';
import { XP_BY_PRIORITY } from './game';
import { scaleDays } from './pace';
import { cleanArea } from './areas';
import { cleanIfThen } from './ifthen';
import { cleanMinimum } from './minimum';

export const PACK_VERSION = 1;

export interface Pack {
  courses: Omit<Course, 'id' | 'createdAt' | 'planId' | 'mentor'>[];
  /** `deadlineInDays` = días desde hoy hasta el plazo de la meta. */
  goals: (Omit<Goal, 'id' | 'createdAt' | 'planId' | 'deadline'> & { deadlineInDays: number | null })[];
  projects: Omit<Project, 'id' | 'createdAt'>[];
  /** `goal` es el título de la meta (del mismo pack o ya existente) a la que aporta el hábito. */
  habits: (Omit<Habit, 'id' | 'createdAt' | 'startDate' | 'planId' | 'goalId'> & { goal: string | null })[];
  /** `course` y `goal` son títulos (del mismo pack o ya existentes) a los que se vincula la tarea. */
  tasks: (Omit<Task, 'id' | 'createdAt' | 'completedAt' | 'courseId' | 'dueDate' | 'goalId'> & { course: string | null; goal: string | null; dueInDays: number | null; dueDate: ISODate | null })[];
}

export interface PackEntities {
  courses: Course[];
  goals: Goal[];
  projects: Project[];
  habits: Habit[];
  tasks: Task[];
}

export type PackResult = { ok: true; pack: Pack; warnings: string[] } | { ok: false; error: string };

const LIMITS = { items: 30, children: 40, subchildren: 40 };
/** Tope de XP por elemento: una ruta importada no puede desequilibrar el juego (la tabla de la app va de 20 a 120 por tarea). */
export const PACK_XP_MAX = { task: 150, habit: 100, group: 600 };
const MEASURES: Measure[] = ['times', 'minutes', 'hours', 'pages', 'exercises', 'tasks', 'percent', 'boolean'];
const PRIORITIES: Priority[] = ['low', 'mid', 'high', 'boss'];

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const text = (v: unknown, max = 120): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const int = (v: unknown, fallback: number, min: number, max: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;

/** Un elemento de una lista puede venir como texto suelto o como objeto con `title`. */
const titleOf = (v: unknown): string => (typeof v === 'string' ? text(v, 100) : isObj(v) ? text(v.title ?? v.label, 100) : '');

/* ---------- Leer el JSON que devuelve la IA ---------- */

/** Por qué no se pudo leer: no hay JSON, está cortado a la mitad o tiene errores de sintaxis. */
export class PackJsonError extends Error {
  constructor(readonly kind: 'none' | 'truncated' | 'invalid') {
    super(kind);
  }
}

/**
 * Arregla los fallos típicos de copiar una respuesta de chat: comillas «curvas», comas sobrantes antes de } o ] y líneas
 * de comentario (// …). No toca el contenido de los textos.
 */
export function repairJson(s: string): string {
  return s
    .replace(/[“”„]/g, '"')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/,\s*([}\]])/g, '$1');
}

/** ¿Las llaves y corchetes (fuera de los textos) quedan cerrados? Si no, la respuesta se cortó. */
function balanced(s: string): boolean {
  let depth = 0;
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') depth--;
  }
  return depth === 0 && !inStr;
}

/** Quita las vallas ``` y el texto alrededor: las IA suelen envolver el JSON en una explicación. */
export function extractJson(raw: string): unknown {
  const s = raw.trim();
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/i);
  const candidate = fenced ? fenced[1] : s;
  const start = candidate.indexOf('{');
  if (start < 0) throw new PackJsonError('none');
  const end = candidate.lastIndexOf('}');
  const body = end > start ? candidate.slice(start, end + 1) : candidate.slice(start);
  for (const attempt of [body, repairJson(body)]) {
    try {
      return JSON.parse(attempt);
    } catch {
      // Se prueba la versión reparada; si tampoco, se explica qué pasó.
    }
  }
  throw new PackJsonError(balanced(repairJson(body)) ? 'invalid' : 'truncated');
}

const JSON_ERRORS: Record<PackJsonError['kind'], string> = {
  none: 'No encuentro un JSON en lo que pegaste. Copia la respuesta completa de la IA, con las llaves { }.',
  truncated: 'La respuesta parece cortada a la mitad (faltan llaves por cerrar). Pídele a la IA que la termine, o que haga una ruta más corta, y pega la respuesta completa.',
  invalid: 'Encontré un JSON pero tiene errores de sintaxis que no pude arreglar solo. Pídele a la IA: «devuélvelo como JSON válido, sin comentarios ni comas sobrantes».',
};

function parseFrequency(v: unknown): Frequency {
  const o = isObj(v) ? v : { type: v };
  switch (o.type) {
    case 'days': {
      const days = [...new Set(arr(o.days).filter((d): d is number => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6))].sort((a, b) => a - b);
      return days.length && days.length < 7 ? { type: 'days', days } : { type: 'daily' };
    }
    case 'every':
      return { type: 'every', every: int(o.every, 2, 2, 60) };
    case 'weekly':
      return { type: 'weekly' };
    case 'monthly':
      return { type: 'monthly' };
    case 'custom':
      return { type: 'custom', times: int(o.times, 3, 1, o.per === 'month' ? 31 : 7), per: o.per === 'month' ? 'month' : 'week' };
    default:
      return { type: 'daily' };
  }
}

/** Planes «si… entonces…»: acepta `when/then` y también `si/entonces`, que es como los escribe una IA en español. */
function parseIfThen(v: unknown): IfThen[] | undefined {
  return cleanIfThen(arr(v).map((x) => (isObj(x) ? { when: x.when ?? x.si, then: x.then ?? x.entonces } : null)));
}

const refTitle = (v: unknown): string | null => text(v, 120) || null;

export function parsePack(raw: string): PackResult {
  let json: unknown;
  try {
    json = extractJson(raw);
  } catch (e) {
    return { ok: false, error: JSON_ERRORS[e instanceof PackJsonError ? e.kind : 'none'] };
  }
  if (!isObj(json)) return { ok: false, error: 'El JSON debe ser un objeto con cursos, metas, proyectos, hábitos o tareas.' };
  if (typeof json.version === 'number' && json.version > PACK_VERSION) return { ok: false, error: 'Este pack es de una versión más nueva de StudyQuest. Actualiza la app.' };

  const warnings: string[] = [];
  const skipped: Record<string, number> = {};
  const skip = (what: string) => void (skipped[what] = (skipped[what] ?? 0) + 1);
  const each = <T>(key: string, label: string, fn: (o: Obj) => T | null): T[] => {
    const all = arr(json[key]);
    if (all.length > LIMITS.items) warnings.push(`Solo leí los primeros ${LIMITS.items} de ${all.length} ${label}.`);
    return all.slice(0, LIMITS.items).flatMap((x) => {
      const out = isObj(x) ? fn(x) : null;
      if (!out) skip(label);
      return out ? [out] : [];
    });
  };
  const area = (o: Obj): { area?: AreaId } => {
    const a = cleanArea(o.area);
    return a ? { area: a } : {};
  };

  const courses: Pack['courses'] = each('courses', 'cursos', (o) => {
    const title = text(o.title);
    if (!title) return null;
    return {
      title, professor: text(o.professor, 60) || 'Mi ruta', field: text(o.field, 60),
      ...(safeUrl(text(o.link, 500)) ? { link: safeUrl(text(o.link, 500)) as string } : {}),
      modules: arr(o.modules).slice(0, LIMITS.children).flatMap((m) => {
        if (!isObj(m) || !text(m.title)) return [];
        const topics = arr(m.topics).slice(0, LIMITS.subchildren).map(titleOf).filter(Boolean);
        return [{
          id: '', title: text(m.title, 100), summary: text(m.summary, 200), xp: int(m.xp, Math.min(PACK_XP_MAX.group, Math.max(100, topics.length * 25)), 10, PACK_XP_MAX.group),
          topics: topics.map((t) => ({ id: '', title: t, status: 'todo' as const, review: false, markedAt: null })),
        }];
      }),
    };
  });

  const goals: Pack['goals'] = each('goals', 'metas', (o) => {
    const title = text(o.title);
    if (!title) return null;
    const deadlineInDays = typeof o.deadlineInDays === 'number' && Number.isFinite(o.deadlineInDays) ? int(o.deadlineInDays, 0, 1, 1095) : null;
    return {
      title, rewardTitle: text(o.rewardTitle, 100) || `Meta cumplida: ${title}`, rewardDescription: text(o.rewardDescription, 200) || '¡Lo lograste! Celébralo.',
      deadlineInDays,
      ...(text(o.measure, 300) ? { measure: text(o.measure, 300) } : {}),
      ...(text(o.why, 300) ? { why: text(o.why, 300) } : {}),
      ...area(o),
      ...(parseIfThen(o.ifThen) ? { ifThen: parseIfThen(o.ifThen) } : {}),
      milestones: arr(o.milestones).slice(0, LIMITS.children).flatMap((m) => {
        if (!isObj(m) || !text(m.title)) return [];
        return [{
          id: '', title: text(m.title, 100), summary: text(m.summary, 200), xp: int(m.xp, 100, 10, PACK_XP_MAX.group), done: false,
          skills: arr(m.skills).slice(0, LIMITS.subchildren).map(titleOf).filter(Boolean).map((label) => ({ id: '', label, done: false })),
        }];
      }),
    };
  });

  const projects: Pack['projects'] = each('projects', 'proyectos', (o) => {
    const title = text(o.title);
    if (!title) return null;
    return {
      title, summary: text(o.summary, 300), kind: o.kind === 'side' ? 'side' : 'main',
      checkpoints: arr(o.checkpoints).slice(0, LIMITS.children).flatMap((c) => {
        if (!titleOf(c)) return [];
        const o2 = isObj(c) ? c : {};
        return [{ id: '', title: titleOf(c), summary: text(o2.summary, 200), xp: int(o2.xp, 100, 10, PACK_XP_MAX.group), done: false }];
      }),
    };
  });

  const habits: Pack['habits'] = each('habits', 'hábitos', (o) => {
    const title = text(o.title);
    if (!title) return null;
    const measure = MEASURES.includes(o.measure as Measure) ? (o.measure as Measure) : 'times';
    const target = measure === 'boolean' ? 1 : int(o.target, measure === 'minutes' ? 30 : 1, 1, 10000);
    const minTarget = cleanMinimum(o.minTarget, { target, measure, kind: 'build' });
    return {
      title, frequency: parseFrequency(o.frequency), measure, target, goal: refTitle(o.goal),
      xp: int(o.xp, 30, 0, PACK_XP_MAX.habit), reminder: /^([01]\d|2[0-3]):[0-5]\d$/.test(text(o.reminder, 5)) ? text(o.reminder, 5) : null,
      ...(minTarget ? { minTarget } : {}),
      ...area(o),
      ...(parseIfThen(o.ifThen) ? { ifThen: parseIfThen(o.ifThen) } : {}),
      steps: arr(o.steps).slice(0, 12).flatMap((s) => (titleOf(s) ? [{ id: '', title: titleOf(s), minutes: int(isObj(s) ? s.minutes : 0, 0, 0, 240) }] : [])),
    };
  });

  const tasks: Pack['tasks'] = each('tasks', 'tareas', (o) => {
    const title = text(o.title);
    if (!title) return null;
    const priority = PRIORITIES.includes(o.priority as Priority) ? (o.priority as Priority) : 'mid';
    const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(text(o.dueDate, 10)) ? text(o.dueDate, 10) : null;
    return {
      title, course: refTitle(o.course), goal: refTitle(o.goal), priority, status: 'todo', estimateMin: int(o.estimateMin, 30, 5, 1440),
      dueDate, dueInDays: typeof o.dueInDays === 'number' && Number.isFinite(o.dueInDays) ? int(o.dueInDays, 0, 0, 730) : null,
      xp: int(o.xp, XP_BY_PRIORITY[priority], 0, PACK_XP_MAX.task),
      ...area(o),
      subtasks: arr(o.subtasks).slice(0, LIMITS.subchildren).map(titleOf).filter(Boolean).map((t) => ({ id: '', title: t, done: false })),
      tags: arr(o.tags).map((t) => text(t, 24)).filter(Boolean).slice(0, 6),
    };
  });

  if (!courses.length && !goals.length && !projects.length && !habits.length && !tasks.length) {
    return { ok: false, error: 'El JSON no trae nada que crear. Debe incluir al menos una de estas listas: courses, goals, projects, habits, tasks.' };
  }
  for (const [what, n] of Object.entries(skipped)) warnings.push(`${n} ${what} sin título se descartaron.`);
  for (const c of courses) if (!c.modules.length) warnings.push(`El curso «${c.title}» no trae módulos.`);
  const known = new Set(courses.map((c) => c.title.toLowerCase()));
  for (const t of tasks) if (t.course && !known.has(t.course.toLowerCase())) warnings.push(`La tarea «${t.title}» apunta al curso «${t.course}»: se vinculará si ya existe en la app.`);
  const goalKnown = new Set(goals.map((g) => g.title.toLowerCase()));
  for (const x of [...tasks, ...habits]) if (x.goal && !goalKnown.has(x.goal.toLowerCase())) warnings.push(`«${x.title}» apunta a la meta «${x.goal}»: se vinculará si ya existe en la app.`);
  return { ok: true, pack: { courses, goals, projects, habits, tasks }, warnings };
}

/** Resumen corto para la vista previa: «2 cursos · 1 meta · 5 tareas». */
export function describePack(p: Record<'courses' | 'goals' | 'projects' | 'habits' | 'tasks', unknown[]>): string {
  const n = (k: number, one: string, many: string) => (k ? [`${k} ${k === 1 ? one : many}`] : []);
  return [
    ...n(p.courses.length, 'curso', 'cursos'), ...n(p.goals.length, 'meta', 'metas'), ...n(p.projects.length, 'proyecto', 'proyectos'),
    ...n(p.habits.length, 'hábito', 'hábitos'), ...n(p.tasks.length, 'tarea', 'tareas'),
  ].join(' · ');
}

/* ---------- Lo que ya tienes ---------- */

export interface ExistingTitles {
  courses?: { id: string; title: string }[];
  goals?: { id: string; title: string }[];
  projects?: { title: string }[];
  habits?: { title: string }[];
  tasks?: { title: string; courseId: string | null }[];
}

const key = (s: string) => s.trim().toLowerCase();

/**
 * Quita del pack lo que ya tienes con el mismo nombre, para que importar dos veces la misma ruta (o una parecida) no
 * duplique cursos, metas, proyectos, hábitos ni tareas. Lo que se quita sigue valiendo como destino de los enlaces.
 */
export function dropExisting(pack: Pack, have: ExistingTitles): { pack: Pack; dropped: string[] } {
  const set = (xs: { title: string }[] = []) => new Set(xs.map((x) => key(x.title)));
  const courses = set(have.courses);
  const goals = set(have.goals);
  const projects = set(have.projects);
  const habits = set(have.habits);
  const courseIdByTitle = new Map((have.courses ?? []).map((c) => [key(c.title), c.id]));
  const taskKeys = new Set((have.tasks ?? []).map((t) => `${key(t.title)}|${t.courseId ?? ''}`));
  const dropped: string[] = [];
  const keep = <T extends { title: string }>(xs: T[], seen: Set<string>, what: string, extra?: (x: T) => boolean): T[] =>
    xs.filter((x) => {
      const dup = seen.has(key(x.title)) || !!extra?.(x);
      if (dup) dropped.push(`${what} «${x.title}»`);
      return !dup;
    });
  return {
    dropped,
    pack: {
      courses: keep(pack.courses, courses, 'Curso'),
      goals: keep(pack.goals, goals, 'Meta'),
      projects: keep(pack.projects, projects, 'Proyecto'),
      habits: keep(pack.habits, habits, 'Hábito'),
      tasks: keep(pack.tasks, new Set(), 'Tarea', (t) => taskKeys.has(`${key(t.title)}|${(t.course && courseIdByTitle.get(key(t.course))) || ''}`)),
    },
  };
}

/**
 * Convierte el pack en entidades listas para guardar: ids nuevos y fechas resueltas desde hoy.
 * `existingCourses` y `existing.goals` permiten vincular a lo que ya tenías (por título, sin distinguir mayúsculas).
 * La meta con `deadlineInDays` recibe su plazo con el mismo ritmo que las tareas.
 */
export function buildPackEntities(
  pack: Pack,
  existingCourses: Pick<Course, 'id' | 'title'>[] = [],
  now: ISODate = today(),
  paceFactor = 1,
  existing: Pick<ExistingTitles, 'goals'> = {},
): PackEntities {
  const created = isoNow();
  const withIds = <T extends { id: string }>(xs: T[]): T[] => xs.map((x) => ({ ...x, id: newId() }));

  const courses: Course[] = pack.courses.map((c) => ({
    ...c, id: newId(), mentor: null, createdAt: created,
    modules: withIds(c.modules).map((m) => ({ ...m, topics: withIds(m.topics) })),
  }));
  const goals: Goal[] = pack.goals.map(({ deadlineInDays, ...g }) => ({
    ...g, id: newId(), createdAt: created,
    ...(deadlineInDays !== null ? { deadline: addDays(now, scaleDays(deadlineInDays, paceFactor)) } : {}),
    milestones: withIds(g.milestones).map((m) => ({ ...m, skills: withIds(m.skills) })),
  }));
  const projects: Project[] = pack.projects.map((p) => ({ ...p, id: newId(), createdAt: created, checkpoints: withIds(p.checkpoints) }));

  const goalByTitle = new Map([...(existing.goals ?? []), ...goals].map((g) => [key(g.title), g.id]));
  const goalLink = (title: string | null): { goalId?: string } => {
    const id = title ? goalByTitle.get(key(title)) : undefined;
    return id ? { goalId: id } : {};
  };
  const habits: Habit[] = pack.habits.map(({ goal, ...h }) => ({ ...h, ...goalLink(goal), id: newId(), startDate: now, createdAt: created, steps: withIds(h.steps) }));

  const byTitle = new Map([...existingCourses, ...courses].map((c) => [key(c.title), c.id]));
  const tasks: Task[] = pack.tasks.map(({ course, goal, dueInDays, dueDate, ...t }) => ({
    ...t, ...goalLink(goal), id: newId(), createdAt: created, completedAt: null,
    courseId: course ? (byTitle.get(key(course)) ?? null) : null,
    dueDate: dueDate ?? (dueInDays !== null ? addDays(now, scaleDays(dueInDays, paceFactor)) : null),
    subtasks: withIds(t.subtasks),
  }));
  return { courses, goals, projects, habits, tasks };
}

/** XP total que pondría en juego el pack (para decirlo en la vista previa). */
export function packXp(p: Pack): number {
  const sum = (xs: { xp: number }[]) => xs.reduce((a, x) => a + x.xp, 0);
  return (
    p.courses.reduce((a, c) => a + sum(c.modules), 0) + p.goals.reduce((a, g) => a + sum(g.milestones), 0) +
    p.projects.reduce((a, pr) => a + sum(pr.checkpoints), 0) + sum(p.tasks)
  );
}

/* ---------- Pedírselo a la IA ---------- */

export interface PackContext {
  level?: 'beginner' | 'intermediate' | 'advanced';
  hoursPerWeek?: number;
  weeks?: number;
  /** Tiempo libre típico, ya escrito («Lun–Vie 18:00–22:30; Sáb–Dom todo el día»). */
  availability?: string;
}

const LEVEL_TEXT = { beginner: 'principiante', intermediate: 'intermedio', advanced: 'avanzado' } as const;

/** Lo que el usuario cuenta de sí mismo, en una frase para el prompt (nivel, tiempo y plazo). */
export function contextText(ctx: PackContext = {}): string {
  const parts = [
    ctx.level ? `Nivel: ${LEVEL_TEXT[ctx.level]}.` : '',
    ctx.hoursPerWeek ? `Puedo dedicarle unas ${ctx.hoursPerWeek} horas por semana.` : '',
    ctx.weeks ? `Quiero lograrlo en ${ctx.weeks} semanas.` : '',
    ctx.availability ? `Mi tiempo libre habitual: ${ctx.availability}.` : '',
  ];
  return parts.filter(Boolean).join(' ');
}

/** Formato y reglas del pack: lo mismo se pega en una IA externa o se envía a Gemini como instrucción de sistema. */
export function packInstructions(): string {
  return `Eres un mentor que diseña rutas de aprendizaje realistas. Devuelves SOLO un JSON (sin explicaciones antes ni después) con este formato, para importarlo en la app StudyQuest. Incluye únicamente las listas que tengan sentido para el objetivo; puedes dejar las demás vacías u omitirlas.

{
  "studyquest": "pack",
  "version": ${PACK_VERSION},
  "courses": [
    {
      "title": "Nombre del curso",
      "professor": "Plataforma o autor (opcional)",
      "field": "Área, p. ej. programación",
      "link": "https://... enlace al curso si es de una plataforma (opcional)",
      "modules": [
        { "title": "Módulo 1", "summary": "De qué trata", "xp": 150, "topics": ["Tema 1", "Tema 2"] }
      ]
    }
  ],
  "goals": [
    {
      "title": "Lo que quiero lograr a largo plazo",
      "deadlineInDays": 90,
      "measure": "Cómo medir el avance: horas, entregables, cifras",
      "why": "Por qué importa (una frase)",
      "area": "growth",
      "rewardTitle": "Recompensa al terminar",
      "rewardDescription": "Cómo lo celebraré",
      "ifThen": [{ "when": "llego cansado del trabajo", "then": "hago solo 5 minutos de práctica" }],
      "milestones": [
        { "title": "Hito 1", "summary": "Qué demuestra", "xp": 100, "skills": ["Habilidad 1", "Habilidad 2"] }
      ]
    }
  ],
  "projects": [
    {
      "title": "Algo que voy a construir",
      "summary": "Descripción breve",
      "kind": "main",
      "checkpoints": [
        { "title": "Primer entregable", "summary": "Opcional", "xp": 100 }
      ]
    }
  ],
  "habits": [
    {
      "title": "Estudiar 30 minutos",
      "goal": "Título EXACTO de la meta a la que aporta (o null)",
      "frequency": { "type": "daily" },
      "measure": "minutes",
      "target": 30,
      "minTarget": 5,
      "xp": 30,
      "reminder": "19:00",
      "area": "growth",
      "steps": []
    }
  ],
  "tasks": [
    {
      "title": "Instalar el entorno",
      "course": "Título EXACTO de uno de los cursos de arriba (o null)",
      "goal": "Título EXACTO de la meta a la que aporta (o null)",
      "priority": "mid",
      "dueInDays": 0,
      "estimateMin": 15,
      "xp": 35,
      "area": "growth",
      "subtasks": ["Paso 1", "Paso 2"],
      "tags": ["setup"]
    }
  ]
}

Reglas del formato:
- Solo JSON válido: comillas dobles rectas, sin comentarios ni comas sobrantes.
- No inventes ids ni fechas. Las tareas usan "dueInDays" = días desde hoy (0 = hoy) y la meta "deadlineInDays".
- Enlaza todo por título: cada tarea y cada hábito lleva en "goal" el título EXACTO de la meta, y cada tarea de estudio en "course" el título EXACTO de su curso.
- LA PRIMERA TAREA debe poder hacerse HOY ("dueInDays": 0) en 15 minutos o menos: un primer paso pequeño y concreto, para vencer la inercia.
- Cada hábito lleva una versión mínima ("minTarget", menor que "target", p. ej. 5 de 30 minutos) para los días malos, y la meta un plan "ifThen" realista.
- "frequency": {"type":"daily"} | {"type":"days","days":[0,2,4]} (0 = lunes … 6 = domingo) | {"type":"every","every":3} | {"type":"weekly"} | {"type":"monthly"} | {"type":"custom","times":3,"per":"week"}.
- "measure": times | minutes | hours | pages | exercises | tasks | percent | boolean.
- "priority": low | mid | high | boss (boss = entrega final, la más difícil).
- "area" (opcional): career | health | money | people | growth | home.
- "link" del curso: URL real de la plataforma (Udemy, Coursera, YouTube, campus…). Si no estás seguro de que exista, omítelo: no inventes enlaces.
- "kind" de un proyecto: main (principal) o side (secundario).
- "xp" es opcional; si lo pones, entre 10 y 150 en tareas y hábitos, y hasta 600 en módulos, hitos y checkpoints.
- Adapta la ruta al nivel y al tiempo indicados: si ya domino algo, no lo repitas; reparte las tareas de forma realista con "dueInDays" y "estimateMin" (puedo acelerar o aflojar el ritmo después) y no pongas más trabajo por semana del que cabe en mis horas.
- Máximo ~10 módulos por curso, ~8 temas por módulo y ~25 tareas en total.
- Escribe todo en español.`;
}

/** Instrucciones completas para pegarle a una IA externa (ChatGPT, Claude…). */
export function packPrompt(topic = '', ctx: PackContext = {}): string {
  const what = topic.trim() || '[ESCRIBE AQUÍ LO QUE QUIERES APRENDER]';
  const extra = contextText(ctx);
  return `Quiero aprender: ${what}${extra ? `\n${extra}` : ''}\n\n${packInstructions()}`;
}

/** Esquema de la respuesta para Gemini (salida estructurada): el modelo devuelve exactamente esta forma. */
const str = { type: 'string' } as const;
const strList = { type: 'array', items: str } as const;
const num = { type: 'number' } as const;
export const PACK_SCHEMA = {
  type: 'object',
  properties: {
    studyquest: str,
    version: num,
    courses: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: str, professor: str, field: str, link: str,
          modules: { type: 'array', items: { type: 'object', properties: { title: str, summary: str, xp: num, topics: strList }, required: ['title', 'topics'] } },
        },
        required: ['title', 'modules'],
      },
    },
    goals: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: str, deadlineInDays: num, measure: str, why: str, area: str, rewardTitle: str, rewardDescription: str,
          ifThen: { type: 'array', items: { type: 'object', properties: { when: str, then: str }, required: ['when', 'then'] } },
          milestones: { type: 'array', items: { type: 'object', properties: { title: str, summary: str, xp: num, skills: strList }, required: ['title'] } },
        },
        required: ['title', 'milestones'],
      },
    },
    projects: {
      type: 'array',
      items: {
        type: 'object',
        properties: { title: str, summary: str, kind: str, checkpoints: { type: 'array', items: { type: 'object', properties: { title: str, summary: str, xp: num }, required: ['title'] } } },
        required: ['title', 'checkpoints'],
      },
    },
    habits: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: str, goal: str, measure: str, target: num, minTarget: num, xp: num, reminder: str, area: str,
          frequency: { type: 'object', properties: { type: str, days: { type: 'array', items: num }, every: num, times: num, per: str }, required: ['type'] },
        },
        required: ['title', 'frequency', 'measure', 'target'],
      },
    },
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: { title: str, course: str, goal: str, priority: str, dueInDays: num, estimateMin: num, xp: num, area: str, subtasks: strList, tags: strList },
        required: ['title', 'dueInDays', 'estimateMin'],
      },
    },
  },
  required: ['studyquest', 'version'],
} as const;
