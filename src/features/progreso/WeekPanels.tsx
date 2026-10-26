import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { addDays, shortDate, today, weekStart } from '@/core/dates';
import { weeklyReport } from '@/core/stats';
import { buildWeekReview, reviewWeekFor } from '@/core/weekReview';
import { CITY_MAX } from '@/core/city';
import type { ISODate, Snapshot } from '@/core/domain';
import { useCity } from '@/features/ciudad/useCity';
import { Button, Panel, cx } from '@/ui/kit';
import { PixelArt } from '@/ui/PixelArt';
import { buildingRows } from '@/ui/city-art';

/**
 * Resumen de la semana en curso, con la puerta a la revisión semanal. El cumplimiento sale de la misma cuenta que la
 * revisión (días que tocaban, sin contar los de antes de crear el hábito), así ambos números coinciden.
 */
export function WeeklyReport({ snap, onReview }: { snap: Snapshot; onReview: (week: ISODate) => void }) {
  const r = useMemo(() => weeklyReport(snap), [snap]);
  const review = useMemo(() => buildWeekReview(snap, weekStart(today())), [snap]);
  const due = review.habits.reduce((a, h) => a + h.due, 0);
  const compliance = due ? Math.round(review.habits.reduce((a, h) => a + h.pct * h.due, 0) / due) : 0;
  const now = today();
  const suggested = reviewWeekFor(now);
  const last = snap.profile.reviews?.at(-1);
  const cells: [string, string, boolean?][] = [
    ['Horas', r.hours.toFixed(1)],
    ['Tareas', String(r.tasks)],
    ['Hábitos', String(r.habitsDone)],
    ['XP ganado', r.xp.toLocaleString('en-US'), true],
    ['Días activos', `${r.days}/7`],
    ['Cumplimiento', due ? `${compliance}%` : '—', true],
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
      <div className="row">
        <Button small variant="primary" onClick={() => onReview(suggested ?? weekStart(now))}>
          Revisar mi semana
        </Button>
        {suggested !== addDays(weekStart(now), -7) && (
          <Button small variant="ghost" onClick={() => onReview(addDays(weekStart(now), -7))}>
            Revisar la anterior
          </Button>
        )}
      </div>
      <p className="muted small">{last ? `Última revisión guardada: semana del ${shortDate(last.week)}.` : 'Aún no has hecho ninguna revisión. Dos minutos bastan: qué avanzó, qué mover y qué priorizar.'}</p>
    </Panel>
  );
}

/** Resumen de tu ciudad: los seis edificios y cuál está más cerca de mejorar (antes vivía en Inicio). */
export function CityMini() {
  const city = useCity();
  return (
    <Panel kicker="Tu ciudad" title={city.title.name} right={<span className="kicker">{city.total} / {CITY_MAX}</span>}>
      {/* El nombre del enlace sale de su contenido: cada edificio dice cómo se llama y su nivel (WCAG 2.5.3). */}
      <Link to="/ciudad" className="citymini">
        {city.states.map((s) => (
          <span key={s.building.id} className="citymini__b" title={`${s.building.name}: nivel ${s.level}`}>
            <PixelArt rows={buildingRows(s.building.id, s.level)} size={64} />
            <span className="sr-only">{s.building.name}: </span>
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
