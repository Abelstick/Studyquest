import { describe, expect, it } from 'vitest';
import type { Course, Task } from './domain';
import { courseDeadline, deadlineSummary, paceText } from './courseDeadline';

// Miércoles 16-sep-2026.
const NOW = '2026-09-16';
const course = (done: number, total: number, extra: Partial<Course> = {}): Course => ({
  id: 'c1',
  title: 'SQL',
  professor: '',
  field: '',
  mentor: null,
  createdAt: '',
  modules: [{ id: 'm', title: 'M', summary: '', xp: 40, topics: Array.from({ length: total }, (_, i) => ({ id: `t${i}`, title: `T${i}`, status: i < done ? ('done' as const) : ('todo' as const), review: false, markedAt: null })) }],
  ...extra,
});
const task = (id: string, dueDate: string | null, extra: Partial<Task> = {}): Task => ({ id, title: id, courseId: 'c1', priority: 'mid', status: 'todo', dueDate, estimateMin: 0, xp: 10, subtasks: [], tags: [], createdAt: '', completedAt: null, ...extra });

describe('plazo de un curso', () => {
  it('la fecha que fijas manda sobre la de las tareas', () => {
    const d = courseDeadline(course(2, 12, { dueDate: '2026-10-16' }), [task('a', '2026-12-01')], NOW);
    expect(d).toMatchObject({ date: '2026-10-16', source: 'set', daysLeft: 30, topicsLeft: 10, state: 'ok' });
  });

  it('sin fecha propia se deduce de la tarea abierta más lejana del curso, y no de otros cursos', () => {
    const d = courseDeadline(course(0, 4), [task('a', '2026-09-20'), task('b', '2026-10-01'), task('hecha', '2027-01-01', { status: 'done' }), task('ajena', '2027-06-01', { courseId: 'otro' })], NOW);
    expect(d).toMatchObject({ date: '2026-10-01', source: 'tasks', daysLeft: 15 });
  });

  it('sin fecha ni tareas con plazo no hay plazo', () => {
    expect(courseDeadline(course(0, 4), [task('a', null)], NOW)).toMatchObject({ date: null, source: null, daysLeft: null, state: 'none', perWeek: null });
  });

  it('calcula el ritmo semanal que hace falta, redondeando hacia arriba', () => {
    // 10 temas en 30 días ≈ 4,3 semanas → 3 temas por semana.
    const d = courseDeadline(course(2, 12, { dueDate: '2026-10-16' }), [], NOW);
    expect(d.perWeek).toBe(3);
    expect(paceText(d)).toBe('≈ 3 temas por semana para llegar');
  });

  it('con pocos días el ritmo no se dispara: menos de una semana cuenta como una', () => {
    const d = courseDeadline(course(0, 5, { dueDate: '2026-09-18' }), [], NOW);
    expect(d).toMatchObject({ state: 'soon', perWeek: 5 });
  });

  it('con menos de una semana por delante dice los temas y los días, no «por semana»', () => {
    expect(paceText(courseDeadline(course(0, 11, { dueDate: '2026-09-19' }), [], NOW))).toBe('11 temas en 3 días');
    expect(paceText(courseDeadline(course(0, 1, { dueDate: '2026-09-17' }), [], NOW))).toBe('1 tema en 1 día');
    expect(paceText(courseDeadline(course(0, 2, { dueDate: NOW }), [], NOW))).toBe('2 temas hoy');
  });

  it('vencido sin terminar: estado «late» y sin ritmo', () => {
    const d = courseDeadline(course(1, 4, { dueDate: '2026-09-10' }), [], NOW);
    expect(d).toMatchObject({ state: 'late', daysLeft: -6, perWeek: null });
    expect(deadlineSummary(d)).toBe('Venció el 10 sep · hace 6 días');
  });

  it('terminado: «done», aunque el plazo haya pasado', () => {
    const d = courseDeadline(course(4, 4, { dueDate: '2026-09-10' }), [], NOW);
    expect(d.state).toBe('done');
    expect(deadlineSummary(d)).toBe('Completado');
  });

  it('el resumen dice la fecha y cuánto falta', () => {
    expect(deadlineSummary(courseDeadline(course(0, 4, { dueDate: '2026-09-30' }), [], NOW))).toBe('Hasta el 30 sep · faltan 14 días');
    expect(deadlineSummary(courseDeadline(course(0, 4), [], NOW))).toBe('Sin plazo');
  });
});
