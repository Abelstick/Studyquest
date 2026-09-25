import { memo, useMemo } from 'react';
import type { HeroItem, Palette } from '@/core/hero';
import { rectsFromRows } from '@/ui/sprites';

/*
 * Iconos de 10×10 de la tienda del héroe. «X» no está en la paleta de los sprites, así que
 * rectsFromRows la deja sin color y aquí se pinta con el del objeto; el resto usa la paleta de siempre.
 */
const ICONS: Record<string, readonly string[]> = {
  espada: ['....KK....', '...KXWK...', '...KXWK...', '...KXWK...', '...KXWK...', '...KXWK...', '.KKKKKKKK.', '.KDDDDDDK.', '....KNK...', '....KKK...'],
  martillo: ['.KKKKKKKK.', '.KXXXXXXK.', '.KXWXXXXK.', '.KXXXXXXK.', '.KKKKKKKK.', '....KNK...', '....KNK...', '....KNK...', '....KNK...', '....KKK...'],
  arco: ['.KK.......', '.KWKK.....', '.KW.KXK...', '.KW..KXK..', '.KW...KXK.', '.KW...KXK.', '.KW..KXK..', '.KW.KXK...', '.KWKK.....', '.KK.......'],
  baston: ['...KKKK...', '..KXWXXK..', '..KXXXXK..', '...KKKK...', '....KNK...', '....KNK...', '....KNK...', '....KNK...', '....KNK...', '....KKK...'],
  blaster: ['..........', 'KKKKKKKKK.', 'KXXXXXXXKC', 'KXWWWWXXKC', 'KKKKKXXKK.', '....KXXK..', '....KDDK..', '....KDDK..', '....KKKK..', '..........'],
  garras: ['.K...K...K', 'KX..KX..KX', 'KX..KX..KX', 'KX..KX..KX', 'KXK.KXK.KX', '.KX..KX.KX', '.KKKKKKKKK', '.KSSSSSSSK', '.KSSSSSSSK', '.KKKKKKKKK'],
  hoja: ['....KK....', '...KXXK...', '..KXWWXK..', '..KXWWXK..', '..KXWWXK..', '..KXWWXK..', '...KXXK...', '.KKKKKKKK.', '....KDK...', '....KKK...'],
  lanza: ['....KK....', '...KXXK...', '..KXWXXK..', '...KXXK...', '....KNK...', '...RKNK...', '...RKNK...', '....KNK...', '....KNK...', '....KKK...'],
  chispas: ['....K.....', '...KXK....', '.KKXWXKK..', '...KXK....', '....K...K.', '.......KXK', '..K.....K.', '.KXK......', '..K...K...', '.....KXK..'],
  escarcha: ['....KK....', '...KXXK...', '..KXWXXK..', '.KXWXXXXK.', 'KXXXXXXXXK', 'KXXXXXXXXK', '.KXXXXXXK.', '..KXXXXK..', '...KXXK...', '....KK....'],
  escudo: ['KKKKKKKKKK', 'KXXXXXXXXK', 'KXWXXXXXXK', 'KXWXXXXXXK', 'KXXXXXXXXK', '.KXXXXXXK.', '.KXXXXXXK.', '..KXXXXK..', '...KXXK...', '....KK....'],
  llamas: ['....K.....', '...KXK....', '...KXK.K..', '..KXXKKXK.', '..KXXXXXK.', '.KXXYXXXXK', '.KXYYYXXXK', '.KXYWYYXK.', '..KXYYXK..', '...KKKK...'],
  rayo: ['.....KKKK.', '....KXXK..', '...KXXK...', '..KXXKKKK.', '.KXXXXXXK.', '.KKKKXXK..', '....KXK...', '...KXK....', '..KXK.....', '..KK......'],
  alas: ['K........K', 'KXK....KXK', 'KXXK..KXXK', 'KXWXKKXWXK', 'KXXXXXXXXK', '.KXXXXXXK.', '..KXXXXK..', '...KXXK...', '....KK....', '..........'],
};

export const ItemIcon = memo(function ItemIcon({ item, size = 40 }: { item: HeroItem; size?: number }) {
  const rows = ICONS[item.shape ?? item.effect ?? ''];
  const rects = useMemo(() => (rows ? rectsFromRows(rows) : []), [rows]);
  if (!rows) return null;
  return (
    <svg className="sprite" width={size} height={size} viewBox="0 0 10 10" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill ?? item.color} />
      ))}
    </svg>
  );
});

/** Las skins se enseñan con sus colores: cuatro cuadros como una paleta de pintor. */
export function PaletteSwatch({ palette, size = 40 }: { palette: Pick<Palette, 'primary' | 'secondary' | 'accent' | 'glow'>; size?: number }) {
  return (
    <span className="swatch4" style={{ width: size, height: size }} aria-hidden="true">
      <i style={{ background: palette.primary }} />
      <i style={{ background: palette.secondary }} />
      <i style={{ background: palette.accent }} />
      <i style={{ background: palette.glow }} />
    </span>
  );
}
