// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { defaultProfile } from '@/core/game';
import { WorldShop } from './WorldShop';
import { ThemePreviewBar } from '../layout/ThemePreviewBar';

// Persistencia en memoria: la prueba no depende del backend configurado en .env.
vi.mock('@/data', async () => {
  const { createLocalDataLayer, MemoryStorage } = await import('@/data/local');
  return { dataLayer: createLocalDataLayer(new MemoryStorage()) };
});

const prefs = () => JSON.parse(localStorage.getItem('sq:prefs') ?? '{}') as { world?: string | null };
const html = () => document.documentElement;

const renderShop = () =>
  render(
    <MemoryRouter>
      <WorldShop />
      <ThemePreviewBar />
    </MemoryRouter>,
  );

beforeEach(() => {
  localStorage.clear();
  useData.setState({ profile: { ...defaultProfile('u'), credits: 500, inventory: ['world-snow'], equipped: { avatar: null, frame: null, world: 'world-snow' } } });
  useUi.setState({ modal: null, toasts: [], preview: null });
  useUi.getState().setWorld('snow');
});
afterEach(cleanup);

describe('Tienda de mundos', () => {
  it('muestra el estado de cada mundo con palabras, no solo con color', () => {
    renderShop();
    const card = (name: RegExp) => screen.getByRole('article', { name });
    expect(within(card(/Montaña nevada/)).getByText('Activo')).toBeTruthy();
    expect(within(card(/Mundo 1-1/)).getByText('En tu colección')).toBeTruthy();
    expect(within(card(/Castillo/)).getByText('Por desbloquear')).toBeTruthy();
    // 600 monedas y solo hay 500.
    expect(within(card(/Castillo/)).getByRole('button', { name: /Te faltan 100 monedas/ })).toHaveProperty('disabled', true);
  });

  it('probar un mundo lo aplica a toda la app sin guardarlo ni cobrar', () => {
    renderShop();
    fireEvent.click(screen.getByRole('button', { name: /Probar Casa encantada/ }));

    expect(html().dataset.world).toBe('ghost');
    expect(prefs().world).toBe('snow');
    expect(useData.getState().profile.credits).toBe(500);
    expect(screen.getByRole('region', { name: 'Vista previa de mundo' }).textContent).toContain('Casa encantada');
    expect(within(screen.getByRole('article', { name: /Casa encantada/ })).getByText('Probándolo')).toBeTruthy();
  });

  it('salir de la prueba (botón o Escape) devuelve el mundo equipado', () => {
    renderShop();
    fireEvent.click(screen.getByRole('button', { name: /Probar Casa encantada/ }));
    fireEvent.click(screen.getByRole('button', { name: /Salir de la vista previa/ }));
    expect(html().dataset.world).toBe('snow');
    expect(screen.queryByRole('region', { name: 'Vista previa de mundo' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Probar Mundo subterráneo/ }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(html().dataset.world).toBe('snow');
  });

  it('canjear desde la prueba compra el mundo, y equiparlo termina la prueba y lo guarda', () => {
    renderShop();
    fireEvent.click(screen.getByRole('button', { name: /Probar Mundo subterráneo/ }));
    fireEvent.click(within(screen.getByRole('region', { name: 'Vista previa de mundo' })).getByRole('button', { name: /Canjear Mundo subterráneo por 450/ }));
    expect(useData.getState().profile.inventory).toContain('world-underground');
    // Cobra el precio (un logro de primera compra puede devolver alguna moneda).
    expect(useData.getState().profile.credits).toBeLessThanOrEqual(500 - 450 + 50);

    fireEvent.click(within(screen.getByRole('region', { name: 'Vista previa de mundo' })).getByRole('button', { name: 'Equipar' }));
    expect(useUi.getState().preview).toBeNull();
    expect(html().dataset.world).toBe('underground');
    expect(prefs().world).toBe('underground');
    expect(useData.getState().profile.equipped.world).toBe('world-underground');
  });

  it('volver al mundo clásico quita el atributo del documento', () => {
    renderShop();
    fireEvent.click(screen.getByRole('button', { name: 'Equipar Mundo 1-1' }));
    expect(html().dataset.world).toBeUndefined();
    expect(useData.getState().profile.equipped.world).toBeNull();
  });
});

describe('Preferencias de experiencia', () => {
  it('el volumen se acota entre 0 y 1 y se guarda', () => {
    useUi.getState().setVolume(1.7);
    expect(useUi.getState().volume).toBe(1);
    useUi.getState().setVolume(0.35);
    expect(JSON.parse(localStorage.getItem('sq:prefs') ?? '{}').volume).toBe(0.35);
  });

  it('«Animaciones reducidas» se refleja en el documento y se guarda', () => {
    useUi.getState().setMotion('reduce');
    expect(html().dataset.motion).toBe('reduce');
    expect(JSON.parse(localStorage.getItem('sq:prefs') ?? '{}').motion).toBe('reduce');
    useUi.getState().setMotion('system');
    expect(html().dataset.motion).toBeUndefined();
  });
});
