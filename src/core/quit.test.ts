import { describe, expect, it } from 'vitest';
import { bestCleanStreak, cleanDays, isQuit, lastSlip, nextMilestone, slippedOn, withSlip, withoutSlip } from './quit';

const NOW = '2026-10-10';
const h = (startDate: string, slips?: string[]) => ({ startDate, slips });

describe('dejar un mal hábito', () => {
  it('solo los hábitos marcados como «quit» lo son', () => {
    expect(isQuit({ kind: 'quit' })).toBe(true);
    expect(isQuit({ kind: 'build' })).toBe(false);
    expect(isQuit({})).toBe(false);
  });

  it('los días limpio cuentan desde que empezó si nunca recayó', () => {
    expect(cleanDays(h('2026-10-10'), NOW)).toBe(0);
    expect(cleanDays(h('2026-10-03'), NOW)).toBe(7);
  });

  it('los días limpio cuentan desde la última recaída, y recaer hoy los deja en 0', () => {
    expect(cleanDays(h('2026-09-01', ['2026-09-15', '2026-10-07']), NOW)).toBe(3);
    expect(cleanDays(h('2026-09-01', ['2026-10-10']), NOW)).toBe(0);
    expect(lastSlip(h('2026-09-01', ['2026-10-07', '2026-09-15']))).toBe('2026-10-07');
    expect(lastSlip(h('2026-09-01'))).toBeNull();
  });

  it('nunca da negativo aunque la fecha de inicio sea futura', () => {
    expect(cleanDays(h('2026-10-20'), NOW)).toBe(0);
  });

  it('la mejor racha es el hueco más largo entre recaídas, contando el actual', () => {
    // 1 sep → 15 sep = 14 días; 15 sep → 7 oct = 22; 7 oct → hoy = 3
    expect(bestCleanStreak(h('2026-09-01', ['2026-09-15', '2026-10-07']), NOW)).toBe(22);
    // sin recaídas, la racha actual es la mejor
    expect(bestCleanStreak(h('2026-10-01'), NOW)).toBe(9);
    // el tramo actual puede ser el mejor
    expect(bestCleanStreak(h('2026-09-25', ['2026-09-26']), NOW)).toBe(14);
  });

  it('registrar y quitar recaídas no duplica ni desordena', () => {
    expect(withSlip(['2026-10-01'], '2026-09-20')).toEqual(['2026-09-20', '2026-10-01']);
    expect(withSlip(['2026-10-01'], '2026-10-01')).toEqual(['2026-10-01']);
    expect(withSlip(undefined, NOW)).toEqual([NOW]);
    expect(withoutSlip(['2026-10-01', NOW], NOW)).toEqual(['2026-10-01']);
    expect(slippedOn(h('2026-09-01', [NOW]), NOW)).toBe(true);
    expect(slippedOn(h('2026-09-01'), NOW)).toBe(false);
  });

  it('el siguiente hito es el primero que aún no se alcanzó', () => {
    expect(nextMilestone(0)).toEqual({ target: 1, left: 1 });
    expect(nextMilestone(7)).toEqual({ target: 14, left: 7 });
    expect(nextMilestone(364)).toEqual({ target: 365, left: 1 });
    expect(nextMilestone(365)).toBeNull();
  });
});
