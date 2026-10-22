import { memo } from 'react';
import { iconRects, type IconName } from './icons';

/** Ícono de interfaz (decorativo): el nombre accesible lo pone el botón o el texto que lo acompaña. */
export const Icon = memo(function Icon({ name, size = 14, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={`icon${className ? ` ${className}` : ''}`} width={size} height={size} viewBox="0 0 7 7" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
      {iconRects(name).map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill="currentColor" />
      ))}
    </svg>
  );
});
