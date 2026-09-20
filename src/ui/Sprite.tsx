import { memo } from 'react';
import { spriteRects, spriteSize, type SpriteName } from './sprites';

const cache = new Map<SpriteName, ReturnType<typeof spriteRects>>();
const rectsOf = (name: SpriteName) => {
  let r = cache.get(name);
  if (!r) cache.set(name, (r = spriteRects(name)));
  return r;
};

interface Props {
  name: SpriteName;
  /** Alto en píxeles CSS. */
  size?: number;
  className?: string;
  /** Si se da, el sprite es informativo; si no, decorativo (oculto a lectores de pantalla). */
  title?: string;
}

export const Sprite = memo(function Sprite({ name, size = 24, className, title }: Props) {
  const { w, h } = spriteSize(name);
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
      {rectsOf(name).map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
      ))}
    </svg>
  );
});
