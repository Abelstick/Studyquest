/**
 * Genera los iconos de la PWA (PNG) y el favicon a partir del sprite del bloque "?".
 * Uso: npm run icons
 */
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { spriteRects, spriteSize } from '../src/ui/sprites';

const out = new URL('../public/', import.meta.url);
mkdirSync(new URL('icons/', out), { recursive: true });

const SKY = '#5c94fc';

/** SVG con el sprite centrado; `scale` es la fracción del lienzo que ocupa. */
function iconSvg(size: number, scale: number, background: string | null, corner = 0) {
  const { w, h } = spriteSize('qblock');
  const px = Math.floor((size * scale) / Math.max(w, h));
  const sw = px * w;
  const sh = px * h;
  const ox = Math.round((size - sw) / 2);
  const oy = Math.round((size - sh) / 2);
  const rects = spriteRects('qblock')
    .map((r) => `<rect x="${ox + r.x * px}" y="${oy + r.y * px}" width="${r.w * px}" height="${px}" fill="${r.fill}"/>`)
    .join('');
  const bg = background ? `<rect width="${size}" height="${size}" rx="${corner}" fill="${background}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">${bg}${rects}</svg>`;
}

async function png(name: string, size: number, scale: number, background: string | null, corner = 0) {
  await sharp(Buffer.from(iconSvg(size, scale, background, corner))).png().toFile(new URL(`icons/${name}`, out).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
  console.log('✔', name);
}

writeFileSync(new URL('favicon.svg', out), iconSvg(64, 0.9, null));
console.log('✔ favicon.svg');
await png('icon-192.png', 192, 0.72, SKY, 28);
await png('icon-512.png', 512, 0.72, SKY, 76);
// "maskable": el sprite debe caber en el 60 % central para que el sistema pueda recortar.
await png('icon-maskable-512.png', 512, 0.5, SKY);
await png('apple-touch-icon.png', 180, 0.72, SKY);
