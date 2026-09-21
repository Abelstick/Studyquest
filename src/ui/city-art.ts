/**
 * Arte de los edificios de la ciudad, dibujado por código en una cuadrícula de píxeles (mismos colores que los sprites).
 * Cada edificio tiene 5 niveles que crecen y ganan detalles; el nivel 0 es un solar en obras. La salida es
 * una lista de filas de texto que dibuja <Sprite/> igual que el resto del arte.
 */
import type { BuildingId } from '@/core/city';

export const CITY_W = 32;
export const CITY_H = 28;

class Canvas {
  readonly g: string[][] = Array.from({ length: CITY_H }, () => Array<string>(CITY_W).fill('.'));
  px(x: number, y: number, c: string) {
    if (x >= 0 && x < CITY_W && y >= 0 && y < CITY_H) this.g[y][x] = c;
  }
  rect(x: number, y: number, w: number, h: number, c: string) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
  }
  /** Rectángulo con contorno negro. (x, y) es la esquina superior izquierda de todo el rectángulo. */
  box(x: number, y: number, w: number, h: number, fill: string) {
    this.rect(x, y, w, h, 'K');
    this.rect(x + 1, y + 1, w - 2, h - 2, fill);
  }
  rows(): string[] {
    return this.g.map((r) => r.join(''));
  }
}

const GROUND = CITY_H - 2; // primera fila de hierba

function ground(c: Canvas) {
  c.rect(0, GROUND, CITY_W, 1, 'g');
  c.rect(0, GROUND + 1, CITY_W, 1, 'H');
}

/** Triángulo (tejado) apoyado sobre la fila `baseY`, con contorno. */
function roof(c: Canvas, cx: number, baseY: number, halfW: number, fill: string, height = halfW) {
  for (let r = 0; r < height; r++) {
    const half = halfW - Math.floor((r * halfW) / height);
    c.rect(cx - half, baseY - r, half * 2 + 1, 1, 'K');
    if (half > 1) c.rect(cx - half + 1, baseY - r, half * 2 - 1, 1, fill);
  }
  c.rect(cx, baseY - height, 1, 1, 'K');
}

function windows(c: Canvas, x: number, y: number, cols: number, rows: number, gx = 4, gy = 4, fill = 'Y') {
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) c.rect(x + i * gx, y + j * gy, 2, 2, fill);
}

function door(c: Canvas, cx: number, w = 3, h = 4) {
  c.rect(cx - Math.floor(w / 2), GROUND - h, w, h, 'N');
  c.px(cx + Math.floor(w / 2) - 1, GROUND - Math.ceil(h / 2), 'Y');
}

function columns(c: Canvas, x: number, y: number, count: number, gap: number, h: number, fill = 'W') {
  for (let i = 0; i < count; i++) {
    c.rect(x + i * gap, y, 2, h, fill);
    c.px(x + i * gap, y, 'E');
    c.px(x + i * gap + 1, y + h - 1, 'E');
  }
}

function flag(c: Canvas, x: number, y: number, fill = 'R') {
  c.rect(x, y, 1, 5, 'K');
  c.rect(x + 1, y, 3, 2, fill);
}

function tree(c: Canvas, x: number) {
  c.rect(x + 1, GROUND - 2, 1, 2, 'N');
  c.rect(x, GROUND - 5, 3, 3, 'G');
  c.px(x + 1, GROUND - 6, 'G');
  c.px(x + 1, GROUND - 4, 'g');
}

/* ---------- Solar en obras (nivel 0) ---------- */
function lot(c: Canvas) {
  c.rect(6, GROUND - 3, 20, 3, 'L'); // tierra
  for (let i = 0; i < 6; i++) c.px(8 + i * 3, GROUND - 4, 'N');
  c.rect(12, GROUND - 12, 1, 9, 'K'); // cartel
  c.rect(12, GROUND - 13, 9, 5, 'K');
  c.rect(13, GROUND - 12, 7, 3, 'Y');
  c.px(14, GROUND - 11, 'K');
  c.px(16, GROUND - 11, 'K');
  c.px(18, GROUND - 11, 'K');
  c.rect(24, GROUND - 4, 2, 1, 'O'); // cono
  c.px(24, GROUND - 5, 'O');
}

/* ---------- Casa (hábitos) ---------- */
function casa(c: Canvas, L: number) {
  const cx = 16;
  if (L === 1) {
    for (let r = 0; r < 9; r++) {
      const half = 7 - Math.floor((r * 7) / 9);
      c.rect(cx - half, GROUND - 1 - r, half * 2 + 1, 1, 'K');
      c.rect(cx - half + 1, GROUND - 1 - r, Math.max(0, half * 2 - 1), 1, r % 2 ? 'W' : 'R');
    }
    c.rect(cx - 1, GROUND - 4, 3, 4, 'D');
    return;
  }
  const w = [0, 0, 14, 16, 18, 22][L];
  const h = [0, 0, 7, 9, 12, 11][L];
  const x = cx - Math.floor(w / 2);
  const top = GROUND - h;
  const roofH = Math.floor(w / 3) + (L >= 5 ? 0 : 2);
  c.box(x, top, w, h, L === 2 ? 'N' : 'L');
  roof(c, cx, top - 1, Math.floor(w / 2) + 1, L === 2 ? 'T' : 'R', roofH);
  door(c, cx);
  windows(c, x + 2, top + 2, 2, 1, 4, 4, 'B');
  windows(c, x + w - 6, top + 2, 2, 1, 4, 4, 'B');
  if (L >= 3) c.rect(x + w - 5, top - 6, 2, 5, 'E'); // chimenea
  if (L >= 4) {
    windows(c, x + 2, top + 6, 2, 1, 4, 4, 'B');
    windows(c, x + w - 6, top + 6, 2, 1, 4, 4, 'B');
    c.rect(x - 2, GROUND - 3, 1, 3, 'N');
    c.rect(x + w + 1, GROUND - 3, 1, 3, 'N');
    tree(c, 1);
  }
  if (L >= 5) {
    flag(c, cx, Math.max(1, top - 1 - roofH - 5), 'Y');
    tree(c, 28);
    c.rect(1, GROUND - 3, 4, 3, 'L');
    c.rect(x - 4, GROUND - 4, 4, 4, 'L');
    c.rect(x + w, GROUND - 4, 4, 4, 'L');
  }
}

/* ---------- Biblioteca (conocimiento) ---------- */
function biblioteca(c: Canvas, L: number) {
  const cx = 16;
  if (L === 1) {
    c.box(8, GROUND - 14, 16, 14, 'N');
    const books = ['R', 'B', 'G', 'Y', 'V', 'O'];
    for (let shelf = 0; shelf < 3; shelf++) {
      const y = GROUND - 13 + shelf * 4;
      for (let i = 0; i < 7; i++) c.rect(10 + i * 2, y, 2, 3, books[(i + shelf) % books.length]);
      c.rect(9, y + 3, 14, 1, 'K');
    }
    return;
  }
  const w = [0, 0, 16, 20, 24, 28][L];
  const h = [0, 0, 9, 11, 13, 14][L];
  const x = cx - Math.floor(w / 2);
  const top = GROUND - h;
  c.box(x, top, w, h, 'L');
  if (L === 2) {
    c.rect(x + 1, top - 2, w - 2, 3, 'K');
    for (let i = 0; i < w - 2; i++) c.px(x + 1 + i, top - 1, i % 2 ? 'W' : 'R'); // toldo
    c.rect(x + 3, top + 3, w - 6, 4, 'B');
    for (let i = 0; i < 5; i++) c.rect(x + 4 + i * 2, top + 4, 1, 3, ['R', 'Y', 'G', 'V', 'O'][i]);
    door(c, cx);
    return;
  }
  // frontón y columnas
  roof(c, cx, top - 1, Math.floor(w / 2), 'E', 4);
  c.rect(x, top, w, 1, 'E');
  columns(c, x + 3, top + 2, Math.floor((w - 4) / 5) + 1, 5, h - 3);
  door(c, cx, 4, 5);
  c.rect(cx - 2, top + 1, 5, 2, 'R'); // cartel con libro
  c.px(cx, top + 1, 'W');
  if (L >= 4) {
    for (let r = 0; r < 4; r++) c.rect(cx - 3 + r, top - 6 - r, 7 - r * 2, 1, r ? 'C' : 'K'); // cúpula
    c.rect(cx - 3, top - 5, 7, 1, 'K');
    c.rect(cx - 2, top - 5, 5, 1, 'C');
    c.rect(cx - 2, top - 8, 5, 2, 'C');
    c.rect(cx - 1, top - 9, 3, 1, 'C');
    c.px(cx, top - 10, 'K');
  }
  if (L >= 5) {
    flag(c, x + 1, top - 7);
    flag(c, x + w - 4, top - 7, 'B');
    tree(c, 1);
    tree(c, 28);
  }
}

/* ---------- Academia (cursos) ---------- */
function academia(c: Canvas, L: number) {
  const cx = 16;
  if (L === 1) {
    c.box(8, GROUND - 8, 16, 8, 'Y');
    windows(c, 10, GROUND - 6, 3, 1, 4, 4, 'B');
    door(c, 20);
    flag(c, 9, GROUND - 14);
    return;
  }
  const w = [0, 0, 16, 20, 26, 30][L];
  const h = [0, 0, 9, 10, 11, 11][L];
  const x = cx - Math.floor(w / 2);
  const top = GROUND - h;
  c.box(x, top, w, h, 'T');
  c.rect(x, top, w, 1, 'W');
  windows(c, x + 2, top + 3, Math.floor((w - 4) / 4), 1, 4, 4, 'Y');
  if (L >= 3) windows(c, x + 2, top + 7, Math.floor((w - 4) / 4), 1, 4, 4, 'Y');
  // torre central con reloj
  const tw = L >= 4 ? 8 : 6;
  const th = L >= 4 ? 7 : 8;
  c.box(cx - tw / 2, top - th, tw, th + 1, 'T');
  roof(c, cx, top - th - 1, tw / 2, 'V', tw / 2 + 1);
  c.rect(cx - 1, top - th + 2, 3, 3, 'W');
  c.px(cx, top - th + 3, 'K');
  door(c, cx, 4, 5);
  c.rect(cx - 3, GROUND - 1, 7, 1, 'E');
  if (L >= 4) {
    for (const fx of [x + 2, x + w - 5]) {
      c.box(fx, top - 6, 4, 7, 'T');
      roof(c, fx + 2, top - 7, 2, 'V', 3);
    }
  }
  if (L >= 5) {
    tree(c, 0);
    tree(c, 29);
  }
  if (L === 2) c.rect(cx - 1, top + 3, 3, 3, 'B');
}

/* ---------- Laboratorio (proyectos) ---------- */
function laboratorio(c: Canvas, L: number) {
  const cx = 16;
  if (L === 1) {
    c.box(8, GROUND - 9, 16, 9, 'E');
    c.rect(10, GROUND - 14, 3, 5, 'D'); // chimenea
    c.rect(11, GROUND - 16, 1, 2, 'W');
    windows(c, 11, GROUND - 7, 2, 1, 5, 4, 'C');
    door(c, 20);
    return;
  }
  const w = [0, 0, 18, 22, 24, 24][L];
  const h = [0, 0, 10, 11, 12, 12][L];
  const x = cx - Math.floor(w / 2);
  const top = GROUND - h;
  c.box(x, top, w, h, 'E');
  c.rect(x, top + h - 3, w, 1, 'K');
  windows(c, x + 2, top + 2, Math.floor((w - 4) / 4), 1, 4, 4, 'C');
  if (L >= 3) windows(c, x + 2, top + 6, Math.floor((w - 4) / 4), 1, 4, 4, 'C');
  door(c, cx, 4, 5);
  // antena
  c.rect(x + 2, top - 6, 1, 6, 'D');
  c.px(x + 2, top - 7, 'R');
  // cúpula de cristal y matraz
  if (L >= 3) {
    for (let r = 0; r < 4; r++) c.rect(cx - 4 + r, top - 1 - r, 9 - r * 2, 1, r === 3 ? 'K' : 'C');
    c.rect(cx - 1, top - 4, 3, 2, 'G');
    c.px(cx, top - 5, 'W');
  }
  if (L >= 4) {
    c.box(x - 3, top + 4, 4, h - 4, 'E');
    c.box(x + w - 1, top + 4, 4, h - 4, 'E');
    c.rect(x + w - 3, top - 8, 1, 8, 'D');
    c.rect(x + w - 5, top - 9, 5, 2, 'W');
  }
  if (L >= 5) {
    c.rect(cx, top - 10, 1, 6, 'Y'); // pararrayos
    c.rect(cx - 1, top - 11, 3, 2, 'Y');
    c.rect(cx - 3, top - 6, 7, 1, 'Y');
    tree(c, 0);
    tree(c, 29);
  }
}

/* ---------- Arena (retos) ---------- */
function arena(c: Canvas, L: number) {
  const cx = 16;
  if (L === 1) {
    c.rect(4, GROUND - 4, 24, 4, 'G');
    for (let i = 0; i < 6; i++) c.rect(6 + i * 4, GROUND - 3, 2, 1, 'W');
    c.rect(6, GROUND - 12, 1, 9, 'K');
    c.rect(6, GROUND - 12, 4, 3, 'R');
    c.rect(24, GROUND - 10, 1, 7, 'K');
    c.rect(22, GROUND - 10, 5, 1, 'K');
    return;
  }
  if (L === 2) {
    c.box(6, GROUND - 10, 20, 10, 'O');
    c.rect(8, GROUND - 8, 16, 3, 'D');
    c.rect(10, GROUND - 7, 12, 1, 'E');
    c.rect(9, GROUND - 8, 2, 3, 'K');
    c.rect(21, GROUND - 8, 2, 3, 'K');
    door(c, cx, 4, 4);
    return;
  }
  const w = [0, 0, 0, 22, 24, 26][L];
  const h = [0, 0, 0, 10, 13, 15][L];
  const x = cx - Math.floor(w / 2);
  const top = GROUND - h;
  // gradas
  c.box(x, top, w, h, 'E');
  c.rect(x + 1, top + 1, w - 2, 1, 'W');
  c.rect(x + 3, top + 3, w - 6, h - 5, 'G');
  for (let i = 0; i < Math.floor((w - 6) / 4); i++) c.rect(x + 5 + i * 4, top + 4 + (h > 12 ? 2 : 0), 2, 1, 'W');
  c.rect(x + 3, top + 3, w - 6, 1, 'K');
  // esquinas redondeadas
  for (const [px, py] of [[x, top], [x + w - 1, top]]) c.px(px, py, '.');
  // arcos
  for (let i = 0; i < Math.floor((w - 4) / 4); i++) c.rect(x + 3 + i * 4, GROUND - 3, 2, 3, 'D');
  if (L >= 4) {
    for (const tx of [x - 1, x + w - 1]) {
      c.rect(tx, top - 8, 1, 8 + h - 2, 'D');
      c.rect(tx - 1, top - 9, 3, 2, 'Y');
    }
  }
  if (L >= 5) {
    flag(c, x + 4, top - 5);
    flag(c, x + w - 8, top - 5, 'B');
    c.rect(cx - 1, top - 4, 2, 2, 'O');
    c.px(cx, top - 5, 'R');
  }
}

/* ---------- Museo (logros) ---------- */
function museo(c: Canvas, L: number) {
  const cx = 16;
  if (L === 1) {
    c.box(10, GROUND - 12, 12, 12, 'C');
    c.rect(11, GROUND - 4, 10, 3, 'N');
    c.rect(14, GROUND - 9, 4, 4, 'Y');
    c.rect(15, GROUND - 5, 2, 2, 'Y');
    c.rect(12, GROUND - 11, 2, 1, 'W');
    return;
  }
  const w = [0, 0, 16, 22, 26, 26][L];
  const h = [0, 0, 9, 11, 12, 12][L];
  const x = cx - Math.floor(w / 2);
  const top = GROUND - h;
  c.box(x, top, w, h, 'W');
  roof(c, cx, top - 1, Math.floor(w / 2) + 1, 'W', 5);
  if (L >= 3) c.rect(cx - 1, top - 4, 3, 2, 'Y');
  columns(c, x + 3, top + 2, Math.floor((w - 4) / 5) + 1, 5, h - 4, L >= 4 ? 'E' : 'E');
  c.rect(x - 1, GROUND - 2, w + 2, 1, 'E');
  c.rect(x - 2, GROUND - 1, w + 4, 1, 'E');
  door(c, cx, 4, 6);
  if (L >= 4) {
    c.rect(x + 2, top + 1, 3, 5, 'R');
    c.rect(x + w - 5, top + 1, 3, 5, 'R');
  }
  if (L >= 5) {
    // cúpula dorada con trofeo
    for (let r = 0; r < 4; r++) c.rect(cx - 3 + r, top - 7 - r, 7 - r * 2, 1, r === 3 ? 'K' : 'Y');
    c.rect(cx - 1, top - 12, 3, 3, 'Y');
    c.rect(cx, top - 13, 1, 1, 'Y');
    flag(c, x + 1, top - 3);
    flag(c, x + w - 4, top - 3, 'B');
  }
}

const PAINTERS: Record<BuildingId, (c: Canvas, level: number) => void> = { casa, biblioteca, academia, laboratorio, arena, museo };

/** Filas del arte de un edificio a un nivel (0 = solar en obras). */
export function buildingRows(id: BuildingId, level: number): string[] {
  const c = new Canvas();
  ground(c);
  const L = Math.max(0, Math.min(5, Math.floor(level)));
  if (L === 0) lot(c);
  else PAINTERS[id](c, L);
  return c.rows();
}
