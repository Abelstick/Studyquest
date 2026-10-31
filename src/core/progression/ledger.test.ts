import { describe, expect, it } from 'vitest';
import type { AttributeId, XpEvent, XpSource } from '../domain';
import { formatAttributeDelta } from './attributes';
import {
  applyGrant, attributeDelta, attributeTotals, dailyXp, distinctActions, idleDaysBefore, sameRows, splitRevert, totalXp, xpKey,
} from './ledger';

const row = (attribute: AttributeId, amount: number, o: Partial<XpEvent> = {}): XpEvent => ({
  id: `${attribute}-${amount}-${o.date ?? '2026-10-20'}`, date: '2026-10-20', attribute, amount, source: 'task' as XpSource, sourceId: 't1', label: '', ...o,
});

describe('ledger', () => {
  it('la clave identifica origen, día y atributo', () => {
    expect(xpKey(row('int', 5))).toBe('task|t1|2026-10-20|int');
  });

  it('otorgar reemplaza la fila de la misma clave y conserva su id', () => {
    const before = [row('int', 10, { id: 'keep' })];
    const after = applyGrant(before, [row('int', 14, { id: 'new' }), row('dis', 6)]);
    expect(after).toHaveLength(2);
    expect(after.find((e) => e.attribute === 'int')).toMatchObject({ id: 'keep', amount: 14 });
  });

  it('revertir quita todo lo de un origen, o solo lo de un día', () => {
    const events = [row('fue', 5, { source: 'habit', sourceId: 'h', date: '2026-10-19' }), row('fue', 7, { source: 'habit', sourceId: 'h' }), row('int', 3)];
    expect(splitRevert(events, { source: 'habit', sourceId: 'h', date: '2026-10-20' }).removed.map((e) => e.amount)).toEqual([7]);
    const all = splitRevert(events, { source: 'habit', sourceId: 'h' });
    expect(all.removed).toHaveLength(2);
    expect(all.kept).toEqual([events[2]]);
  });

  it('suma totales por atributo y el total del personaje', () => {
    const events = [row('int', 14), row('dis', 6), row('int', 3, { sourceId: 't2' })];
    expect(totalXp(events)).toBe(23);
    expect(attributeTotals(events)).toMatchObject({ int: 17, dis: 6, fue: 0 });
  });

  it('describe el cambio por atributo para el aviso', () => {
    const before = [row('int', 10)];
    const after = [row('int', 24), row('dis', 10)];
    const delta = attributeDelta(before, after);
    expect(delta).toEqual({ int: 14, dis: 10 });
    expect(formatAttributeDelta(delta)).toBe('+14 XP Intelecto · +10 XP Disciplina');
  });

  it('sabe cuántos días completos estuvo quieto un atributo', () => {
    const events = [row('fue', 5, { date: '2026-10-15' })];
    expect(idleDaysBefore(events, 'fue', '2026-10-16')).toBe(0);
    expect(idleDaysBefore(events, 'fue', '2026-10-20')).toBe(4);
    expect(idleDaysBefore(events, 'vit', '2026-10-20')).toBeNull();
  });

  it('historial diario con ceros en los días sin XP', () => {
    const events = [row('int', 5, { date: '2026-10-18' }), row('dis', 2, { date: '2026-10-18' }), row('int', 1, { date: '2026-10-20' })];
    expect(dailyXp(events, '2026-10-18', '2026-10-20', 'int')).toEqual([{ date: '2026-10-18', xp: 5 }, { date: '2026-10-19', xp: 0 }, { date: '2026-10-20', xp: 1 }]);
    expect(dailyXp(events, '2026-10-18', '2026-10-18')[0].xp).toBe(7);
  });

  it('cuenta acciones y no filas (una acción repartida en dos atributos es una)', () => {
    expect(distinctActions([row('int', 14), row('dis', 6)])).toHaveLength(1);
  });

  it('compara grupos de filas por clave y monto', () => {
    expect(sameRows([row('int', 14), row('dis', 6)], [row('dis', 6), row('int', 14)])).toBe(true);
    expect(sameRows([row('int', 14)], [row('int', 15)])).toBe(false);
    expect(sameRows([], [])).toBe(true);
  });
});
