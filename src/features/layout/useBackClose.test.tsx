// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useUi } from '@/state/ui';
import { useBackClose } from './useBackClose';

/** `history.back()` es asíncrono en jsdom: se espera al `popstate`. */
const back = () =>
  act(
    () =>
      new Promise<void>((resolve) => {
        window.addEventListener('popstate', () => setTimeout(resolve, 0), { once: true });
        history.back();
      }),
  );
const settle = () => act(() => new Promise<void>((r) => setTimeout(r, 30)));

beforeEach(() => {
  history.replaceState({ key: 'inicio' }, '');
  useUi.setState({ modal: null, notifOpen: false, navOpen: false, levelUp: null, victory: null });
});
afterEach(cleanup);

describe('botón atrás de Android', () => {
  it('con un modal abierto, atrás lo cierra y no cambia de pantalla', async () => {
    renderHook(() => useBackClose());
    const before = history.length;
    act(() => useUi.getState().openModal({ type: 'task' }));
    expect(history.length).toBe(before + 1);
    await back();
    expect(useUi.getState().modal).toBeNull();
    // Se vuelve a la entrada de antes, con el estado del router intacto.
    expect(history.state).toEqual({ key: 'inicio' });
  });

  it('al cerrar desde la pantalla, retira su entrada del historial', async () => {
    renderHook(() => useBackClose());
    act(() => useUi.getState().setNavOpen(true));
    expect((history.state as Record<string, unknown>).sqOverlay).toBe(true);
    act(() => useUi.getState().setNavOpen(false));
    await settle();
    expect(history.state).toEqual({ key: 'inicio' });
  });

  it('con dos cosas apiladas, cada atrás cierra una', async () => {
    renderHook(() => useBackClose());
    act(() => {
      useUi.getState().openModal({ type: 'task' });
      useUi.getState().showLevelUp({ level: 2, rank: 'Aprendiz', world: '1-1', bonus: 0 });
    });
    await back();
    expect(useUi.getState().levelUp).toBeNull();
    expect(useUi.getState().modal).not.toBeNull();
    await back();
    expect(useUi.getState().modal).toBeNull();
  });
});
