/** Curvas de nivel. Subir del nivel n al n+1 cuesta round(base · n^exponent); se empieza en el nivel 1 con 0 XP. */
import type { AttributeId } from '../domain';
import { ATTRIBUTE_CURVE, CHARACTER_CURVE } from './config';

export interface Curve {
  base: number;
  exponent: number;
  maxLevel: number;
}

export interface LevelInfo {
  level: number;
  /** XP dentro del nivel actual. */
  into: number;
  /** XP que cuesta el nivel actual entero (0 en el nivel máximo). */
  needed: number;
  /** XP que falta para el siguiente (0 en el nivel máximo). */
  left: number;
  /** 0–100. En el nivel máximo, 100. */
  pct: number;
  maxed: boolean;
}

/** XP que cuesta pasar del nivel `n` al `n + 1`. */
export const xpForLevel = (n: number, c: Curve = ATTRIBUTE_CURVE): number => Math.round(c.base * Math.max(1, n) ** c.exponent);

const tables = new Map<Curve, number[]>();

/** Tabla acumulada: `t[n]` es el XP total necesario para EMPEZAR el nivel n (t[1] = 0). Se calcula una vez por curva. */
function table(c: Curve): number[] {
  let t = tables.get(c);
  if (!t) {
    t = [0, 0];
    for (let n = 1; n < c.maxLevel; n++) t.push(t[n] + xpForLevel(n, c));
    tables.set(c, t);
  }
  return t;
}

/** XP total necesario para empezar el nivel `level`. */
export const xpToReach = (level: number, c: Curve = ATTRIBUTE_CURVE): number => {
  const t = table(c);
  return t[Math.max(1, Math.min(c.maxLevel, Math.floor(level)))];
};

export function levelInfo(xp: number, c: Curve = ATTRIBUTE_CURVE): LevelInfo {
  const t = table(c);
  const safe = Math.max(0, Number.isFinite(xp) ? xp : 0);
  // Búsqueda binaria del último nivel cuyo umbral no supera el XP.
  let lo = 1;
  let hi = c.maxLevel;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (t[mid] <= safe) lo = mid;
    else hi = mid - 1;
  }
  const level = lo;
  if (level >= c.maxLevel) return { level, into: safe - t[level], needed: 0, left: 0, pct: 100, maxed: true };
  const needed = t[level + 1] - t[level];
  const into = safe - t[level];
  return { level, into, needed, left: needed - into, pct: Math.min(100, Math.floor((into / needed) * 100)), maxed: false };
}

export const attributeLevel = (xp: number): LevelInfo => levelInfo(xp, ATTRIBUTE_CURVE);

/** Atributos que subieron de nivel entre dos totales (para celebrarlo). Bajar no se anuncia: deshacer no es un castigo. */
export function attributeLevelUps(before: Record<AttributeId, number>, after: Record<AttributeId, number>): { attribute: AttributeId; from: number; to: number }[] {
  const out: { attribute: AttributeId; from: number; to: number }[] = [];
  for (const id of Object.keys(after) as AttributeId[]) {
    const from = attributeLevel(before[id] ?? 0).level;
    const to = attributeLevel(after[id]).level;
    if (to > from) out.push({ attribute: id, from, to });
  }
  return out;
}

/** Nivel del personaje: sale de la suma del XP de todos los atributos (no hay un XP global aparte). */
export const characterLevel = (totalXp: number): LevelInfo => levelInfo(totalXp, CHARACTER_CURVE);
