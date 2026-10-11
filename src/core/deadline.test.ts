import { describe, expect, it } from 'vitest';
import type { Task } from './domain';
import { deadlineText, dailyMissions } from './missions';
import { isOverdue, minutesToDue, timeLeftLabel } from './tasks';
import type { Snapshot } from './domain';

const NOW = '2026-09-16';
const task = (dueDate: string | null, dueTime?: string, over: Partial<Task> = {}): Task => ({
  id: 't', title: 't', courseId: null, priority: 'mid', status: 'todo', dueDate, dueTime, estimateMin: 0, xp: 10, subtasks: [], tags: [], createdAt: '', completedAt: null, ...over,
});
const at = (h: number, m = 0) => h * 60 + m;

describe('hora límite de una tarea', () => {
  it('sin hora vence al terminar el día; con hora, a esa hora', () => {
    expect(minutesToDue(task(NOW), NOW, at(23, 0))).toBe(60);
    expect(minutesToDue(task(NOW, '18:00'), NOW, at(17, 15))).toBe(45);
    expect(minutesToDue(task('2026-09-17', '08:00'), NOW, at(20, 0))).toBe(12 * 60);
    expect(minutesToDue(task(null), NOW, 0)).toBeNull();
  });

  it('está vencida en cuanto pasa la hora, aunque sea hoy', () => {
    expect(isOverdue(task(NOW, '18:00'), NOW, at(17, 59))).toBe(false);
    expect(isOverdue(task(NOW, '18:00'), NOW, at(18, 0))).toBe(true);
    expect(isOverdue(task(NOW), NOW, at(23, 59))).toBe(false);
    expect(isOverdue(task('2026-09-15'), NOW, 0)).toBe(true);
    expect(isOverdue(task('2026-09-15', undefined, { status: 'done' }), NOW, 0)).toBe(false);
  });

  it('ignora una hora con formato inválido', () => {
    expect(minutesToDue(task(NOW, '25:00'), NOW, at(23, 0))).toBe(60);
  });

  it('dice cuánto queda en horas o minutos si vence hoy', () => {
    expect(timeLeftLabel(task(NOW, '18:00'), NOW, at(15, 0))).toBe('Quedan 3 h');
    expect(timeLeftLabel(task(NOW, '18:00'), NOW, at(17, 35))).toBe('Quedan 25 min');
    expect(timeLeftLabel(task(NOW, '18:00'), NOW, at(18, 5))).toBe('Venció a las 18:00');
    expect(timeLeftLabel(task(NOW), NOW, at(15, 0))).toBe('Vence hoy');
    expect(timeLeftLabel(task('2026-09-19', '18:00'), NOW, at(15, 0))).toBe('Faltan 3 días');
  });

  it('la misión dice hasta qué hora', () => {
    expect(deadlineText(task(NOW, '18:00'), NOW)).toBe('Hasta hoy a las 18:00');
    expect(deadlineText(task('2026-09-20', '09:30'), NOW)).toBe('Hasta el 20 sep a las 09:30');
    expect(deadlineText(task('2026-09-14', '09:30'), NOW)).toBe('Venció el 14 sep a las 09:30');
  });

  it('dentro del mismo día va antes la que vence más temprano', () => {
    const tasks = [task(NOW, undefined, { id: 'sin-hora' }), task(NOW, '20:00', { id: 'noche' }), task(NOW, '09:00', { id: 'mañana' })];
    const m = dailyMissions({ tasks, habits: [], habitLogs: [], courses: [] } as unknown as Snapshot, NOW); // solo hacen falta estos campos
    expect(m.map((x) => x.id)).toEqual(['t:mañana', 't:noche', 't:sin-hora']);
  });
});
