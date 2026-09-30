import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';
import type { SpriteName } from '@/ui/sprites';

/**
 * Gráficas del dashboard de Progreso, hechas a mano en SVG/HTML sin librerías.
 * Reglas (skill dataviz): marcas finas, una sola escala, cuadrícula de 1px apenas visible, un tooltip
 * por gráfica que también sale con el teclado, y siempre una vista de tabla equivalente.
 */

export interface Point {
  label: string;
  value: number;
}

const W = 640;
const H = 220;
const PAD = { l: 44, r: 16, t: 16, b: 26 };

/** Máximo «redondo» para el eje: 0 / 25 / 50 / 100 / 250… */
export function niceMax(v: number): number {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * mag) return m * mag;
  return 10 * mag;
}

const fmtNum = (n: number) => (n >= 1000 ? `${+(n / 1000).toFixed(1)}k` : String(Math.round(n * 10) / 10));

function Tooltip({ x, y, title, value }: { x: number; y: number; title: string; value: string }) {
  return (
    <div className="viz-tip" style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` }} role="status">
      <strong>{value}</strong>
      <span>{title}</span>
    </div>
  );
}

/** Índice del mejor valor (si hay al menos dos puntos con datos y el máximo es único), para marcarlo como récord. */
export function recordIndex(points: Point[]): number | null {
  const max = Math.max(...points.map((p) => p.value));
  if (max <= 0 || points.filter((p) => p.value > 0).length < 2) return null;
  const at = points.reduce<number[]>((a, p, i) => (p.value === max ? [...a, i] : a), []);
  return at.length === 1 ? at[0] : null;
}

/** Estrella de píxeles del récord: amarilla con borde oscuro, como un power-up. */
function RecordStar({ x, y, showLabel }: { x: number; y: number; showLabel: boolean }) {
  return (
    <g aria-hidden="true">
      <polygon points={`${x},${y - 9} ${x + 3},${y - 3} ${x + 9},${y - 3} ${x + 4},${y + 1} ${x + 6},${y + 8} ${x},${y + 4} ${x - 6},${y + 8} ${x - 4},${y + 1} ${x - 9},${y - 3} ${x - 3},${y - 3}`} className="viz-star" />
      {showLabel && (
        <text x={x} y={y - 15} textAnchor="middle" className="viz-record">
          ¡RÉCORD!
        </text>
      )}
    </g>
  );
}

function Grid({ max, ticks = 4, unit }: { max: number; ticks?: number; unit: string }) {
  return (
    <g aria-hidden="true">
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const v = (max / ticks) * i;
        const y = PAD.t + (H - PAD.t - PAD.b) * (1 - i / ticks);
        return (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} className={i === 0 ? 'viz-axis' : 'viz-grid'} />
            <text x={PAD.l - 8} y={y + 4} textAnchor="end" className="viz-tick">
              {fmtNum(v)}
              {i === ticks ? ` ${unit}` : ''}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** Serie en el tiempo: línea de 2px con área tenue, cruz que sigue al puntero y punto final rotulado. */
export function LineChart({ points, unit, label, format = fmtNum }: { points: Point[]; unit: string; label: string; format?: (n: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const id = useId();
  const n = points.length;
  const max = niceMax(Math.max(...points.map((p) => p.value), 0));
  const x = (i: number) => PAD.l + (n === 1 ? (W - PAD.l - PAD.r) / 2 : (i * (W - PAD.l - PAD.r)) / (n - 1));
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / max);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${path} L${x(n - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const active = hover ?? null;
  const last = n - 1;
  const rec = recordIndex(points);

  const onMove = (clientX: number, rect: DOMRect) => {
    const px = ((clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') setHover((h) => Math.min(n - 1, (h ?? -1) + 1));
    else if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? n) - 1));
    else if (e.key === 'Escape') setHover(null);
  };
  const tickIdx = n <= 3 ? points.map((_, i) => i) : [0, Math.floor((n - 1) / 2), n - 1];

  return (
    <div className="viz-wrap" onPointerLeave={() => setHover(null)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="viz-svg"
        role="img"
        aria-label={label}
        tabIndex={0}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
        onPointerMove={(e) => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
      >
        <Grid max={max} unit={unit} />
        <path d={area} className="viz-area" />
        <path d={path} className="viz-line" />
        {tickIdx.map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === last ? 'end' : 'middle'} className="viz-tick">
            {points[i].label}
          </text>
        ))}
        {active !== null && <line x1={x(active)} x2={x(active)} y1={PAD.t} y2={y(0)} className="viz-cross" />}
        {rec !== null && <RecordStar x={x(rec)} y={y(points[rec].value)} showLabel={rec !== last} />}
        {/* Punto final, con su anillo del color de la superficie para que se lea sobre la línea. */}
        <circle cx={x(last)} cy={y(points[last].value)} r={6} className="viz-ring" />
        <circle cx={x(last)} cy={y(points[last].value)} r={4} className="viz-dot" />
        {active !== null && active !== last && (
          <>
            <circle cx={x(active)} cy={y(points[active].value)} r={6} className="viz-ring" />
            <circle cx={x(active)} cy={y(points[active].value)} r={4} className="viz-dot" />
          </>
        )}
        <text x={x(last)} y={y(points[last].value) - 12} textAnchor="end" className="viz-endlabel">
          {format(points[last].value)}
        </text>
        <rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b} fill="transparent" id={id} />
      </svg>
      {active !== null && <Tooltip x={x(active)} y={y(points[active].value)} title={points[active].label} value={`${format(points[active].value)} ${unit}`} />}
    </div>
  );
}

/** Columnas de hasta 24px con la punta redondeada y la base recta; la última (la actual) va destacada. */
export function ColumnChart({ points, unit, label, highlightLast = true, format = fmtNum }: { points: Point[]; unit: string; label: string; highlightLast?: boolean; format?: (n: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = points.length;
  const max = niceMax(Math.max(...points.map((p) => p.value), 0));
  const band = (W - PAD.l - PAD.r) / n;
  const bw = Math.min(24, band * 0.6);
  const base = H - PAD.b;
  const cx0 = (i: number) => PAD.l + band * i + band / 2;
  const top = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / max);
  const labelEvery = Math.ceil(n / 7);
  const rec = recordIndex(points);
  const brick = useId();

  return (
    <div className="viz-wrap" onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="viz-svg" role="img" aria-label={label}>
        <defs>
          {/* Costuras de ladrillo: una línea del color de la superficie cada 10px sobre cada columna. */}
          <pattern id={brick} patternUnits="userSpaceOnUse" width="24" height="10">
            <rect x="0" y="9" width="24" height="1" className="viz-seam" />
          </pattern>
        </defs>
        <Grid max={max} unit={unit} />
        {points.map((p, i) => {
          const h = base - top(p.value);
          const r = Math.min(4, h);
          const x0 = cx0(i) - bw / 2;
          const d = p.value > 0 ? `M${x0},${base} V${base - h + r} a${r},${r} 0 0 1 ${r},${-r} h${bw - 2 * r} a${r},${r} 0 0 1 ${r},${r} V${base} Z` : '';
          // Sin «semana actual» que destacar, todas las columnas llevan el color pleno.
          const isLast = !highlightLast || i === n - 1;
          return (
            <g key={i}>
              {d && <path d={d} className={cx('viz-col', isLast && 'is-last', hover === i && 'is-hover')} />}
              {d && <path d={d} fill={`url(#${brick})`} pointerEvents="none" />}
              {(i % labelEvery === 0 || i === n - 1) && (
                <text x={cx0(i)} y={H - 6} textAnchor="middle" className="viz-tick">
                  {p.label}
                </text>
              )}
              {/* Zona de puntería más ancha que la barra, con foco de teclado. */}
              <rect
                x={PAD.l + band * i}
                y={PAD.t}
                width={band}
                height={H - PAD.t - PAD.b}
                fill="transparent"
                tabIndex={0}
                role="img"
                aria-label={`${p.label}: ${format(p.value)} ${unit}`}
                onPointerEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
              />
            </g>
          );
        })}
        {rec !== null && <RecordStar x={cx0(rec)} y={top(points[rec].value) - 14} showLabel />}
        {highlightLast && points[n - 1].value > 0 && rec !== n - 1 && (
          <text x={cx0(n - 1)} y={top(points[n - 1].value) - 6} textAnchor="middle" className="viz-endlabel">
            {format(points[n - 1].value)}
          </text>
        )}
      </svg>
      {hover !== null && <Tooltip x={cx0(hover)} y={top(points[hover].value)} title={points[hover].label} value={`${format(points[hover].value)} ${unit}`} />}
    </div>
  );
}

/** Barras horizontales para comparar categorías: el valor va en la punta y todas comparten un solo color. */
export function HBars({ rows, unit, format = fmtNum, max }: { rows: { label: string; value: number; note?: string; sprite?: SpriteName }[]; unit: string; format?: (n: number) => string; max?: number }) {
  const top = max ?? Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="hbars">
      {rows.map((r) => (
        <li key={r.label} className="hbars__row" title={`${r.label}: ${format(r.value)} ${unit}`}>
          <span className="hbars__label">
            {r.sprite && <Sprite name={r.sprite} size={16} />}
            <span>{r.label}</span>
          </span>
          <span className="hbars__track">
            <span className="hbars__bar" style={{ width: `${Math.max(r.value > 0 ? 2 : 0, (r.value / top) * 100)}%` }} />
          </span>
          <span className="hbars__value">
            {format(r.value)} {unit}
            {r.note && <span className="hbars__note"> · {r.note}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Minigráfica de tendencia para una tarjeta: solo la forma, sin ejes; el último punto en el color de acento. */
export function Sparkline({ values }: { values: number[] }) {
  const w = 96;
  const h = 28;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => [values.length === 1 ? w / 2 : (i * (w - 6)) / (values.length - 1) + 3, h - 3 - (v / max) * (h - 6)] as const);
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="spark" aria-hidden="true">
      <polyline points={pts.map((p) => p.join(',')).join(' ')} className="spark__line" />
      <circle cx={lx} cy={ly} r={3} className="viz-dot" />
    </svg>
  );
}

/** Tarjeta de gráfica: título, subtítulo y un interruptor para ver los mismos datos como tabla. */
export function ChartCard({ title, subtitle, sprite, children, table }: { title: string; subtitle?: string; sprite?: SpriteName; children: ReactNode; table: { head: [string, string]; rows: [string, string][] } }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className="panel chartcard">
      <div className="chartcard__head">
        <div>
          <h2 className="chartcard__title">
            {sprite && <Sprite name={sprite} size={20} />} {title}
          </h2>
          {subtitle && <p className="muted small">{subtitle}</p>}
        </div>
        <button type="button" className="tag tag--btn tag--plain" aria-pressed={asTable} onClick={() => setAsTable(!asTable)}>
          {asTable ? 'Ver gráfica' : 'Ver tabla'}
        </button>
      </div>
      {asTable ? (
        <div className="chartcard__table">
          <table>
            <thead>
              <tr>
                <th scope="col">{table.head[0]}</th>
                <th scope="col">{table.head[1]}</th>
              </tr>
            </thead>
            <tbody>
              {table.rows.map(([a, b]) => (
                <tr key={a}>
                  <th scope="row">{a}</th>
                  <td>{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  );
}
