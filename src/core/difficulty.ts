/**
 * Niveles de dificultad de tareas y hábitos. No cambian las reglas de XP: son un atajo que propone el XP
 * (el de la prioridad en una tarea, 30 en un hábito) multiplicado por el nivel. El XP que se cobra y se devuelve
 * sigue siendo el `xp` guardado, así que dar y deshacer siempre coinciden.
 *
 * Lógica pura, sin React ni base de datos.
 */
import type { Difficulty } from './domain';

export interface DifficultyInfo {
  value: Difficulty;
  label: string;
  /** Multiplica el XP base. */
  mult: number;
  hint: string;
}

export const DIFFICULTIES: DifficultyInfo[] = [
  { value: 'easy', label: 'Fácil', mult: 0.5, hint: 'Cuesta poco: la mitad del XP.' },
  { value: 'normal', label: 'Normal', mult: 1, hint: 'El esfuerzo de siempre.' },
  { value: 'hard', label: 'Difícil', mult: 1.5, hint: 'Exige más: 50 % más de XP.' },
  { value: 'epic', label: 'Épica', mult: 2, hint: 'Un reto grande: el doble de XP.' },
];

/** XP base de un hábito (el que ya se proponía antes de existir la dificultad). */
export const HABIT_BASE_XP = 30;

export const difficultyOf = (x: { difficulty?: Difficulty }): Difficulty => x.difficulty ?? 'normal';

export const difficultyInfo = (d: Difficulty): DifficultyInfo => DIFFICULTIES.find((x) => x.value === d) ?? DIFFICULTIES[1];

/** XP propuesto para un nivel: redondeado a múltiplos de 5 y nunca menos de 5 (salvo base 0, que se queda en 0). */
export function xpForDifficulty(baseXp: number, d: Difficulty): number {
  if (baseXp <= 0) return 0;
  return Math.max(5, Math.round((baseXp * difficultyInfo(d).mult) / 5) * 5);
}
