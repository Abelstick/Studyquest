import { memo, useMemo } from 'react';
import { rectsFromRows } from './sprites';

interface Props {
  /** Cuadrícula de caracteres (ver PALETTE en sprites.ts). */
  rows: readonly string[];
  /** Alto en píxeles CSS. */
  size?: number;
  className?: string;
  title?: string;
}

/** Dibuja arte de píxeles generado por código (edificios de la ciudad), con el mismo aspecto nítido que los sprites. */
export const PixelArt = memo(function PixelArt({ rows, size = 120, className, title }: Props) {
  const rects = useMemo(() => rectsFromRows(rows), [rows]);
  const w = rows[0]?.length ?? 1;
  const h = rows.length || 1;
  return (
    <svg
      className={`sprite${className ? ` ${className}` : ''}`}
      width={(size * w) / h}
      height={size}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
      ))}
    </svg>
  );
});
