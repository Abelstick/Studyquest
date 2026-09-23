import { describe, expect, it } from 'vitest';
import type { Habit, HabitLog } from './domain';
import { CATCH_UP_DAYS, canCatchUp, catchUpDay, catchUpWindow, pendingCatchUp, totalPending } from './catchup';

const NOW = '2026-09-16'; // miércoles

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h1', title: 'Leer', frequency: { type: 'daily' }, measure: 'boolean', target: 1, xp: 20,
  reminder: null, steps: [], startDate: '2026-01-01', createdAt: '', ...over,
});
const log = (date: string, value = 1, habitId = 'h1'): HabitLog => ({ id: `l-${date}`, habitId, date, value, stepsDone: [] });

describe('qué días se pueden rellenar', () => {
  it('ayer sí, por si se te olvidó marcarlo', () => {
    const d = catchUpDay(habit(), [], '2026-09-15', NOW);
    expect(d).toMatchObject({ editable: true, done: false, isToday: false });
  });

  it('hoy también, que es lo normal', () => {
    expect(catchUpDay(habit(), [], NOW, NOW)).toMatchObject({ editable: true, isToday: true });
  });

  it('mañana NO: no se puede marcar lo que aún no ha pasado', () => {
    expect(catchUpDay(habit(), [], '2026-09-17', NOW)).toMatchObject({ editable: false, reason: 'futuro' });
  });

  it('más atrás del límite NO: la racha dejaría de significar algo', () => {
    const justo = catchUpDay(habit(), [], '2026-09-09', NOW); // 7 días atrás
    const pasado = catchUpDay(habit(), [], '2026-09-08', NOW); // 8 días atrás
    expect(justo.editable).toBe(true);
    expect(pasado).toMatchObject({ editable: false, reason: 'demasiado-atras' });
    expect(CATCH_UP_DAYS).toBe(7);
  });

  it('antes de crear el hábito NO', () => {
    const h = habit({ startDate: '2026-09-14' });
    expect(catchUpDay(h, [], '2026-09-13', NOW)).toMatchObject({ editable: false, reason: 'antes-de-crearlo' });
    expect(catchUpDay(h, [], '2026-09-14', NOW).editable).toBe(true);
  });

  it('un día que no tocaba NO se rellena: no incumpliste nada', () => {
    // solo lunes (0) y viernes (4); el martes 15 no tocaba
    const h = habit({ frequency: { type: 'days', days: [0, 4] } });
    expect(catchUpDay(h, [], '2026-09-15', NOW)).toMatchObject({ editable: false, reason: 'no-tocaba', due: false });
    expect(catchUpDay(h, [], '2026-09-14', NOW).editable).toBe(true); // lunes sí
  });

  it('pero si un día que no tocaba YA está marcado, se puede desmarcar', () => {
    const h = habit({ frequency: { type: 'days', days: [0, 4] } });
    expect(catchUpDay(h, [log('2026-09-15')], '2026-09-15', NOW)).toMatchObject({ editable: true, done: true });
  });

  it('canCatchUp responde lo mismo, en corto', () => {
    expect(canCatchUp(habit(), [], '2026-09-15', NOW)).toBe(true);
    expect(canCatchUp(habit(), [], '2026-09-17', NOW)).toBe(false);
  });
});

describe('la ventana de días', () => {
  it('va del más antiguo a hoy, con hoy al final', () => {
    const w = catchUpWindow(habit(), [], NOW);
    expect(w).toHaveLength(CATCH_UP_DAYS + 1);
    expect(w[0].date).toBe('2026-09-09');
    expect(w.at(-1)).toMatchObject({ date: NOW, isToday: true });
  });

  it('marca como hechos los días que tienen registro', () => {
    const w = catchUpWindow(habit(), [log('2026-09-14'), log('2026-09-15')], NOW);
    expect(w.filter((d) => d.done).map((d) => d.date)).toEqual(['2026-09-14', '2026-09-15']);
  });

  it('un registro por debajo del objetivo no cuenta como hecho', () => {
    const h = habit({ measure: 'pages', target: 20 });
    const w = catchUpWindow(h, [log('2026-09-15', 12)], NOW);
    expect(w.find((d) => d.date === '2026-09-15')?.done).toBe(false);
  });
});

describe('lo que te falta por ponerte al día', () => {
  it('lista los días pasados que tocaban y siguen sin marcar', () => {
    const logs = [log('2026-09-14'), log('2026-09-12')];
    const p = pendingCatchUp(habit(), logs, NOW);
    expect(p.map((d) => d.date)).toEqual(['2026-09-09', '2026-09-10', '2026-09-11', '2026-09-13', '2026-09-15']);
  });

  it('hoy no cuenta como olvido: todavía estás a tiempo', () => {
    expect(pendingCatchUp(habit(), [], NOW).some((d) => d.date === NOW)).toBe(false);
  });

  it('un hábito al día no tiene nada pendiente', () => {
    const logs = ['2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14', '2026-09-15'].map((d) => log(d));
    expect(pendingCatchUp(habit(), logs, NOW)).toEqual([]);
  });

  it('suma los olvidos de todos los hábitos', () => {
    const a = habit({ id: 'a' });
    const b = habit({ id: 'b', frequency: { type: 'days', days: [0] } }); // solo lunes
    const logs = [log('2026-09-15', 1, 'a')];
    // «a» tiene 6 días sin marcar de los 7; «b» solo el lunes 14
    expect(totalPending([a, b], logs, NOW)).toBe(6 + 1);
  });
});
