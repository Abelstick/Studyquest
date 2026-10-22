import { describe, expect, it } from 'vitest';
import { ICONS, ICON_NAMES, iconRects } from './icons';

describe('íconos', () => {
  it.each(ICON_NAMES)('%s: cuadrícula de 7×7 y solo "#" o "."', (name) => {
    const rows: readonly string[] = ICONS[name];
    expect(rows).toHaveLength(7);
    rows.forEach((row, i) => expect(row, `fila ${i}`).toMatch(/^[#.]{7}$/));
    expect(iconRects(name).length).toBeGreaterThan(0);
  });
});
