// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { defaultProfile } from '@/core/game';
import type { Course, Habit, Task } from '@/core/domain';
import Habitos from './habitos/Habitos';
import Tareas from './tareas/Tareas';
import Cursos from './cursos/Cursos';

const habit = (id: string, extra: Partial<Habit> = {}): Habit => ({ id, title: id, frequency: { type: 'daily' }, measure: 'boolean', target: 1, xp: 10, reminder: null, steps: [], startDate: '2026-01-01', createdAt: '', ...extra });
const task = (id: string, extra: Partial<Task> = {}): Task => ({ id, title: id, courseId: null, priority: 'mid', status: 'todo', dueDate: null, estimateMin: 0, xp: 10, subtasks: [], tags: [], createdAt: '', completedAt: null, ...extra });
const course = (id: string, done: number, total: number): Course => ({
  id,
  title: id,
  professor: '',
  field: '',
  mentor: null,
  createdAt: '',
  modules: [{ id: `${id}m`, title: 'Módulo', summary: '', xp: 40, topics: Array.from({ length: total }, (_, i) => ({ id: `${id}t${i}`, title: `Tema ${i}`, status: i < done ? ('done' as const) : ('todo' as const), review: false, markedAt: null })) }],
});

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

beforeEach(() => {
  useData.setState({ profile: defaultProfile('u'), tasks: [], habits: [], habitLogs: [], courses: [], events: [], sessions: [], xpEvents: [] });
  useUi.setState({ modal: null, toasts: [], folds: {} });
});
afterEach(cleanup);

describe('Hábitos', () => {
  it('por defecto pone primero lo que toca y falta, y deja al final lo que hoy no toca', () => {
    useData.setState({ habits: [habit('Nunca', { frequency: { type: 'dates', dates: ['2000-01-01'] } }), habit('Diario')] });
    wrap(<Habitos />);
    const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titles.indexOf('Diario')).toBeLessThan(titles.indexOf('Nunca'));
  });

  it('el buscador filtra, avisa si nada coincide y al ocultarlo vuelve todo', () => {
    useData.setState({ habits: [habit('Leer'), habit('Correr')] });
    wrap(<Habitos />);
    fireEvent.click(screen.getByRole('button', { name: /Buscar/ }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'corr' } });
    expect(screen.queryByText('Leer')).toBeNull();
    expect(screen.getByText('Correr')).toBeTruthy();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } });
    expect(screen.getByText('Ningún hábito coincide')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar buscador de hábitos' }));
    expect(screen.getByText('Leer')).toBeTruthy();
    expect(screen.getByText('Correr')).toBeTruthy();
  });
});

describe('Tareas', () => {
  const doneTasks = Array.from({ length: 9 }, (_, i) => task(`Hecha ${i}`, { status: 'done', completedAt: `2026-03-0${i + 1}` }));

  it('la columna Superada enseña las más recientes y el resto tras «Ver más»', () => {
    useData.setState({ tasks: doneTasks });
    wrap(<Tareas />);
    const col = screen.getByRole('region', { name: 'Superada' });
    expect(within(col).getByText('Hecha 8')).toBeTruthy();
    expect(within(col).queryByText('Hecha 0')).toBeNull();
    // El contador sigue diciendo cuántas hay en total.
    expect(within(col).getByRole('heading', { level: 2 }).textContent).toContain('9');
    fireEvent.click(within(col).getByRole('button', { name: /Ver 3 más antiguas/ }));
    expect(within(col).getByText('Hecha 0')).toBeTruthy();
  });

  it('al buscar se enseñan todas las que coinciden, sin límite', () => {
    useData.setState({ tasks: doneTasks });
    wrap(<Tareas />);
    fireEvent.click(screen.getByRole('button', { name: /Buscar/ }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'hecha' } });
    const col = screen.getByRole('region', { name: 'Superada' });
    expect(within(col).getByText('Hecha 0')).toBeTruthy();
    expect(within(col).queryByRole('button', { name: /más antiguas/ })).toBeNull();
  });
});

describe('Cursos', () => {
  it('filtra por estado y ordena', () => {
    useData.setState({ courses: [course('Nuevo', 0, 2), course('Medio', 1, 2), course('Listo', 2, 2)] });
    wrap(<Cursos />);
    expect(screen.getAllByRole('heading', { level: 2 }).filter((h) => ['Nuevo', 'Medio', 'Listo'].includes(h.textContent ?? ''))).toHaveLength(3);
    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar cursos por estado' }), { target: { value: 'done' } });
    expect(screen.queryByRole('heading', { level: 2, name: 'Nuevo' })).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Listo' })).toBeTruthy();
  });

  it('si el filtro no deja ninguno, lo dice y «Quitar filtros» devuelve todos', () => {
    useData.setState({ courses: [course('Nuevo', 0, 2), course('Listo', 2, 2)] });
    wrap(<Cursos />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar cursos por estado' }), { target: { value: 'doing' } });
    expect(screen.getByText('Ningún curso coincide')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Nuevo' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Listo' })).toBeTruthy();
  });
});
