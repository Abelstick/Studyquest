import { describe, expect, it } from 'vitest';
import type { Task } from './domain';
import { courseTasks, courseTasksLabel } from './courseTasks';

const task = (id: string, extra: Partial<Task> = {}): Task => ({ id, title: id, courseId: 'c1', priority: 'mid', status: 'todo', dueDate: null, estimateMin: 0, xp: 10, subtasks: [], tags: [], createdAt: '', completedAt: null, ...extra });
const NOW = '2026-09-16';

describe('tareas de un curso', () => {
  it('cuenta abiertas, vencidas, de hoy y hechas, solo de ese curso', () => {
    const r = courseTasks(
      [
        task('tarde', { dueDate: '2026-09-10' }),
        task('hoy', { dueDate: NOW }),
        task('luego', { dueDate: '2026-09-30' }),
        task('sin'),
        task('hecha', { status: 'done', completedAt: NOW }),
        task('ajena', { courseId: 'c2', dueDate: '2026-01-01' }),
      ],
      'c1',
      NOW,
    );
    expect(r.open.map((t) => t.id)).toEqual(['tarde', 'hoy', 'luego', 'sin']);
    expect([r.late, r.dueToday, r.done]).toEqual([1, 1, 1]);
    expect(r.next?.id).toBe('tarde');
  });

  it('dentro del mismo día va antes la que vence más temprano', () => {
    const r = courseTasks([task('b', { dueDate: NOW, dueTime: '18:00' }), task('a', { dueDate: NOW, dueTime: '09:00' })], 'c1', NOW);
    expect(r.open.map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('sin tareas abiertas no hay siguiente', () => {
    expect(courseTasks([], 'c1', NOW).next).toBeNull();
  });

  it('el texto resume el estado', () => {
    expect(courseTasksLabel(courseTasks([], 'c1', NOW))).toBe('Sin tareas');
    expect(courseTasksLabel(courseTasks([task('x', { status: 'done' })], 'c1', NOW))).toBe('Todo al día');
    expect(courseTasksLabel(courseTasks([task('x', { dueDate: '2026-09-01' }), task('y')], 'c1', NOW))).toBe('2 abiertas · 1 vencida');
    expect(courseTasksLabel(courseTasks([task('x')], 'c1', NOW))).toBe('1 abierta');
  });
});
