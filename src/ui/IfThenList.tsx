import type { IfThen } from '@/core/domain';
import { ifThenText } from '@/core/ifthen';
import { cx } from './kit';

/** Planes «si ocurre X, haré Y» en lectura. `compact` los deja en una línea cada uno (para tarjetas de Hoy). */
export function IfThenList({ plans, compact, className }: Readonly<{ plans?: IfThen[]; compact?: boolean; className?: string }>) {
  if (!plans?.length) return null;
  return (
    <ul className={cx('ifthen-list', compact && 'ifthen-list--compact', className)} aria-label="Si… entonces…">
      {plans.map((p) => {
        const t = ifThenText(p);
        return (
          <li key={p.id}>
            <b>Si</b> {t.when} <span aria-hidden="true">→</span>
            <span className="sr-only"> entonces</span> {t.then}
          </li>
        );
      })}
    </ul>
  );
}
