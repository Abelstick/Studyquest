// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { useAi } from '@/ai/store';
import { defaultProfile } from '@/core/game';
import { PackModal } from './PackModal';

const PACK = JSON.stringify({
  goals: [{ title: 'Dominar SQL', deadlineInDays: 60, milestones: [{ title: 'Consultas' }] }],
  courses: [{ title: 'SQL desde cero', modules: [{ title: 'Básico', topics: ['SELECT'] }] }],
  habits: [{ title: 'Practicar SQL', goal: 'Dominar SQL', frequency: { type: 'daily' }, measure: 'minutes', target: 30, minTarget: 5 }],
  tasks: [{ title: 'Instalar SQL Server', course: 'SQL desde cero', goal: 'Dominar SQL', dueInDays: 0, estimateMin: 15 }],
});

const importPack = vi.fn();
const open = () => render(<MemoryRouter><PackModal /></MemoryRouter>);
const paste = (text: string) => fireEvent.change(screen.getByLabelText(/Respuesta de la IA/), { target: { value: text } });

beforeEach(() => {
  importPack.mockClear();
  useData.setState({ importPack, profile: defaultProfile('u'), courses: [], goals: [], projects: [], habits: [], tasks: [], events: [], habitLogs: [] });
  useUi.setState({ modal: null, toasts: [] });
  useAi.setState({ apiKey: null });
});
afterEach(cleanup);

describe('Importar con IA', () => {
  it('sin clave invita a activarla y deja el camino de copiar y pegar abierto', () => {
    open();
    expect(screen.getByRole('button', { name: 'Activar la IA' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copiar prompt para la IA' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Generar aquí con Gemini/ })).toBeNull();
  });

  it('con clave ofrece generar aquí, pero solo cuando hay un objetivo', () => {
    useAi.setState({ apiKey: 'K'.repeat(24) });
    open();
    const btn = screen.getByRole('button', { name: /Generar aquí con Gemini/ });
    expect(btn.hasAttribute('disabled')).toBe(true);
    fireEvent.change(screen.getByLabelText(/Qué quieres aprender/), { target: { value: 'SQL Server' } });
    expect(btn.hasAttribute('disabled')).toBe(false);
  });

  it('explica por qué falla una respuesta mal pegada y no deja crear', () => {
    open();
    paste('{"tasks": [ {"title": "x" "dueInDays": 3} ] }');
    expect(screen.getByRole('alert').textContent).toMatch(/errores de sintaxis/);
    expect(screen.getByRole('button', { name: 'Crear todo' }).hasAttribute('disabled')).toBe(true);
  });

  it('enseña el resumen, el primer paso y el XP en juego, y crea todo enlazado', () => {
    open();
    paste(PACK);
    expect(screen.getByText('Listo para crear')).toBeTruthy();
    expect(screen.getByText(/Meta: Dominar SQL · 1 hitos · plazo/)).toBeTruthy();
    expect(screen.getByText(/enlazado a su meta/)).toBeTruthy();
    expect(screen.getByText(/Tu primer paso:/).textContent).toMatch(/Instalar SQL Server.*hoy/);
    fireEvent.click(screen.getByRole('button', { name: 'Crear todo' }));
    const made = importPack.mock.calls[0][0];
    expect(made.habits[0].goalId).toBe(made.goals[0].id);
    expect(made.tasks[0]).toMatchObject({ goalId: made.goals[0].id, courseId: made.courses[0].id });
    expect(useUi.getState().modal).toBeNull();
  });

  it('si ya lo tienes, por defecto lo omite y no duplica; se puede desmarcar', () => {
    useData.setState({ courses: [{ id: 'c1', title: 'sql desde cero', professor: '', field: '', modules: [], mentor: null, createdAt: '' }], goals: [{ id: 'g1', title: 'Dominar SQL', rewardTitle: '', rewardDescription: '', milestones: [], createdAt: '' }] });
    open();
    paste(PACK);
    expect(screen.getByText(/Omitir lo que ya tengo/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Crear todo' }));
    const made = importPack.mock.calls[0][0];
    expect(made.courses).toHaveLength(0);
    expect(made.goals).toHaveLength(0);
    // Lo nuevo se enlaza con lo que ya existía.
    expect(made.tasks[0]).toMatchObject({ courseId: 'c1', goalId: 'g1' });
    expect(made.habits[0].goalId).toBe('g1');

    importPack.mockClear();
    fireEvent.click(screen.getByRole('checkbox', { name: /Omitir lo que ya tengo/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Crear todo' }));
    expect(importPack.mock.calls[0][0].courses).toHaveLength(1);
  });

  it('si todo ya existe, avisa que no hay nada nuevo y bloquea el botón', () => {
    useData.setState({ goals: [{ id: 'g1', title: 'Dominar SQL', rewardTitle: '', rewardDescription: '', milestones: [], createdAt: '' }] });
    open();
    paste(JSON.stringify({ goals: [{ title: 'dominar sql', milestones: [{ title: 'a' }] }] }));
    expect(screen.getByText('Nada nuevo que crear')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Crear todo' }).hasAttribute('disabled')).toBe(true);
  });
});
