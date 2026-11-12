import { useEffect, useRef, type RefObject } from 'react';

/** Cuánto hay que arrastrar hacia la derecha para que cuente. */
export const SWIPE_MIN_PX = 80;
/** Hasta dónde acompaña la tarjeta al dedo. */
const SWIPE_MAX_PX = 120;
/** Movimiento a partir del cual se decide si el gesto es deslizar (horizontal) o hacer scroll (vertical). */
const DECIDE_PX = 12;

/**
 * Deslizar un elemento hacia la derecha con el dedo para ejecutar una acción (completar una misión).
 * Solo táctil: con ratón no hace nada. El scroll vertical sigue funcionando (pide `touch-action: pan-y` en CSS).
 * Mientras se arrastra lleva la clase `is-swiping` y, pasado el umbral, `is-swipe-ready`.
 */
export function useSwipe(ref: RefObject<HTMLElement | null>, onSwipe: () => void, enabled = true): void {
  // La acción cambia en cada render (lleva los datos del momento); los eventos se enganchan una sola vez.
  const action = useRef(onSwipe);
  useEffect(() => {
    action.current = onSwipe;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let id: number | null = null;
    let x0 = 0;
    let y0 = 0;
    let dx = 0;
    let swiping = false;

    const reset = () => {
      id = null;
      swiping = false;
      dx = 0;
      el.style.transform = '';
      el.classList.remove('is-swiping', 'is-swipe-ready');
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || !e.isPrimary) return;
      id = e.pointerId;
      x0 = e.clientX;
      y0 = e.clientY;
      dx = 0;
      swiping = false;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      dx = e.clientX - x0;
      const dy = Math.abs(e.clientY - y0);
      if (!swiping) {
        if (dy > DECIDE_PX && dy > Math.abs(dx)) return reset(); // es scroll
        if (dx < DECIDE_PX || dx < dy * 1.5) return;
        swiping = true;
        el.classList.add('is-swiping');
      }
      el.style.transform = `translateX(${Math.max(0, Math.min(dx, SWIPE_MAX_PX))}px)`;
      el.classList.toggle('is-swipe-ready', dx >= SWIPE_MIN_PX);
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      const done = swiping && dx >= SWIPE_MIN_PX;
      const moved = swiping;
      reset();
      if (moved) {
        // El dedo acabó sobre la tarjeta: sin esto, soltar contaría además como un toque (abriría la ficha).
        const swallow = (c: Event) => {
          c.stopPropagation();
          c.preventDefault();
        };
        el.addEventListener('click', swallow, { capture: true, once: true });
        setTimeout(() => el.removeEventListener('click', swallow, { capture: true }), 350);
      }
      if (done) action.current();
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', reset);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', reset);
      reset();
    };
  }, [ref, enabled]);
}
