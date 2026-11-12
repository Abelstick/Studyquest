import { describe, expect, it } from 'vitest';
import { WORLD_THEMES } from '@/core/themes';
import { SPRITES } from './sprites';
import { WORLD_SPRITES, worldSprite } from './worldSprites';

describe('iconos de sección por mundo', () => {
  it('cada mundo comprable tiene su juego de iconos, y todos existen', () => {
    const worlds = WORLD_THEMES.filter((t) => t.world).map((t) => t.world as string);
    expect(Object.keys(WORLD_SPRITES).sort()).toEqual([...worlds].sort());
    for (const set of Object.values(WORLD_SPRITES)) for (const name of Object.values(set)) expect(SPRITES[name], name).toBeDefined();
  });

  it('dentro de un mundo, las cuatro secciones se distinguen', () => {
    for (const [world, set] of Object.entries(WORLD_SPRITES)) expect(new Set(Object.values(set)).size, world).toBe(4);
  });

  it('el mundo clásico, uno desconocido y los demás sprites no cambian', () => {
    expect(worldSprite(null, 'qblock')).toBe('qblock');
    expect(worldSprite('no-existe', 'qblock')).toBe('qblock');
    expect(worldSprite('tactical', 'qblock')).toBe('crosshair');
    expect(worldSprite('tactical', 'star')).toBe('star');
    expect(worldSprite('stellar', 'coin')).toBe('coin');
  });
});
