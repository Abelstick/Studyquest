import { useMemo } from 'react';
import { useData } from '@/state';
import { shortDate, today } from '@/core/dates';
import { yearHeat, HEAT_STEPS } from '@/core/heatmap';
import { Panel, cx } from '@/ui/kit';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** Etiquetas de los días: solo tres, para que quepan sin apretar. */
const WEEKDAY_ROWS: { row: number; label: string }[] = [
  { row: 1, label: 'Lun' },
  { row: 3, label: 'Mié' },
  { row: 5, label: 'Vie' },
];

/**
 * Mapa de calor del último año: una casilla por día, más oscura cuanto más XP dejó, con los meses arriba y
 * los días de la semana a un lado. Los días congelados van en azul. Reemplaza al mapa de 20 semanas.
 */
export function ActivityYear() {
  const xpEvents = useData((s) => s.xpEvents);
  const frozen = useData((s) => s.profile.frozenDates);
  const now = today();
  const heat = useMemo(() => yearHeat(xpEvents, frozen, now), [xpEvents, frozen, now]);

  // Un mes se rotula en la primera semana en la que cambia (sin pisar el rótulo anterior).
  const months = useMemo(() => {
    const out: { col: number; label: string }[] = [];
    let prev = -1;
    heat.weeks.forEach((w, i) => {
      const m = Number(w[0].date.slice(5, 7)) - 1;
      if (m !== prev) {
        if (!out.length || i - out[out.length - 1].col >= 3) out.push({ col: i, label: MONTHS[m] });
        prev = m;
      }
    });
    return out;
  }, [heat]);

  return (
    <Panel
      kicker="Mapa de actividad · último año"
      right={
        <div className="legend" aria-hidden="true">
          <span className="kicker">Menos</span>
          {[0, 1, 2, 3, 4].map((l) => (
            <i key={l} className={`heat__cell is-${l}`} />
          ))}
          <span className="kicker">Más</span>
        </div>
      }
    >
      <p className="muted small">
        {heat.activeDays} {heat.activeDays === 1 ? 'día activo' : 'días activos'} en el último año
        {heat.best > 0 && ` · tu mejor día fue de ${heat.best.toLocaleString('es')} XP`}. Más oscuro desde {HEAT_STEPS[1]} XP.
      </p>
      <div className="yheat" role="img" aria-label={`Mapa de actividad del último año: ${heat.activeDays} días activos`}>
        <div className="yheat__months" aria-hidden="true">
          {months.map((m) => (
            <span key={m.col} style={{ gridColumn: `${m.col + 2} / span 4` }}>
              {m.label}
            </span>
          ))}
        </div>
        <div className="yheat__body">
          <div className="yheat__days" aria-hidden="true">
            {WEEKDAY_ROWS.map((d) => (
              <span key={d.label} style={{ gridRow: d.row }}>
                {d.label}
              </span>
            ))}
          </div>
          <div className="yheat__grid">
            {heat.weeks.flatMap((w) =>
              w.map((c) => (
                <span
                  key={c.date}
                  title={`${shortDate(c.date)} · ${c.xp} XP${c.frozen ? ' · día congelado' : ''}`}
                  className={cx('heat__cell', c.future ? 'is-future' : `is-${c.level}`, c.frozen && !c.future && c.level === 0 && 'is-frozen', c.date === now && 'is-today')}
                />
              )),
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}
