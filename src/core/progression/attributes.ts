/** Catálogo de los seis atributos del personaje. Fijo en código, como la tienda y los logros. */
import type { AttributeId } from '../domain';
import type { SpriteName } from '@/ui/sprites';

export interface AttributeDef {
  id: AttributeId;
  name: string;
  /** Abreviatura de tres letras («FUE»). */
  short: string;
  /** Para textos sin sprite (toasts, notificaciones push). */
  emoji: string;
  sprite: SpriteName;
  /** Token de color de styles/tokens.css (sin `var()`), para que cada mundo visual lo pueda redefinir. */
  token: string;
  /** Qué lo alimenta, en una frase. */
  hint: string;
}

export const ATTRIBUTES: readonly AttributeDef[] = [
  { id: 'fue', name: 'Fuerza', short: 'FUE', emoji: '💪', sprite: 'sword', token: '--attr-fue', hint: 'Ejercicio, deporte, caminar, gimnasio.' },
  { id: 'vit', name: 'Vitalidad', short: 'VIT', emoji: '❤️', sprite: 'heart', token: '--attr-vit', hint: 'Tomar agua, dormir bien, comer sano, descansar.' },
  { id: 'int', name: 'Intelecto', short: 'INT', emoji: '🧠', sprite: 'owl', token: '--attr-int', hint: 'Estudiar, cursos, lectura técnica, practicar código.' },
  { id: 'dis', name: 'Disciplina', short: 'DIS', emoji: '🎯', sprite: 'flag', token: '--attr-dis', hint: 'Cumplir a tiempo, Pomodoros, constancia.' },
  { id: 'esp', name: 'Espíritu', short: 'ESP', emoji: '🌙', sprite: 'moon', token: '--attr-esp', hint: 'Meditar, escribir un diario, leer por gusto, ocio sano.' },
  { id: 'cre', name: 'Creatividad', short: 'CRE', emoji: '🎨', sprite: 'note', token: '--attr-cre', hint: 'Proyectos personales, dibujo, música, escritura.' },
];

export const ATTRIBUTE_IDS: readonly AttributeId[] = ATTRIBUTES.map((a) => a.id);

export const isAttributeId = (v: unknown): v is AttributeId => typeof v === 'string' && (ATTRIBUTE_IDS as readonly string[]).includes(v);

export const attributeOf = (id: AttributeId): AttributeDef => ATTRIBUTES.find((a) => a.id === id) ?? ATTRIBUTES[0];

/** «+14 XP Intelecto · +6 XP Disciplina», en el orden del catálogo. Solo lo que cambió. */
export const formatAttributeDelta = (delta: Partial<Record<AttributeId, number>>): string =>
  ATTRIBUTES.filter((a) => delta[a.id])
    .map((a) => `${(delta[a.id] ?? 0) > 0 ? '+' : ''}${delta[a.id]} XP ${a.name}`)
    .join(' · ');

/** Un registro con un valor por atributo. */
export const perAttribute = <T>(fn: (id: AttributeId) => T): Record<AttributeId, T> =>
  Object.fromEntries(ATTRIBUTE_IDS.map((id) => [id, fn(id)])) as Record<AttributeId, T>;

/** «+14 XP Fuerza · +6 XP Vitalidad» a partir de una vista previa de XP. */
export const gainsText = (gains: readonly { attribute: AttributeId; xp: number }[]): string =>
  formatAttributeDelta(Object.fromEntries(gains.map((g) => [g.attribute, g.xp])));
