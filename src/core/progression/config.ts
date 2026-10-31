/**
 * Balance de la progresión: TODAS las constantes del XP, los niveles, la Forma y las monedas.
 * Se puede ajustar el juego tocando solo este archivo; la lógica no lleva números sueltos.
 */
import type { Difficulty } from '../domain';

/** XP base de una acción según su dificultad (tareas y hábitos). */
export const BASE_XP_BY_DIFFICULTY: Record<Difficulty, number> = { easy: 10, normal: 20, hard: 35, epic: 50 };

/** XP base de lo que no tiene dificultad propia. */
export const SOURCE_BASE_XP = {
  /** Tema de curso completado. */
  topic: 15,
  /** Repaso superado. */
  review: 5,
  /** Repaso que deja el tema dominado. */
  mastered: 20,
  /** Hito de una meta. */
  milestone: 35,
  /** Checkpoint de un proyecto. */
  checkpoint: 20,
  /** Certificación registrada. */
  certification: 50,
  /** XP por minuto de sesión de estudio (un Pomodoro de 25 min ≈ una acción normal). */
  sessionPerMinute: 0.8,
  /** Tope de una sola sesión, para que una sesión olvidada abierta no valga una semana. */
  sessionMax: 120,
  /** Jefe final: XP extra al derrotarlo, sobre el de su dificultad. */
  boss: 15,
} as const;

/** Bonos fijos (van enteros a un atributo, sin reparto ni multiplicadores). */
export const BONUS_XP = {
  /** Bonus de fin de semana por hábito completado. */
  weekend: 5,
  /** Combo: completar varios hábitos el mismo día. */
  combo: 15,
  /** Cadena de hábitos completa. */
  chain: 15,
  /** Reto semanal de horas cumplido. */
  weekly: 50,
  /** Cofre diario cuando trae XP. */
  chest: 10,
} as const;

/** Reparto entre el atributo primario y el secundario. Sin secundario, el primario se lo lleva todo. */
export const SPLIT = { primary: 0.7, secondary: 0.3 } as const;

/** Multiplicadores (se suman entre sí y luego multiplican el XP base). */
export const MULTIPLIERS = {
  /** +5 % por cada 7 días de racha… */
  streakPerWeek: 0.05,
  /** …con un tope de +25 %. */
  streakCap: 0.25,
  /** Primera acción del día en ese atributo. */
  firstOfDay: 0.1,
  /** Volver a un atributo tras varios días sin actividad. */
  comeback: 0.2,
  /** Días completos sin actividad en el atributo para contar como regreso. */
  comebackIdleDays: 3,
} as const;

/** Disciplina extra por la constancia (XP fijo, no se multiplica). */
export const DISCIPLINE = {
  /** Cualquier acción completada con la racha viva. */
  streakBonus: 2,
  /** Tarea completada sin pasarse de su fecha límite. */
  onTimeBonus: 5,
} as const;

/** Forma: barra 0–100 por atributo. Es visual y casi no afecta: nunca resta progreso. */
export const FORMA = {
  max: 100,
  min: 0,
  /** Días sin actividad que no bajan la Forma. */
  graceDays: 2,
  /** Lo que baja cada día sin actividad pasada la gracia. */
  decayPerDay: 5,
  /** Lo que sube cada día con actividad: se recupera rápido. */
  recoverPerDay: 25,
  /** Por debajo de este valor… */
  lowThreshold: 50,
  /** …el XP de ese atributo baja un 10 %. */
  lowPenalty: -0.1,
} as const;

/** Curva de un atributo: subir del nivel n al n+1 cuesta round(base · n^exponent). */
export const ATTRIBUTE_CURVE = { base: 40, exponent: 1.6, maxLevel: 50 } as const;

/** Curva del nivel del personaje, sobre la suma del XP de los seis atributos. Sin tope. */
export const CHARACTER_CURVE = { base: 100, exponent: 1.6, maxLevel: 200 } as const;

/** Monedas: se ganan con el XP y se gastan en la tienda. */
export const COINS = {
  /** Monedas por cada punto de XP. */
  perXp: 0.5,
  /** Premio por subir de nivel el personaje. */
  levelUp: 250,
} as const;

/** Clase del personaje (la definen sus dos atributos más altos). */
export const CLASSES = {
  /** XP total mínimo para dejar de ser «Aventurero». */
  minTotalXp: 150,
  /** La pareja nueva debe superar a la actual en este porcentaje para cambiar de clase (evita el parpadeo). */
  switchMargin: 0.1,
} as const;

/** Niveles de atributo que dan un desbloqueo (insignia, marco, skin y poder del héroe). */
export const UNLOCK_LEVELS = { badge: 5, frame: 10, skin: 20, power: 30 } as const;

/** Congeladores de racha ganados con la constancia (los comprados en la tienda van aparte). */
export const FREEZERS = {
  /** Uno por cada tantos días de racha… */
  everyStreakDays: 7,
  /** …mientras tengas menos de estos. */
  maxEarned: 2,
} as const;
