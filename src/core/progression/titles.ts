/**
 * Identidad del personaje: títulos por atributo y clases por pareja de atributos. Solo datos y reglas puras;
 * cambiar un nombre o un umbral se hace aquí, sin tocar la lógica.
 */
import type { AttributeId } from '../domain';
import { ATTRIBUTE_IDS, attributeOf } from './attributes';
import { CLASSES as CLASS_RULES } from './config';
import { attributeLevel } from './curve';

/* ---------- Títulos ---------- */

export interface TitleStep {
  level: number;
  title: string;
}

/** Títulos de cada atributo, del primero (nivel 1) al último. Se gana el último cuyo nivel ya alcanzaste. */
export const TITLES: Record<AttributeId, TitleStep[]> = {
  fue: [
    { level: 1, title: 'Novato' },
    { level: 5, title: 'Atleta' },
    { level: 15, title: 'Luchador' },
    { level: 30, title: 'Campeón' },
    { level: 50, title: 'Titán' },
  ],
  vit: [
    { level: 1, title: 'Brote' },
    { level: 5, title: 'Saludable' },
    { level: 15, title: 'Vigoroso' },
    { level: 30, title: 'Incansable' },
    { level: 50, title: 'Inmortal' },
  ],
  int: [
    { level: 1, title: 'Aprendiz' },
    { level: 5, title: 'Estudiante' },
    { level: 15, title: 'Erudito' },
    { level: 30, title: 'Sabio' },
    { level: 50, title: 'Archimago' },
  ],
  dis: [
    { level: 1, title: 'Iniciado' },
    { level: 5, title: 'Constante' },
    { level: 15, title: 'Metódico' },
    { level: 30, title: 'Imparable' },
    { level: 50, title: 'Señor del Tiempo' },
  ],
  esp: [
    { level: 1, title: 'Viajero' },
    { level: 5, title: 'Sereno' },
    { level: 15, title: 'Contemplativo' },
    { level: 30, title: 'Iluminado' },
    { level: 50, title: 'Alma Eterna' },
  ],
  cre: [
    { level: 1, title: 'Curioso' },
    { level: 5, title: 'Creador' },
    { level: 15, title: 'Artesano' },
    { level: 30, title: 'Visionario' },
    { level: 50, title: 'Leyenda Creativa' },
  ],
};

export interface TitleInfo {
  current: TitleStep;
  next: TitleStep | null;
}

export function titleFor(attribute: AttributeId, level: number): TitleInfo {
  const steps = TITLES[attribute];
  let i = 0;
  steps.forEach((s, k) => {
    if (level >= s.level) i = k;
  });
  return { current: steps[i], next: steps[i + 1] ?? null };
}

/* ---------- Clases ---------- */

export type ClassId =
  | 'aventurero'
  | 'guerrero' | 'estratega' | 'paladin' | 'samurai' | 'explorador'
  | 'alquimista' | 'guardian' | 'monje' | 'druida'
  | 'erudito' | 'mistico' | 'inventor'
  | 'asceta' | 'artifice'
  | 'bardo';

export interface ClassDef {
  id: ClassId;
  name: string;
  /** La pareja de atributos que la define (vacía en «Aventurero»). */
  pair: [AttributeId, AttributeId] | [];
  blurb: string;
}

/** Las 15 parejas posibles, más la clase de partida. */
export const CLASS_DEFS: readonly ClassDef[] = [
  { id: 'aventurero', name: 'Aventurero', pair: [], blurb: 'Aún explorando. Tu clase aparecerá cuando dos atributos tomen la delantera.' },
  { id: 'guerrero', name: 'Guerrero', pair: ['fue', 'vit'], blurb: 'Cuerpo fuerte y bien cuidado: entrenas y descansas como se debe.' },
  { id: 'estratega', name: 'Estratega', pair: ['fue', 'int'], blurb: 'Músculo y cabeza: entrenas el cuerpo sin dejar de aprender.' },
  { id: 'paladin', name: 'Paladín', pair: ['fue', 'dis'], blurb: 'Fuerza con disciplina: no fallas a tus compromisos.' },
  { id: 'samurai', name: 'Samurái', pair: ['fue', 'esp'], blurb: 'Entrenas el cuerpo con la mente en calma.' },
  { id: 'explorador', name: 'Explorador', pair: ['fue', 'cre'], blurb: 'Te mueves y creas: energía para salir a hacer cosas nuevas.' },
  { id: 'alquimista', name: 'Alquimista', pair: ['vit', 'int'], blurb: 'Cuidas tu cuerpo y alimentas tu mente.' },
  { id: 'guardian', name: 'Guardián', pair: ['vit', 'dis'], blurb: 'Rutinas sanas que se cumplen: agua, sueño y constancia.' },
  { id: 'monje', name: 'Monje', pair: ['vit', 'esp'], blurb: 'Bienestar por dentro y por fuera.' },
  { id: 'druida', name: 'Druida', pair: ['vit', 'cre'], blurb: 'Energía sana al servicio de lo que creas.' },
  { id: 'erudito', name: 'Erudito', pair: ['int', 'dis'], blurb: 'Estudias con método: aprender es tu disciplina.' },
  { id: 'mistico', name: 'Místico', pair: ['int', 'esp'], blurb: 'Curiosidad y reflexión: entiendes y te entiendes.' },
  { id: 'inventor', name: 'Inventor', pair: ['int', 'cre'], blurb: 'Lo que aprendes lo conviertes en algo nuevo.' },
  { id: 'asceta', name: 'Asceta', pair: ['dis', 'esp'], blurb: 'Constancia serena: haces lo que toca sin perder la calma.' },
  { id: 'artifice', name: 'Artífice', pair: ['dis', 'cre'], blurb: 'Creas con constancia: tus proyectos avanzan de verdad.' },
  { id: 'bardo', name: 'Bardo', pair: ['esp', 'cre'], blurb: 'Arte y alma: creas desde lo que sientes.' },
];

export const classOf = (id: ClassId): ClassDef => CLASS_DEFS.find((c) => c.id === id) ?? CLASS_DEFS[0];

export const isClassId = (v: unknown): v is ClassId => typeof v === 'string' && CLASS_DEFS.some((c) => c.id === v);

const pairKey = (a: AttributeId, b: AttributeId) => [a, b].sort((x, y) => ATTRIBUTE_IDS.indexOf(x) - ATTRIBUTE_IDS.indexOf(y)).join('+');
const BY_PAIR = new Map(CLASS_DEFS.filter((c) => c.pair.length === 2).map((c) => [pairKey(c.pair[0] as AttributeId, c.pair[1] as AttributeId), c.id]));

/** Los dos atributos con más XP (a igualdad, el que va antes en el catálogo). */
export function topTwo(totals: Record<AttributeId, number>): [AttributeId, AttributeId] {
  const sorted = [...ATTRIBUTE_IDS].sort((a, b) => totals[b] - totals[a] || ATTRIBUTE_IDS.indexOf(a) - ATTRIBUTE_IDS.indexOf(b));
  return [sorted[0], sorted[1]];
}

/** La clase que dicen los números ahora mismo, sin memoria. */
export function classFor(totals: Record<AttributeId, number>): ClassId {
  const sum = ATTRIBUTE_IDS.reduce((a, id) => a + totals[id], 0);
  const [a, b] = topTwo(totals);
  if (sum < CLASS_RULES.minTotalXp || totals[b] <= 0) return 'aventurero';
  return BY_PAIR.get(pairKey(a, b)) ?? 'aventurero';
}

const pairXp = (c: ClassDef, totals: Record<AttributeId, number>) => c.pair.reduce((s, id) => s + totals[id], 0);

/**
 * La clase con memoria: solo se cambia si la pareja nueva supera a la actual por un margen. Así no se
 * alterna entre dos clases cada vez que dos atributos van empatados.
 */
export function nextClass(current: ClassId | undefined, totals: Record<AttributeId, number>): ClassId {
  const fresh = classFor(totals);
  if (!current || current === 'aventurero' || fresh === current) return fresh;
  if (fresh === 'aventurero') return current; // nunca se «baja» a Aventurero
  const mine = pairXp(classOf(current), totals);
  const theirs = pairXp(classOf(fresh), totals);
  return theirs > mine * (1 + CLASS_RULES.switchMargin) ? fresh : current;
}

/** Texto de la pareja de una clase: «Espíritu + Creatividad». */
export const classPairText = (c: ClassDef): string => c.pair.map((id) => attributeOf(id).name).join(' + ');

/** Nivel de cada atributo a partir de sus totales. */
export const levelsOf = (totals: Record<AttributeId, number>): Record<AttributeId, number> =>
  Object.fromEntries(ATTRIBUTE_IDS.map((id) => [id, attributeLevel(totals[id]).level])) as Record<AttributeId, number>;
