import { describe, expect, it } from 'vitest';
import type { AttributeId, XpEvent } from '../domain';
import { addDays } from '../dates';
import { DISCIPLINE, FORMA, MULTIPLIERS } from './config';
import { planAction, planBonus, shares, streakMultiplier, type ActionSpec } from './grant';
import { applyGrant } from './ledger';

const DAY = '2026-10-20';
let n = 0;
const newId = () => `id-${++n}`;
const ev = (attribute: AttributeId, date: string, amount = 10, sourceId = `x-${date}-${attribute}`): XpEvent => ({ id: newId(), date, attribute, amount, source: 'task', sourceId, label: '' });

const gym: ActionSpec = { source: 'habit', sourceId: 'h1', date: DAY, label: 'Gimnasio', base: 20, mapping: { primary: 'fue', secondary: 'vit' } };
const sql: ActionSpec = { source: 'task', sourceId: 't1', date: DAY, label: 'Estudiar SQL', base: 20, mapping: { primary: 'int', secondary: 'dis' } };

/** Ledger con actividad de ayer y de hoy (otra acción) en los atributos dados: así no aplican «primera del día» ni «regreso». */
const warm = (...attrs: AttributeId[]) => attrs.flatMap((a) => [ev(a, addDays(DAY, -1)), ev(a, DAY)]);
const amounts = (rows: XpEvent[]) => Object.fromEntries(rows.map((r) => [r.attribute, r.amount]));

describe('reparto 70/30', () => {
  it('divide el XP base entre primario y secundario', () => {
    expect(shares({ primary: 'fue', secondary: 'vit' })).toEqual([{ attribute: 'fue', share: 0.7 }, { attribute: 'vit', share: 0.3 }]);
  });
  it('sin secundario (o repetido) el primario se lo lleva todo', () => {
    expect(shares({ primary: 'dis', secondary: null })).toEqual([{ attribute: 'dis', share: 1 }]);
    expect(shares({ primary: 'int', secondary: 'int' })).toEqual([{ attribute: 'int', share: 1 }]);
  });
});

describe('multiplicador de racha', () => {
  it('+5 % por cada 7 días, con tope de +25 %', () => {
    expect(streakMultiplier(0)).toBe(0);
    expect(streakMultiplier(6)).toBe(0);
    expect(streakMultiplier(7)).toBeCloseTo(0.05);
    expect(streakMultiplier(20)).toBeCloseTo(0.1);
    expect(streakMultiplier(35)).toBeCloseTo(0.25);
    expect(streakMultiplier(400)).toBeCloseTo(MULTIPLIERS.streakCap);
  });
});

describe('planAction', () => {
  it('sin multiplicadores: 20 XP → 14 FUE + 6 VIT', () => {
    const rows = planAction(gym, { events: warm('fue', 'vit'), streak: 0, newId });
    expect(amounts(rows)).toEqual({ fue: 14, vit: 6 });
  });

  it('la primera acción del día en un atributo da +10 %', () => {
    // Ayer hubo VIT pero hoy ya hay FUE: solo VIT es «primera».
    const rows = planAction(gym, { events: [ev('fue', addDays(DAY, -1)), ev('vit', addDays(DAY, -1)), ev('fue', DAY)], streak: 0, newId });
    expect(amounts(rows)).toEqual({ fue: 14, vit: Math.round(6 * 1.1) });
    expect(rows.find((r) => r.attribute === 'vit')?.mult?.first).toBeCloseTo(MULTIPLIERS.firstOfDay);
  });

  it('regresar tras 3 días completos sin actividad da +20 % (más el +10 % de primera)', () => {
    const events = [ev('fue', addDays(DAY, -4)), ev('vit', addDays(DAY, -1))];
    const rows = planAction(gym, { events, streak: 0, newId });
    const fue = rows.find((r) => r.attribute === 'fue');
    expect(fue?.mult).toMatchObject({ comeback: MULTIPLIERS.comeback, first: MULTIPLIERS.firstOfDay });
    expect(fue?.amount).toBe(Math.round(20 * 0.7 * 1.3));
  });

  it('dos días sin actividad todavía no son un regreso', () => {
    const rows = planAction(gym, { events: [ev('fue', addDays(DAY, -3)), ev('vit', addDays(DAY, -1))], streak: 0, newId });
    expect(rows.find((r) => r.attribute === 'fue')?.mult?.comeback).toBe(0);
  });

  it('la primera vez que se usa un atributo no cuenta como regreso', () => {
    const rows = planAction(gym, { events: [], streak: 0, newId });
    expect(rows.every((r) => r.mult?.comeback === 0)).toBe(true);
  });

  it('la racha multiplica todas las partes y suma Disciplina fija', () => {
    const rows = planAction(gym, { events: warm('fue', 'vit', 'dis'), streak: 14, newId });
    expect(amounts(rows)).toEqual({ fue: Math.round(14 * 1.1), vit: Math.round(6 * 1.1), dis: DISCIPLINE.streakBonus });
  });

  it('cumplir una tarea a tiempo suma Disciplina, también si ya era su secundario', () => {
    const rows = planAction({ ...sql, onTime: true }, { events: warm('int', 'dis'), streak: 3, newId });
    expect(amounts(rows)).toEqual({ int: 14, dis: 6 + DISCIPLINE.streakBonus + DISCIPLINE.onTimeBonus });
  });

  it('con la Forma baja el atributo gana un 10 % menos, sin restar nada de lo que ya tiene', () => {
    // Un solo día activo hace 20 días: la Forma ya bajó de 50.
    const old = ev('fue', addDays(DAY, -20));
    const rows = planAction({ ...gym, mapping: { primary: 'fue', secondary: null } }, { events: [old, ev('fue', DAY, 1, 'other')], streak: 0, newId });
    const m = rows[0].mult;
    expect(m?.forma).toBe(FORMA.lowPenalty);
    expect(m?.comeback).toBe(MULTIPLIERS.comeback);
    expect(rows[0].amount).toBe(Math.round(20 * (1 + MULTIPLIERS.comeback + FORMA.lowPenalty)));
  });

  it('un avance a medias da su parte y no cobra la Disciplina fija', () => {
    const rows = planAction({ ...gym, progress: 0.5 }, { events: warm('fue', 'vit'), streak: 10, newId });
    expect(amounts(rows)).toEqual({ fue: Math.round(14 * 1.05 * 0.5), vit: Math.round(6 * 1.05 * 0.5) });
  });

  it('avance 0 no deja filas (deshacer)', () => {
    expect(planAction({ ...gym, progress: 0 }, { events: [], streak: 10, newId })).toEqual([]);
  });

  it('al avanzar otra vez reutiliza los multiplicadores y el id de la fila del día', () => {
    const ctx = { events: warm('vit'), streak: 0, newId };
    const first = planAction({ ...gym, progress: 0.5 }, ctx);
    const events = applyGrant(ctx.events, first);
    // Ahora ya hay FUE hoy (la propia acción), pero sigue siendo «la primera del día»: no se pierde el +10 %.
    const second = planAction(gym, { ...ctx, events });
    const fue1 = first.find((r) => r.attribute === 'fue');
    const fue2 = second.find((r) => r.attribute === 'fue');
    expect(fue2?.id).toBe(fue1?.id);
    expect(fue2?.mult?.first).toBe(fue1?.mult?.first);
    expect(fue2?.amount).toBe(Math.round(20 * 0.7 * 1.1));
  });

  it('es idempotente: aplicar dos veces lo mismo no duplica XP', () => {
    const ctx = { events: warm('fue', 'vit'), streak: 0, newId };
    const once = applyGrant(ctx.events, planAction(gym, ctx));
    const twice = applyGrant(once, planAction(gym, { ...ctx, events: once }));
    expect(twice).toHaveLength(once.length);
    expect(twice.reduce((a, e) => a + e.amount, 0)).toBe(once.reduce((a, e) => a + e.amount, 0));
  });
});

describe('planBonus', () => {
  it('un bono va entero a su atributo, sin multiplicadores', () => {
    const rows = planBonus({ source: 'combo', sourceId: 'combo', date: DAY, label: 'Combo', attribute: 'dis', amount: 15 }, { events: [], newId });
    expect(rows).toEqual([expect.objectContaining({ attribute: 'dis', amount: 15, sourceId: 'combo', date: DAY })]);
    expect(rows[0].mult).toBeUndefined();
  });
  it('un bono de 0 no deja filas', () => {
    expect(planBonus({ source: 'bonus', sourceId: 'chest', date: DAY, label: '', attribute: 'dis', amount: 0 }, { events: [], newId })).toEqual([]);
  });
});
