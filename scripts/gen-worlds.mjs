/**
 * Genera el decorado por capas de cada mundo visual (src/styles/worlds.css).
 * Uso: npm run worlds
 *
 * Un fondo de un solo color se ve pobre. Cada mundo se dibuja en cuatro capas a distinta
 * profundidad, igual que el fondo de un juego de plataformas:
 *   --sky      degradado del cielo
 *   --skybits  lo que flota en él (nubes, estrellas, burbujas, luna, sol)
 *   --far      silueta lejana (colinas, montañas, dunas, almenas, árboles secos)
 *   --near     detalle cercano (arbustos, pinos, cactus, algas, lápidas)
 *
 * Todo es pixel art dibujado con rectángulos y `crispEdges`, sin imágenes que descargar:
 * el CSS resultante son data-URIs, así que el decorado viaja con la hoja de estilos.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'styles', 'worlds.css');

/** Envuelve las formas en un SVG y lo codifica para `url()`. */
const svg = (w, h, body) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}' shape-rendering='crispEdges'>${body}</svg>`,
  )}")`;

const rect = (x, y, w, h, fill, op) => `<rect x='${x}' y='${y}' width='${w}' height='${h}' fill='${fill}'${op === undefined ? '' : ` opacity='${op}'`}/>`;
const circle = (cx, cy, r, fill, op) => `<circle cx='${cx}' cy='${cy}' r='${r}' fill='${fill}'${op === undefined ? '' : ` opacity='${op}'`}/>`;
const ring = (cx, cy, r, stroke, op) => `<circle cx='${cx}' cy='${cy}' r='${r}' fill='none' stroke='${stroke}' stroke-width='3' opacity='${op ?? 1}'/>`;

/** Forma escalonada (colina redondeada o montaña puntiaguda), como el pixel art del original. */
const stepped = (cx, base, halfWidth, fill, step) => {
  let out = '';
  const n = Math.max(1, Math.floor(halfWidth / step));
  for (let i = 0; i < n; i++) {
    const w = halfWidth * 2 - i * step * 2;
    out += rect(cx - Math.floor(w / 2), base - (i + 1) * step, w, step, fill);
  }
  return out;
};

const bush = (x, base, fill, s) =>
  rect(x, base - s, s * 3, s, fill) + rect(x + s, base - s * 2, s, s, fill) + rect(x - s, base - s, s, s, fill) + rect(x + s * 3, base - s, s, s, fill);

const pine = (x, base, fill, trunk, s) => {
  let out = rect(x + s, base - s * 2, s, s * 2, trunk);
  [5, 4, 3, 2, 1].forEach((w, i) => {
    out += rect(x + Math.floor(((5 - w) * s) / 2) + Math.floor(s / 2) - s, base - s * 2 - (i + 1) * s, w * s, s, fill);
  });
  return out;
};

const cactus = (x, base, fill, s) =>
  rect(x + s, base - s * 5, s, s * 5, fill) + rect(x, base - s * 4, s, s * 2, fill) + rect(x + s * 2, base - s * 3, s, s * 2, fill);

const tomb = (x, base, fill, s) => rect(x, base - s * 2, s * 2, s * 2, fill) + rect(x + Math.floor(s / 2), base - s * 3, s, s, fill);

const deadTree = (x, base, fill, s) =>
  rect(x + s * 2, base - s * 6, s, s * 6, fill) +
  rect(x, base - s * 5, s * 2, s, fill) +
  rect(x + s * 3, base - s * 4, s * 2, s, fill) +
  rect(x - s, base - s * 6, s, s, fill) +
  rect(x + s * 5, base - s * 5, s, s, fill);

const merlon = (x, base, fill, s) => rect(x, base - s * 3, s * 3, s * 3, fill) + rect(x, base - s * 4, s, s, fill) + rect(x + s * 2, base - s * 4, s, s, fill);

const weed = (x, base, fill, s) => rect(x, base - s * 4, s, s * 4, fill) + rect(x + s, base - s * 3, s, s * 3, fill) + rect(x - s, base - s * 2, s, s * 2, fill);

const cloud = (x, y, fill, s, op) =>
  rect(x, y + s, s * 6, s, fill, op) +
  rect(x + s, y, s * 4, s, fill, op) +
  rect(x + s * 2, y - s, s * 2, s, fill, op) +
  rect(x - s, y + s, s, s, fill, op) +
  rect(x + s * 6, y + s, s, s, fill, op);

const dots = (list, fill) => list.map(([x, y, s, op]) => rect(x, y, s, s, fill, op)).join('');
const repeatAcross = (n, fn) => Array.from({ length: n }, (_, i) => fn(i)).join('');

const FAR = 300;
const NEAR = 190;

/** Luna en cuarto creciente: un círculo claro mordido por otro del color del cielo. */
const moon = (cx, cy, r, fill, sky) => circle(cx, cy, r, fill, 0.75) + circle(cx - Math.round(r * 0.45), cy - Math.round(r * 0.3), r, sky);

const WORLDS = {
  ':root': {
    sky: 'linear-gradient(180deg, #4b86f0 0%, #5c94fc 45%, #93c0ff 100%)',
    skybits: svg(980, 300, cloud(40, 40, '#ffffff', 9, 0.92) + cloud(360, 110, '#ffffff', 7, 0.8) + cloud(620, 30, '#ffffff', 11, 0.85) + cloud(820, 150, '#ffffff', 6, 0.7)),
    far: svg(560, FAR, stepped(150, FAR, 130, '#1f8f31', 10) + stepped(430, FAR, 90, '#2aa63c', 10)),
    near: svg(420, NEAR, bush(50, NEAR, '#3fbf4a', 16) + bush(250, NEAR, '#4ad45a', 13)),
  },
  ":root[data-theme='dark']": {
    sky: 'linear-gradient(180deg, #05051a 0%, #0d0d24 55%, #1b1b3a 100%)',
    skybits: svg(
      980,
      320,
      dots(
        [
          [60, 40, 3, 0.9], [150, 120, 2, 0.6], [240, 60, 3, 0.8], [330, 180, 2, 0.5], [430, 30, 3, 0.95],
          [520, 140, 2, 0.6], [610, 80, 3, 0.75], [700, 200, 2, 0.5], [790, 50, 3, 0.9], [880, 150, 2, 0.65],
          [120, 240, 2, 0.5], [460, 250, 2, 0.45], [830, 260, 2, 0.5],
        ],
        '#ffffff',
      ) + moon(760, 80, 34, '#ffd23f', '#0a0a20'),
    ),
    far: svg(560, FAR, stepped(150, FAR, 130, '#1a1a40', 10) + stepped(430, FAR, 90, '#23234f', 10)),
    near: svg(420, NEAR, bush(50, NEAR, '#2a2a5e', 16) + bush(250, NEAR, '#33337a', 13)),
  },
  ":root[data-world='underground']": {
    sky: 'linear-gradient(180deg, #071233 0%, #0b1c4a 60%, #10265e 100%)',
    skybits: svg(600, 120, repeatAcross(11, (i) => rect(i * 60, 0, 52, 26, '#0a1738', 0.9))),
    far: svg(560, FAR, repeatAcross(8, (i) => rect(i * 76, FAR - 120, 68, 120, '#13296b'))),
    near: svg(420, NEAR, repeatAcross(8, (i) => rect(i * 60, NEAR - 60, 52, 60, '#1b3688'))),
  },
  ":root[data-world='castle']": {
    sky: 'linear-gradient(180deg, #1a0e10 0%, #2a1a1a 60%, #4a1f18 100%)',
    skybits: svg(900, 300, dots([[80, 60, 3, 0.5], [300, 120, 3, 0.5], [560, 40, 3, 0.5], [760, 150, 3, 0.5]], '#ff8a3c')),
    far: svg(560, FAR, repeatAcross(4, (i) => merlon(30 + i * 180, FAR, '#4a3038', 24))),
    near: svg(420, NEAR, rect(0, NEAR - 26, 420, 26, '#e0542a', 0.75) + rect(0, NEAR - 40, 420, 14, '#ff8a3c', 0.45) + rect(0, NEAR - 50, 420, 10, '#ffd23f', 0.2)),
  },
  ":root[data-world='water']": {
    sky: 'linear-gradient(180deg, #1c8fd6 0%, #0c5f9e 55%, #04213d 100%)',
    skybits: svg(
      900,
      400,
      [[70, 60, 12, 0.5], [240, 160, 8, 0.4], [410, 50, 14, 0.45], [560, 210, 9, 0.4], [720, 90, 11, 0.5], [840, 260, 7, 0.35]]
        .map(([x, y, r, o]) => ring(x, y, r, '#8fe0ff', o))
        .join(''),
    ),
    far: svg(560, FAR, repeatAcross(4, (i) => weed(70 + i * 150, FAR, '#0d7bb5', 18))),
    near: svg(420, NEAR, repeatAcross(4, (i) => weed(40 + i * 130, NEAR, '#17a878', 15))),
  },
  ":root[data-world='snow']": {
    sky: 'linear-gradient(180deg, #7fb8dd 0%, #a9d4ee 55%, #dceefb 100%)',
    skybits: svg(
      900,
      400,
      dots(
        [[60, 50, 5, 0.9], [180, 150, 4, 0.7], [300, 60, 5, 0.85], [420, 220, 4, 0.6], [540, 90, 5, 0.8], [660, 180, 4, 0.65], [780, 40, 5, 0.9], [850, 260, 4, 0.6], [120, 300, 4, 0.5], [480, 330, 4, 0.5]],
        '#ffffff',
      ),
    ),
    far: svg(560, FAR, stepped(150, FAR, 160, '#e6f3fc', 10) + stepped(430, FAR, 120, '#cfe6f5', 10)),
    near: svg(420, NEAR, pine(50, NEAR, '#1f5a44', '#6b4226', 14) + pine(250, NEAR, '#2a7a5c', '#6b4226', 12)),
  },
  ":root[data-world='desert']": {
    sky: 'linear-gradient(180deg, #f0a94e 0%, #efc677 50%, #f4dda6 100%)',
    skybits: svg(900, 300, circle(740, 70, 42, '#ffd23f', 0.55) + cloud(120, 60, '#f6e2b8', 8, 0.5) + cloud(420, 130, '#f6e2b8', 6, 0.4)),
    far: svg(560, FAR, stepped(150, FAR, 150, '#c98f43', 10) + stepped(430, FAR, 110, '#b87f39', 10)),
    near: svg(420, NEAR, cactus(60, NEAR, '#2f8a46', 14) + cactus(260, NEAR, '#37a052', 12)),
  },
  ":root[data-world='ghost']": {
    sky: 'linear-gradient(180deg, #0a0518 0%, #120a24 55%, #231640 100%)',
    skybits: svg(
      900,
      340,
      moon(740, 70, 40, '#e8e0ff', '#100822') + dots([[80, 50, 3, 0.6], [220, 140, 3, 0.6], [380, 60, 3, 0.6], [520, 190, 3, 0.6], [640, 110, 3, 0.6], [860, 210, 3, 0.6]], '#c9b6ff'),
    ),
    far: svg(560, FAR, deadTree(90, FAR, '#2b1b52', 16) + deadTree(360, FAR, '#33205f', 14)),
    near: svg(420, NEAR, tomb(50, NEAR, '#463473', 18) + tomb(190, NEAR, '#4f3b80', 16) + tomb(330, NEAR, '#3e2d68', 17)),
  },
};

const css =
  `/* GENERADO por scripts/gen-worlds.mjs — no editar a mano: ejecuta \`npm run worlds\`.\n` +
  ` * Decorado por capas de cada mundo visual (cielo, lo que flota en él, silueta lejana y detalle cercano).\n */\n` +
  Object.entries(WORLDS)
    .map(([sel, w]) => `${sel} {\n  --sky: ${w.sky};\n  --skybits: ${w.skybits};\n  --far: ${w.far};\n  --near: ${w.near};\n}\n`)
    .join('');

writeFileSync(OUT, css, 'utf8');
console.log(`worlds.css: ${Object.keys(WORLDS).length} mundos, ${(css.length / 1024).toFixed(1)} KB`);
