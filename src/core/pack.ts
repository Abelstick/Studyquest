/**
 * «Pack de aprendizaje»: un JSON que le pides a cualquier IA (ChatGPT, Claude, Gemini…) y pegas en la app
 * para crear de golpe cursos, metas, proyectos, hábitos y tareas.
 *
 * El formato no lleva ids ni fechas absolutas (la IA no conoce el día de hoy): las tareas usan
 * `dueInDays` y se vinculan al curso por su título. Aquí se lee, valida y convierte a entidades de la app.
 * Nada de lo que venga de la IA se usa sin pasar por `parsePack`. Lógica pura, sin React ni base de datos.
 */
import { safeUrl } from './certifications';
import type { Course, Frequency, Goal, Habit, ISODate, Measure, Priority, Project, Task } from './domain';
import { addDays, isoNow, newId, today } from './dates';
import { XP_BY_PRIORITY } from './game';

export const PACK_VERSION = 1;

export interface Pack {
  courses: Omit<Course, 'id' | 'createdAt' | 'planId' | 'mentor'>[];
  goals: Omit<Goal, 'id' | 'createdAt' | 'planId'>[];
  projects: Omit<Project, 'id' | 'createdAt'>[];
  habits: Omit<Habit, 'id' | 'createdAt' | 'startDate' | 'planId'>[];
  /** `course` es el título del curso (del mismo pack o ya existente) al que se vincula. */
  tasks: (Omit<Task, 'id' | 'createdAt' | 'completedAt' | 'courseId' | 'dueDate'> & { course: string | null; dueInDays: number | null; dueDate: ISODate | null })[];
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

/** Quita las vallas ``` y el texto alrededor: las IA suelen envolver el JSON en una explicación. */
export function extractJson(raw: string): unknown {
  const s = raw.trim();
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : s;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('sin JSON');
  return JSON.parse(candidate.slice(start, end + 1));
}

function parseFrequency(v: unknown): Frequency {
  const o = isObj(v) ? v : { type: v };
  switch (o.type) {
    case 'days': {
      const days = [...new Set(arr(o.days).filter((d): d is number => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6))].sort();
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

export function parsePack(raw: string): PackResult {
  let json: unknown;
  try {
    json = extractJson(raw);
  } catch {
    return { ok: false, error: 'No encuentro un JSON en lo que pegaste. Copia la respuesta completa de la IA (con las llaves { }).' };
  }
  if (!isObj(json)) return { ok: false, error: 'El JSON debe ser un objeto con cursos, metas, proyectos, hábitos o tareas.' };
  if (typeof json.version === 'number' && json.version > PACK_VERSION) return { ok: false, error: 'Este pack es de una versión más nueva de StudyQuest. Actualiza la app.' };

  const warnings: string[] = [];
  const skipped: Record<string, number> = {};
  const skip = (what: string) => void (skipped[what] = (skipped[what] ?? 0) + 1);
  const each = <T>(key: string, label: string, fn: (o: Obj) => T | null): T[] =>
    arr(json[key]).slice(0, LIMITS.items).flatMap((x) => {
      const out = isObj(x) ? fn(x) : null;
      if (!out) skip(label);
      return out ? [out] : [];
    });

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
          id: '', title: text(m.title, 100), summary: text(m.summary, 200), xp: int(m.xp, Math.max(100, topics.length * 25), 10, 5000),
          topics: topics.map((t) => ({ id: '', title: t, status: 'todo' as const, review: false, markedAt: null })),
        }];
      }),
    };
  });

  const goals: Pack['goals'] = each('goals', 'metas', (o) => {
    const title = text(o.title);
    if (!title) return null;
    return {
      title, rewardTitle: text(o.rewardTitle, 100) || `Meta cumplida: ${title}`, rewardDescription: text(o.rewardDescription, 200) || '¡Lo lograste! Celébralo.',
      milestones: arr(o.milestones).slice(0, LIMITS.children).flatMap((m) => {
        if (!isObj(m) || !text(m.title)) return [];
        return [{
          id: '', title: text(m.title, 100), summary: text(m.summary, 200), xp: int(m.xp, 100, 10, 5000), done: false,
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
        return [{ id: '', title: titleOf(c), summary: text(o2.summary, 200), xp: int(o2.xp, 100, 10, 5000), done: false }];
      }),
    };
  });

  const habits: Pack['habits'] = each('habits', 'hábitos', (o) => {
    const title = text(o.title);
    if (!title) return null;
    const measure = MEASURES.includes(o.measure as Measure) ? (o.measure as Measure) : 'times';
    return {
      title, frequency: parseFrequency(o.frequency), measure, target: measure === 'boolean' ? 1 : int(o.target, measure === 'minutes' ? 30 : 1, 1, 10000),
      xp: int(o.xp, 30, 0, 1000), reminder: /^([01]\d|2[0-3]):[0-5]\d$/.test(text(o.reminder, 5)) ? text(o.reminder, 5) : null,
      steps: arr(o.steps).slice(0, 12).flatMap((s) => (titleOf(s) ? [{ id: '', title: titleOf(s), minutes: int(isObj(s) ? s.minutes : 0, 0, 0, 240) }] : [])),
    };
  });

  const tasks: Pack['tasks'] = each('tasks', 'tareas', (o) => {
    const title = text(o.title);
    if (!title) return null;
    const priority = PRIORITIES.includes(o.priority as Priority) ? (o.priority as Priority) : 'mid';
    const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(text(o.dueDate, 10)) ? text(o.dueDate, 10) : null;
    return {
      title, course: text(o.course, 120) || null, priority, status: 'todo', estimateMin: int(o.estimateMin, 30, 5, 1440),
      dueDate, dueInDays: typeof o.dueInDays === 'number' && Number.isFinite(o.dueInDays) ? int(o.dueInDays, 0, 0, 730) : null,
      xp: int(o.xp, XP_BY_PRIORITY[priority], 0, 1000),
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

/**
 * Convierte el pack en entidades listas para guardar: ids nuevos y fechas resueltas desde hoy.
 * `existingCourses` permite vincular tareas a cursos que ya tenías (por título, sin distinguir mayúsculas).
 */
export function buildPackEntities(pack: Pack, existingCourses: Pick<Course, 'id' | 'title'>[] = [], now: ISODate = today()): PackEntities {
  const created = isoNow();
  const withIds = <T extends { id: string }>(xs: T[]): T[] => xs.map((x) => ({ ...x, id: newId() }));

  const courses: Course[] = pack.courses.map((c) => ({
    ...c, id: newId(), mentor: null, createdAt: created,
    modules: withIds(c.modules).map((m) => ({ ...m, topics: withIds(m.topics) })),
  }));
  const goals: Goal[] = pack.goals.map((g) => ({
    ...g, id: newId(), createdAt: created,
    milestones: withIds(g.milestones).map((m) => ({ ...m, skills: withIds(m.skills) })),
  }));
  const projects: Project[] = pack.projects.map((p) => ({ ...p, id: newId(), createdAt: created, checkpoints: withIds(p.checkpoints) }));
  const habits: Habit[] = pack.habits.map((h) => ({ ...h, id: newId(), startDate: now, createdAt: created, steps: withIds(h.steps) }));

  const byTitle = new Map([...existingCourses, ...courses].map((c) => [c.title.toLowerCase(), c.id]));
  const tasks: Task[] = pack.tasks.map(({ course, dueInDays, dueDate, ...t }) => ({
    ...t, id: newId(), createdAt: created, completedAt: null,
    courseId: course ? (byTitle.get(course.toLowerCase()) ?? null) : null,
    dueDate: dueDate ?? (dueInDays !== null ? addDays(now, dueInDays) : null),
    subtasks: withIds(t.subtasks),
  }));
  return { courses, goals, projects, habits, tasks };
}

/** Instrucciones para pegarle a la IA. Describe el formato exacto que la app sabe leer. */
export function packPrompt(topic = ''): string {
  const what = topic.trim() || '[ESCRIBE AQUÍ LO QUE QUIERES APRENDER, tu nivel y cuánto tiempo tienes]';
  return `Eres un mentor que diseña rutas de aprendizaje. Quiero aprender: ${what}

Devuélveme SOLO un bloque de código JSON (sin explicaciones antes ni después) con este formato, para importarlo en la app StudyQuest. Incluye únicamente las listas que tengan sentido para mi objetivo; puedes dejar las demás vacías u omitirlas.

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
      "rewardTitle": "Recompensa al terminar",
      "rewardDescription": "Cómo lo celebraré",
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
      "frequency": { "type": "daily" },
      "measure": "minutes",
      "target": 30,
      "xp": 30,
      "reminder": "19:00",
      "steps": []
    }
  ],
  "tasks": [
    {
      "title": "Instalar el entorno",
      "course": "Nombre EXACTO de uno de los cursos de arriba (o null)",
      "priority": "mid",
      "dueInDays": 3,
      "estimateMin": 45,
      "xp": 35,
      "subtasks": ["Paso 1", "Paso 2"],
      "tags": ["setup"]
    }
  ]
}

Reglas del formato:
- Solo JSON válido: comillas dobles, sin comentarios ni comas sobrantes.
- No inventes ids ni fechas. Las tareas usan "dueInDays" = días desde hoy (0 = hoy).
- "frequency": {"type":"daily"} | {"type":"days","days":[0,2,4]} (0 = lunes … 6 = domingo) | {"type":"every","every":3} | {"type":"weekly"} | {"type":"monthly"} | {"type":"custom","times":3,"per":"week"}.
- "measure": times | minutes | hours | pages | exercises | tasks | percent | boolean.
- "priority": low | mid | high | boss (boss = entrega final, la más difícil).
- "link" del curso: URL real de la plataforma (Udemy, Coursera, YouTube, campus…). Si no estás seguro de que exista, omítelo: no inventes enlaces.
- "kind" de un proyecto: main (principal) o side (secundario).
- "xp" es opcional; si lo pones, entre 10 y 500 según la dificultad.
- Máximo ~10 módulos por curso, ~8 temas por módulo y ~25 tareas en total.
- Escribe todo en español.`;
}
