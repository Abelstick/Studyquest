import { useLayoutEffect, useRef, type HTMLAttributes, type KeyboardEvent } from 'react';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'role' | 'onKeyDown'>;

const KEYS = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];

/**
 * Grupo de opciones con el teclado del patrón «radio» de WAI-ARIA: una sola parada con Tab (la opción marcada), las
 * flechas mueven y marcan, Inicio y Fin saltan a los extremos. Los hijos son botones con `role="radio"` y
 * `aria-checked`; el grupo solo se encarga del foco (WCAG 2.1.1 y 4.1.2).
 */
export function RadioGroup({ children, ...rest }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const radios = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="radio"]:not(:disabled)') ?? []);

  // Tabulación itinerante: solo la opción marcada (o la primera, si no hay ninguna) entra en el orden de Tab.
  useLayoutEffect(() => {
    const all = radios();
    const on = all.find((r) => r.getAttribute('aria-checked') === 'true') ?? all[0];
    all.forEach((r) => {
      r.tabIndex = r === on ? 0 : -1;
    });
  });

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!KEYS.includes(e.key)) return;
    const all = radios();
    const i = all.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    e.preventDefault();
    let next = i;
    if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = all.length - 1;
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % all.length;
    else next = (i - 1 + all.length) % all.length;
    all[next].focus();
    all[next].click();
  };

  return (
    <div ref={ref} role="radiogroup" onKeyDown={onKeyDown} {...rest}>
      {children}
    </div>
  );
}
