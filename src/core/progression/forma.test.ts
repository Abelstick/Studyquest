import { describe, expect, it } from 'vitest';
import type { AttributeId, XpEvent } from '../domain';
import { addDays } from '../dates';
import { FORMA } from './config';
import { formaBefore, formaOn, isFormaLow } from './forma';

const D0 = '2026-10-01';
const on = (offset: number, attribute: AttributeId = 'fue'): XpEvent => ({ id: `e${offset}`, date: addDays(D0, offset), attribute, amount: 10, source: 'habit', sourceId: 'h', label: '' });

describe('Forma', () => {
  it('sin actividad nunca, está llena (empezar no se castiga)', () => {
    expect(formaOn([], 'fue', D0)).toBe(FORMA.max);
  });

  it('no baja durante los días de gracia', () => {
    const events = [on(0)];
    expect(formaOn(events, 'fue', addDays(D0, FORMA.graceDays))).toBe(100);
  });

  it('baja 5 por día pasada la gracia', () => {
    const events = [on(0)];
    expect(formaOn(events, 'fue', addDays(D0, FORMA.graceDays + 1))).toBe(95);
    expect(formaOn(events, 'fue', addDays(D0, FORMA.graceDays + 4))).toBe(80);
  });

  it('nunca baja de 0', () => {
    expect(formaOn([on(0)], 'fue', addDays(D0, 400))).toBe(FORMA.min);
  });

  it('se recupera rápido al volver: +25 por día activo', () => {
    // 11 días quieto → 100 − 9·5 = 55; al volver sube a 80 y al día siguiente a 100.
    const events = [on(0), on(12), on(13)];
    expect(formaOn(events, 'fue', addDays(D0, 11))).toBe(55);
    expect(formaOn(events, 'fue', addDays(D0, 12))).toBe(80);
    expect(formaOn(events, 'fue', addDays(D0, 13))).toBe(100);
  });

  it('cada atributo tiene su propia Forma', () => {
    const events = [on(0, 'fue'), on(20, 'int')];
    expect(formaOn(events, 'int', addDays(D0, 20))).toBe(100);
    expect(formaOn(events, 'fue', addDays(D0, 20))).toBeLessThan(FORMA.lowThreshold);
  });

  it('la que afecta al XP es la del final del día anterior', () => {
    const events = [on(0), on(20)];
    expect(formaBefore(events, 'fue', addDays(D0, 20))).toBe(formaOn(events, 'fue', addDays(D0, 19)));
    expect(isFormaLow(formaBefore(events, 'fue', addDays(D0, 20)))).toBe(true);
    expect(isFormaLow(50)).toBe(false);
  });
});
