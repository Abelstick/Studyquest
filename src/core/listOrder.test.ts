import { describe, expect, it } from 'vitest';
import type { Course, Habit, Snapshot, Task } from './domain';
import { arrangeCourses, byRecentlyDone, courseStatus, sortHabitCards } from './listOrder';

const habit = (id: string): Habit => ({ id, title: id, frequency: { type: 'daily' }, measure: 'boolean', target: 1, xp: 10, reminder: null, steps: [], startDate: '2026-01-01', createdAt: '' });
const card = (id: string, o: { due?: boolean; done?: boolean; pct?: number } = {}) => ({ h: habit(id), due: o.due ?? true, done: o.done ?? false, pct: o.pct ?? 50 });

const course = (id: string, title: string, statuses: ('todo' | 'doing' | 'done')[]): Course => ({
  id,
  title,
  professor: '',
  field: '',
  mentor: null,
  createdAt: '',
  modules: [{ id: `${id}m`, title: 'M', summary: '', xp: 40, topics: statuses.map((status, i) => ({ id: `${id}t${i}`, title: `T${i}`, status, review: false, markedAt: null })) }],
});
// Del registro de estudio solo importan el curso y el día.
const session = (courseId: string, date: string) => ({ id: courseId + date, courseId, minutes: 30, date }) as Snapshot['sessions'][number];

describe('orden de hábitos', () => {
  it('«hoy primero»: lo que falta, luego lo hecho y al final lo que no toca; con empate, el orden de creación', () => {
    const r = sortHabitCards([card('a', { due: false }), card('b', { done: true }), card('c'), card('d')], 'today');
    expect(r.map((c) => c.h.id)).toEqual(['c', 'd', 'b', 'a']);
  });

  it('«menos cumplidos» pone primero lo que más cuesta del mes', () => {
    const r = sortHabitCards([card('a', { pct: 90 }), card('b', { pct: 10 }), card('c', { pct: 50 })], 'month');
    expect(r.map((c) => c.h.id)).toEqual(['b', 'c', 'a']);
  });

  it('A–Z no modifica la lista original', () => {
    const input = [card('b'), card('a')];
    expect(sortHabitCards(input, 'name').map((c) => c.h.id)).toEqual(['a', 'b']);
    expect(input.map((c) => c.h.id)).toEqual(['b', 'a']);
  });
});

describe('cursos', () => {
  const nuevo = course('n', 'Nuevo', ['todo', 'todo']);
  const medio = course('m', 'Medio', ['done', 'todo']);
  const listo = course('l', 'Listo', ['done', 'done']);
  const vacio = course('v', 'Vacío', []);

  it('estado según los temas hechos; un curso sin temas está sin empezar', () => {
    expect([nuevo, medio, listo, vacio].map(courseStatus)).toEqual(['new', 'doing', 'done', 'new']);
  });

  it('filtra por estado', () => {
    expect(arrangeCourses([nuevo, medio, listo], [], 'doing', 'name').map((c) => c.id)).toEqual(['m']);
    expect(arrangeCourses([nuevo, medio, listo], [], 'all', 'name')).toHaveLength(3);
  });

  it('«recientes»: el último estudiado primero y los completados al final', () => {
    const r = arrangeCourses([listo, nuevo, medio], [session('n', '2026-03-01'), session('m', '2026-03-05'), session('l', '2026-03-09')], 'all', 'recent');
    expect(r.map((c) => c.id)).toEqual(['m', 'n', 'l']);
  });

  it('«más avanzados» ordena por porcentaje', () => {
    expect(arrangeCourses([nuevo, listo, medio], [], 'all', 'progress').map((c) => c.id)).toEqual(['l', 'm', 'n']);
  });
});

describe('tareas superadas', () => {
  // De la tarea solo importa el día de cierre.
  const t = (id: string, completedAt: string | null) => ({ id, completedAt }) as Task;
  it('la cerrada más recientemente va primero y la que no tiene fecha, al final', () => {
    expect([t('a', '2026-03-01'), t('b', null), t('c', '2026-03-09')].sort(byRecentlyDone).map((x) => x.id)).toEqual(['c', 'a', 'b']);
  });
});
