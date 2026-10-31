/**
 * Desbloqueos por hitos de cada atributo: insignia (nv 5), marco de avatar (nv 10), skin del héroe (nv 20) y
 * poder del héroe (nv 30). Aquí viven los ids y los nombres; la tienda (core/catalog.ts) y el héroe
 * (core/hero.ts) crean sus objetos a partir de esta lista. Al llegar al nivel se entregan al inventario y
 * ya no se pierden.
 */
import type { AttributeId } from '../domain';
import { ATTRIBUTES } from './attributes';
import { UNLOCK_LEVELS } from './config';

export type UnlockKind = keyof typeof UNLOCK_LEVELS;

export interface UnlockDef {
  /** Id del objeto en el inventario. */
  id: string;
  attribute: AttributeId;
  kind: UnlockKind;
  level: number;
  title: string;
  blurb: string;
}

const NAMES: Record<AttributeId, Record<UnlockKind, string>> = {
  fue: { badge: 'Sello del Músculo', frame: 'Marco de Acero', skin: 'Armadura de Titán', power: 'Furia ardiente' },
  vit: { badge: 'Sello del Pulso', frame: 'Marco Latido', skin: 'Piel de Roble', power: 'Escudo vital' },
  int: { badge: 'Sello del Saber', frame: 'Marco Arcano', skin: 'Túnica del Archimago', power: 'Tormenta de ideas' },
  dis: { badge: 'Sello del Reloj', frame: 'Marco del Deber', skin: 'Uniforme del Método', power: 'Chispas de constancia' },
  esp: { badge: 'Sello de la Luna', frame: 'Marco Astral', skin: 'Manto Sereno', power: 'Aura de escarcha' },
  cre: { badge: 'Sello de la Musa', frame: 'Marco del Taller', skin: 'Traje del Visionario', power: 'Alas creativas' },
};

const KIND_TEXT: Record<UnlockKind, string> = { badge: 'Insignia', frame: 'Marco de avatar', skin: 'Skin del héroe', power: 'Poder del héroe' };
const PREFIX: Record<UnlockKind, string> = { badge: 'badge-attr-', frame: 'frame-attr-', skin: 'hero-s-attr-', power: 'hero-p-attr-' };
const KINDS: UnlockKind[] = ['badge', 'frame', 'skin', 'power'];

export const UNLOCKS: readonly UnlockDef[] = ATTRIBUTES.flatMap((a) =>
  KINDS.map((kind) => ({
    id: `${PREFIX[kind]}${a.id}`,
    attribute: a.id,
    kind,
    level: UNLOCK_LEVELS[kind],
    title: NAMES[a.id][kind],
    blurb: `${KIND_TEXT[kind]} · se gana con ${a.name} al nivel ${UNLOCK_LEVELS[kind]}.`,
  })),
);

export const unlockKindLabel = (k: UnlockKind) => KIND_TEXT[k];

export const unlockById = (id: string | null | undefined): UnlockDef | undefined => (id ? UNLOCKS.find((u) => u.id === id) : undefined);

/** Los desbloqueos de un tipo, en el orden del catálogo de atributos. */
export const unlocksOfKind = (kind: UnlockKind): UnlockDef[] => UNLOCKS.filter((u) => u.kind === kind);

/** Lo que ya se alcanzó con estos niveles. */
export const reachedUnlocks = (levels: Record<AttributeId, number>): UnlockDef[] => UNLOCKS.filter((u) => levels[u.attribute] >= u.level);

/** Lo alcanzado que todavía no está en el inventario (lo que hay que entregar ahora). */
export const pendingUnlocks = (levels: Record<AttributeId, number>, inventory: readonly string[]): UnlockDef[] =>
  reachedUnlocks(levels).filter((u) => !inventory.includes(u.id));

/** El siguiente desbloqueo de un atributo, o null si ya los tiene todos. */
export const nextUnlock = (attribute: AttributeId, level: number): UnlockDef | null =>
  UNLOCKS.filter((u) => u.attribute === attribute && u.level > level).sort((a, b) => a.level - b.level)[0] ?? null;
