import { useEffect, useRef, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { cx } from './kit';

export interface SectionTab {
  to: string;
  label: string;
  /** Contador opcional (por ejemplo, flashcards que tocan hoy). Solo se muestra si es mayor que cero. */
  count?: number;
  /** Texto para lectores de pantalla que explica el contador. */
  countLabel?: string;
}

interface Props {
  tabs: SectionTab[];
  /** `to` de la pestaña activa. */
  current: string;
  /** Nombre de la sección, para el lector de pantalla. */
  label: string;
  /** id del panel que controlan las pestañas. */
  panelId: string;
}

/**
 * Pestañas de la sección actual. Patrón ARIA de pestañas con activación manual: las flechas,
 * Inicio y Fin mueven el foco; Enter o Espacio abren la pestaña. Solo la activa está en el orden
 * de tabulación, así Tab salta directo al contenido.
 */
export function SectionTabs({ tabs, current, label, panelId }: Props) {
  const refs = useRef<(HTMLAnchorElement | null)[]>([]);
  const activeIndex = tabs.findIndex((t) => t.to === current);
  // En móvil la fila de pestañas se desplaza: la activa siempre queda a la vista (sin mover la página en vertical).
  useEffect(() => {
    refs.current[activeIndex]?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [activeIndex]);
  if (tabs.length < 2) return null;

  const onKeyDown = (e: KeyboardEvent<HTMLAnchorElement>, i: number) => {
    const last = tabs.length - 1;
    const next = e.key === 'ArrowRight' ? (i === last ? 0 : i + 1) : e.key === 'ArrowLeft' ? (i === 0 ? last : i - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? last : null;
    if (next !== null) {
      e.preventDefault();
      refs.current[next]?.focus();
    } else if (e.key === ' ') {
      // Un enlace no se activa con Espacio por sí solo; en una pestaña sí debe.
      e.preventDefault();
      e.currentTarget.click();
    }
  };

  return (
    <div className="section-tabs" role="tablist" aria-label={label}>
      {tabs.map((t, i) => {
        const on = t.to === current;
        return (
          <Link
            key={t.to}
            ref={(el) => {
              refs.current[i] = el;
            }}
            to={t.to}
            role="tab"
            id={sectionTabId(t.to)}
            aria-selected={on}
            aria-controls={panelId}
            tabIndex={on ? 0 : -1}
            className={cx('section-tabs__tab', on && 'is-on')}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="section-tabs__count">
                {t.count}
                {t.countLabel && <span className="sr-only"> {t.countLabel}</span>}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

/** id del elemento pestaña, para enlazar el panel con `aria-labelledby`. */
export const sectionTabId = (to: string) => `stab-${to.replace(/\W/g, '') || 'inicio'}`;
