import { useRef } from 'react';
import { useStageParallax } from './motion';
import { cx } from './kit';

/**
 * La pantalla del mundo: el decorado por capas (worlds.css) dentro de un marco, como la pantalla de una
 * recreativa encajada en su caja. En Inicio es alta y protagoniza; en el resto, una franja.
 * Es decorativa: no tiene contenido que leer.
 */
export function WorldStage({ tall }: { tall: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useStageParallax(ref);
  return (
    <div ref={ref} className={cx('stage', tall && 'stage--tall')} aria-hidden="true">
      <div className="stage__layer stage__skybits" />
      <div className="stage__layer stage__far" />
      <div className="stage__layer stage__mid" />
      <div className="stage__layer stage__near" />
      <div className="stage__ground" />
    </div>
  );
}
