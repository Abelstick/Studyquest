import { describe, expect, it } from 'vitest';
import type { Habit, Snapshot, Task } from './domain';
import { dailyMissions, missionUrgency } from './missions';

const NOW = '2026-09-16';
const task = (id: string, dueDate: string | null): Task => ({ id, title: id, courseId: null, priority: 'mid', status: 'todo', dueDate, estimateMin: 0, xp: 10, subtasks: [], tags: [], createdAt: '', completedAt: null });
const habit: Habit = { id: 'h', title: 'Agua', frequency: { type: 'daily' }, measure: 'boolean', target: 1, xp: 20, reminder: null, steps: [], startDate: '2026-08-01', createdAt: '' };

describe('misiones de hoy', () => {
  it('no deja fuera a los hábitos aunque haya muchas tareas con fecha', () => {
    const tasks = Array.from({ length: 10 }, (_, i) => task(`t${i}`, '2026-09-10'));
    const m = dailyMissions({ tasks, habits: [habit], habitLogs: [], courses: [] } as unknown as Snapshot, NOW);
    expect(m).toHaveLength(11);
    expect(m.some((x) => x.kind === 'habit')).toBe(true);
  });
  it('lo pendiente va antes que lo hecho y los hábitos de hoy cuentan como urgentes', () => {
    const m = dailyMissions({ tasks: [task('a', '2026-09-20'), task('b', null)], habits: [habit], habitLogs: [], courses: [] } as unknown as Snapshot, NOW);
    expect(m[0].kind).toBe('habit');
    expect(missionUrgency(m[0], NOW)).toBe(0);
  });
});
