import { describe, expect, it } from 'vitest';
import type { Habit, HabitLog, XpEvent } from './domain';
import { addDays } from './dates';
import { computeStreak, courseProgress, frequencyLabel, habitStreaks, isDueOn, levelFromXp, levelProgress, monthlyCompliance, weekStrip, worldFor, xpAtLevelStart } from './game';

const NOW = '2026-09-20'; // domingo

const ev = (date: string, amount = 50): XpEvent => ({ id: date + amount, date, amount, source: 'session', label: '' });
const habit = (over: Partial<Habit>): Habit => ({
  id: 'h', title: 'h', frequency: { type: 'daily' }, measure: 'minutes', target: 30, xp: 30, reminder: null, steps: [], startDate: '2026-08-01', createdAt: '', ...over,
});
const log = (habitId: string, date: string, value: number): HabitLog => ({ id: habitId + date, habitId, date, value, stepsDone: [] });

describe('niveles', () => {
  it('nivel 12 cuesta 3.000 XP y arranca en 16.500', () => {
    expect(xpAtLevelStart(12)).toBe(16_500);
    expect(xpAtLevelStart(13) - xpAtLevelStart(12)).toBe(3_000);
  });
  it('19.390 XP = nivel 12 con 2.890 / 3.000', () => {
    const p = levelProgress(19_390);
    expect(p).toMatchObject({ level: 12, into: 2_890, needed: 3_000, left: 110 });
  });
  it('los límites de nivel son exactos', () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(249)).toBe(1);
    expect(levelFromXp(250)).toBe(2);
    expect(levelFromXp(xpAtLevelStart(13) - 1)).toBe(12);
    expect(levelFromXp(xpAtLevelStart(13))).toBe(13);
    expect(levelFromXp(-50)).toBe(1);
  });
  it('mundo: nivel 12 → 3-4, nivel 13 → 4-1', () => {
    expect(worldFor(1)).toBe('1-1');
    expect(worldFor(12)).toBe('3-4');
    expect(worldFor(13)).toBe('4-1');
  });
});

describe('racha', () => {
  it('cuenta días consecutivos terminando hoy', () => {
    const events = [0, 1, 2, 3].map((i) => ev(addDays(NOW, -i)));
    expect(computeStreak(events, [], NOW).current).toBe(4);
  });
  it('si hoy aún no hay actividad, la racha de ayer sigue viva', () => {
    const events = [1, 2, 3].map((i) => ev(addDays(NOW, -i)));
    const s = computeStreak(events, [], NOW);
    expect(s.current).toBe(3);
    expect(s.activeToday).toBe(false);
  });
  it('un hueco de un día la rompe', () => {
    const events = [0, 1, 3, 4, 5].map((i) => ev(addDays(NOW, -i)));
    const s = computeStreak(events, [], NOW);
    expect(s.current).toBe(2);
    expect(s.best).toBe(3);
  });
  it('un día congelado mantiene la racha', () => {
    const events = [0, 2, 3].map((i) => ev(addDays(NOW, -i)));
    expect(computeStreak(events, [addDays(NOW, -1)], NOW).current).toBe(4);
  });
  it('un día con XP neto ≤ 0 (por deshacer) no cuenta', () => {
    expect(computeStreak([ev(NOW, 40), ev(NOW, -40)], [], NOW).current).toBe(0);
  });
});

describe('hábitos', () => {
  it('días específicos: solo toca esos días', () => {
    const h = habit({ frequency: { type: 'days', days: [0, 2, 4] } }); // L X V
    expect(isDueOn(h, '2026-09-14', [])).toBe(true); // lunes
    expect(isDueOn(h, '2026-09-15', [])).toBe(false); // martes
    expect(isDueOn(h, '2026-09-16', [])).toBe(true); // miércoles
  });
  it('cada 2 días parte de la fecha de inicio', () => {
    const h = habit({ frequency: { type: 'every', every: 2 }, startDate: '2026-09-10' });
    expect(isDueOn(h, '2026-09-10', [])).toBe(true);
    expect(isDueOn(h, '2026-09-11', [])).toBe(false);
    expect(isDueOn(h, '2026-09-12', [])).toBe(true);
    expect(isDueOn(h, '2026-09-09', [])).toBe(false);
  });
  it('semanal: deja de tocar tras cumplirse esa semana', () => {
    const h = habit({ frequency: { type: 'weekly' }, target: 1 });
    expect(isDueOn(h, '2026-09-17', [])).toBe(true);
    expect(isDueOn(h, '2026-09-17', [log('h', '2026-09-15', 1)])).toBe(false);
    expect(isDueOn(h, '2026-09-21', [log('h', '2026-09-15', 1)])).toBe(true); // semana nueva
  });
  it('la tira semanal marca hecho / hoy / nada', () => {
    const h = habit({});
    const strip = weekStrip(h, [log('h', '2026-09-14', 30), log('h', '2026-09-15', 10)], NOW);
    expect(strip.map((d) => d.state)).toEqual(['done', 'idle', 'idle', 'idle', 'idle', 'idle', 'today']);
  });
  it('rachas del hábito ignoran los días en que no tocaba', () => {
    const h = habit({ frequency: { type: 'days', days: [0, 2, 4] } });
    const logs = [log('h', '2026-09-14', 30), log('h', '2026-09-16', 30), log('h', '2026-09-18', 30)]; // L X V
    expect(habitStreaks(h, logs, NOW)).toMatchObject({ current: 3, best: 3, completions: 3 });
  });
  it('cumplimiento mensual se limita a 100 %', () => {
    const h = habit({});
    const logs = Array.from({ length: 30 }, (_, i) => log('h', addDays(NOW, -i), 30));
    expect(monthlyCompliance(h, logs, NOW)).toBe(100);
  });
});

describe('frecuencias nuevas', () => {
  it('fechas concretas: solo toca esos días', () => {
    const h = habit({ frequency: { type: 'dates', dates: ['2026-10-05', '2026-11-20'] } });
    expect(isDueOn(h, '2026-10-05', [])).toBe(true);
    expect(isDueOn(h, '2026-10-06', [])).toBe(false);
  });
  it('anual: mismo día y mes cada año', () => {
    const h = habit({ frequency: { type: 'yearly', month: 3, day: 15 } });
    expect(isDueOn(h, '2026-03-15', [])).toBe(true);
    expect(isDueOn(h, '2027-03-15', [])).toBe(true);
    expect(isDueOn(h, '2026-03-16', [])).toBe(false);
    expect(isDueOn(h, '2026-04-15', [])).toBe(false);
  });
  it('anual 29 de febrero: en año no bisiesto toca el 28', () => {
    const h = habit({ frequency: { type: 'yearly', month: 2, day: 29 } });
    expect(isDueOn(h, '2028-02-29', [])).toBe(true); // bisiesto
    expect(isDueOn(h, '2028-02-28', [])).toBe(false);
    expect(isDueOn(h, '2027-02-28', [])).toBe(true); // no bisiesto
    expect(isDueOn(h, '2027-03-01', [])).toBe(false);
  });
  it('personalizado 3× por semana: toca hasta cumplir 3 en la semana', () => {
    const h = habit({ frequency: { type: 'custom', times: 3, per: 'week' }, target: 1 });
    const logs = [log('h', '2026-09-14', 1), log('h', '2026-09-15', 1)]; // lunes y martes
    expect(isDueOn(h, '2026-09-16', logs)).toBe(true); // miércoles: van 2 de 3
    expect(isDueOn(h, '2026-09-17', [...logs, log('h', '2026-09-16', 1)])).toBe(false); // ya son 3
    expect(isDueOn(h, '2026-09-21', [...logs, log('h', '2026-09-16', 1)])).toBe(true); // semana nueva
  });
  it('personalizado por mes cuenta dentro del mes natural', () => {
    const h = habit({ frequency: { type: 'custom', times: 2, per: 'month' }, target: 1 });
    const logs = [log('h', '2026-09-03', 1), log('h', '2026-09-10', 1)];
    expect(isDueOn(h, '2026-09-20', logs)).toBe(false);
    expect(isDueOn(h, '2026-10-01', logs)).toBe(true);
  });
  it('etiquetas legibles', () => {
    expect(frequencyLabel({ type: 'custom', times: 3, per: 'week' })).toBe('3× por semana');
    expect(frequencyLabel({ type: 'yearly', month: 3, day: 15 })).toBe('Cada 15 mar');
    expect(frequencyLabel({ type: 'dates', dates: ['2026-10-05'] })).toBe('1 fecha');
  });
});

describe('cursos', () => {
  it('el progreso cuenta temas completados', () => {
    const topic = (id: string, status: 'done' | 'todo') => ({ id, title: 't', status, review: false, markedAt: null });
    const course = {
      id: 'c', title: 'c', professor: '', field: '', mentor: null, createdAt: '',
      modules: [{ id: 'm', title: 'm', summary: '', xp: 100, topics: [topic('1', 'done'), topic('2', 'todo'), topic('3', 'todo'), topic('4', 'done')] }],
    };
    expect(courseProgress(course)).toMatchObject({ total: 4, done: 2, pct: 50, xp: 50 });
  });
});
