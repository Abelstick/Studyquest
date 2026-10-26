import { useMemo } from 'react';
import { useData } from '@/state';
import { shortDate } from '@/core/dates';
import type { Course } from '@/core/domain';
import { courseDeadline } from '@/core/courseDeadline';
import { courseStats, weeksUntil } from '@/core/courseStats';
import { Panel, cx } from '@/ui/kit';

const hours = (min: number) => (min >= 60 ? `${+(min / 60).toFixed(1)} h` : `${min} min`);
const fmt = (n: number) => String(n).replace('.', ',');

/**
 * Cómo avanzas en este curso: las horas de las últimas 8 semanas, tus días de estudio, el ritmo de temas por
 * semana y cuándo terminarías si sigues así (frente al plazo, si lo hay).
 */
export function CourseRhythm({ course }: Readonly<{ course: Course }>) {
  const sessions = useData((s) => s.sessions);
  const tasks = useData((s) => s.tasks);
  const stats = useMemo(() => courseStats(course, sessions), [course, sessions]);
  const deadline = useMemo(() => courseDeadline(course, tasks), [course, tasks]);
  const max = Math.max(1, ...stats.weeks.map((w) => w.minutes));
  const empty = stats.weeks.every((w) => w.minutes === 0);
  const late = stats.projected && deadline.date && deadline.state !== 'late' && stats.projected > deadline.date;

  return (
    <Panel kicker="Estadísticas" title="Tu ritmo en este curso">
      {empty ? (
        <p className="muted small">Aún no hay sesiones de estudio de este curso. Con la primera empezará a dibujarse tu ritmo.</p>
      ) : (
        <div className="rbars" role="img" aria-label={`Horas por semana en las últimas ${stats.weeks.length} semanas`}>
          {stats.weeks.map((w, i) => (
            <div key={w.from} className={cx('rbars__col', i === stats.weeks.length - 1 && 'is-now')} title={`Semana del ${shortDate(w.from)}: ${hours(w.minutes)} · ${w.days} ${w.days === 1 ? 'día' : 'días'}`}>
              <i style={{ height: `${Math.max(w.minutes ? 8 : 0, Math.round((w.minutes / max) * 100))}%` }} />
              <span>{shortDate(w.from).split(' ')[0]}</span>
            </div>
          ))}
        </div>
      )}
      <dl className="kv">
        <div>
          <dt>Últimos 30 días</dt>
          <dd>
            {stats.days30} {stats.days30 === 1 ? 'día' : 'días'} · {hours(stats.minutes30)}
            {stats.trend !== 0 && <span className={cx('rtrend', stats.trend > 0 ? 'is-up' : 'is-down')}> {stats.trend > 0 ? '▲' : '▼'}</span>}
          </dd>
        </div>
        <div>
          <dt>Ritmo de temas</dt>
          <dd>{stats.pace === null ? '—' : `${fmt(stats.pace)} por semana`}</dd>
        </div>
        <div>
          <dt>Terminarías</dt>
          <dd>
            {stats.topicsLeft === 0 ? 'Ya terminaste' : stats.projected ? `${shortDate(stats.projected)} (en ~${weeksUntil(stats.projected)} sem.)` : '—'}
          </dd>
        </div>
      </dl>
      {stats.pace === null && stats.topicsLeft > 0 && <p className="muted small">Marca temas como completados y calcularemos tu ritmo con los de las últimas 4 semanas.</p>}
      {late && deadline.date && <p className="rwarn">Al ritmo actual llegarías después de tu plazo ({shortDate(deadline.date)}).</p>}
    </Panel>
  );
}
