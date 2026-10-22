/**
 * Íconos de interfaz en pixel art, 7×7. A diferencia de los sprites, son de un solo color y toman el del
 * texto (`currentColor`): así contrastan en el HUD oscuro, sobre la crema o dentro del botón amarillo.
 * Reemplazan a los glifos Unicode (✔ ▶ ＋ ☰…), que cada sistema dibujaba con una fuente distinta.
 * "#" es un píxel lleno; "." es transparente.
 */
export const ICONS = {
  plus: [
    '...#...',
    '...#...',
    '...#...',
    '#######',
    '...#...',
    '...#...',
    '...#...',
  ],
  check: [
    '.......',
    '......#',
    '.....##',
    '#...##.',
    '##.##..',
    '.###...',
    '..#....',
  ],
  play: [
    '.#.....',
    '.##....',
    '.###...',
    '.####..',
    '.###...',
    '.##....',
    '.#.....',
  ],
  menu: [
    '.......',
    '#######',
    '.......',
    '#######',
    '.......',
    '#######',
    '.......',
  ],
  help: [
    '.####..',
    '#....#.',
    '.....#.',
    '...##..',
    '...#...',
    '.......',
    '...#...',
  ],
  keys: [
    '#######',
    '#.#.#.#',
    '#######',
    '#.#.#.#',
    '#######',
    '#.....#',
    '#######',
  ],
  sound: [
    '...#...',
    '..##.#.',
    '###.#.#',
    '###.#.#',
    '###.#.#',
    '..##.#.',
    '...#...',
  ],
  mute: [
    '...#...',
    '..##...',
    '###.#.#',
    '###..#.',
    '###.#.#',
    '..##...',
    '...#...',
  ],
  sync: [
    '..###..',
    '.#...#.',
    '#.....#',
    '#..#..#',
    '#...#.#',
    '.#...#.',
    '..###..',
  ],
  close: [
    '#.....#',
    '.#...#.',
    '..#.#..',
    '...#...',
    '..#.#..',
    '.#...#.',
    '#.....#',
  ],
} as const;

export type IconName = keyof typeof ICONS;
export const ICON_NAMES = Object.keys(ICONS) as IconName[];

/** Píxeles contiguos de una fila en un solo rectángulo. */
export function iconRects(name: IconName): { x: number; y: number; w: number }[] {
  const out: { x: number; y: number; w: number }[] = [];
  ICONS[name].forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] !== '#') {
        x++;
        continue;
      }
      let w = 1;
      while (row[x + w] === '#') w++;
      out.push({ x, y, w });
      x += w;
    }
  });
  return out;
}
