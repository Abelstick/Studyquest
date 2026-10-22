/**
 * Genera el decorado por capas de cada mundo visual (src/styles/worlds.css).
 * Uso: npm run worlds
 *
 * Cada mundo es un escenario de plataformas moderno, en la línea de los juegos de Switch: formas
 * redondeadas, contornos gruesos delante y suaves detrás, brillos, patrones de lunares y neblina de
 * profundidad. Todo es dibujo propio con primitivas SVG; ningún personaje ni recurso de terceros.
 *
 * Capas, de atrás hacia delante (la pantalla del mundo las mueve a distinta velocidad con GSAP):
 *   --sky      degradado del cielo
 *   --skybits  lo que flota en él (nubes, sol, luna, estrellas, burbujas)
 *   --far      silueta lejana, desaturada por la distancia
 *   --mid      plano medio con contorno y patrón
 *   --near     primer plano: contorno de tinta y brillo
 *   --ground   franja de suelo que remata la pantalla
 *
 * Las capas se repiten en horizontal: ninguna forma cruza el borde de su lienzo, así el mosaico no se corta.
 * El CSS resultante son data-URIs: el decorado viaja con la hoja de estilos y funciona sin conexión.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'styles', 'worlds.css');

/* ---------- Primitivas ---------- */

/** Envuelve las formas en un SVG y lo codifica para `url()`. */
const svg = (w, h, body) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${body}</svg>`)}")`;

const attrs = (o) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}='${v}'`)
    .join(' ');
const circle = (cx, cy, r, fill, extra = {}) => `<circle ${attrs({ cx, cy, r, fill, ...extra })}/>`;
const path = (d, fill, extra = {}) => `<path ${attrs({ d, fill, ...extra })}/>`;
const rect = (x, y, width, height, fill, extra = {}) => `<rect ${attrs({ x, y, width, height, fill, ...extra })}/>`;
const group = (body, extra = {}) => `<g ${attrs(extra)}>${body}</g>`;

let clipSeq = 0;
/** Recorta `inner` a la forma `shape` (para lunares y brillos que no se salen de la colina). */
const clipped = (shape, inner) => {
  const id = `c${clipSeq++}`;
  return `<clipPath id='${id}'>${shape}</clipPath>${group(inner, { 'clip-path': `url(#${id})` })}`;
};

/** Media elipse apoyada en `base`: la colina redonda de toda la vida. */
const domeD = (cx, base, rx, ry) => `M${cx - rx} ${base}A${rx} ${ry} 0 0 1 ${cx + rx} ${base}Z`;

/**
 * Unión de círculos con contorno limpio: primero todos los círculos engordados en el color del contorno,
 * después los rellenos encima. Así no se ven las costuras entre círculos (nubes, arbustos, copas).
 */
const blob = (circles, fill, stroke, sw, flatBase) => {
  const flat = flatBase === undefined ? '' : (() => {
    const xs = circles.map(([x, , r]) => [x - r, x + r]).flat();
    const x0 = Math.min(...xs) + 4;
    const x1 = Math.max(...xs) - 4;
    return { x0, x1 };
  })();
  let out = '';
  if (stroke) {
    out += circles.map(([x, y, r]) => circle(x, y, r + sw, stroke)).join('');
    if (flat) out += rect(flat.x0 - sw, flatBase - 30, flat.x1 - flat.x0 + sw * 2, 30 + sw, stroke, { rx: 14 });
  }
  out += circles.map(([x, y, r]) => circle(x, y, r, fill)).join('');
  if (flat) out += rect(flat.x0, flatBase - 30, flat.x1 - flat.x0, 30, fill, { rx: 12 });
  return out;
};

/** Colina con contorno, lunares y un brillo en el lado de la luz. */
const hill = ({ cx, base, rx, ry, fill, stroke, sw = 4, dots, shine }) => {
  const d = domeD(cx, base + sw, rx, ry);
  let inner = '';
  if (dots) {
    for (let y = base - ry + 22; y < base; y += 34) {
      for (let x = cx - rx + ((y / 34) % 2 ? 18 : 36); x < cx + rx; x += 38) inner += circle(x, y, dots.r, dots.fill);
    }
  }
  if (shine) inner += path(domeD(cx - rx * 0.18, base + sw, rx * 0.7, ry * 0.86), 'none', { stroke: shine, 'stroke-width': 10, 'stroke-linecap': 'round', opacity: 0.55, 'stroke-dasharray': `${rx * 0.9} 9999` });
  return (stroke ? path(d, fill, { stroke, 'stroke-width': sw, 'stroke-linejoin': 'round' }) : path(d, fill)) + (inner ? clipped(path(d, '#000'), inner) : '');
};

/** Nube: bultos redondos con base plana y una sombra suave por debajo. */
const cloud = (x, y, s, fill, stroke, shade) => {
  const c = [
    [x, y, 16 * s],
    [x + 22 * s, y - 12 * s, 22 * s],
    [x + 50 * s, y - 6 * s, 18 * s],
    [x + 70 * s, y + 2 * s, 12 * s],
  ];
  const base = y + 16 * s;
  let out = blob(c, fill, stroke, 3, base);
  if (shade) out += rect(x - 4 * s, base - 7 * s, 78 * s, 7 * s, shade, { opacity: 0.6, rx: 3 * s });
  return out;
};

const bush = (x, base, s, fill, stroke, shine) =>
  blob(
    [
      [x, base - 14 * s, 16 * s],
      [x + 22 * s, base - 24 * s, 22 * s],
      [x + 46 * s, base - 14 * s, 16 * s],
    ],
    fill,
    stroke,
    4,
    base,
  ) + (shine ? circle(x + 16 * s, base - 34 * s, 5 * s, shine, { opacity: 0.7 }) : '');

/** Árbol de copa redonda con tronco. */
const roundTree = (x, base, s, leaf, trunk, stroke, shine) =>
  rect(x - 5 * s, base - 46 * s, 10 * s, 46 * s, trunk, { stroke, 'stroke-width': 3 }) +
  blob(
    [
      [x - 16 * s, base - 56 * s, 18 * s],
      [x, base - 74 * s, 24 * s],
      [x + 18 * s, base - 56 * s, 18 * s],
    ],
    leaf,
    stroke,
    4,
  ) +
  (shine ? circle(x - 8 * s, base - 84 * s, 6 * s, shine, { opacity: 0.6 }) : '');

/** Pino de pisos redondeados, con nieve opcional en cada piso. */
const pine = (x, base, s, leaf, trunk, stroke, snow) => {
  let out = rect(x - 5 * s, base - 22 * s, 10 * s, 22 * s, trunk, { stroke, 'stroke-width': 3 });
  [0, 1, 2].forEach((i) => {
    const w = (34 - i * 8) * s;
    const top = base - (22 + 26 * (i + 1) + 12) * s;
    const bottom = base - (18 + 26 * i) * s;
    const d = `M${x - w} ${bottom}Q${x} ${bottom + 8 * s} ${x + w} ${bottom}L${x + 4 * s} ${top}Q${x} ${top - 6 * s} ${x - 4 * s} ${top}Z`;
    out += path(d, leaf, { stroke, 'stroke-width': 4, 'stroke-linejoin': 'round' });
    if (snow) out += path(`M${x - w * 0.42} ${top + (bottom - top) * 0.45}L${x} ${top}L${x + w * 0.42} ${top + (bottom - top) * 0.45}Q${x} ${top + (bottom - top) * 0.3} ${x - w * 0.42} ${top + (bottom - top) * 0.45}Z`, snow);
  });
  return out;
};

/** Cactus de cápsulas, con flor rosa arriba. */
const cactus = (x, base, s, fill, stroke, flower) => {
  const cap = (cx, y0, y1, w) => rect(cx - w / 2, y0, w, y1 - y0, fill, { rx: w / 2, stroke, 'stroke-width': 4 });
  return (
    cap(x - 22 * s, base - 62 * s, base - 30 * s, 16 * s) +
    rect(x - 22 * s, base - 38 * s, 22 * s, 12 * s, fill, { stroke, 'stroke-width': 4 }) +
    cap(x + 22 * s, base - 74 * s, base - 40 * s, 16 * s) +
    rect(x, base - 50 * s, 22 * s, 12 * s, fill, { stroke, 'stroke-width': 4 }) +
    cap(x, base - 96 * s, base + 4, 24 * s) +
    path(`M${x - 4 * s} ${base - 86 * s}V${base - 20 * s}`, 'none', { stroke: '#ffffff', 'stroke-width': 3 * s, opacity: 0.35, 'stroke-linecap': 'round' }) +
    (flower ? circle(x, base - 98 * s, 7 * s, flower, { stroke, 'stroke-width': 3 }) : '')
  );
};

/** Montaña de cumbre redondeada con casquete de nieve. */
const mountain = (cx, base, w, h, fill, cap, stroke) => {
  const d = `M${cx - w} ${base}L${cx - 14} ${base - h + 12}Q${cx} ${base - h - 4} ${cx + 14} ${base - h + 12}L${cx + w} ${base}Z`;
  const capD = `M${cx - w * 0.3} ${base - h * 0.62}L${cx - 14} ${base - h + 12}Q${cx} ${base - h - 4} ${cx + 14} ${base - h + 12}L${cx + w * 0.3} ${base - h * 0.62}Q${cx + w * 0.15} ${base - h * 0.55} ${cx} ${base - h * 0.64}Q${cx - w * 0.15} ${base - h * 0.55} ${cx - w * 0.3} ${base - h * 0.62}Z`;
  return path(d, fill, stroke ? { stroke, 'stroke-width': 4, 'stroke-linejoin': 'round' } : {}) + (cap ? path(capD, cap) : '');
};

/** Duna o colina baja: una onda suave de lado a lado del lienzo (empieza y acaba a la misma altura: encaja al repetirse). */
const wave = (w, base, amp, y, fill, stroke, n = 2) => {
  let d = `M0 ${base}L0 ${y}`;
  const seg = w / n;
  let crest = '';
  for (let i = 0; i < n; i++) crest += `Q${seg * i + seg / 4} ${y - amp} ${seg * i + seg / 2} ${y}T${seg * (i + 1)} ${y}`;
  d += `${crest}L${w} ${base}Z`;
  // El contorno va solo por la cresta: si cerrara el polígono, dibujaría una costura vertical en cada repetición.
  return path(d, fill) + (stroke ? path(`M0 ${y}${crest}`, 'none', { stroke, 'stroke-width': 4, 'stroke-linejoin': 'round' }) : '');
};

const stars = (list, fill) => list.map(([x, y, r, o]) => circle(x, y, r, fill, { opacity: o })).join('');

/** Destello de cuatro puntas (estrellas grandes, cristales que brillan). */
const sparkle = (x, y, r, fill, op = 1) => path(`M${x} ${y - r}Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y}Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r}Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y}Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r}Z`, fill, { opacity: op });

const moon = (cx, cy, r, fill, glow) => circle(cx, cy, r * 1.9, glow, { opacity: 0.18 }) + circle(cx, cy, r, fill) + circle(cx + r * 0.35, cy - r * 0.2, r * 0.22, '#000', { opacity: 0.08 }) + circle(cx - r * 0.3, cy + r * 0.35, r * 0.14, '#000', { opacity: 0.08 });

const sun = (cx, cy, r, fill, ray) => {
  let out = circle(cx, cy, r * 2.2, fill, { opacity: 0.16 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    out += path(`M${cx + Math.cos(a) * r * 1.25} ${cy + Math.sin(a) * r * 1.25}L${cx + Math.cos(a) * r * 1.6} ${cy + Math.sin(a) * r * 1.6}`, 'none', { stroke: ray, 'stroke-width': 6, 'stroke-linecap': 'round' });
  }
  return out + circle(cx, cy, r, fill, { stroke: ray, 'stroke-width': 4 });
};

/** Suelo: césped festoneado con borde de tinta y tierra con piedrecitas. Mosaico de 96 px. */
const ground = (top, top2, soil, soil2, stroke) => {
  const W = 96;
  const H = 44;
  let scallops = '';
  for (let x = 0; x <= W; x += 24) scallops += circle(x, 14, 12, top, { stroke, 'stroke-width': 3 });
  return svg(
    W,
    H,
    rect(0, 12, W, H, soil) +
      rect(0, 12, W, 3, stroke) +
      scallops +
      rect(0, 8, W, 10, top) +
      rect(0, 18, W, 3, top2) +
      circle(18, 32, 3, soil2) +
      circle(58, 38, 4, soil2) +
      circle(82, 28, 2.5, soil2),
  );
};

/* ---------- Escenarios ---------- */

const SKY_W = 1200;
const SKY_H = 260;
const FAR_W = 900;
const FAR_H = 260;
const MID_W = 760;
const MID_H = 200;
const NEAR_W = 620;
const NEAR_H = 130;

const WORLDS = {
  /* Pradera de día: el mundo de partida. */
  '.stage': {
    sky: 'linear-gradient(180deg, #4f9cf5 0%, #7bbcff 55%, #c6e7ff 100%)',
    skybits: svg(SKY_W, SKY_H, cloud(80, 70, 1.1, '#fbf8f0', '#9cc3ee', '#d6e6f5') + cloud(470, 140, 0.8, '#fbf8f0', '#9cc3ee', '#d6e6f5') + cloud(820, 60, 1.3, '#fbf8f0', '#9cc3ee', '#d6e6f5') + cloud(1060, 170, 0.6, '#fbf8f0', '#9cc3ee')),
    far: svg(FAR_W, FAR_H, hill({ cx: 190, base: FAR_H, rx: 200, ry: 170, fill: '#9fdab7' }) + hill({ cx: 560, base: FAR_H, rx: 150, ry: 120, fill: '#b2e3c4' }) + hill({ cx: 790, base: FAR_H, rx: 100, ry: 200, fill: '#a6dcbc' })),
    mid: svg(MID_W, MID_H, hill({ cx: 170, base: MID_H, rx: 150, ry: 120, fill: '#4cbf5a', stroke: '#1d4a2c', dots: { r: 7, fill: '#6fd877' }, shine: '#bff5b6' }) + hill({ cx: 560, base: MID_H, rx: 120, ry: 160, fill: '#3fae55', stroke: '#1d4a2c', dots: { r: 6, fill: '#5ccb6b' }, shine: '#bff5b6' }) + roundTree(370, MID_H, 0.9, '#2f9e48', '#8a5a34', '#1d4a2c', '#9be89a')),
    near: svg(NEAR_W, NEAR_H, bush(40, NEAR_H, 1.3, '#38b04f', '#16331f', '#b8f0a8') + bush(330, NEAR_H, 1, '#2f9e48', '#16331f', '#b8f0a8') + circle(250, NEAR_H - 12, 8, '#f2c230', { stroke: '#16331f', 'stroke-width': 3 }) + circle(520, NEAR_H - 10, 7, '#ff8fb0', { stroke: '#16331f', 'stroke-width': 3 })),
    ground: ground('#5fc95b', '#2f8f3a', '#a8643a', '#8a4e2c', '#16331f'),
  },
  /* La misma pradera, de noche. */
  ":root[data-theme='dark'] .stage": {
    sky: 'linear-gradient(180deg, #0b1230 0%, #1a2a5e 60%, #34508f 100%)',
    skybits: svg(
      SKY_W,
      SKY_H,
      stars([[60, 40, 2, 0.9], [180, 120, 1.5, 0.6], [300, 60, 2, 0.8], [420, 170, 1.5, 0.5], [560, 30, 2.2, 0.95], [690, 140, 1.5, 0.6], [950, 200, 1.5, 0.5], [1100, 50, 2, 0.9], [1160, 150, 1.5, 0.6]], '#fbf6ea') +
        sparkle(240, 200, 8, '#fbf6ea', 0.8) +
        sparkle(1010, 110, 10, '#fbf6ea', 0.85) +
        moon(820, 80, 34, '#fbeab0', '#fbeab0') +
        cloud(380, 110, 0.7, '#2a3c74', '#22325f'),
    ),
    far: svg(FAR_W, FAR_H, hill({ cx: 190, base: FAR_H, rx: 200, ry: 170, fill: '#22355f' }) + hill({ cx: 560, base: FAR_H, rx: 150, ry: 120, fill: '#283d6b' }) + hill({ cx: 790, base: FAR_H, rx: 100, ry: 200, fill: '#253a66' })),
    mid: svg(MID_W, MID_H, hill({ cx: 170, base: MID_H, rx: 150, ry: 120, fill: '#2a5a4e', stroke: '#0b1622', dots: { r: 7, fill: '#336c5d' }, shine: '#5fa08c' }) + hill({ cx: 560, base: MID_H, rx: 120, ry: 160, fill: '#245046', stroke: '#0b1622', dots: { r: 6, fill: '#2e6356' }, shine: '#5fa08c' }) + roundTree(370, MID_H, 0.9, '#1f4a3c', '#4a3324', '#0b1622')),
    near: svg(NEAR_W, NEAR_H, bush(40, NEAR_H, 1.3, '#1f4a3a', '#081018', '#4d8a72') + bush(330, NEAR_H, 1, '#1b4234', '#081018') + circle(250, NEAR_H - 12, 6, '#f2c230', { opacity: 0.9 }) + circle(250, NEAR_H - 12, 16, '#f2c230', { opacity: 0.18 })),
    ground: ground('#2f6b3c', '#1b4226', '#4a3324', '#3a2619', '#081018'),
  },
  /* Subterráneo: cueva de roca azul con cristales que brillan. */
  ":root[data-world='underground'] .stage": {
    sky: 'linear-gradient(180deg, #0c1024 0%, #18224a 60%, #24346c 100%)',
    skybits: svg(
      SKY_W,
      SKY_H,
      [80, 260, 420, 640, 860, 1040]
        .map((x, i) => path(`M${x - 34} 0Q${x} ${70 + (i % 3) * 30} ${x + 34} 0Z`, '#141c3c', { stroke: '#0a0f22', 'stroke-width': 4 }))
        .join('') + [[180, 120], [540, 70], [760, 160], [980, 90]].map(([x, y]) => sparkle(x, y, 9, '#7fe6ff', 0.75)).join(''),
    ),
    far: svg(FAR_W, FAR_H, [[120, 90, 220], [380, 70, 170], [620, 100, 230], [820, 60, 150]].map(([x, w, h]) => rect(x - w / 2, FAR_H - h, w, h + 10, '#1e2c5c', { rx: w / 2 })).join('')),
    mid: svg(
      MID_W,
      MID_H,
      hill({ cx: 190, base: MID_H, rx: 170, ry: 110, fill: '#33478a', stroke: '#0a0f22', dots: { r: 6, fill: '#3d539c' }, shine: '#7e95d8' }) +
        hill({ cx: 580, base: MID_H, rx: 130, ry: 140, fill: '#2d4080', stroke: '#0a0f22', shine: '#7e95d8' }) +
        [[380, 0], [400, -14], [420, 6]].map(([x, d]) => path(`M${x - 12} ${MID_H}L${x} ${MID_H - 70 + d}L${x + 12} ${MID_H}Z`, '#5be0ff', { stroke: '#0a0f22', 'stroke-width': 3, 'stroke-linejoin': 'round' })).join(''),
    ),
    near: svg(
      NEAR_W,
      NEAR_H,
      [[90, 1.1, '#8a6cff', '#c9bcff'], [380, 0.9, '#36c5a0', '#a8f0d8']]
        .map(([x, s, cap, glow]) =>
          rect(x - 10 * s, NEAR_H - 40 * s, 20 * s, 40 * s, '#efe3c8', { stroke: '#0a0f22', 'stroke-width': 4, rx: 6 }) +
          path(domeD(x, NEAR_H - 36 * s, 44 * s, 40 * s), cap, { stroke: '#0a0f22', 'stroke-width': 4, 'stroke-linejoin': 'round' }) +
          circle(x, NEAR_H - 60 * s, 52 * s, glow, { opacity: 0.16 }) +
          path(`M${x - 26 * s} ${NEAR_H - 50 * s}Q${x} ${NEAR_H - 66 * s} ${x + 26 * s} ${NEAR_H - 50 * s}`, 'none', { stroke: glow, 'stroke-width': 4 * s, 'stroke-linecap': 'round', opacity: 0.8 }),
        )
        .join(''),
    ),
    ground: ground('#6f86c4', '#3d4d7a', '#28324f', '#1c2440', '#0a0f22'),
  },
  /* Castillo: almenas a contraluz y un río de lava. */
  ":root[data-world='castle'] .stage": {
    sky: 'linear-gradient(180deg, #1c0c10 0%, #4a1a1c 60%, #8a3420 100%)',
    skybits: svg(SKY_W, SKY_H, moon(980, 70, 28, '#ffb08a', '#ff6a3c') + stars([[120, 180, 3, 0.7], [300, 90, 2.5, 0.6], [520, 200, 3, 0.7], [700, 120, 2, 0.6], [880, 210, 2.5, 0.6]], '#ff9a50')),
    far: svg(
      FAR_W,
      FAR_H,
      [[160, 110, 200], [450, 160, 150], [720, 120, 220]]
        .map(([x, w, h]) => {
          let t = rect(x - w / 2, FAR_H - h, w, h, '#3a1e22');
          for (let i = 0; i < 4; i++) t += rect(x - w / 2 + (i * w) / 4 + 4, FAR_H - h - 18, w / 4 - 12, 20, '#3a1e22');
          t += rect(x - 8, FAR_H - h + 40, 16, 26, '#ff8a3c', { rx: 8, opacity: 0.7 });
          return t;
        })
        .join(''),
    ),
    mid: svg(MID_W, MID_H, hill({ cx: 180, base: MID_H, rx: 170, ry: 100, fill: '#4f2b2a', stroke: '#1a0a0c', shine: '#8a4a3c' }) + hill({ cx: 560, base: MID_H, rx: 140, ry: 130, fill: '#45262a', stroke: '#1a0a0c', shine: '#8a4a3c' })),
    near: svg(NEAR_W, NEAR_H, wave(NEAR_W, NEAR_H, 10, NEAR_H - 40, '#ff6a2c', '#1a0a0c', 3) + wave(NEAR_W, NEAR_H, 6, NEAR_H - 24, '#ffb03c', undefined, 4) + [[120, 60], [400, 50]].map(([x, y]) => circle(x, NEAR_H - y, 6, '#ffd23f', { opacity: 0.8 })).join('')),
    ground: ground('#b0563a', '#6b2a1c', '#3a1e22', '#2a1416', '#1a0a0c'),
  },
  /* Bajo el agua: corales, algas y rayos de luz. */
  ":root[data-world='water'] .stage": {
    sky: 'linear-gradient(180deg, #2fb4ec 0%, #1477bf 55%, #0b3f74 100%)',
    skybits: svg(
      SKY_W,
      SKY_H,
      [[100, 0, 160], [420, 0, 120], [800, 0, 180]].map(([x, , w]) => path(`M${x} 0L${x + w} 0L${x + w * 0.5 + 60} ${SKY_H}L${x + w * 0.5 - 60} ${SKY_H}Z`, '#bdf0ff', { opacity: 0.12 })).join('') +
        [[70, 60, 10], [240, 160, 7], [410, 50, 12], [560, 200, 8], [720, 90, 11], [900, 180, 6], [1080, 70, 9]].map(([x, y, r]) => circle(x, y, r, 'none', { stroke: '#d6f6ff', 'stroke-width': 3, opacity: 0.7 }) + circle(x - r * 0.35, y - r * 0.35, r * 0.25, '#ffffff', { opacity: 0.7 })).join(''),
    ),
    far: svg(FAR_W, FAR_H, hill({ cx: 200, base: FAR_H, rx: 210, ry: 110, fill: '#1f6a9e' }) + hill({ cx: 640, base: FAR_H, rx: 240, ry: 140, fill: '#1c6294' })),
    mid: svg(
      MID_W,
      MID_H,
      hill({ cx: 200, base: MID_H, rx: 150, ry: 90, fill: '#e07a8a', stroke: '#0a2a44', dots: { r: 6, fill: '#f29aa6' }, shine: '#ffc7cf' }) +
        hill({ cx: 560, base: MID_H, rx: 120, ry: 110, fill: '#f0a24a', stroke: '#0a2a44', dots: { r: 5, fill: '#f7bb6e' }, shine: '#ffe0b0' }),
    ),
    near: svg(
      NEAR_W,
      NEAR_H,
      [[60, 110], [90, 80], [330, 120], [360, 90], [540, 100]]
        .map(([x, h]) => path(`M${x} ${NEAR_H}Q${x - 18} ${NEAR_H - h * 0.33} ${x} ${NEAR_H - h * 0.66}T${x} ${NEAR_H - h}`, 'none', { stroke: '#22b37e', 'stroke-width': 12, 'stroke-linecap': 'round' }))
        .join('') +
        path(domeD(220, NEAR_H, 24, 18), '#ffd6c0', { stroke: '#0a2a44', 'stroke-width': 4 }),
    ),
    ground: ground('#e3cf8f', '#b9a462', '#c7ae6a', '#a99457', '#0a2a44'),
  },
  /* Nieve: cumbres nevadas y pinos con escarcha. */
  ":root[data-world='snow'] .stage": {
    sky: 'linear-gradient(180deg, #7ab8e8 0%, #a9d6f5 55%, #e6f5ff 100%)',
    skybits: svg(SKY_W, SKY_H, cloud(140, 80, 1, '#fbfdff', '#b6d4ee') + cloud(760, 60, 1.2, '#fbfdff', '#b6d4ee') + stars([[60, 50, 4, 0.9], [300, 170, 3, 0.8], [520, 90, 4, 0.8], [640, 200, 3, 0.7], [1000, 150, 4, 0.85], [1140, 60, 3, 0.8]], '#ffffff')),
    far: svg(FAR_W, FAR_H, mountain(200, FAR_H, 220, 220, '#a5c6e3', '#f4faff') + mountain(620, FAR_H, 260, 180, '#9bbfdf', '#f4faff')),
    mid: svg(MID_W, MID_H, hill({ cx: 190, base: MID_H, rx: 180, ry: 110, fill: '#f4faff', stroke: '#2c4a6a', shine: '#ffffff', dots: { r: 5, fill: '#e1eef9' } }) + hill({ cx: 580, base: MID_H, rx: 140, ry: 140, fill: '#eaf4fd', stroke: '#2c4a6a', shine: '#ffffff' })),
    near: svg(NEAR_W, NEAR_H, pine(70, NEAR_H, 1, '#2a7a5c', '#6b4226', '#12283a', '#f4faff') + pine(420, NEAR_H, 0.85, '#23694f', '#6b4226', '#12283a', '#f4faff')),
    ground: ground('#f2f8ff', '#bcd8ee', '#7d9cbd', '#6888aa', '#2c4a6a'),
  },
  /* Desierto: dunas, mesetas rayadas y cactus en flor. */
  ":root[data-world='desert'] .stage": {
    sky: 'linear-gradient(180deg, #f39a45 0%, #f8c472 55%, #fde7b6 100%)',
    skybits: svg(SKY_W, SKY_H, sun(900, 90, 44, '#ffe27a', '#f0a030') + cloud(200, 80, 0.8, '#fdf0d6', '#e8b880') + cloud(560, 150, 0.6, '#fdf0d6', '#e8b880')),
    far: svg(FAR_W, FAR_H, wave(FAR_W, FAR_H, 40, FAR_H - 110, '#eab070', undefined, 2) + wave(FAR_W, FAR_H, 30, FAR_H - 60, '#e1a05e', undefined, 3)),
    mid: svg(
      MID_W,
      MID_H,
      [[180, 220, 130], [560, 160, 160]]
        .map(([x, w, h]) => {
          const d = `M${x - w / 2} ${MID_H + 4}L${x - w / 2 + 24} ${MID_H - h + 14}Q${x - w / 2 + 28} ${MID_H - h} ${x - w / 2 + 44} ${MID_H - h}H${x + w / 2 - 44}Q${x + w / 2 - 28} ${MID_H - h} ${x + w / 2 - 24} ${MID_H - h + 14}L${x + w / 2} ${MID_H + 4}Z`;
          return path(d, '#c9733a', { stroke: '#4a2410', 'stroke-width': 4, 'stroke-linejoin': 'round' }) + clipped(path(d, '#000'), [0.35, 0.6, 0.82].map((f) => rect(x - w, MID_H - h * f, w * 2, 8, '#e09454')).join(''));
        })
        .join(''),
    ),
    near: svg(NEAR_W, NEAR_H, cactus(110, NEAR_H, 1, '#3aa05a', '#14301f', '#ff8fb0') + cactus(430, NEAR_H, 0.8, '#2f8f4c', '#14301f', '#f2c230')),
    ground: ground('#ecc97a', '#c9a052', '#d8a85e', '#b98d45', '#4a2410'),
  },
  /* Casa encantada: luna enorme, árboles secos y lápidas. */
  ":root[data-world='ghost'] .stage": {
    sky: 'linear-gradient(180deg, #0c0720 0%, #22163f 60%, #3e2a66 100%)',
    skybits: svg(SKY_W, SKY_H, moon(880, 100, 50, '#efe6ff', '#c3a2ff') + stars([[80, 50, 2, 0.7], [240, 140, 2, 0.6], [400, 60, 2, 0.6], [560, 190, 2, 0.5], [660, 70, 2, 0.6], [1120, 200, 2, 0.6]], '#d8c8ff') + cloud(300, 120, 0.7, '#3a2a5e', '#2c1f4a')),
    far: svg(
      FAR_W,
      FAR_H,
      [[200, 1], [640, 0.8]]
        .map(([x, s]) => path(`M${x} ${FAR_H}V${FAR_H - 150 * s}M${x} ${FAR_H - 100 * s}Q${x - 40 * s} ${FAR_H - 130 * s} ${x - 70 * s} ${FAR_H - 170 * s}M${x} ${FAR_H - 120 * s}Q${x + 50 * s} ${FAR_H - 140 * s} ${x + 80 * s} ${FAR_H - 190 * s}M${x} ${FAR_H - 150 * s}Q${x + 10 * s} ${FAR_H - 180 * s} ${x - 10 * s} ${FAR_H - 210 * s}`, 'none', { stroke: '#2b1d4c', 'stroke-width': 14 * s, 'stroke-linecap': 'round' }))
        .join(''),
    ),
    mid: svg(MID_W, MID_H, hill({ cx: 190, base: MID_H, rx: 170, ry: 100, fill: '#4a3a78', stroke: '#140c26', dots: { r: 6, fill: '#55448a' }, shine: '#8a76c4' }) + hill({ cx: 570, base: MID_H, rx: 140, ry: 130, fill: '#433470', stroke: '#140c26', shine: '#8a76c4' })),
    near: svg(
      NEAR_W,
      NEAR_H,
      [[80, 1], [200, 0.8], [440, 1.1]].map(([x, s]) => rect(x - 22 * s, NEAR_H - 64 * s, 44 * s, 70 * s, '#6a5c8e', { rx: 22 * s, stroke: '#140c26', 'stroke-width': 4 }) + rect(x - 10 * s, NEAR_H - 44 * s, 20 * s, 4 * s, '#140c26', { opacity: 0.5 })).join('') +
        circle(320, NEAR_H - 70, 10, '#b8f0ff', { opacity: 0.5 }) +
        circle(320, NEAR_H - 70, 22, '#b8f0ff', { opacity: 0.15 }),
    ),
    ground: ground('#5a4a80', '#3a2d5c', '#2a2040', '#1e1630', '#140c26'),
  },
};

const LAYERS = ['sky', 'skybits', 'far', 'mid', 'near', 'ground'];

const css =
  `/* GENERADO por scripts/gen-worlds.mjs — no editar a mano: ejecuta \`npm run worlds\`.\n` +
  ` * Decorado por capas de la pantalla del mundo (.stage): cielo, lo que flota, lejos, medio, cerca y suelo.\n */\n` +
  Object.entries(WORLDS)
    .map(([sel, w]) => `${sel} {\n${LAYERS.map((k) => `  --${k}: ${w[k]};`).join('\n')}\n}\n`)
    .join('');

writeFileSync(OUT, css, 'utf8');
console.log(`worlds.css: ${Object.keys(WORLDS).length} mundos, ${(css.length / 1024).toFixed(1)} KB`);
