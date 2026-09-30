import { describe, expect, it } from 'vitest';
import type { Habit, HabitLog, StudySession } from './domain';
import { calendarDays, overdueTasks, undatedTasks, weekDays } from './calendar';

const NOW = '2026-09-16'; // miércoles
const habit = (over: Partial<Habit>): Habit => ({
  id: 'h', title: 'Agua', frequency: { type: 'daily' }, measure: 'times', target: 10, xp: 20, reminder: null, steps: [], startDate: '2026-08-01', createdAt: '', ...over,
});
const log = (date: string, value: number): HabitLog => ({ id: date, habitId: 'h', date, value, stepsDone: [] });
const session = (date: string, minutes: number): StudySession => ({ id: date, date, minutes, courseId: null, label: '' });

describe('calendario', () => {
  it('la semana va de lunes a domingo', () => {
    const w = weekDays(NOW);
    expect(w[0]).toBe('2026-09-14');
    expect(w[6]).toBe('2026-09-20');
  });

  it('muestra el avance del hábito por día y suma los minutos estudiados', () => {
    const days = calendarDays({ tasks: [], courses: [], habits: [habit({})], habitLogs: [log('2026-09-14', 10), log('2026-09-15', 6)], sessions: [session('2026-09-15', 30), session('2026-09-15', 45)] }, '2026-09-14', '2026-09-20', NOW);
    expect(days.get('2026-09-14')?.habits[0]).toMatchObject({ done: true, progress: 1 });
    expect(days.get('2026-09-15')?.habits[0]).toMatchObject({ done: false, value: 6, progress: 0.6 });
    expect(days.get('2026-09-15')?.minutes).toBe(75);
    expect(days.get('2026-09-18')?.habits[0]).toMatchObject({ due: true, done: false }); // programado a futuro
  });

  it('un hábito de cuota solo aparece cuando se hizo, y hoy mientras falte cuota', () => {
    const h = habit({ frequency: { type: 'custom', times: 2, per: 'week' } });
    const days = calendarDays({ tasks: [], courses: [], habits: [h], habitLogs: [log('2026-09-14', 10)] }, '2026-09-14', '2026-09-20', NOW);
    expect(days.get('2026-09-14')?.habits).toHaveLength(1);
    expect(days.get('2026-09-15')?.habits ?? []).toHaveLength(0);
    expect(days.get('2026-09-16')?.habits).toHaveLength(1); // hoy: aún falta 1
    expect(days.get('2026-09-18')?.habits ?? []).toHaveLength(0);
  });

  it('separa vencidas y sin fecha', () => {
    const t = (id: string, dueDate: string | null, status: 'todo' | 'done' = 'todo') => ({ id, title: id, courseId: null, priority: 'mid', status, dueDate, estimateMin: 0, xp: 10, subtasks: [], tags: [], createdAt: '', completedAt: null }) as never;
    const tasks = [t('a', '2026-09-10'), t('b', null), t('c', '2026-09-10', 'done'), t('d', '2026-09-30')];
    expect(overdueTasks(tasks, NOW).map((x: { id: string }) => x.id)).toEqual(['a']);
    expect(undatedTasks(tasks).map((x: { id: string }) => x.id)).toEqual(['b']);
  });
});
