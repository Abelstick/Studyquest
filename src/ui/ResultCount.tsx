import { useEffect, useState } from 'react';

interface Props {
  /** Cuántos elementos quedan tras buscar o filtrar. */
  count: number;
  /** Qué son, en plural: «hábitos», «cursos». */
  what: string;
  /** Hay una búsqueda o un filtro activo; sin él no se anuncia nada. */
  active: boolean;
}

/**
 * Anuncia a los lectores de pantalla cuántos resultados dejó un filtro («3 hábitos coinciden»), porque la lista
 * cambia sin mover el foco (WCAG 4.1.3). No se ve. Espera un instante para no anunciar cada letra que se escribe.
 */
export function ResultCount({ count, what, active }: Readonly<Props>) {
  const [text, setText] = useState('');
  useEffect(() => {
    if (!active) {
      setText('');
      return;
    }
    const t = setTimeout(() => setText(count === 0 ? `Ningún resultado en ${what}.` : `${count} ${count === 1 ? 'resultado' : 'resultados'} en ${what}.`), 400);
    return () => clearTimeout(t);
  }, [count, what, active]);
  return (
    <p className="sr-only" role="status">
      {text}
    </p>
  );
}
