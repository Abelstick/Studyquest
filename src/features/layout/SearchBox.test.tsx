// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useData } from '@/state';
import type { Task } from '@/core/domain';
import { SearchBox } from './SearchBox';

function Where() {
  const { pathname, search } = useLocation();
  return <output data-testid="where">{pathname + search}</output>;
}

const task = (id: string, title: string): Task => ({ id, title, courseId: null, priority: 'mid', status: 'todo', dueDate: null, estimateMin: 0, xp: 10, subtasks: [], tags: [], createdAt: '', completedAt: null });

const setup = (props: Parameters<typeof SearchBox>[0] = {}) =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <SearchBox {...props} />
      <Where />
    </MemoryRouter>,
  );

beforeEach(() => {
  useData.setState({ tasks: [task('t1', 'Ejercicios de SQL'), task('t2', 'Leer sobre SQL')], courses: [], habits: [], notes: [], goals: [], projects: [] });
});
afterEach(cleanup);

describe('SearchBox', () => {
  it('con una letra no muestra resultados', () => {
    setup();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar' }), { target: { value: 's' } });
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('Enter abre el primer resultado con su enlace directo', () => {
    setup();
    const input = screen.getByRole('searchbox', { name: 'Buscar' });
    fireEvent.change(input, { target: { value: 'sql' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByTestId('where').textContent).toBe('/tareas?tarea=t1');
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('las flechas recorren los resultados y vuelven al campo', () => {
    setup();
    const input = screen.getByRole('searchbox', { name: 'Buscar' });
    fireEvent.change(input, { target: { value: 'sql' } });
    const [first, second] = screen.getAllByRole('button');
    input.focus();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(second);
    fireEvent.keyDown(second, { key: 'ArrowUp' });
    fireEvent.keyDown(first, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(input);
  });

  it('Escape con texto limpia sin propagarse (no cierra el modal que la contiene)', () => {
    const outer = vi.fn();
    document.addEventListener('keydown', outer);
    setup();
    const input = screen.getByRole('searchbox', { name: 'Buscar' });
    fireEvent.change(input, { target: { value: 'sql' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect((input as HTMLInputElement).value).toBe('');
    expect(outer).not.toHaveBeenCalled();
    document.removeEventListener('keydown', outer);
  });

  it('avisa al elegir un resultado (para cerrar el modal en móvil)', () => {
    const onNavigate = vi.fn();
    setup({ inline: true, onNavigate });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar' }), { target: { value: 'leer' } });
    fireEvent.click(screen.getByRole('button', { name: /Leer sobre SQL/ }));
    expect(onNavigate).toHaveBeenCalledOnce();
    expect(screen.getByTestId('where').textContent).toBe('/tareas?tarea=t2');
  });
});
