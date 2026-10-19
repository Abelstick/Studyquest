// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useData } from '@/state';
import type { AgendaEvent } from '@/core/domain';
import { ExportModal } from './ExportModal';

const jornada: AgendaEvent = {
  id: 'w1', title: 'Jornada laboral', category: 'work', date: '2026-10-17', start: '08:30', minutes: 570,
  repeat: { type: 'weekly', every: 1, days: [0, 1, 2, 3, 4] }, rev: 0, createdAt: '', updatedAt: '2026-10-17T00:00:00.000Z',
};

beforeEach(() => useData.setState({ events: [jornada], tasks: [], habits: [], habitLogs: [], courses: [] }));
afterEach(cleanup);

describe('Exportar a tu calendario', () => {
  it('por defecto saca cada día que toca como un evento: una semana de trabajo son 5', () => {
    render(<ExportModal from="2026-10-19" to="2026-10-25" />);
    expect(screen.getByText(/5 eventos/)).toBeTruthy();
    expect((screen.getByRole('checkbox', { name: /Un evento por cada día que toca/ }) as HTMLInputElement).checked).toBe(true);
  });

  it('se puede volver a la regla de repetición: entonces es un solo evento', () => {
    render(<ExportModal from="2026-10-19" to="2026-10-25" />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Un evento por cada día que toca/ }));
    expect(screen.getByText(/1 evento /)).toBeTruthy();
    expect(screen.getByText(/regla de repetición completa/)).toBeTruthy();
  });

  it('al elegir cuáles, las repeticiones salen agrupadas en una línea', () => {
    render(<ExportModal from="2026-10-19" to="2026-10-25" />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Elegir cuáles' }));
    expect(screen.getAllByRole('checkbox', { name: /Jornada laboral/ })).toHaveLength(1);
    expect(screen.getByText(/5 veces, del 19 oct al 23 oct/)).toBeTruthy();
  });

  it('un rango sin ocurrencias lo dice en vez de descargar un archivo vacío', () => {
    render(<ExportModal from="2026-10-24" to="2026-10-25" />);
    expect(screen.getByText(/No hay nada que exportar/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Descargar/ }).hasAttribute('disabled')).toBe(true);
  });
});
