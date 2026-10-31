import type { CSSProperties } from 'react';
import type { AttributeId } from '@/core/domain';
import { attributeOf } from '@/core/progression';
import { cx } from './kit';
import { Sprite } from './Sprite';

/** El color de un atributo como variable CSS, para que cada bloque lo use donde haga falta (relleno, borde, trazo). */
export const attrStyle = (id: AttributeId): CSSProperties => ({ '--attr': `var(${attributeOf(id).token})` }) as CSSProperties;

/** Marca pequeña de un atributo: su sprite sobre su color. */
export function AttrBadge({ id, size = 14, className }: Readonly<{ id: AttributeId; size?: number; className?: string }>) {
  return (
    <span className={cx('attr-badge', className)} style={attrStyle(id)} aria-hidden="true">
      <Sprite name={attributeOf(id).sprite} size={size} />
    </span>
  );
}

/** «+14 FUE · +6 VIT»: el XP repartido por atributo. El texto va en el color normal; el atributo lo dice su marca. */
export function Gains({ gains, className, full }: Readonly<{ gains: { attribute: AttributeId; xp: number }[]; className?: string; full?: boolean }>) {
  const shown = gains.filter((g) => g.xp !== 0);
  if (!shown.length) return null;
  const label = shown.map((g) => `${g.xp > 0 ? '+' : ''}${g.xp} XP de ${attributeOf(g.attribute).name}`).join(', ');
  return (
    <span className={cx('gains', className)} aria-label={label} title={label}>
      {shown.map((g) => (
        <span key={g.attribute} className="gain" style={attrStyle(g.attribute)} aria-hidden="true">
          <span className="gain__dot" />
          {g.xp > 0 ? '+' : ''}
          {g.xp} {full ? attributeOf(g.attribute).name : attributeOf(g.attribute).short}
        </span>
      ))}
    </span>
  );
}
