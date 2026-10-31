import type { AttributeState } from '@/core/progression';
import { attrStyle } from '@/ui/Attribute';

/** Punto del eje `i` (de `n`) a la distancia `r` del centro; el primero apunta hacia arriba. */
const at = (i: number, n: number, r: number, c: number): [number, number] => {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return [c + r * Math.cos(a), c + r * Math.sin(a)];
};
const poly = (pts: [number, number][]) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

/** Escala del radar: el nivel más alto, redondeado hacia arriba a un múltiplo de 5 (mínimo 5). Crece contigo. */
export const radarScale = (levels: number[]) => Math.max(5, Math.ceil(Math.max(...levels, 1) / 5) * 5);

/**
 * La forma del personaje: seis ejes, uno por atributo, con el nivel de cada uno. Es un dibujo; los datos exactos
 * están en la hoja de abajo, así que el lector de pantalla recibe un resumen en una frase.
 */
export function AttributeRadar({ attributes, size = 280 }: Readonly<{ attributes: AttributeState[]; size?: number }>) {
  const n = attributes.length;
  const c = size / 2;
  const R = c - 34; // margen para las etiquetas
  const scale = radarScale(attributes.map((a) => a.level.level));
  const rings = [0.25, 0.5, 0.75, 1];
  // El nivel 1 ya se ve: el polígono nunca colapsa en el centro.
  const value = (a: AttributeState) => Math.max(0.06, Math.min(1, a.level.level / scale));
  const shape = attributes.map((a, i) => at(i, n, R * value(a), c));
  const label = `Forma de tu personaje: ${attributes.map((a) => `${a.def.name} ${a.level.level}`).join(', ')}.`;

  return (
    <figure className="radar">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="radar__svg">
        {rings.map((k) => (
          <polygon key={k} className={k === 1 ? 'radar__ring radar__ring--outer' : 'radar__ring'} points={poly(attributes.map((_, i) => at(i, n, R * k, c)))} />
        ))}
        {attributes.map((a, i) => {
          const [x, y] = at(i, n, R, c);
          return <line key={a.def.id} className="radar__axis" x1={c} y1={c} x2={x} y2={y} />;
        })}
        <polygon className="radar__shape" points={poly(shape)} />
        {attributes.map((a, i) => {
          const [x, y] = shape[i];
          return <rect key={a.def.id} className="radar__dot" style={attrStyle(a.def.id)} x={x - 4} y={y - 4} width={8} height={8} />;
        })}
        {attributes.map((a, i) => {
          const [x, y] = at(i, n, R + 18, c);
          const anchor = Math.abs(x - c) < 4 ? 'middle' : x > c ? 'start' : 'end';
          return (
            <text key={a.def.id} className="radar__label" x={x} y={y} textAnchor={anchor} dominantBaseline="middle">
              <tspan className="radar__short">{a.def.short}</tspan>
              <tspan className="radar__lv" dx={4}>
                {a.level.level}
              </tspan>
            </text>
          );
        })}
      </svg>
      <figcaption className="radar__caption muted small">Escala hasta el nivel {scale}: crece contigo.</figcaption>
    </figure>
  );
}
