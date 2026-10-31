import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, difficultyInfo, difficultyOf } from './difficulty';
import { BASE_XP_BY_DIFFICULTY } from './progression/config';
import { habitBaseXp, taskBaseXp } from './progression/rewards';

describe('dificultad', () => {
  it('sin nivel definido es normal', () => {
    expect(difficultyOf({})).toBe('normal');
    expect(difficultyOf({ difficulty: 'epic' })).toBe('epic');
  });

  it('decide el XP base: fácil 10 · normal 20 · difícil 35 · épica 50', () => {
    expect(DIFFICULTIES.map((d) => d.xp)).toEqual([10, 20, 35, 50]);
    expect(DIFFICULTIES.map((d) => habitBaseXp({ difficulty: d.value }))).toEqual([10, 20, 35, 50]);
    expect(taskBaseXp({ priority: 'mid' })).toBe(BASE_XP_BY_DIFFICULTY.normal);
  });

  it('el XP crece con el nivel', () => {
    const xps = DIFFICULTIES.map((d) => d.xp);
    expect(xps).toEqual([...xps].sort((a, b) => a - b));
  });

  it('la pista dice cuánto da', () => {
    expect(difficultyInfo('hard').hint).toContain('35 XP');
  });
});
