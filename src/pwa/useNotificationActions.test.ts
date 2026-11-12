import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useData } from '@/state';
import { today } from '@/core/dates';
import type { Habit, Task } from '@/core/domain';
import { completeHabitFromNotification, completeTaskFromNotification, taskIdOfKey } from './useNotificationActions';

const habit: Habit = { id: 'h1', title: 'Leer', frequency: { type: 'daily' }, measure: 'pages', target: 20, reminder: '08:00', steps: [], startDate: '2026-01-01', createdAt: '' };
const task: Task = { id: 't1', title: 'Informe', courseId: null, priority: 'mid', status: 'todo', dueDate: today(), estimateMin: 0, subtasks: [], tags: [], createdAt: '', completedAt: null };

const setHabitValue = vi.fn();
const setTaskStatus = vi.fn();

beforeEach(() => {
  setHabitValue.mockClear();
  setTaskStatus.mockClear();
  useData.setState({ habits: [habit], tasks: [task], habitLogs: [], setHabitValue, setTaskStatus });
});

describe('botones de las notificaciones', () => {
  it('«Hecho» deja el hábito en su objetivo completo', () => {
    expect(completeHabitFromNotification('h1')).toBe(true);
    expect(setHabitValue).toHaveBeenCalledWith('h1', 20);
  });

  it('un hábito ya cumplido hoy, o que ya no existe, no se toca', () => {
    useData.setState({ habitLogs: [{ id: 'l1', habitId: 'h1', date: today(), value: 20, stepsDone: [] }] });
    expect(completeHabitFromNotification('h1')).toBe(false);
    expect(completeHabitFromNotification('borrado')).toBe(false);
    expect(setHabitValue).not.toHaveBeenCalled();
  });

  it('«Completar» cierra la tarea abierta y no reabre una ya hecha', () => {
    expect(completeTaskFromNotification('t1')).toBe(true);
    expect(setTaskStatus).toHaveBeenCalledWith('t1', 'done');
    setTaskStatus.mockClear();
    useData.setState({ tasks: [{ ...task, status: 'done' }] });
    expect(completeTaskFromNotification('t1')).toBe(false);
    expect(setTaskStatus).not.toHaveBeenCalled();
  });

  it('saca el id de la tarea de la clave del aviso', () => {
    expect(taskIdOfKey('task:abc')).toBe('abc');
    expect(taskIdOfKey('abc')).toBeNull();
    expect(taskIdOfKey('task:')).toBeNull();
    expect(taskIdOfKey(undefined)).toBeNull();
  });
});
