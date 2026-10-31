import { useRef } from 'react';
import { DUR, EASE, appReducedMotion, canAnimate, gsap, useGSAP } from './gsap';

interface Props {
  /** Texto final (normalmente una cifra ya formateada). */
  value: string;
  className?: string;
}

/**
 * Cifra de marcador: cuando cambia, los dígitos «ruedan» como en una máquina antes de fijarse (ScrambleText).
 * El primer render no se anima: solo los cambios cuentan algo.
 *
 * El texto lo escribe GSAP, no React: si React fuera dueño del nodo de texto, ScrambleText lo sustituiría
 * y la siguiente actualización de React escribiría en un nodo que ya no está en la página.
 * Los lectores de pantalla leen una copia oculta con el valor final, nunca los dígitos al azar.
 */
export function Scramble({ value, className }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const first = useRef(true);
  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const reduced = !canAnimate() || appReducedMotion() || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (first.current || reduced) {
        first.current = false;
        el.textContent = value;
        return;
      }
      gsap.to(el, { duration: DUR.short + 0.2, ease: EASE.out, scrambleText: { text: value, chars: '0123456789', speed: 0.6 } });
    },
    { dependencies: [value], scope: ref },
  );
  return (
    <span className={className}>
      <span ref={ref} aria-hidden="true" />
      <span className="sr-only">{value}</span>
    </span>
  );
}
