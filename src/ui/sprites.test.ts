import { describe, expect, it } from 'vitest';
import { PALETTE, SPRITES, SPRITE_NAMES, spriteRects } from './sprites';

describe('sprites', () => {
  it.each(SPRITE_NAMES)('%s: todas las filas miden lo mismo y solo usan colores de la paleta', (name) => {
    const rows: readonly string[] = SPRITES[name];
    const width = rows[0].length;
    rows.forEach((row, i) => expect(row.length, `fila ${i}`).toBe(width));
    for (const row of rows) for (const ch of row) if (ch !== '.') expect(PALETTE[ch], `carácter ${ch}`).toBeDefined();
    expect(spriteRects(name).length).toBeGreaterThan(0);
  });
});
