// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ResultCount } from './ResultCount';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const wait = () => act(() => vi.advanceTimersByTime(500));

describe('anuncio de resultados', () => {
  it('es una región de estado y no dice nada si no hay búsqueda activa', () => {
    render(<ResultCount count={3} what="hábitos" active={false} />);
    wait();
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('dice cuántos resultados hay, en singular y plural, y cuando no hay ninguno', () => {
    const { rerender } = render(<ResultCount count={3} what="hábitos" active />);
    wait();
    expect(screen.getByRole('status').textContent).toBe('3 resultados en hábitos.');
    rerender(<ResultCount count={1} what="hábitos" active />);
    wait();
    expect(screen.getByRole('status').textContent).toBe('1 resultado en hábitos.');
    rerender(<ResultCount count={0} what="hábitos" active />);
    wait();
    expect(screen.getByRole('status').textContent).toBe('Ningún resultado en hábitos.');
  });

  it('no anuncia cada letra: espera a que se deje de escribir', () => {
    const { rerender } = render(<ResultCount count={5} what="cursos" active />);
    act(() => vi.advanceTimersByTime(200));
    rerender(<ResultCount count={2} what="cursos" active />);
    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByRole('status').textContent).toBe('');
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByRole('status').textContent).toBe('2 resultados en cursos.');
  });
});
