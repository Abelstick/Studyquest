import { useId, useState, type ReactNode } from 'react';
import { cx } from './kit';

interface Props {
  /** Hay algún orden o filtro distinto del de fábrica: se avisa en el botón aunque la barra esté plegada. */
  active?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Orden y filtros de una lista, en una barra bajo el título. En pantalla ancha siempre se ve; en móvil queda
 * plegada tras un botón, porque casi nunca se toca y empuja la lista hacia abajo (igual que en Hoy).
 */
export function ListTools({ active, children, className }: Readonly<Props>) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className={cx('ltools', open && 'is-open', className)}>
      <button type="button" className="btn btn--ghost btn--sm ltools__toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        {open ? 'Ocultar orden y filtros' : `Ordenar y filtrar${active ? ' (activos)' : ''}`}
      </button>
      <div className="ltools__body" id={id}>
        {children}
      </div>
    </div>
  );
}
