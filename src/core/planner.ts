/**
 * Planificador inteligente: convierte una ruta de aprendizaje (Excel → SQL → Python → …) en un plan con fechas
 * que respeta tu disponibilidad y lo que ya tienes en la agenda. Todo son funciones puras, sin IA:
 * la IA (o una plantilla) solo aporta el temario; el reparto en el tiempo lo calcula este código.
 */
import type { Course, Goal, Habit, HabitLog, ISODate, Task } from './domain';
import { addDays, diffDays, isoNow, newId, shortDate, today, weekStart, weekdayIndex } from './dates';
import { isDueOn } from './game';
import { parseRoadmap, type Roadmap, type RoadmapModule } from './roadmap';

export { parseRoadmap };
export type { Roadmap, RoadmapModule, Level, RoadmapRequest } from './roadmap';

/* ---------- Disponibilidad ---------- */

/** Minutos libres por día de la semana (0 = lunes … 6 = domingo). */
export const DEFAULT_WEEK_MINUTES: number[] = [90, 90, 90, 90, 90, 150, 150];

export const sanitizeWeek = (raw: unknown): number[] =>
  Array.from({ length: 7 }, (_, i) => {
    const v = Array.isArray(raw) ? raw[i] : undefined;
    return typeof v === 'number' && Number.isFinite(v) ? Math.min(720, Math.max(0, Math.round(v / 15) * 15)) : DEFAULT_WEEK_MINUTES[i];
  });

export const weekTotal = (week: number[]) => week.reduce((a, b) => a + b, 0);

/**
 * Minutos que ya tienes comprometidos cada día: tareas pendientes con fecha (según su estimación)
 * y hábitos medidos en minutos u horas que tocan ese día.
 */
export function busyMinutes(
  data: { tasks: Task[]; habits: Habit[]; habitLogs: HabitLog[] },
  start: ISODate,
  end: ISODate,
): Record<ISODate, number> {
  const busy: Record<ISODate, number> = {};
  const add = (d: ISODate, m: number) => void (busy[d] = (busy[d] ?? 0) + m);
  for (const t of data.tasks) if (t.status !== 'done' && t.dueDate && t.dueDate >= start && t.dueDate <= end) add(t.dueDate, t.estimateMin);
  const timed = data.habits.filter((h) => h.measure === 'minutes' || h.measure === 'hours');
  if (timed.length) {
    for (let d = start; d <= end; d = addDays(d, 1)) {
      for (const h of timed) if (isDueOn(h, d, data.habitLogs)) add(d, h.measure === 'hours' ? h.target * 60 : h.target);
    }
  }
  return busy;
}

/* ---------- Reparto en el tiempo ---------- */

export interface PlanItem {
  title: string;
  minutes: number;
  topics: string[];
  kind: 'module' | 'project';
}

/** Un tramo de estudio de un día concreto. */
export interface Slice {
  date: ISODate;
  item: number;
  minutes: number;
  /** Minutos del ítem ya estudiados antes de este tramo. */
  offset: number;
}

/** Trabajo de una semana en un módulo (será una tarea). */
export interface Chunk {
  item: number;
  week: ISODate;
  dueDate: ISODate;
  minutes: number;
  topics: string[];
}

export interface Schedule {
  items: PlanItem[];
  slices: Slice[];
  chunks: Chunk[];
  ranges: { item: number; start: ISODate; end: ISODate }[];
  neededMin: number;
  capacityMin: number;
  /** 1 = cabe todo; menos de 1 = se recortaron las horas para que quepa. */
  coverage: number;
  endsOn: ISODate | null;
  warnings: string[];
  ok: boolean;
}

export interface ScheduleInput {
  roadmap: Roadmap;
  start: ISODate;
  end: ISODate;
  weekly: number[];
  busy?: Record<ISODate, number>;
  blocked?: ISODate[];
}

export const toItems = (r: Roadmap): PlanItem[] => [
  ...r.modules.map((m): PlanItem => ({ title: m.title, minutes: Math.round(m.hours * 60), topics: m.topics, kind: 'module' })),
  { title: r.project.title, minutes: Math.round(r.project.hours * 60), topics: r.project.steps, kind: 'project' },
];

const fmtH = (min: number) => `${+(min / 60).toFixed(1)} h`;

export function schedulePlan(input: ScheduleInput): Schedule {
  const { roadmap, start, end, weekly, busy = {}, blocked = [] } = input;
  const base = toItems(roadmap);
  const days: ISODate[] = [];
  for (let d = start; d <= end && days.length < 800; d = addDays(d, 1)) days.push(d);
  const blockedSet = new Set(blocked);
  const capOf = (d: ISODate) => (blockedSet.has(d) ? 0 : Math.max(0, weekly[weekdayIndex(d)] - (busy[d] ?? 0)));

  const capacityMin = days.reduce((a, d) => a + capOf(d), 0);
  const neededMin = base.reduce((a, i) => a + i.minutes, 0);
  const warnings: string[] = [];
  const empty = { slices: [], chunks: [], ranges: [], endsOn: null };

  if (!days.length || capacityMin <= 0) {
    warnings.push('No tienes tiempo libre entre hoy y la fecha objetivo. Añade horas a tu semana o amplía el plazo.');
    return { items: base, ...empty, neededMin, capacityMin, coverage: 0, warnings, ok: false };
  }

  // Si no cabe, se recortan todas las horas por igual (se redondea hacia abajo a bloques de 5 min: nunca se pasa de la capacidad).
  const coverage = Math.min(1, capacityMin / neededMin);
  const items = coverage < 1 ? base.map((i) => ({ ...i, minutes: Math.max(5, Math.floor((i.minutes * coverage) / 5) * 5) })) : base;

  const slices: Slice[] = [];
  let di = 0;
  let cap = capOf(days[0]);
  items.forEach((item, idx) => {
    let left = item.minutes;
    let offset = 0;
    while (left > 0) {
      while (cap <= 0 && di < days.length - 1) cap = capOf(days[++di]);
      if (cap <= 0) break;
      const take = Math.min(cap, left);
      slices.push({ date: days[di], item: idx, minutes: take, offset });
      cap -= take;
      left -= take;
      offset += take;
    }
  });

  // Cada tema cae en el tramo que contiene su punto medio: todos los temas aparecen una vez.
  const topicSlice = (idx: number, topic: number): Slice | undefined => {
    const item = items[idx];
    const mid = ((topic + 0.5) * item.minutes) / item.topics.length;
    return slices.find((s) => s.item === idx && mid >= s.offset && mid < s.offset + s.minutes) ?? slices.filter((s) => s.item === idx).at(-1);
  };
  const chunkMap = new Map<string, Chunk>();
  for (const s of slices) {
    const week = weekStart(s.date);
    const key = `${s.item}|${week}`;
    const c = chunkMap.get(key);
    if (c) {
      c.minutes += s.minutes;
      c.dueDate = s.date > c.dueDate ? s.date : c.dueDate;
    } else chunkMap.set(key, { item: s.item, week, dueDate: s.date, minutes: s.minutes, topics: [] });
  }
  items.forEach((item, idx) =>
    item.topics.forEach((topic, t) => {
      const s = topicSlice(idx, t);
      if (s) chunkMap.get(`${idx}|${weekStart(s.date)}`)?.topics.push(topic);
    }),
  );
  const chunks = [...chunkMap.values()].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.item - b.item);

  const ranges = items.flatMap((_, idx) => {
    const own = slices.filter((s) => s.item === idx);
    return own.length ? [{ item: idx, start: own[0].date, end: own[own.length - 1].date }] : [];
  });
  const endsOn = slices.at(-1)?.date ?? null;

  const weeksSpan = Math.max(1, days.length / 7);
  if (coverage < 1) {
    const perWeek = neededMin / 60 / weeksSpan;
    const have = capacityMin / 60 / weeksSpan;
    const weeksNeeded = Math.ceil(neededMin / (capacityMin / weeksSpan));
    warnings.push(
      `Con tu disponibilidad caben ${fmtH(capacityMin)} de las ${fmtH(neededMin)} que pide la ruta (${Math.round(coverage * 100)}%). ` +
        `Necesitarías ~${perWeek.toFixed(1)} h por semana (tienes ${have.toFixed(1)}) o ampliar el plazo a ~${weeksNeeded} semanas. He recortado las horas de cada módulo para que quepa.`,
    );
  } else if (endsOn && diffDays(end, endsOn) >= 14) {
    warnings.push(`Terminarías el ${shortDate(endsOn)}, ${Math.floor(diffDays(end, endsOn) / 7)} semanas antes del plazo: tienes margen para ir más tranquilo.`);
  }
  return { items, slices, chunks, ranges, neededMin, capacityMin, coverage, endsOn, warnings, ok: true };
}

/* ---------- Del plan a los datos de la app ---------- */

export interface PlanEntities {
  course: Course;
  goal: Goal;
  habit: Habit;
  tasks: Task[];
}

export function buildPlanEntities(roadmap: Roadmap, schedule: Schedule, weekly: number[], now: ISODate = today()): PlanEntities {
  const created = isoNow();
  const { items } = schedule;
  const title = roadmap.goal;

  const course: Course = {
    id: newId(), title, professor: 'Plan inteligente', field: 'plan de estudio', mentor: null, createdAt: created,
    modules: items.map((it) => ({
      id: newId(), title: it.title, summary: `${fmtH(it.minutes)} de estudio`, xp: Math.max(100, Math.round(it.minutes / 60) * 20),
      topics: it.topics.map((t) => ({ id: newId(), title: t, status: 'todo' as const, review: false, markedAt: null })),
    })),
  };

  const goal: Goal = {
    id: newId(), title, createdAt: created,
    rewardTitle: `Ruta completada: ${title}`,
    rewardDescription: 'Terminaste tu plan de estudio de principio a fin. ¡Celébralo!',
    milestones: items.map((it) => ({
      id: newId(), title: it.title, summary: `${fmtH(it.minutes)} · ${it.topics.length} temas`, xp: it.kind === 'project' ? 500 : Math.max(100, Math.round(it.minutes / 60) * 10), done: false,
      skills: it.kind === 'project' ? [] : it.topics.map((t) => ({ id: newId(), label: t, done: false })),
    })),
  };

  const tasks: Task[] = schedule.chunks
    .filter((c) => items[c.item].kind === 'module')
    .map((c) => ({
      id: newId(), title: `${items[c.item].title} · semana del ${shortDate(c.week < now ? now : c.week)}`, courseId: course.id, priority: 'mid' as const, status: 'todo' as const,
      dueDate: c.dueDate, estimateMin: c.minutes, xp: Math.min(150, Math.max(20, Math.round(c.minutes / 10) * 5)),
      subtasks: c.topics.map((t) => ({ id: newId(), title: t, done: false })), tags: ['plan'], createdAt: created, completedAt: null,
    }));

  const projectIdx = items.findIndex((i) => i.kind === 'project');
  const range = schedule.ranges.find((r) => r.item === projectIdx);
  if (projectIdx >= 0 && range) {
    const p = items[projectIdx];
    tasks.push({
      id: newId(), title: p.title, courseId: course.id, priority: 'boss', status: 'todo', dueDate: range.end, estimateMin: p.minutes, xp: 120,
      subtasks: p.topics.map((t) => ({ id: newId(), title: t, done: false })), tags: ['plan', 'proyecto final'], createdAt: created, completedAt: null,
    });
  }

  const studyDays = weekly.flatMap((m, i) => (m > 0 ? [i] : []));
  const avg = studyDays.length ? weekTotal(weekly) / studyDays.length : 30;
  const habit: Habit = {
    id: newId(), title: `Estudiar ${title}`, frequency: studyDays.length === 7 || !studyDays.length ? { type: 'daily' } : { type: 'days', days: studyDays },
    measure: 'minutes', target: Math.max(10, Math.round(avg / 5) * 5), xp: 30, reminder: null, steps: [], startDate: now, createdAt: created,
  };

  return { course, goal, habit, tasks };
}

/* ---------- Plantillas (funcionan sin conexión y sin IA) ---------- */

export interface Template {
  id: string;
  name: string;
  keywords: string[];
  summary: string;
  modules: RoadmapModule[];
  project: Roadmap['project'];
}

export const TEMPLATES: Template[] = [
  {
    id: 'datos', name: 'Análisis de datos', keywords: ['dato', 'datos', 'analisis', 'analytics', 'sql', 'excel', 'power bi', 'pandas', 'data'],
    summary: 'De las hojas de cálculo a un dashboard completo: Excel, SQL, Python, Pandas y Power BI.',
    modules: [
      { title: 'Excel', hours: 12, topics: ['Fórmulas esenciales', 'Tablas dinámicas', 'Limpieza de datos', 'Gráficos'] },
      { title: 'SQL', hours: 16, topics: ['SELECT y WHERE', 'GROUP BY y agregaciones', 'JOINs', 'Subconsultas'] },
      { title: 'Python', hours: 18, topics: ['Sintaxis y tipos', 'Listas y diccionarios', 'Funciones', 'Archivos y CSV'] },
      { title: 'Pandas', hours: 16, topics: ['Series y DataFrames', 'Selección y filtros', 'Limpieza de nulos', 'groupby y merge'] },
      { title: 'Power BI', hours: 14, topics: ['Conexión a datos', 'Modelo y relaciones', 'Medidas DAX básicas', 'Dashboards'] },
    ],
    project: { title: 'Proyecto final: dashboard de ventas', hours: 24, steps: ['Elegir dataset y pregunta', 'Limpiar y explorar', 'Analizar con SQL o Pandas', 'Construir el dashboard', 'Presentar hallazgos'] },
  },
  {
    id: 'web', name: 'Desarrollo web', keywords: ['web', 'frontend', 'html', 'css', 'javascript', 'react', 'pagina', 'programacion'],
    summary: 'Construye sitios reales: HTML, CSS, JavaScript, React y despliegue.',
    modules: [
      { title: 'HTML y CSS', hours: 14, topics: ['Estructura semántica', 'Selectores y cascada', 'Flexbox y Grid', 'Diseño responsive'] },
      { title: 'JavaScript', hours: 20, topics: ['Variables y funciones', 'Arrays y objetos', 'DOM y eventos', 'Async y fetch'] },
      { title: 'Git y herramientas', hours: 6, topics: ['Git básico', 'GitHub', 'Terminal', 'npm'] },
      { title: 'React', hours: 18, topics: ['Componentes y props', 'Estado y hooks', 'Formularios', 'Rutas'] },
      { title: 'APIs y despliegue', hours: 10, topics: ['Consumir una API', 'Variables de entorno', 'Desplegar en Render o Netlify'] },
    ],
    project: { title: 'Proyecto final: mi portafolio', hours: 20, steps: ['Diseñar la página', 'Maquetar con React', 'Conectar una API', 'Desplegar', 'Escribir el README'] },
  },
  {
    id: 'ingles', name: 'Inglés', keywords: ['ingles', 'english', 'idioma', 'toefl', 'ielts', 'b1', 'b2'],
    summary: 'Gramática, vocabulario, listening y conversación con práctica constante.',
    modules: [
      { title: 'Gramática base', hours: 14, topics: ['Presente y pasado', 'Present perfect', 'Futuro', 'Condicionales'] },
      { title: 'Vocabulario', hours: 12, topics: ['Vida diaria', 'Trabajo y estudios', 'Viajes', 'Phrasal verbs'] },
      { title: 'Listening', hours: 12, topics: ['Podcasts lentos', 'Series con subtítulos', 'Dictados', 'Acentos'] },
      { title: 'Speaking', hours: 14, topics: ['Presentarte', 'Conversaciones cotidianas', 'Pronunciación', 'Grabarte y corregir'] },
      { title: 'Reading y writing', hours: 10, topics: ['Lecturas graduadas', 'Correos', 'Ensayos cortos'] },
    ],
    project: { title: 'Proyecto final: presentación de 5 minutos', hours: 8, steps: ['Elegir tema', 'Escribir el guion', 'Ensayar', 'Grabar y corregir', 'Presentarla'] },
  },
  {
    id: 'ux', name: 'Diseño UX/UI', keywords: ['diseno', 'ux', 'ui', 'figma', 'interfaz', 'producto'],
    summary: 'Investigación, wireframes, diseño visual y prototipos en Figma.',
    modules: [
      { title: 'Fundamentos de UX', hours: 10, topics: ['Qué es UX', 'Usuarios y personas', 'Investigación', 'Flujos'] },
      { title: 'Wireframes', hours: 10, topics: ['Bocetos a mano', 'Arquitectura de información', 'Wireframes digitales'] },
      { title: 'Diseño visual', hours: 14, topics: ['Tipografía', 'Color y contraste', 'Rejillas y espacio', 'Componentes'] },
      { title: 'Figma', hours: 14, topics: ['Interfaz y frames', 'Auto layout', 'Componentes y variantes', 'Prototipos'] },
      { title: 'Pruebas de usabilidad', hours: 8, topics: ['Plan de pruebas', 'Moderar una sesión', 'Analizar resultados'] },
    ],
    project: { title: 'Proyecto final: rediseño de una app', hours: 20, steps: ['Elegir una app', 'Investigar usuarios', 'Diseñar wireframes', 'Prototipar en Figma', 'Probar y mejorar'] },
  },
  {
    id: 'marketing', name: 'Marketing digital', keywords: ['marketing', 'redes', 'seo', 'publicidad', 'ads', 'contenido', 'ventas'],
    summary: 'Estrategia, contenido, SEO, anuncios y métricas para hacer crecer un proyecto.',
    modules: [
      { title: 'Estrategia', hours: 8, topics: ['Público objetivo', 'Propuesta de valor', 'Embudo de ventas', 'Objetivos y KPI'] },
      { title: 'Contenido y redes', hours: 12, topics: ['Calendario editorial', 'Copywriting', 'Video corto', 'Comunidad'] },
      { title: 'SEO', hours: 10, topics: ['Palabras clave', 'SEO on-page', 'Enlaces', 'Herramientas'] },
      { title: 'Publicidad de pago', hours: 12, topics: ['Meta Ads', 'Google Ads', 'Presupuesto y pujas', 'Creatividades'] },
      { title: 'Analítica', hours: 10, topics: ['Google Analytics', 'Métricas clave', 'Pruebas A/B', 'Informes'] },
    ],
    project: { title: 'Proyecto final: campaña completa', hours: 16, steps: ['Definir el objetivo', 'Diseñar el embudo', 'Crear el contenido', 'Lanzar la campaña', 'Medir y reportar'] },
  },
];

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Deja un título limpio a partir de la frase del usuario:
 * «Quiero aprender análisis de datos en 3 meses» → «Análisis de datos».
 */
export function cleanGoal(text: string): string {
  let g = text.trim().replace(/[.!¡¿?]+$/g, '');
  g = g.replace(/^(?:quiero|quisiera|necesito|deseo|voy a|me gustaría|me gustaria)\s+/i, '');
  g = g.replace(/^(?:aprender|estudiar|dominar|mejorar|hacer|crear|sacar|aprobar)\s+(?:a\s+|el\s+|la\s+|mi\s+)?/i, '');
  g = g.replace(/\s+(?:en|durante|para|de aquí a|dentro de)\s+(?:\d+|un|una|dos|tres|cuatro|seis|doce)\s+(?:d[ií]as?|semanas?|meses|mes|a[ñn]os?)\b.*$/i, '');
  g = g.trim();
  return g ? g.charAt(0).toUpperCase() + g.slice(1) : text.trim();
}

/** Palabras sueltas del texto, sin tildes ni mayúsculas. */
const words = (s: string): string[] => normalize(s).match(/[a-z0-9]+/g) ?? [];

/** ¿Aparece la palabra clave? Palabras completas (así «ui» no salta con «quiero»); las largas admiten terminaciones (dato → datos). */
function hasKeyword(text: string[], keyword: string): boolean {
  const parts = words(keyword);
  if (parts.length > 1) return text.some((_, i) => parts.every((p, k) => text[i + k] === p));
  const [kw] = parts;
  return text.some((w) => w === kw || (kw.length >= 4 && w.startsWith(kw)));
}

/** Plantilla que mejor encaja con lo que escribió el usuario (null si ninguna palabra clave coincide). */
export function matchTemplate(goal: string): Template | null {
  const text = words(goal);
  let best: { t: Template; hits: number } | null = null;
  for (const t of TEMPLATES) {
    const hits = t.keywords.filter((k) => hasKeyword(text, k)).length;
    if (hits > (best?.hits ?? 0)) best = { t, hits };
  }
  return best?.t ?? null;
}

/** La plantilla convertida en ruta, con las horas escaladas al presupuesto de horas del usuario. */
export function templateRoadmap(t: Template, goal: string, budgetHours?: number): Roadmap {
  const total = t.modules.reduce((a, m) => a + m.hours, 0) + t.project.hours;
  const k = budgetHours && budgetHours > 0 ? Math.min(2, Math.max(0.5, budgetHours / total)) : 1;
  const scale = (h: number) => Math.max(2, Math.round(h * k * 2) / 2);
  return {
    goal: goal.trim() || t.name,
    summary: t.summary,
    modules: t.modules.map((m) => ({ ...m, hours: scale(m.hours) })),
    project: { ...t.project, hours: scale(t.project.hours) },
  };
}

/* ---------- Rutas hechas a mano y edición ---------- */

export const MAX_MODULES = 12;
export const MAX_TOPICS = 12;

/** Ruta para empezar de cero: un módulo vacío y el proyecto final por rellenar. */
export function blankRoadmap(goal: string): Roadmap {
  return { goal: goal.trim() || 'Mi meta', summary: '', modules: [{ title: '', hours: 6, topics: [''] }], project: { title: `Proyecto final: ${goal.trim() || 'mi meta'}`, hours: 8, steps: [''] } };
}

const clampHours = (h: number) => Math.min(80, Math.max(1, Math.round((Number.isFinite(h) ? h : 1) * 2) / 2));

/** Limpia lo que el usuario dejó a medias: recorta textos, quita temas/pasos vacíos, descarta módulos totalmente vacíos y acota las horas. */
export function cleanRoadmap(r: Roadmap): Roadmap {
  const list = (xs: string[]) => xs.map((x) => x.replace(/\s+/g, ' ').trim().slice(0, 80)).filter(Boolean).slice(0, MAX_TOPICS);
  return {
    goal: r.goal.replace(/\s+/g, ' ').trim().slice(0, 120),
    summary: r.summary,
    modules: r.modules
      .map((m) => ({ title: m.title.replace(/\s+/g, ' ').trim().slice(0, 80), hours: clampHours(m.hours), topics: list(m.topics) }))
      .filter((m) => m.title || m.topics.length)
      .slice(0, MAX_MODULES),
    project: { title: r.project.title.replace(/\s+/g, ' ').trim().slice(0, 80), hours: clampHours(r.project.hours), steps: list(r.project.steps) },
  };
}

/** Problemas que impiden crear el plan (ya sobre la ruta limpia). Vacío = lista para crear. */
export function validateRoadmap(r: Roadmap): string[] {
  const problems: string[] = [];
  if (!r.goal) problems.push('Ponle un nombre a tu meta.');
  if (!r.modules.length) problems.push('Añade al menos un módulo.');
  r.modules.forEach((m, i) => {
    if (!m.title) problems.push(`El módulo ${i + 1} no tiene nombre.`);
    else if (!m.topics.length) problems.push(`El módulo «${m.title}» necesita al menos un tema.`);
  });
  if (!r.project.title) problems.push('El proyecto final necesita un nombre.');
  if (!r.project.steps.length) problems.push('El proyecto final necesita al menos un paso.');
  return problems;
}
