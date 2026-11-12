import { memo } from 'react';
import { useUi } from '@/state/ui';
import { spriteRects, spriteSize, type SpriteName } from './sprites';
import { worldSprite } from './worldSprites';

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
  /** Icono de sección: cambia con el mundo visual (ver ui/worldSprites.ts). Sin esto, el sprite es siempre el mismo. */
  themed?: boolean;
}

const Plain = memo(function Plain({ name, size = 24, className, title }: Omit<Props, 'themed'>) {
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

/** Solo los sprites `themed` se suscriben al mundo: el resto no se vuelve a pintar al cambiarlo. */
function Themed({ name, ...rest }: Omit<Props, 'themed'>) {
  const world = useUi((s) => (s.preview ? s.preview.world : s.world));
  return <Plain name={worldSprite(world, name)} {...rest} />;
}

export const Sprite = memo(function Sprite({ themed, ...rest }: Props) {
  return themed ? <Themed {...rest} /> : <Plain {...rest} />;
});
