// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { SectionTabs } from './SectionTabs';

function Where() {
  const { pathname } = useLocation();
  return <output data-testid="where">{pathname}</output>;
}

const TABS = [
  { to: '/tareas', label: 'Tareas' },
  { to: '/calendario', label: 'Calendario' },
  { to: '/planificador', label: 'Planificador', count: 3, countLabel: 'pendientes' },
];

const setup = (current = '/tareas') =>
  render(
    <MemoryRouter initialEntries={[current]}>
      <SectionTabs tabs={TABS} current={current} label="Pestañas de Planear" panelId="panel" />
      <Where />
    </MemoryRouter>,
  );

// jsdom no implementa scrollIntoView (todos los navegadores sí): basta con que exista.
beforeAll(() => {
  Element.prototype.scrollIntoView = () => undefined;
});
afterEach(cleanup);

describe('SectionTabs', () => {
  it('expone el patrón ARIA de pestañas', () => {
    setup();
    expect(screen.getByRole('tablist', { name: 'Pestañas de Planear' })).toBeTruthy();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[1].getAttribute('aria-selected')).toBe('false');
    expect(tabs.every((t) => t.getAttribute('aria-controls') === 'panel')).toBe(true);
  });

  it('solo la pestaña activa está en el orden de tabulación', () => {
    setup('/calendario');
    expect(screen.getAllByRole('tab').map((t) => t.tabIndex)).toEqual([-1, 0, -1]);
  });

  it('flechas, Inicio y Fin mueven el foco (y dan la vuelta)', () => {
    setup();
    const [a, b, c] = screen.getAllByRole('tab');
    a.focus();
    fireEvent.keyDown(a, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(b);
    fireEvent.keyDown(b, { key: 'End' });
    expect(document.activeElement).toBe(c);
    fireEvent.keyDown(c, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(a);
    fireEvent.keyDown(a, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(c);
    fireEvent.keyDown(c, { key: 'Home' });
    expect(document.activeElement).toBe(a);
  });

  it('Espacio abre la pestaña enfocada', () => {
    setup();
    const cal = screen.getByRole('tab', { name: 'Calendario' });
    fireEvent.keyDown(cal, { key: ' ' });
    expect(screen.getByTestId('where').textContent).toBe('/calendario');
  });

  it('muestra el contador solo si es mayor que cero, con texto para lector de pantalla', () => {
    setup();
    expect(screen.getByRole('tab', { name: /Planificador/ }).textContent).toBe('Planificador3 pendientes');
  });

  it('con una sola pestaña no pinta nada', () => {
    const { container } = render(
      <MemoryRouter>
        <SectionTabs tabs={[TABS[0]]} current="/tareas" label="x" panelId="p" />
      </MemoryRouter>,
    );
    expect(container.innerHTML).toBe('');
  });
});
