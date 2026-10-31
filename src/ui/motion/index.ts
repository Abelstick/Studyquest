/** Movimiento de la app: importa desde aquí, nunca directamente de `gsap`, para que los plugins estén registrados. */
export { DUR, EASE, appReducedMotion, canAnimate, gsap, useGSAP, withMotion } from './gsap';
export { useFlipReorder, useInsertCoinTitle, useLevelUpIntro, useStageParallax } from './hooks';
export { Scramble } from './Scramble';
