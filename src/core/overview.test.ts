import { describe, expect, it } from 'vitest';
import type { Habit, HabitLog, Task } from './domain';
import { habitWeek, taskScopes, taskTally } from './overview';

// Miércoles 16-sep-2026: la semana va del 14 al 20.
const NOW = '2026-09-16';
const task = (id: string, dueDate: string | null, extra: Partial<Task> = {}): Task => ({ id, title: id, courseId: null, priority: 'mid', status: 'todo', dueDate, estimateMin: 0, xp: 10, subtasks: [], tags: [], createdAt: '', completedAt: null, ...extra });
const done = (id: string, dueDate: string | null, completedAt: string) => task(id, dueDate, { status: 'done', completedAt });

describe('tareas por periodo', () => {
  it('si el día tenía 7 cosas, hacerlas todas es el 100 %', () => {
    const tasks = [...Array.from({ length: 3 }, (_, i) => done(`h${i}`, NOW, NOW)), ...Array.from({ length: 4 }, (_, i) => done(`v${i}`, '2026-09-10', NOW))];
    expect(taskTally(tasks, NOW, NOW, NOW)).toEqual({ done: 7, total: 7, late: 0 });
  });

  it('las abiertas atrasadas se arrastran al día y cuentan como vencidas', () => {
    const t = taskTally([task('a', '2026-09-01'), task('b', NOW), done('c', NOW, NOW)], NOW, NOW, NOW);
    expect(t).toEqual({ done: 1, total: 3, late: 1 });
  });

  it('sin fecha o con fecha futura no entran en el día: son extra', () => {
    const t = taskTally([task('sin', null), task('luego', '2026-09-20'), done('extra', null, NOW), done('adelanto', '2026-09-30', NOW)], NOW, NOW, NOW);
    expect(t).toEqual({ done: 0, total: 0, late: 0 });
  });

  it('una cerrada otro día no cuenta en este periodo', () => {
    expect(taskTally([done('a', '2026-09-14', '2026-09-14')], NOW, NOW, NOW).total).toBe(0);
  });

  it('semana, mes y año acumulan; «open» cuenta toda la lista', () => {
    const tasks = [done('lun', '2026-09-14', '2026-09-14'), task('vie', '2026-09-18'), task('fin-mes', '2026-09-30'), task('dic', '2026-12-01'), task('sin', null), done('agosto', '2026-08-03', '2026-08-03')];
    const s = taskScopes(tasks, NOW);
    expect(s.week).toEqual({ done: 1, total: 2, late: 0 });
    expect(s.month).toMatchObject({ done: 1, total: 3 });
    expect(s.year).toMatchObject({ done: 2, total: 5 });
    expect(s.open).toBe(4);
  });
});

describe('hábitos de la semana', () => {
  const habit = (id: string, extra: Partial<Habit> = {}): Habit => ({ id, title: id, frequency: { type: 'daily' }, measure: 'boolean', target: 1, xp: 10, reminder: null, steps: [], startDate: '2026-01-01', createdAt: '', ...extra });
  const log = (habitId: string, date: string): HabitLog => ({ id: `${habitId}-${date}`, habitId, date, value: 1, stepsDone: [] });

  it('cuenta de lunes a hoy lo cumplido sobre lo que tocaba', () => {
    // Lunes, martes y miércoles: 3 días de un hábito diario; hechos lunes y miércoles.
    const w = habitWeek([habit('a')], [log('a', '2026-09-14'), log('a', '2026-09-16')], NOW);
    expect(w).toEqual({ done: 2, due: 3, pct: 67 });
  });

  it('un hábito no cuenta antes de su fecha de inicio', () => {
    expect(habitWeek([habit('a', { startDate: '2026-09-16' })], [], NOW)).toEqual({ done: 0, due: 1, pct: 0 });
  });

  it('sin hábitos el porcentaje es 0, no NaN', () => {
    expect(habitWeek([], [], NOW)).toEqual({ done: 0, due: 0, pct: 0 });
  });
});
