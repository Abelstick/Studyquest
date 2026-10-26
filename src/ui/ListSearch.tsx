import { useId, useRef, useState } from 'react';
import { cx } from './kit';
import { Icon } from './Icon';
import { Sprite } from './Sprite';

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** Qué se busca, para el nombre accesible y el texto de ayuda («hábitos», «tareas»…). */
  what: string;
  className?: string;
}

/**
 * Buscador de una lista que se puede ocultar. Plegado es solo un botón; abierto, un campo con su ✕.
 * Al ocultarlo se borra lo escrito, para no dejar un filtro invisible que esconda cosas sin explicación.
 */
export function ListSearch({ value, onChange, what, className }: Readonly<Props>) {
  const [open, setOpen] = useState(value !== '');
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  const hide = () => {
    onChange('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        className={cx('btn btn--ghost lsearch__open', className)}
        aria-expanded={false}
        aria-controls={id}
        onClick={() => {
          setOpen(true);
          // El campo aún no existe en este render: se enfoca cuando ya está.
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
      >
        <Sprite name="ring" size={14} /> Buscar
      </button>
    );
  }

  return (
    <div className={cx('lsearch', className)} id={id}>
      <Sprite name="ring" size={14} />
      <input
        ref={inputRef}
        className="lsearch__input"
        type="search"
        autoFocus
        placeholder={`Buscar ${what}…`}
        aria-label={`Buscar ${what}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Escape') return;
          // Con texto, Escape solo limpia; sin texto, oculta el buscador.
          e.stopPropagation();
          if (value) onChange('');
          else hide();
        }}
      />
      <button type="button" className="lsearch__close" onClick={hide} aria-label={`Ocultar buscador de ${what}`} title="Ocultar buscador">
        <Icon name="close" size={12} />
      </button>
    </div>
  );
}
