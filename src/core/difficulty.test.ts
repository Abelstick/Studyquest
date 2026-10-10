import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, HABIT_BASE_XP, difficultyOf, xpForDifficulty } from './difficulty';
import { XP_BY_PRIORITY } from './game';

describe('dificultad', () => {
  it('sin nivel definido es normal', () => {
    expect(difficultyOf({})).toBe('normal');
    expect(difficultyOf({ difficulty: 'epic' })).toBe('epic');
  });

  it('normal no cambia el XP: lo que ya existía sigue igual', () => {
    for (const xp of Object.values(XP_BY_PRIORITY)) expect(xpForDifficulty(xp, 'normal')).toBe(xp);
    expect(xpForDifficulty(HABIT_BASE_XP, 'normal')).toBe(HABIT_BASE_XP);
  });

  it('un hábito de 30 XP da 15 · 30 · 45 · 60', () => {
    expect(DIFFICULTIES.map((d) => xpForDifficulty(HABIT_BASE_XP, d.value))).toEqual([15, 30, 45, 60]);
  });

  it('una tarea de prioridad media (35) da 20 · 35 · 50 · 70, siempre en múltiplos de 5', () => {
    const xps = DIFFICULTIES.map((d) => xpForDifficulty(XP_BY_PRIORITY.mid, d.value));
    expect(xps).toEqual([20, 35, 55, 70]);
    expect(xps.every((x) => x % 5 === 0)).toBe(true);
  });

  it('el XP crece con el nivel y nunca baja de 5', () => {
    for (const base of [5, 10, 20, 35, 50, 120]) {
      const xps = DIFFICULTIES.map((d) => xpForDifficulty(base, d.value));
      expect(xps).toEqual([...xps].sort((a, b) => a - b));
      expect(Math.min(...xps)).toBeGreaterThanOrEqual(5);
    }
  });

  it('con base 0 el XP se queda en 0', () => {
    expect(xpForDifficulty(0, 'epic')).toBe(0);
  });
});
