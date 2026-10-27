// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { defaultProfile } from '@/core/game';
import type { Habit, HabitLog, Task } from '@/core/domain';
import Inicio from './Inicio';

/** Miércoles 16-sep-2026, 12:00. */
const NOW = new Date(2026, 8, 16, 12, 0, 0);
const TODAY = '2026-09-16';

const habit = (id: string, extra: Partial<Habit> = {}): Habit => ({ id, title: id, frequency: { type: 'daily' }, measure: 'boolean', target: 1, xp: 20, reminder: null, steps: [], startDate: '2026-01-01', createdAt: '', ...extra });
const log = (habitId: string, value: number, date = TODAY): HabitLog => ({ id: `${habitId}-${date}`, habitId, date, value, stepsDone: [] });
const task = (id: string, extra: Partial<Task> = {}): Task => ({ id, title: id, courseId: null, priority: 'mid', status: 'todo', dueDate: null, estimateMin: 0, xp: 10, subtasks: [], tags: [], createdAt: '', completedAt: null, ...extra });

const card = () => document.querySelector('.nextstep') as HTMLElement;
const title = () => card().querySelector('.nextstep__title')?.textContent;

// Las acciones reales del store guardan en un repositorio; aquí basta con que cambien el estado.
const setHabitValue = vi.fn((id: string, value: number) => {
  const h = useData.getState().habits.find((x) => x.id === id);
  if (!h) return;
  useData.setState((s) => ({ habitLogs: [...s.habitLogs.filter((l) => !(l.habitId === id && l.date === TODAY)), log(id, value)] }));
});
const setTaskStatus = vi.fn((id: string, status: Task['status']) => useData.setState((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, status, completedAt: status === 'done' ? TODAY : null } : t)) })));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(NOW);
  useData.setState({ profile: { ...defaultProfile('u'), onboarded: true }, tasks: [], habits: [], habitLogs: [], courses: [], sessions: [], xpEvents: [], events: [], notifications: [], setHabitValue, setTaskStatus });
  useUi.setState({ modal: null, toasts: [], folds: {} });
  setHabitValue.mockClear();
  setTaskStatus.mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const home = () =>
  render(
    <MemoryRouter>
      <Inicio />
    </MemoryRouter>,
  );

describe('tarjeta grande de «Siguiente paso»', () => {
  it('al completar un hábito desde el tablero, la tarjeta pasa al siguiente', () => {
    useData.setState({ habits: [habit('Leer', { reminder: '07:00' }), habit('Correr', { reminder: '19:00' })] });
    home();
    expect(title()).toBe('Leer');
    fireEvent.click(screen.getByRole('checkbox', { name: /Completar: Leer/ }));
    expect(title()).toBe('Correr');
  });

  it('al completar una tarea, también', () => {
    useData.setState({ tasks: [task('Informe', { dueDate: TODAY, dueTime: '20:00' }), task('Resumen', { dueDate: TODAY, dueTime: '23:00' })] });
    home();
    expect(title()).toBe('Informe');
    fireEvent.click(within(screen.getByRole('region', { name: /^Tareas/ })).getByRole('checkbox', { name: /Completar: Informe/ }));
    expect(title()).toBe('Resumen');
  });

  it('con un hábito a medias sigue siendo el paso, pero enseña lo que llevas y el XP que ya ganaste', () => {
    useData.setState({ habits: [habit('Leer', { measure: 'pages', target: 20, xp: 25 })], habitLogs: [log('Leer', 12)] });
    home();
    expect(title()).toBe('Leer');
    expect(within(card()).getByText(/llevas el 60 % · ya ganaste \+15 de 25 XP/)).toBeTruthy();
    expect(within(card()).getByRole('progressbar', { name: 'Avance de hoy de Leer' })).toBeTruthy();
  });

  it('el hábito del paso enseña su hora junto a la fecha', () => {
    useData.setState({ habits: [habit('Leer', { reminder: '07:30' })] });
    home();
    expect(within(card()).getByText(/Hábito de hoy · Mié 16 sep · 07:30/)).toBeTruthy();
  });

  it('sin avance no enseña barra, y el hábito lleva la fecha de hoy', () => {
    useData.setState({ habits: [habit('Leer')] });
    home();
    expect(within(card()).queryByRole('progressbar')).toBeNull();
    expect(within(card()).getByText(/Hábito de hoy · Mié 16 sep/)).toBeTruthy();
  });

  it('un hábito de varias veces no se quita tras la primera: sigue siendo el paso hasta completarlo', () => {
    useData.setState({
      habits: [habit('Agua', { measure: 'times', target: 3, reminder: '07:00' }), habit('Correr', { reminder: '19:00' })],
    });
    home();
    expect(title()).toBe('Agua');
    // Primera repetición con la casilla del tablero: suma una, no completa las tres.
    fireEvent.click(screen.getByRole('checkbox', { name: /Sumar uno a: Agua \(0 de 3\)/ }));
    expect(useData.getState().habitLogs.find((l) => l.habitId === 'Agua')?.value).toBe(1);
    expect(title()).toBe('Agua');
    fireEvent.click(screen.getByRole('checkbox', { name: /Sumar uno a: Agua \(1 de 3\)/ }));
    expect(title()).toBe('Agua');
    // La tercera lo completa y recién entonces pasa al siguiente.
    fireEvent.click(screen.getByRole('checkbox', { name: /Sumar uno a: Agua \(2 de 3\)/ }));
    expect(useData.getState().habitLogs.find((l) => l.habitId === 'Agua')?.value).toBe(3);
    expect(title()).toBe('Correr');
  });

  it('un hábito que llegó a su versión mínima sigue siendo el paso hasta cumplirlo del todo', () => {
    useData.setState({ habits: [habit('Estudiar', { measure: 'minutes', target: 30, minTarget: 5, reminder: '08:00' }), habit('Leer', { reminder: '20:00' })], habitLogs: [log('Estudiar', 10)] });
    home();
    expect(title()).toBe('Estudiar');
  });

  it('con la app abierta toda la noche, al pasar la medianoche «hoy» se pone al día solo', () => {
    // Una tarea de mañana: hoy no es el paso; a las 00:00 del día siguiente sí.
    useData.setState({ tasks: [task('Entrega', { dueDate: '2026-09-17' })] });
    home();
    expect(card().classList.contains('nextstep--clear')).toBe(true);
    act(() => {
      vi.setSystemTime(new Date(2026, 8, 17, 0, 1, 0));
      vi.advanceTimersByTime(60_000);
    });
    expect(title()).toBe('Entrega');
  });
});
