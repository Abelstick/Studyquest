import { describe, expect, it } from 'vitest';
import { passwordStrength } from './password';

describe('fuerza de contraseña', () => {
  it('vacía no puntúa', () => {
    expect(passwordStrength('')).toEqual({ score: 0, label: '' });
  });
  it('las cortas son débiles aunque mezclen de todo', () => {
    expect(passwordStrength('aB3!').score).toBe(1);
  });
  it('sube con la longitud y la variedad', () => {
    expect(passwordStrength('abcdef').score).toBe(1);
    expect(passwordStrength('abcdefgh1').score).toBe(2);
    expect(passwordStrength('Abcdefgh1').score).toBe(3);
    expect(passwordStrength('Abcdefgh1!xyz').score).toBe(4);
  });
  it('tiene etiqueta legible', () => {
    expect(passwordStrength('Abcdefgh1!xyz').label).toBe('Épica');
  });
});
