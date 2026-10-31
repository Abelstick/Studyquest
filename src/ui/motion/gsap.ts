/**
 * Punto único de entrada a GSAP: registra los plugins una vez y define el lenguaje de movimiento de la app.
 *
 * Criterio («Recreativa de barrio»):
 * - La firma es el movimiento A 12 FPS: los momentos que importan (el siguiente paso, reordenar misiones,
 *   subir de nivel) avanzan cuadro a cuadro con `steps()`, como un sprite. Es lo que hace que la app se
 *   sienta un juego sin necesidad de decorar.
 * - Lo demás (hover, pulsar, abrir) es suave y corto con `power4.out`: por contraste, lo escalonado destaca.
 * - Nada se anima si la persona pidió menos movimiento, ni fuera del navegador (tests en jsdom, SSR).
 */
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { Flip } from 'gsap/Flip';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { SplitText } from 'gsap/SplitText';

/** Hay navegador de verdad: jsdom y el render en servidor no tienen `matchMedia`. */
export const canAnimate = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function';

gsap.registerPlugin(useGSAP, Flip, ScrambleTextPlugin, SplitText);
// ScrollTrigger consulta `matchMedia` en cuanto se registra: fuera del navegador rompería al importar.
if (canAnimate()) gsap.registerPlugin(ScrollTrigger);

export { gsap, useGSAP, Flip, ScrollTrigger, SplitText };

/** Easings con nombre: el código dice la intención, no la curva. */
export const EASE = {
  /** Microinteracciones y entradas suaves: arranca rápido y se posa. */
  out: 'power4.out',
  /** Entradas grandes: más frenada al final, se siente pesada y segura. */
  enter: 'expo.out',
  /** La firma: un sprite a 12 fps. Úsala solo en momentos que merecen atención. */
  frames: (n: number) => `steps(${n})`,
} as const;

/** Duraciones en segundos: 0.2–0.4 para tocar, 0.8–1.2 para entrar. */
export const DUR = { micro: 0.24, short: 0.4, enter: 1 } as const;

/** Segundos que dura un cuadro a 12 fps: sirve para calcular cuántos `steps` caben en una duración. */
export const FRAME = 1 / 12;
export const framesIn = (seconds: number) => Math.max(1, Math.round(seconds / FRAME));

const MOTION_OK = '(prefers-reduced-motion: no-preference)';

/** «Animaciones: reducidas» elegido en el Perfil (state/ui lo refleja en <html data-motion>), aunque el sistema no lo pida. */
export const appReducedMotion = () => typeof document !== 'undefined' && document.documentElement.dataset.motion === 'reduce';

/**
 * Ejecuta `setup` solo si la persona no pidió reducir el movimiento. Dentro de `useGSAP`, el `matchMedia`
 * queda recogido por el contexto y se revierte solo al desmontar; si la preferencia cambia en caliente,
 * las animaciones se deshacen y el contenido queda en su estado final.
 */
export function withMotion(setup: () => void | (() => void)) {
  if (!canAnimate() || appReducedMotion()) return;
  const mm = gsap.matchMedia();
  mm.add(MOTION_OK, setup);
  return mm;
}
