import { describe, expect, it } from 'vitest';
import type { Course, Snapshot, StudySession, XpEvent } from './domain';
import { courseLastStudied, coursesInPlay, hoursBetween, weeklyXp, xpBetween, xpBySource, xpByWeekday } from './stats';

const NOW = '2026-09-16'; // miércoles
const ev = (date: string, amount: number, source: XpEvent['source'] = 'task'): XpEvent => ({ id: date + amount + source, date, amount, source, label: '' });
const snap = (over: Partial<Snapshot>): Snapshot => ({ xpEvents: [], sessions: [], ...over }) as Snapshot;

describe('datos del dashboard', () => {
  it('suma el XP por semana y descarta lo negativo', () => {
    const s = snap({ xpEvents: [ev('2026-09-14', 50), ev('2026-09-15', -20), ev('2026-09-08', 30)] });
    const w = weeklyXp(s, 2, NOW);
    expect(w.map((x) => x.xp)).toEqual([30, 50]);
    expect(w[1].from).toBe('2026-09-14');
  });
  it('agrupa el XP por fuente, de más a menos', () => {
    const s = snap({ xpEvents: [ev('2026-09-14', 50, 'task'), ev('2026-09-14', 30, 'habit'), ev('2026-09-15', 50, 'task')] });
    const r = xpBySource(s, null);
    expect(r.map((x) => [x.source, x.xp, x.pct])).toEqual([['task', 100, 77], ['habit', 30, 23]]);
    expect(xpBySource(s, '2026-09-15')).toHaveLength(1);
  });
  it('el XP medio por día de la semana cuenta también los días en blanco', () => {
    const s = snap({ xpEvents: [ev('2026-09-14', 60)] }); // lunes
    const r = xpByWeekday(s, '2026-09-14', NOW); // lun, mar, mié
    expect(r[0].avg).toBe(60);
    expect(r[1].avg).toBe(0);
  });
  it('compara periodos', () => {
    const s = snap({ xpEvents: [ev('2026-09-14', 50), ev('2026-09-01', 20)], sessions: [{ id: 'a', date: '2026-09-14', minutes: 90, courseId: null, label: '' }] });
    expect(xpBetween(s, '2026-09-08', '2026-09-17')).toBe(50);
    expect(hoursBetween(s, '2026-09-08', '2026-09-17')).toBe(1.5);
  });
});

describe('cursos del Inicio', () => {
  const course = (id: string, createdAt: string, done: boolean): Course => ({
    id,
    title: id,
    professor: '',
    field: '',
    mentor: null,
    createdAt,
    modules: [{ id: `m-${id}`, title: 'M', summary: '', xp: 50, topics: [{ id: `t-${id}`, title: 'T', status: done ? 'done' : 'todo', review: false, markedAt: null }] }],
  });
  const session = (courseId: string, date: string): StudySession => ({ id: courseId + date, courseId, date, minutes: 20, label: '' });

  it('primero el último que estudiaste, luego los nuevos y al final los terminados', () => {
    const courses = [course('viejo', '2026-01-01T00:00:00Z', false), course('nuevo', '2026-09-01T00:00:00Z', false), course('hecho', '2026-09-10T00:00:00Z', true), course('estudiado', '2026-02-01T00:00:00Z', false)];
    const sessions = [session('estudiado', '2026-09-15'), session('viejo', '2026-09-01'), session('hecho', '2026-09-16')];
    expect(coursesInPlay({ courses, sessions }).map((c) => c.id)).toEqual(['estudiado', 'viejo', 'nuevo', 'hecho']);
    expect(courseLastStudied({ sessions }, courses[0])).toBe('2026-09-01');
    expect(courseLastStudied({ sessions }, courses[1])).toBeNull();
  });
});
