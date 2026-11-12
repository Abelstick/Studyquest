import { useEffect, useRef } from 'react';
import { useUi } from '@/state/ui';

/** Marca en `history.state` de la entrada que se añade mientras hay algo abierto encima de la pantalla. */
const MARK = 'sqOverlay';

const hasMark = (): boolean => !!(history.state as Record<string, unknown> | null)?.[MARK];
/** Añade la entrada conservando el estado del router (misma URL, misma clave): para él no hubo navegación. */
const pushMark = () => history.pushState({ ...(history.state as object | null), [MARK]: true }, '');

const isOpen = (): boolean => {
  const s = useUi.getState();
  return !!(s.levelUp || s.victory || s.modal || s.notifOpen || s.navOpen);
};

/** Cierra solo lo que está más arriba, en el mismo orden en que se apilan en pantalla. */
function closeTop(): void {
  const s = useUi.getState();
  if (s.levelUp) s.showLevelUp(null);
  else if (s.victory) s.showVictory(null);
  else if (s.modal) s.closeModal();
  else if (s.notifOpen) s.setNotifOpen(false);
  else if (s.navOpen) s.setNavOpen(false);
}

/**
 * El botón (o gesto) «atrás» de Android cierra lo que esté abierto —modal, menú, avisos— en vez de
 * cambiar de pantalla o salir de la app. Mientras hay algo abierto se añade una entrada al historial;
 * «atrás» la consume y cerramos. Si se cierra desde la pantalla, la entrada se retira sola.
 */
export function useBackClose(): void {
  const open = useUi((s) => !!(s.levelUp || s.victory || s.modal || s.notifOpen || s.navOpen));
  // ¿Hay una entrada nuestra en el historial? En una ref y no en la limpieza del efecto: en desarrollo
  // (StrictMode) los efectos se montan dos veces y un `history.back()` de más cerraría lo recién abierto.
  const marked = useRef(false);

  useEffect(() => {
    if (open && !marked.current) {
      pushMark();
      marked.current = true;
    } else if (!open && marked.current) {
      marked.current = false;
      // Si mientras tanto se navegó a otra pantalla, lo de arriba ya no es nuestra entrada: no se toca.
      if (hasMark()) history.back();
    }
  }, [open]);

  useEffect(() => {
    const onPop = () => {
      if (marked.current) {
        marked.current = false;
        closeTop();
        // Quedaba algo debajo (p. ej. un modal bajo la celebración de nivel): el siguiente «atrás» lo cierra.
        if (isOpen()) {
          pushMark();
          marked.current = true;
        }
      } else if (hasMark() && !isOpen()) {
        // Entrada vieja que quedó atrás tras navegar con algo abierto: se salta para que «atrás» no parezca roto.
        history.back();
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
}
