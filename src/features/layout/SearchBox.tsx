import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '@/state';
import { SEARCH_MIN, searchAll } from '@/core/search';
import { cx } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';

interface Props {
  /** En línea (dentro del menú «＋» del móvil): los resultados van debajo, sin desplegable flotante. */
  inline?: boolean;
  /** Se llama tras elegir un resultado (por ejemplo, para cerrar el modal que contiene la búsqueda). */
  onNavigate?: () => void;
  autoFocus?: boolean;
  /** id del campo, para que un atajo de teclado pueda enfocarlo. */
  id?: string;
}

/** Búsqueda global: cada resultado lleva a su destino exacto (ver core/search.ts). */
export function SearchBox({ inline, onNavigate, autoFocus, id }: Props) {
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const courses = useData((s) => s.courses);
  const tasks = useData((s) => s.tasks);
  const habits = useData((s) => s.habits);
  const notes = useData((s) => s.notes);
  const goals = useData((s) => s.goals);
  const projects = useData((s) => s.projects);
  const results = useMemo(() => searchAll({ courses, tasks, habits, notes, goals, projects }, q), [q, courses, tasks, habits, notes, goals, projects]);
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const open = q.trim().length >= SEARCH_MIN;
  const listId = inline ? 'search-results-inline' : 'search-results';

  const go = (to: string) => {
    setQ('');
    navigate(to);
    onNavigate?.();
  };
  /** Flechas: del campo al primer resultado y entre resultados; Escape vuelve al campo y limpia. */
  const moveFocus = (e: KeyboardEvent<HTMLElement>, from: number) => {
    const items = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = e.key === 'ArrowDown' ? Math.min(items.length - 1, from + 1) : from - 1;
      if (next < 0) inputRef.current?.focus();
      else items[next]?.focus();
    } else if (e.key === 'Escape' && q) {
      // Con texto, Escape solo limpia (no cierra el modal que la contenga).
      e.stopPropagation();
      setQ('');
      inputRef.current?.focus();
    }
  };

  return (
    <div className={cx('search', inline && 'search--inline')}>
      <Sprite name="ring" size={16} />
      <input
        ref={inputRef}
        id={id}
        className="search__input"
        type="search"
        placeholder="Buscar tareas, cursos…"
        aria-label="Buscar"
        aria-expanded={open}
        aria-controls={listId}
        autoFocus={autoFocus}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && results[0]) go(results[0].to);
          else moveFocus(e, -1);
        }}
      />
      {open && (
        <ul className="search__results" id={listId} ref={listRef}>
          {results.length === 0 && <li className="search__empty">Nada por aquí… ¡el bloque estaba vacío!</li>}
          {results.map((r, i) => (
            <li key={r.key}>
              <button type="button" onClick={() => go(r.to)} onKeyDown={(e) => moveFocus(e, i)}>
                <span className="tag tag--plain">{r.kind}</span> {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
