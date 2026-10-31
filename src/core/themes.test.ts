import { describe, expect, it } from 'vitest';
import { SHOP } from './catalog';
import { CLASSIC_WORLD, WORLD_THEMES, worldIdOf, worldTheme, worldTitle } from './themes';

describe('Mundos visuales: identidad', () => {
  it('cada mundo de la tienda tiene su ficha, y cada ficha su artículo', () => {
    const items = SHOP.filter((i) => i.kind === 'world').map((i) => i.id);
    const themed = WORLD_THEMES.filter((t) => t.itemId).map((t) => t.itemId);
    expect(themed.sort()).toEqual(items.sort());
  });

  it('el id de data-world sale del artículo', () => {
    for (const t of WORLD_THEMES.filter((w) => w.itemId)) expect(worldIdOf(t.itemId)).toBe(t.world);
    expect(worldIdOf(null)).toBeNull();
  });

  it('cada mundo cuenta qué cambia y tiene timbre propio', () => {
    for (const t of WORLD_THEMES) {
      expect(t.traits.length, t.style).toBeGreaterThanOrEqual(3);
      expect(t.effects.length, t.style).toBeGreaterThanOrEqual(2);
    }
    expect(new Set(WORLD_THEMES.map((t) => t.voice)).size).toBe(WORLD_THEMES.length);
  });

  it('un mundo desconocido vuelve al clásico', () => {
    expect(worldTheme('no-existe')).toBe(CLASSIC_WORLD);
    expect(worldTheme(null)).toBe(CLASSIC_WORLD);
    expect(worldTitle(CLASSIC_WORLD)).toBe('Mundo 1-1');
    expect(worldTitle(worldTheme('castle'))).toBe(SHOP.find((i) => i.id === 'world-castle')?.title);
  });
});
