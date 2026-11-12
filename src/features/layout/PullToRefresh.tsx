import { useEffect, useRef } from 'react';
import { useUi } from '@/state/ui';
import { Icon } from '@/ui/Icon';

/** Cuánto hay que tirar (ya amortiguado) para que al soltar se actualice. */
const PULL_MIN_PX = 64;
const PULL_MAX_PX = 96;
/** El dedo recorre el doble de lo que baja el indicador: se siente con resistencia. */
const DAMPING = 0.5;
/** Lo mínimo que se ve «Actualizando…», para que no sea un parpadeo. */
const MIN_BUSY_MS = 500;

const overlayOpen = (): boolean => {
  const s = useUi.getState();
  return !!(s.modal || s.notifOpen || s.navOpen || s.levelUp || s.victory);
};

/** ¿El gesto empezó dentro de algo con scroll propio que no está arriba del todo? Entonces es su scroll, no el nuestro. */
const insideScrolled = (target: EventTarget | null): boolean => {
  for (let el = target instanceof Element ? target : null; el && el !== document.body; el = el.parentElement) if (el.scrollTop > 0) return true;
  return false;
};

/**
 * Tirar hacia abajo desde lo alto de la página para volver a leer los datos (solo táctil).
 * El indicador se mueve escribiendo en el DOM, no con estado: así el gesto no vuelve a pintar toda la app.
 */
export function PullToRefresh({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let x0 = 0;
    let y0 = 0;
    let pull = 0;
    let tracking = false;
    let busy = false;

    const show = (px: number) => {
      pull = px;
      el.style.setProperty('--ptr-y', `${px}px`);
      el.classList.toggle('is-on', px > 0);
      el.classList.toggle('is-ready', px >= PULL_MIN_PX);
    };
    const onStart = (e: TouchEvent) => {
      tracking = !busy && e.touches.length === 1 && window.scrollY <= 0 && !overlayOpen() && !insideScrolled(e.target);
      if (!tracking) return;
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const dy = e.touches[0].clientY - y0;
      const dx = Math.abs(e.touches[0].clientX - x0);
      // Se soltó hacia arriba, de lado, o la página ya se movió: deja de ser «tirar para actualizar».
      if (dy <= 0 || dx > dy || window.scrollY > 0) {
        if (pull > 0) show(0);
        tracking = dy > 0 && dx <= dy && window.scrollY <= 0;
        return;
      }
      show(Math.min(PULL_MAX_PX, dy * DAMPING));
    };
    const onEnd = () => {
      if (!tracking) return;
      tracking = false;
      if (pull < PULL_MIN_PX) return show(0);
      busy = true;
      show(PULL_MIN_PX);
      el.classList.add('is-busy');
      const started = Date.now();
      const finish = () =>
        setTimeout(
          () => {
            busy = false;
            el.classList.remove('is-busy');
            show(0);
          },
          Math.max(0, MIN_BUSY_MS - (Date.now() - started)),
        );
      // `refresh` del store no rechaza (sin red deja la pantalla como está); por si acaso, el indicador siempre se retira.
      onRefresh().then(finish, finish);
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [onRefresh]);

  return (
    <div ref={ref} className="ptr" role="status" aria-live="polite">
      <Icon name="play" size={12} className="ptr__icon" />
      <span className="ptr__pull">Suelta para actualizar</span>
      <span className="ptr__busy">Actualizando…</span>
    </div>
  );
}
