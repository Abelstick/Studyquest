import { useId, type ReactNode } from 'react';
import { useUi } from '@/state/ui';
import { cx } from './kit';
import { Icon } from './Icon';

/** Abierto o cerrado de una sección plegable. Se recuerda por id entre visitas; sin elección, usa `defaultOpen`. */
export function useFold(id: string, defaultOpen = true) {
  const stored = useUi((s) => s.folds[id]);
  const setFold = useUi((s) => s.setFold);
  const open = stored ?? defaultOpen;
  return [open, () => setFold(id, !open)] as const;
}

interface FoldToggleProps {
  open: boolean;
  onToggle: () => void;
  controls: string;
  children: ReactNode;
  className?: string;
}

/** Botón que pliega o despliega: flecha a la izquierda y el título como etiqueta. */
export function FoldToggle({ open, onToggle, controls, children, className }: Readonly<FoldToggleProps>) {
  return (
    <button type="button" className={cx('fold__toggle', className)} aria-expanded={open} aria-controls={controls} onClick={onToggle}>
      <span className="fold__chev" aria-hidden="true">
        <Icon name={open ? 'down' : 'play'} size={10} />
      </span>
      {children}
    </button>
  );
}

interface FoldPanelProps {
  id: string;
  title: string;
  kicker?: string;
  /** Lo que se ve en la cabecera con el panel cerrado o abierto (un recuento, un estado). */
  badge?: ReactNode;
  right?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}

/** Panel con cabecera que se pliega: cerrado ocupa una sola línea y deja ver su resumen. */
export function FoldPanel({ id, title, kicker, badge, right, defaultOpen = true, className, children }: Readonly<FoldPanelProps>) {
  const [open, toggle] = useFold(id, defaultOpen);
  const bodyId = useId();
  return (
    <section className={cx('panel fold', !open && 'is-closed', className)} aria-label={title}>
      <div className="panel__head fold__head">
        <FoldToggle open={open} onToggle={toggle} controls={bodyId}>
          <span className="fold__label">
            {kicker && <span className="kicker">{kicker}</span>}
            <span className="panel__title">{title}</span>
          </span>
          {badge !== undefined && <span className="fold__badge">{badge}</span>}
        </FoldToggle>
        {right}
      </div>
      <div className="fold__body" id={bodyId} hidden={!open}>
        {children}
      </div>
    </section>
  );
}
