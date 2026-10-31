// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useData } from '@/state';
import { defaultProfile } from '@/core/game';
import type { Habit, XpEvent } from '@/core/domain';
import { characterSheet } from '@/core/progression';
import { AttributeSheet } from './AttributeSheet';
import { AttributeRadar } from './AttributeRadar';

const NOW = new Date(2026, 8, 16, 12, 0, 0);
const TODAY = '2026-09-16';
const gym: Habit = { id: 'g', title: 'Ir al gimnasio', category: 'gimnasio', frequency: { type: 'daily' }, measure: 'boolean', target: 1, reminder: null, steps: [], startDate: '2026-01-01', createdAt: '' };
const ev = (attribute: XpEvent['attribute'], date: string, amount: number): XpEvent => ({ id: `${attribute}${date}`, date, attribute, amount, source: 'habit', sourceId: 'g', label: 'Ir al gimnasio' });
const events = [ev('fue', TODAY, 15), ev('vit', TODAY, 7), ev('fue', '2026-09-10', 30)];

const renderSheet = () =>
  render(
    <MemoryRouter>
      <AttributeSheet attributes={characterSheet(events, TODAY).attributes} />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  useData.setState({ profile: defaultProfile('u'), tasks: [], habits: [gym], habitLogs: [], courses: [], goals: [], projects: [], xpEvents: events });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('hoja de atributos', () => {
  it('muestra los seis atributos con su nivel y su Forma', () => {
    renderSheet();
    const rows = screen.getAllByRole('button', { expanded: false });
    expect(rows).toHaveLength(6);
    expect(screen.getByRole('progressbar', { name: /Forma de Fuerza: 100 %/ })).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: /Fuerza: 5 de 121 XP para el nivel 3/ })).toBeTruthy();
  });

  it('al tocar un atributo enseña qué lo alimenta y su historial; con 30 días cambia el total', () => {
    renderSheet();
    const fue = screen.getByRole('button', { name: /Fuerza/ });
    fireEvent.click(fue);
    expect(fue.getAttribute('aria-expanded')).toBe('true');
    const feeders = screen.getByRole('region', { name: /Qué alimenta tu Fuerza/ });
    expect(within(feeders).getByText('Ir al gimnasio')).toBeTruthy();
    expect(within(feeders).getByText('70 %')).toBeTruthy();
    const history = screen.getByRole('region', { name: /Historial de Fuerza/ });
    expect(within(history).getByRole('heading', { name: '45 XP en 7 días' })).toBeTruthy();
    expect(within(history).getAllByRole('listitem').filter((li) => li.classList.contains('ahist__day'))).toHaveLength(7);
    fireEvent.click(within(history).getByRole('radio', { name: '30 días' }));
    expect(within(history).getAllByRole('listitem').filter((li) => li.classList.contains('ahist__day'))).toHaveLength(30);
  });

  it('un atributo sin nada que lo alimente invita a crear un hábito, sin reproches', () => {
    renderSheet();
    fireEvent.click(screen.getByRole('button', { name: /Creatividad/ }));
    expect(screen.getByText(/Todavía nada alimenta tu creatividad/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Crear un hábito/ })).toBeTruthy();
    expect(screen.getAllByText(/Sin estrenar/).length).toBeGreaterThan(0);
  });

  it('el radar resume la forma del personaje para lectores de pantalla', () => {
    render(<AttributeRadar attributes={characterSheet(events, TODAY).attributes} />);
    expect(screen.getByRole('img', { name: /Fuerza 2, Vitalidad 1, Intelecto 1/ })).toBeTruthy();
  });
});
