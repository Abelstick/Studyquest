import { describe, expect, it } from 'vitest';
import { FREEZERS } from './config';
import { daysToFreeze, earnFreezers, freezerMilestoneKey, streakStart } from './freezers';

const set = (...d: string[]) => new Set(d);
const NOW = '2026-09-16';

describe('streakStart', () => {
  it('encuentra el primer día de la racha, hoy o hasta ayer', () => {
    expect(streakStart(set('2026-09-14', '2026-09-15', '2026-09-16'), NOW)).toBe('2026-09-14');
    expect(streakStart(set('2026-09-14', '2026-09-15'), NOW)).toBe('2026-09-14');
    expect(streakStart(set('2026-09-13'), NOW)).toBeNull();
  });
});

describe('daysToFreeze', () => {
  it('cubre el hueco que termina ayer si la racha venía viva', () => {
    expect(daysToFreeze(set('2026-09-14'), NOW, 1)).toEqual(['2026-09-15']);
    expect(daysToFreeze(set('2026-09-13'), NOW, 2)).toEqual(['2026-09-14', '2026-09-15']);
  });

  it('no gasta nada si ayer hubo XP, si no hay congeladores o si no alcanzan', () => {
    expect(daysToFreeze(set('2026-09-15'), NOW, 2)).toEqual([]);
    expect(daysToFreeze(set('2026-09-14'), NOW, 0)).toEqual([]);
    expect(daysToFreeze(set('2026-09-12'), NOW, 2)).toEqual([]);
  });

  it('hoy no se congela: aún se puede salvar por las buenas', () => {
    expect(daysToFreeze(set('2026-09-15'), NOW, 1)).not.toContain(NOW);
  });
});

describe('earnFreezers', () => {
  const start = '2026-09-01';
  it(`uno por cada ${FREEZERS.everyStreakDays} días de racha`, () => {
    expect(earnFreezers(6, start, 0).earned).toBe(0);
    expect(earnFreezers(7, start, 0)).toEqual({ earned: 1, seen: [freezerMilestoneKey(start, 7)] });
    expect(earnFreezers(14, start, 0).earned).toBe(2);
  });

  it(`nunca pasa de ${FREEZERS.maxEarned} y el hito que llegó con el tope no se cobra después`, () => {
    const full = earnFreezers(14, start, FREEZERS.maxEarned);
    expect(full.earned).toBe(0);
    expect(earnFreezers(14, start, 0, full.seen).earned).toBe(0);
  });

  it('un hito ya cobrado no se repite; una racha nueva empieza de cero', () => {
    const first = earnFreezers(7, start, 0);
    expect(earnFreezers(7, start, 1, first.seen).earned).toBe(0);
    expect(earnFreezers(7, '2026-10-01', 1, first.seen).earned).toBe(1);
  });
});
