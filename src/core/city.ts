/**
 * Tu ciudad: cada área de estudio es un edificio que sube de nivel con tu progreso real.
 * Todo se calcula a partir de las estadísticas que ya existen (no hay nada nuevo que registrar), así que
 * la ciudad siempre coincide con lo que has hecho. Funciones puras.
 */
import type { Stats } from './stats';

export type BuildingId = 'casa' | 'biblioteca' | 'academia' | 'laboratorio' | 'arena' | 'museo';
export const MAX_LEVEL = 5;
/** Monedas al alcanzar cada nivel (índice = nivel). */
export const LEVEL_REWARD = [0, 50, 100, 200, 400, 800] as const;

type Five<T> = readonly [T, T, T, T, T];

export interface Building {
  id: BuildingId;
  name: string;
  /** Con qué parte de la app se relaciona. */
  area: string;
  what: string;
  /** Unidad de sus puntos, para «te faltan 3 …». */
  unit: string;
  /** Puntos necesarios para los niveles 1 a 5. */
  thresholds: Five<number>;
  levelNames: Five<string>;
  /** Cómo se ganan los puntos. */
  scoring: string[];
  /** Consejo y a dónde ir para mejorarlo. */
  tip: string;
  to: string;
  cta: string;
  measure: (s: Stats) => number;
}

export const BUILDINGS: Building[] = [
  {
    id: 'casa',
    name: 'Casa',
    area: 'Hábitos',
    what: 'Tu hogar crece con la constancia: cada hábito cumplido suma un ladrillo.',
    unit: 'hábitos cumplidos',
    thresholds: [5, 25, 75, 200, 500],
    levelNames: ['Tienda de campaña', 'Cabaña', 'Casita', 'Casa familiar', 'Mansión'],
    scoring: ['1 punto por cada hábito cumplido (una vez por hábito y día)'],
    tip: 'Marca tus hábitos cada día: la constancia es lo que levanta la casa.',
    to: '/habitos',
    cta: 'Ir a mis hábitos',
    measure: (s) => s.habitCompletions,
  },
  {
    id: 'biblioteca',
    name: 'Biblioteca',
    area: 'Conocimiento',
    what: 'Guarda lo que aprendes: temas estudiados y repasos hechos.',
    unit: 'puntos de conocimiento',
    thresholds: [5, 20, 60, 150, 350],
    levelNames: ['Estante de libros', 'Librería', 'Biblioteca', 'Gran biblioteca', 'Archivo legendario'],
    scoring: ['1 punto por tema completado', '1 punto por repaso superado', '3 puntos por tema dominado (4 repasos)'],
    tip: 'Completa temas de tus cursos y repasa tus flashcards.',
    to: '/repaso',
    cta: 'Ir a repasar',
    measure: (s) => s.topicsDone + s.reviews + s.mastered * 3,
  },
  {
    id: 'academia',
    name: 'Academia',
    area: 'Cursos',
    what: 'Crece con tus cursos: módulos superados, cursos terminados y horas de estudio.',
    unit: 'puntos de estudio',
    thresholds: [6, 25, 70, 160, 350],
    levelNames: ['Aula', 'Escuelita', 'Academia', 'Instituto', 'Universidad'],
    scoring: ['3 puntos por módulo completado', '10 puntos por curso terminado', '1 punto por hora de estudio'],
    tip: 'Avanza en tus cursos y registra tus sesiones de estudio (o usa el Pomodoro).',
    to: '/cursos',
    cta: 'Ir a mis cursos',
    measure: (s) => s.modulesDone * 3 + s.coursesCompleted * 10 + Math.floor(s.hoursTotal),
  },
  {
    id: 'laboratorio',
    name: 'Laboratorio',
    area: 'Proyectos',
    what: 'Aquí se construye: proyectos, sus checkpoints y los hitos de tus metas.',
    unit: 'puntos de creación',
    thresholds: [4, 16, 45, 110, 250],
    levelNames: ['Taller', 'Laboratorio', 'Centro de pruebas', 'Instituto de I+D', 'Fábrica de ideas'],
    scoring: ['2 puntos por checkpoint de proyecto', '10 puntos por proyecto terminado', '2 puntos por hito de una meta'],
    tip: 'Avanza en un proyecto o cumple hitos de tus metas.',
    to: '/proyectos',
    cta: 'Ir a mis proyectos',
    measure: (s) => s.checkpointsDone * 2 + s.projectsCompleted * 10 + s.milestonesDone * 2,
  },
  {
    id: 'arena',
    name: 'Arena',
    area: 'Retos',
    what: 'El lugar de los desafíos: jefes finales, retos semanales, combos y Pomodoros.',
    unit: 'puntos de reto',
    thresholds: [5, 20, 55, 130, 300],
    levelNames: ['Pista de entrenamiento', 'Gimnasio', 'Arena', 'Estadio', 'Coliseo'],
    scoring: ['3 puntos por jefe final derrotado', '5 puntos por reto semanal cumplido', '2 puntos por combo ×2', '1 punto por Pomodoro'],
    tip: 'Derrota jefes finales, cumple el reto semanal y haz Pomodoros.',
    to: '/pomodoro',
    cta: 'Ir al Pomodoro',
    measure: (s) => s.bosses * 3 + s.weeklyChallenges * 5 + s.combos * 2 + s.pomodoros,
  },
  {
    id: 'museo',
    name: 'Museo',
    area: 'Logros',
    what: 'Expone tus trofeos: un objeto por cada logro que desbloqueas.',
    unit: 'logros',
    thresholds: [3, 8, 16, 28, 40],
    levelNames: ['Vitrina', 'Sala de honor', 'Museo', 'Gran museo', 'Palacio de los récords'],
    scoring: ['1 punto por cada logro desbloqueado'],
    tip: 'Cada logro nuevo es una pieza más para la exposición.',
    to: '/arsenal',
    cta: 'Ver mis logros',
    measure: (s) => s.achievementsCount,
  },
];

export const buildingById = (id: string): Building | undefined => BUILDINGS.find((b) => b.id === id);

/** Nivel (0-5) que corresponde a esa cantidad de puntos. */
export const levelOf = (b: Pick<Building, 'thresholds'>, value: number): number => b.thresholds.filter((t) => value >= t).length;

export interface BuildingState {
  building: Building;
  value: number;
  level: number;
  /** Puntos del siguiente nivel (null si ya está al máximo). */
  next: number | null;
  /** Puntos con los que empezó el nivel actual. */
  from: number;
  /** % hacia el siguiente nivel (100 si está al máximo). */
  pct: number;
  /** Puntos que faltan para subir (null si está al máximo). */
  left: number | null;
}

export function buildingState(b: Building, stats: Stats): BuildingState {
  const value = Math.max(0, b.measure(stats));
  const level = levelOf(b, value);
  const from = level === 0 ? 0 : b.thresholds[level - 1];
  const next = level >= MAX_LEVEL ? null : b.thresholds[level];
  return { building: b, value, level, next, from, pct: next === null ? 100 : Math.min(100, Math.round(((value - from) / (next - from)) * 100)), left: next === null ? null : next - value };
}

export const cityStates = (stats: Stats): BuildingState[] => BUILDINGS.map((b) => buildingState(b, stats));

/** Suma de los niveles de todos los edificios (0-30). */
export const cityTotal = (stats: Stats): number => cityStates(stats).reduce((a, s) => a + s.level, 0);
export const CITY_MAX = BUILDINGS.length * MAX_LEVEL;

const TITLES: [number, string][] = [
  [0, 'Terreno en obras'],
  [3, 'Aldea'],
  [8, 'Pueblo'],
  [14, 'Ciudad'],
  [21, 'Metrópolis'],
  [28, 'Capital legendaria'],
];

export function cityTitle(total: number): { name: string; next: { at: number; name: string } | null } {
  const i = TITLES.reduce((acc, [min], k) => (total >= min ? k : acc), 0);
  const next = TITLES[i + 1];
  return { name: TITLES[i][1], next: next ? { at: next[0], name: next[1] } : null };
}

/** Adornos que aparecen al crecer la ciudad. */
export function cityDecor(total: number) {
  return { trees: Math.min(6, Math.floor(total / 3)), fountain: total >= 8, lamps: total >= 14, flags: total >= 21 };
}

/** Habitantes: crecen con tu XP y con cada mejora de un edificio. */
export const population = (xp: number, total: number): number => Math.floor(Math.max(0, xp) / 20) + total * 5;

/** El edificio más cerca de subir de nivel (para animar a dar el último empujón). */
export function closestUpgrade(states: BuildingState[]): BuildingState | null {
  return states.filter((s) => s.next !== null).sort((a, b) => b.pct - a.pct || (a.left ?? 0) - (b.left ?? 0))[0] ?? null;
}

export type CityLevels = Partial<Record<BuildingId, number>>;

export interface CityUpgrade {
  id: BuildingId;
  from: number;
  to: number;
  coins: number;
}

/**
 * Compara los niveles actuales con los ya celebrados (`claimed`). La primera vez (sin registro) se limita a anotar el punto de
 * partida, sin premios: no se regalan monedas por progreso anterior a la ciudad.
 */
export function cityUpgrades(claimed: CityLevels | undefined, stats: Stats): { levels: Record<BuildingId, number>; ups: CityUpgrade[]; firstTime: boolean } {
  const states = cityStates(stats);
  const levels = Object.fromEntries(states.map((s) => [s.building.id, s.level])) as Record<BuildingId, number>;
  if (!claimed) return { levels, ups: [], firstTime: true };
  const ups: CityUpgrade[] = [];
  const merged = { ...levels };
  for (const s of states) {
    const before = Math.max(0, Math.min(MAX_LEVEL, claimed[s.building.id] ?? 0));
    merged[s.building.id] = Math.max(before, s.level); // no se «des-celebra» si borras datos
    if (s.level > before) {
      let coins = 0;
      for (let l = before + 1; l <= s.level; l++) coins += LEVEL_REWARD[l];
      ups.push({ id: s.building.id, from: before, to: s.level, coins });
    }
  }
  return { levels: merged, ups, firstTime: false };
}
