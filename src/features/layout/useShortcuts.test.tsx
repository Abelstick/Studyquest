// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useUi } from '@/state/ui';
import { useShortcuts } from './useShortcuts';

function Harness() {
  useShortcuts();
  const { pathname } = useLocation();
  return (
    <>
      <input aria-label="campo" />
      <input id="busqueda" aria-label="busqueda" />
      <output data-testid="where">{pathname}</output>
    </>
  );
}

const setup = (at = '/') =>
  render(
    <MemoryRouter initialEntries={[at]}>
      <Harness />
    </MemoryRouter>,
  );
const press = (key: string, target: Element = document.body, extra: Partial<KeyboardEventInit> = {}) => act(() => void fireEvent.keyDown(target, { key, ...extra }));
const where = () => screen.getByTestId('where').textContent;

beforeEach(() => {
  useUi.setState({ modal: null, navOpen: false });
  try {
    localStorage.clear();
  } catch {
    // jsdom siempre tiene localStorage; el try es por coherencia con el resto del código.
  }
});
afterEach(cleanup);

describe('atajos de teclado', () => {
  it('«g» + letra va a la sección', () => {
    setup();
    press('g');
    press('p');
    expect(where()).toBe('/tareas');
    press('g');
    press('j');
    expect(where()).toBe('/progreso');
  });

  it('una letra suelta, sin «g» antes, no navega', () => {
    setup();
    press('p');
    expect(where()).toBe('/');
  });

  it('no actúa mientras se escribe', () => {
    setup();
    const field = screen.getByLabelText('campo');
    press('g', field);
    press('p', field);
    press('n', field);
    expect(where()).toBe('/');
    expect(useUi.getState().modal).toBeNull();
  });

  it('no actúa con Ctrl, Alt o Cmd (atajos del navegador)', () => {
    setup();
    press('n', document.body, { ctrlKey: true });
    press('n', document.body, { metaKey: true });
    expect(useUi.getState().modal).toBeNull();
  });

  it('no actúa con un modal abierto', () => {
    setup();
    act(() => useUi.setState({ modal: { type: 'guide' } }));
    press('g');
    press('p');
    expect(where()).toBe('/');
  });

  it('«n» crea lo propio de la pantalla y «?» abre la chuleta', () => {
    setup('/habitos');
    press('n');
    expect(useUi.getState().modal).toEqual({ type: 'habit' });
    act(() => useUi.setState({ modal: null }));
    press('?');
    expect(useUi.getState().modal).toEqual({ type: 'shortcuts' });
  });

  it('«/» enfoca el buscador si está visible y, si no (móvil), abre «Buscar o crear»', () => {
    setup();
    // jsdom no calcula el diseño: offsetParent es null, como cuando la barra oculta el buscador en móvil.
    press('/');
    expect(useUi.getState().modal).toEqual({ type: 'quick' });
  });

  it('«[» oculta y muestra la barra lateral, y se recuerda en el dispositivo', () => {
    useUi.setState({ sideHidden: false });
    setup();
    press('[');
    expect(useUi.getState().sideHidden).toBe(true);
    expect(localStorage.getItem('sq:side-hidden')).toBe('1');
    press('[');
    expect(useUi.getState().sideHidden).toBe(false);
    expect(localStorage.getItem('sq:side-hidden')).toBe('0');
  });

  it('«[» no actúa mientras se escribe', () => {
    useUi.setState({ sideHidden: false });
    setup();
    press('[', screen.getByLabelText('campo'));
    expect(useUi.getState().sideHidden).toBe(false);
  });
});
