/**
 * Sugerencia de categoría y reparto de atributos a partir del nombre de un hábito, tarea, curso…
 *
 * Es determinista y sin red: se usa al crear algo (la pantalla propone y la persona decide) y al
 * inferir la categoría de lo que se creó antes de que existiera. También queda expuesta como
 * herramienta (`SUGGEST_MAPPING_TOOL`) para que la asistente Sofía la llame al crear hábitos
 * conversando; la IA puede mejorar la propuesta, pero esta respuesta siempre está disponible.
 */
import type { AreaId, AttributeMapping, CategoryId, Progressable } from '../domain';
import { CATEGORIES, DEFAULT_CATEGORY, categoryOf, isCategoryId } from './categories';
import { isAttributeId } from './attributes';

export type SuggestKind = 'task' | 'habit' | 'course' | 'goal' | 'project';

export interface SuggestContext {
  kind?: SuggestKind;
  area?: AreaId;
  /** Texto extra que ayuda (el campo de un curso, las etiquetas de una tarea…). */
  extra?: string;
  /** Categoría heredada (la del curso de una tarea): manda si el título no dice nada claro. */
  inherit?: CategoryId;
}

export interface MappingSuggestion {
  category: CategoryId;
  mapping: AttributeMapping;
  /** high: varias pistas claras · medium: una pista · low: no se reconoció nada y es un valor por defecto. */
  confidence: 'high' | 'medium' | 'low';
  /** Palabras que decidieron la categoría (vacío si es un valor por defecto). */
  matched: string[];
}

const STRONG = 2;
const WEAK = 1;

/** Minúsculas, sin tildes y solo letras y números separados por un espacio. */
export const normalize = (text: string): string =>
  ` ${text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim()} `;

/**
 * ¿Aparece la palabra clave? Las de varias palabras, tal cual; las cortas (≤ 3 letras: «sql», «git»),
 * como palabra entera; el resto, como inicio de palabra (así «libro» encuentra «libros»).
 */
function hits(text: string, keyword: string): boolean {
  if (keyword.includes(' ')) return text.includes(` ${keyword} `) || text.includes(` ${keyword}`);
  if (keyword.length <= 3) return text.includes(` ${keyword} `);
  return text.includes(` ${keyword}`);
}

const AREA_FALLBACK: Record<AreaId, CategoryId> = {
  career: 'trabajo',
  health: 'descanso',
  money: 'finanzas',
  people: 'ocio',
  growth: 'estudio',
  home: 'trabajo',
};

const KIND_FALLBACK: Partial<Record<SuggestKind, CategoryId>> = { course: 'curso', project: 'proyecto' };

export function suggestMapping(title: string, ctx: SuggestContext = {}): MappingSuggestion {
  const text = normalize(`${title} ${ctx.extra ?? ''}`);
  let best: { id: CategoryId; score: number; matched: string[] } | null = null;
  for (const c of CATEGORIES) {
    const strong = c.strong.filter((k) => hits(text, k));
    const weak = c.weak.filter((k) => hits(text, k));
    const score = strong.length * STRONG + weak.length * WEAK;
    if (score > 0 && (!best || score > best.score)) best = { id: c.id, score, matched: [...strong, ...weak] };
  }
  // Con una categoría heredada, el título solo manda si es una pista clara de OTRO atributo: «Repasar» en un
  // curso de inglés sigue siendo de inglés (los dos son Intelecto), pero «Ir al gimnasio» es gimnasio.
  const overrides = (id: CategoryId, score: number) =>
    !ctx.inherit || (score >= STRONG && categoryOf(id).mapping.primary !== categoryOf(ctx.inherit).mapping.primary);
  if (best && overrides(best.id, best.score)) {
    return { category: best.id, mapping: categoryOf(best.id).mapping, confidence: best.score >= STRONG * 2 ? 'high' : 'medium', matched: best.matched };
  }
  const fallback = ctx.inherit ?? (ctx.kind && KIND_FALLBACK[ctx.kind]) ?? (ctx.area && AREA_FALLBACK[ctx.area]) ?? DEFAULT_CATEGORY;
  return { category: fallback, mapping: categoryOf(fallback).mapping, confidence: 'low', matched: [] };
}

/** Reparto vigente de algo: el elegido a mano, o el de su categoría, o el sugerido por su título. */
export function mappingOf(item: Progressable & { title: string }, ctx: SuggestContext = {}): AttributeMapping {
  if (item.attributes && isAttributeId(item.attributes.primary)) {
    const secondary = item.attributes.secondary;
    return { primary: item.attributes.primary, secondary: isAttributeId(secondary) && secondary !== item.attributes.primary ? secondary : null };
  }
  if (item.category && isCategoryId(item.category)) return categoryOf(item.category).mapping;
  return suggestMapping(item.title, ctx).mapping;
}

/** Categoría vigente de algo (la guardada o la sugerida). */
export const categoryIdOf = (item: Progressable & { title: string }, ctx: SuggestContext = {}): CategoryId =>
  item.category && isCategoryId(item.category) ? item.category : suggestMapping(item.title, ctx).category;

/**
 * Descripción de la herramienta para un modelo con llamadas a funciones (formato JSON Schema, el que usan
 * Gemini y la mayoría). El ejecutor solo tiene que llamar a `suggestMapping(args.title, args)`.
 */
export const SUGGEST_MAPPING_TOOL = {
  name: 'suggest_attribute_mapping',
  description:
    'Sugiere la categoría de una actividad (hábito, tarea, curso, meta o proyecto) y a qué atributos del personaje va su XP: el primario recibe el 70 % y el secundario el 30 %. Atributos: fue (Fuerza), vit (Vitalidad), int (Intelecto), dis (Disciplina), esp (Espíritu), cre (Creatividad).',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Nombre de la actividad, tal como lo diría la persona.' },
      kind: { type: 'string', enum: ['task', 'habit', 'course', 'goal', 'project'] },
      area: { type: 'string', enum: ['career', 'health', 'money', 'people', 'growth', 'home'] },
      extra: { type: 'string', description: 'Contexto opcional: etiquetas, campo del curso, descripción.' },
    },
    required: ['title'],
  },
} as const;
