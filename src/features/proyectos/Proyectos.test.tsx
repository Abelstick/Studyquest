// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useData } from '@/state';
import type { Project } from '@/core/domain';
import Proyectos from './Proyectos';

const project = (id: string, title: string, kind: Project['kind']): Project => ({ id, title, summary: '', kind, checkpoints: [], createdAt: '' }) as Project;

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  useData.setState({ projects: [project('p1', 'Portafolio', 'main'), project('p2', 'Panel SQL', 'side'), project('p3', 'Blog', 'side')] });
});
afterEach(cleanup);

describe('Proyectos: enlace directo desde la búsqueda', () => {
  it('?proyecto=<id> trae ese proyecto a la vista y lo resalta', () => {
    render(
      <MemoryRouter initialEntries={['/proyectos?proyecto=p2']}>
        <Proyectos />
      </MemoryRouter>,
    );
    const card = screen.getByRole('heading', { name: 'Panel SQL' }).closest('article');
    expect(card?.id).toBe('proyecto-p2');
    expect(card?.className).toContain('is-found');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Blog' }).closest('article')?.className).not.toContain('is-found');
  });

  it('un id que no existe no resalta nada', () => {
    render(
      <MemoryRouter initialEntries={['/proyectos?proyecto=no-existe']}>
        <Proyectos />
      </MemoryRouter>,
    );
    expect(document.querySelector('.is-found')).toBeNull();
  });
});
