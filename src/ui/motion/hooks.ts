/**
 * Animaciones de la app, una por intención. Todas siguen las mismas reglas:
 * - `useGSAP` con `scope`, así los selectores no se escapan del componente y todo se revierte al desmontar.
 * - Lo que dispara un evento (un clic) pasa por `contextSafe`, para que también quede recogido.
 * - `withMotion` las apaga con `prefers-reduced-motion` y fuera del navegador.
 */
import { useRef, type RefObject } from 'react';
import { DUR, EASE, Flip, ScrollTrigger, SplitText, canAnimate, framesIn, gsap, useGSAP, withMotion } from './gsap';

/**
 * LA ANIMACIÓN PROTAGONISTA · «Inserta ficha».
 * El título del siguiente paso entra letra a letra subiendo desde una ranura, cuadro a cuadro (12 fps).
 * Se repite cada vez que cambia el paso: cerrar una tarea y ver aparecer la siguiente es el momento
 * más repetido de la app, así que es donde la marca se gana la memoria.
 */
export function useInsertCoinTitle(scope: RefObject<HTMLElement | null>, selector: string, key: string) {
  useGSAP(
    () => {
      withMotion(() => {
        const split = SplitText.create(selector, {
          type: 'words,chars',
          mask: 'chars', // cada letra sale de su propia ranura: el recorte es la «boca» de la máquina
          autoSplit: true, // vuelve a partir si cambia el ancho o cargan las fuentes
          onSplit: (self) =>
            gsap.from(self.chars, {
              yPercent: 110,
              duration: 0.32,
              ease: EASE.frames(4),
              stagger: { each: 0.028, from: 'start' },
            }),
        });
        return () => split.revert();
      });
    },
    { scope, dependencies: [key], revertOnUpdate: true },
  );
}

/**
 * Reordenar con Flip. Antes de que el clic cambie los datos, `capture()` fotografía dónde está cada
 * elemento; al cambiar el orden, cada uno viaja de su sitio viejo al nuevo, cuadro a cuadro.
 * La foto caduca en un segundo: si el clic no reordenó nada, no se anima un orden posterior con datos viejos.
 * Los elementos se emparejan por `data-flip-id`: así también viaja uno que React vuelve a crear en otro
 * contenedor (una tarea que pasa de columna), no solo el que cambia de sitio dentro de la misma lista.
 */
export function useFlipReorder(scope: RefObject<HTMLElement | null>, selector: string, orderKey: string) {
  const snapshot = useRef<{ state: Flip.FlipState; at: number } | null>(null);
  const { contextSafe } = useGSAP(
    () => {
      const shot = snapshot.current;
      snapshot.current = null;
      if (!shot || performance.now() - shot.at > 1000 || !scope.current) return;
      const targets = scope.current.querySelectorAll(selector);
      withMotion(() => {
        Flip.from(shot.state, {
          targets,
          duration: DUR.short + 0.08,
          ease: EASE.frames(framesIn(0.48)),
          absolute: true, // saca los elementos del flujo mientras viajan: la lista no salta
          zIndex: 2,
        });
      });
    },
    { scope, dependencies: [orderKey] },
  );
  const capture = contextSafe(() => {
    if (!canAnimate() || !scope.current) return;
    snapshot.current = { state: Flip.getState(scope.current.querySelectorAll(selector)), at: performance.now() };
  });
  return capture;
}

/**
 * La pantalla del mundo: cada capa se mueve a su velocidad al hacer scroll (profundidad) y las nubes
 * derivan sin parar, a saltos de un cuadro, como el fondo de un juego de 16 bits.
 */
export function useStageParallax(scope: RefObject<HTMLElement | null>) {
  useGSAP(
    () => {
      withMotion(() => {
        // Lo lejano casi no se mueve; lo cercano, mucho. Esa diferencia es la que «crea» la distancia.
        const depth: [string, number][] = [
          ['.stage__skybits', 10],
          ['.stage__far', 18],
          ['.stage__mid', 32],
          ['.stage__near', 52],
        ];
        for (const [layer, px] of depth) {
          gsap.to(layer, {
            y: px,
            ease: 'none', // `scrub` ata la capa al scroll: la curva la pone el dedo, no el easing
            scrollTrigger: { trigger: scope.current, start: 'top top', end: 'bottom top', scrub: 0.4 },
          });
        }
        gsap.to('.stage__skybits', {
          backgroundPositionX: '-=1200',
          duration: 240,
          ease: EASE.frames(framesIn(240) / 4), // un salto cada 4 cuadros: deriva visible pero tranquila
          repeat: -1,
        });
        return () => ScrollTrigger.getAll().forEach((t) => t.trigger === scope.current && t.kill());
      });
    },
    { scope },
  );
}

/**
 * Subida de nivel: la tarjeta cae, el número rebota en tres cuadros y la lista de premios entra en ritmo.
 * El timeline se guarda en un ref para poder pararlo si se cierra antes de terminar.
 */
export function useLevelUpIntro(scope: RefObject<HTMLElement | null>, active: boolean) {
  const tl = useRef<gsap.core.Timeline | null>(null);
  useGSAP(
    () => {
      if (!active) return;
      withMotion(() => {
        tl.current = gsap
          .timeline({ defaults: { ease: EASE.frames(3) } })
          .from('.levelup__card', { yPercent: -18, autoAlpha: 0, duration: 0.25 })
          .from('.levelup__level', { yPercent: -160, duration: 0.25 }, '<0.1')
          .to('.levelup__level', { keyframes: { yPercent: [-14, 0, -5, 0] }, duration: 0.33 })
          .from('.levelup__list li', { xPercent: -8, autoAlpha: 0, duration: 0.25, stagger: 0.08, ease: EASE.out }, '-=0.1');
        return () => tl.current?.kill();
      });
    },
    { scope, dependencies: [active], revertOnUpdate: true },
  );
}
