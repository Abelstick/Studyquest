/**
 * Niveles de dificultad de tareas y hábitos. Deciden el XP base de la acción (la tabla está en
 * core/progression/config.ts); ese XP se reparte entre los atributos de su categoría.
 *
 * Lógica pura, sin React ni base de datos.
 */
import type { Difficulty } from './domain';
import { BASE_XP_BY_DIFFICULTY } from './progression/config';

export interface DifficultyInfo {
  value: Difficulty;
  label: string;
  /** XP base que da. */
  xp: number;
  hint: string;
}

const xp = BASE_XP_BY_DIFFICULTY;

export const DIFFICULTIES: DifficultyInfo[] = [
  { value: 'easy', label: 'Fácil', xp: xp.easy, hint: `Cuesta poco: ${xp.easy} XP.` },
  { value: 'normal', label: 'Normal', xp: xp.normal, hint: `El esfuerzo de siempre: ${xp.normal} XP.` },
  { value: 'hard', label: 'Difícil', xp: xp.hard, hint: `Exige más: ${xp.hard} XP.` },
  { value: 'epic', label: 'Épica', xp: xp.epic, hint: `Un reto grande: ${xp.epic} XP.` },
];

export const difficultyOf = (x: { difficulty?: Difficulty }): Difficulty => x.difficulty ?? 'normal';

export const difficultyInfo = (d: Difficulty): DifficultyInfo => DIFFICULTIES.find((x) => x.value === d) ?? DIFFICULTIES[1];
