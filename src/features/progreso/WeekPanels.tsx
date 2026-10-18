import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { addDays, shortDate, today, weekStart } from '@/core/dates';
import { isDueOn } from '@/core/game';
import { weeklyReport } from '@/core/stats';
import { CITY_MAX } from '@/core/city';
import type { Snapshot } from '@/core/domain';
import { useCity } from '@/features/ciudad/useCity';
import { Panel, cx } from '@/ui/kit';
import { PixelArt } from '@/ui/PixelArt';
import { buildingRows } from '@/ui/city-art';

/** Resumen de la semana en curso (antes vivía en Inicio). */
export function WeeklyReport({ snap }: { snap: Snapshot }) {
  const r = useMemo(() => weeklyReport(snap), [snap]);
  const habitsDue = useMemo(() => {
    const now = today();
    let n = 0;
    for (let d = weekStart(now); d <= now; d = addDays(d, 1)) n += snap.habits.filter((h) => isDueOn(h, d, snap.habitLogs)).length;
    return n;
  }, [snap.habits, snap.habitLogs]);
  const compliance = habitsDue ? Math.min(100, Math.round((r.habitsDone / habitsDue) * 100)) : 0;
  const cells: [string, string, boolean?][] = [
    ['Horas', r.hours.toFixed(1)],
    ['Tareas', String(r.tasks)],
    ['Hábitos', String(r.habitsDone)],
    ['XP ganado', r.xp.toLocaleString('en-US'), true],
    ['Días activos', `${r.days}/7`],
    ['Cumplimiento', `${compliance}%`, true],
  ];
  return (
    <Panel title="Informe semanal" kicker={`Semana del ${shortDate(r.from)}`}>
      <dl className="stat-grid">
        {cells.map(([k, v, hot]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd className={cx(hot && 'is-hot')}>{v}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

/** Resumen de tu ciudad: los seis edificios y cuál está más cerca de mejorar (antes vivía en Inicio). */
export function CityMini() {
  const city = useCity();
  return (
    <Panel kicker="// Tu ciudad" title={city.title.name} right={<span className="kicker">{city.total} / {CITY_MAX}</span>}>
      <Link to="/ciudad" className="citymini" aria-label="Ver mi ciudad">
        {city.states.map((s) => (
          <span key={s.building.id} className="citymini__b" title={`${s.building.name}: nivel ${s.level}`}>
            <PixelArt rows={buildingRows(s.building.id, s.level)} size={64} />
            <span className="citymini__lv">{s.level === 0 ? '—' : `Nv ${s.level}`}</span>
          </span>
        ))}
      </Link>
      {city.closest ? (
        <p className="muted small">
          Tu <b>{city.closest.building.name.toLowerCase()}</b> está al <b>{city.closest.pct}%</b> de mejorar: te {city.closest.left === 1 ? 'falta' : 'faltan'} {city.closest.left} {city.closest.building.unit}.
        </p>
      ) : (
        <p className="muted small">¡Todos tus edificios están al máximo!</p>
      )}
    </Panel>
  );
}
