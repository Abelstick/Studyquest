// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ListSearch } from './ListSearch';

function Harness() {
  const [q, setQ] = useState('');
  return (
    <>
      <ListSearch value={q} onChange={setQ} what="hábitos" />
      <output data-testid="q">{q}</output>
    </>
  );
}

afterEach(cleanup);

describe('buscador de listas', () => {
  it('empieza plegado y se abre con el botón', () => {
    render(<Harness />);
    expect(screen.queryByRole('searchbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Buscar/ }));
    expect(screen.getByRole('searchbox', { name: 'Buscar hábitos' })).toBeTruthy();
  });

  it('al ocultarlo borra lo escrito para no dejar un filtro invisible', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /Buscar/ }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'leer' } });
    expect(screen.getByTestId('q').textContent).toBe('leer');
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar buscador de hábitos' }));
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.getByTestId('q').textContent).toBe('');
  });

  it('Escape limpia primero y, sin texto, oculta', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /Buscar/ }));
    const box = screen.getByRole('searchbox');
    fireEvent.change(box, { target: { value: 'sql' } });
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(screen.getByTestId('q').textContent).toBe('');
    expect(screen.getByRole('searchbox')).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' });
    expect(screen.queryByRole('searchbox')).toBeNull();
  });
});

describe('accesibilidad del buscador', () => {
  it('al ocultarlo devuelve el foco al botón que lo abre, no lo deja perdido', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /Buscar/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar buscador de hábitos' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Buscar/ }));
  });

  it('el botón plegado no apunta a un elemento que no existe', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: /Buscar/ }).hasAttribute('aria-controls')).toBe(false);
  });
});
