import { describe, expect, it } from 'vitest';
import type { AttributeId, XpEvent } from '../domain';
import { xpToReach } from './curve';
import { attributeWeek } from './weekly';

const MONDAY = '2026-09-14';
let n = 0;
const ev = (date: string, attribute: AttributeId, amount: number): XpEvent => ({ id: `e${n++}`, date, attribute, amount, source: 'bonus', sourceId: `s${n}`, label: '' });

describe('attributeWeek', () => {
  it('una semana sin XP no regaña: los atributos siguen intactos', () => {
    const w = attributeWeek([ev('2026-09-01', 'int', 50)], MONDAY);
    expect(w.total).toBe(0);
    expect(w.top).toBeNull();
    expect(w.neglected).toBeNull();
    expect(w.message).toMatch(/intactos/);
  });

  it('nombra el que más creció y el descuidado entre los ya entrenados', () => {
    const w = attributeWeek([ev('2026-09-01', 'fue', 30), ev('2026-09-01', 'esp', 20), ev('2026-09-15', 'int', 80), ev('2026-09-16', 'esp', 10), ev('2026-09-16', 'fue', 30)], MONDAY);
    expect(w.top?.def.id).toBe('int');
    expect(w.neglected?.def.id).toBe('esp');
    expect(w.message).toMatch(/Intelecto fue tu fuerte: \+80 XP/);
    expect(w.message).toMatch(/Espíritu creció poco/);
  });

  it('un atributo que nunca usaste no cuenta como descuidado', () => {
    const w = attributeWeek([ev('2026-09-15', 'int', 80)], MONDAY);
    expect(w.neglected).toBeNull();
    expect(w.message).toMatch(/Buen equilibrio/);
  });

  it('cuenta los niveles subidos en la semana y la semana anterior aparte', () => {
    const w = attributeWeek([ev('2026-09-08', 'dis', 7), ev('2026-09-15', 'dis', xpToReach(3))], MONDAY);
    const dis = w.rows.find((r) => r.def.id === 'dis');
    expect(dis).toMatchObject({ prevXp: 7, levelsUp: 2 });
    expect(w.message).toMatch(/subió al nivel 3/);
    // Lo de la semana siguiente no cuenta.
    expect(attributeWeek([ev('2026-09-21', 'dis', 50)], MONDAY).total).toBe(0);
  });
});
