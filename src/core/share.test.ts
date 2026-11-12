import { describe, expect, it } from 'vitest';
import { SHARED_TITLE_MAX, sharedTaskTitle } from './share';

describe('compartir hacia la app', () => {
  it('título y enlace: el enlace va detrás', () => {
    expect(sharedTaskTitle({ title: 'Curso de SQL', url: 'https://ejemplo.com/sql' })).toBe('Curso de SQL · https://ejemplo.com/sql');
  });

  it('Chrome manda el enlace dentro del texto: no se repite', () => {
    expect(sharedTaskTitle({ title: 'Curso de SQL', text: 'https://ejemplo.com/sql' })).toBe('Curso de SQL · https://ejemplo.com/sql');
    expect(sharedTaskTitle({ text: 'Mira esto https://ejemplo.com/sql' })).toBe('Mira esto · https://ejemplo.com/sql');
  });

  it('solo texto o solo enlace', () => {
    expect(sharedTaskTitle({ text: '  Repasar   el tema 3 ' })).toBe('Repasar el tema 3');
    expect(sharedTaskTitle({ url: 'https://ejemplo.com' })).toBe('https://ejemplo.com');
  });

  it('sin nada, vacío', () => {
    expect(sharedTaskTitle({})).toBe('');
    expect(sharedTaskTitle({ title: ' ', text: null })).toBe('');
  });

  it('un texto largo se recorta, el enlace no', () => {
    const out = sharedTaskTitle({ title: 'a'.repeat(400), url: 'https://ejemplo.com/x' });
    expect(out.length).toBeLessThanOrEqual(SHARED_TITLE_MAX);
    expect(out.endsWith(' · https://ejemplo.com/x')).toBe(true);
  });
});
