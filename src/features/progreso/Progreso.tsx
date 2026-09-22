import { useMemo, useState } from 'react';
import { useData } from '@/state';
import type { Snapshot } from '@/core/domain';
import { addDays, shortDate, today, weekStart } from '@/core/dates';
import { computeStreak } from '@/core/game';
import { computeStats, timeDistribution, weeklyHours, xpByDay } from '@/core/stats';
import { PageHead, Panel, Segmented, cx } from '@/ui/kit';

type Range = '90' | '180' | 'all';
const RANGES: { value: Range; label: string }[] = [
  { value: '90', label: '90 días' },
  { value: '180', label: '6 meses' },
  { value: 'all', label: 'Todo' },
];
const DIST_TONES = ['var(--red)', 'var(--green)', 'var(--blue)', 'var(--yellow)', 'var(--violet)', 'var(--ink-soft)'];

const level = (xp: number) => (xp <= 0 ? 0 : xp < 50 ? 1 : xp < 120 ? 2 : xp < 220 ? 3 : 4);

export default function Progreso() {
  const profile = useData((s) => s.profile);
  const tasks = useData((s) => s.tasks);
  const habits = useData((s) => s.habits);
  const habitLogs = useData((s) => s.habitLogs);
  const courses = useData((s) => s.courses);
  const goals = useData((s) => s.goals);
  const projects = useData((s) => s.projects);
  const personalRewards = useData((s) => s.personalRewards);
  const certifications = useData((s) => s.certifications);
  const sessions = useData((s) => s.sessions);
  const xpEvents = useData((s) => s.xpEvents);
  const notifications = useData((s) => s.notifications);
  const [range, setRange] = useState<Range>('90');

  const snap: Snapshot = useMemo(
    () => ({ profile, tasks, habits, habitLogs, courses, goals, projects, certifications, personalRewards, sessions, xpEvents, notifications }),
    [profile, tasks, habits, habitLogs, courses, goals, projects, certifications, personalRewards, sessions, xpEvents, notifications],
  );
  const now = today();

  const view = useMemo(() => {
    const stats = computeStats(snap);
    const streak = computeStreak(xpEvents, profile.frozenDates);
    const since = range === 'all' ? null : addDays(now, -Number(range));
    const inRange = sessions.filter((s) => !since || s.date >= since);
    const hoursInRange = inRange.reduce((a, s) => a + s.minutes, 0) / 60;
    const firstSession = sessions.reduce<string | null>((m, s) => (m === null || s.date < m ? s.date : m), null);
    const weeksAll = firstSession ? Math.ceil((Date.parse(weekStart(now)) - Date.parse(weekStart(firstSession))) / (7 * 86_400_000)) + 1 : 8;
    const weekCount = range === '90' ? 12 : range === '180' ? 26 : Math.min(52, Math.max(8, weeksAll));
    const weeks = weeklyHours(snap, weekCount);
    const max = Math.max(1, ...weeks.map((w) => w.hours));
    const dist = timeDistribution(snap, since);
    const perDay = xpByDay(snap);
    const start = addDays(weekStart(now), -19 * 7);
    const heat = Array.from({ length: 140 }, (_, i) => {
      const date = addDays(start, Math.floor(i / 7) * 7 + (i % 7));
      return { date, lvl: date > now ? -1 : level(perDay.get(date) ?? 0), xp: perDay.get(date) ?? 0 };
    });
    const weekXp = xpEvents.filter((e) => e.date >= weekStart(now) && e.amount > 0).reduce((a, e) => a + e.amount, 0);
    const weekHours = weeks[weeks.length - 1]?.hours ?? 0;
    const milestones = goals.reduce((a, g) => a + g.milestones.length, 0);
    const openProjects = projects.length - stats.projectsCompleted;
    return { stats, streak, hoursInRange, weeks, max, dist, heat, weekXp, weekHours, milestones, openProjects };
  }, [snap, range, now, xpEvents, profile.frozenDates, sessions, goals, projects]);

  const { stats } = view;
  const big: { k: string; v: string; d: string; hot?: boolean }[] = [
    { k: 'XP histórico', v: stats.xp.toLocaleString('en-US'), d: `+${view.weekXp.toLocaleString('en-US')} esta semana`, hot: true },
    { k: 'Horas estudiadas', v: view.hoursInRange.toFixed(0), d: `+${view.weekHours.toFixed(1)} esta semana`, hot: true },
    { k: 'Racha actual', v: String(view.streak.current), d: `récord ${view.streak.best}` },
    { k: 'Tareas completadas', v: String(stats.tasksDone), d: `${tasks.filter((t) => t.status !== 'done').length} abiertas` },
    { k: 'Hitos alcanzados', v: `${stats.milestonesDone} / ${view.milestones}`, d: goals.length ? `${goals.length} ${goals.length === 1 ? 'meta' : 'metas'}` : 'sin metas' },
    { k: 'Proyectos', v: String(stats.projectsCompleted), d: `${view.openProjects} en curso` },
  ];

  return (
    <div className="stack">
      <PageHead kicker="// Hoja de personaje" title="Progreso" sprite="star" right={<Segmented label="Rango de fechas" value={range} options={RANGES} onChange={setRange} />} />

      <dl className="bigstats">
        {big.map((s) => (
          <div key={s.k}>
            <dt>{s.k}</dt>
            <dd>{s.v}</dd>
            <dd className={cx('bigstats__delta', s.hot && 'is-hot')}>{s.d}</dd>
          </div>
        ))}
      </dl>

      <div className="cols">
        <Panel kicker="// Horas de estudio por semana">
          <div className="bars" style={{ ['--n' as string]: view.weeks.length }}>
            {view.weeks.map((w, i) => (
              <div key={w.from} className="bars__col" title={`Semana del ${shortDate(w.from)}: ${w.hours.toFixed(1)} h`}>
                {view.weeks.length <= 14 && <span className="bars__v">{w.hours ? w.hours.toFixed(1) : ''}</span>}
                <div className={cx('bars__bar', i === view.weeks.length - 1 && 'is-now')} style={{ height: `${Math.max(w.hours ? 3 : 0, (w.hours / view.max) * 100)}%` }} />
              </div>
            ))}
          </div>
          <div className="bars__axis">
            <span>{shortDate(view.weeks[0].from)}</span>
            <span>esta semana</span>
          </div>
        </Panel>

        <Panel kicker="// Distribución del tiempo">
          {view.dist.length === 0 ? (
            <p className="muted">Registra sesiones de estudio para ver en qué inviertes el tiempo.</p>
          ) : (
            <>
              <div className="stackbar" role="img" aria-label="Distribución del tiempo por curso">
                {view.dist.map((d, i) => (
                  <span key={d.id} style={{ width: `${d.pct}%`, background: DIST_TONES[i % DIST_TONES.length] }} />
                ))}
              </div>
              <ul className="list">
                {view.dist.map((d, i) => (
                  <li key={d.id} className="list__row">
                    <span className="swatch" style={{ background: DIST_TONES[i % DIST_TONES.length] }} />
                    <span className="grow">{d.label}</span>
                    <b>{d.pct}%</b>
                    <span className="muted small dist__h">{d.hours.toFixed(0)} h</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>
      </div>

      <Panel
        kicker="// Mapa de actividad — 20 semanas"
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
        <div className="heat heat--year" role="img" aria-label="Mapa de actividad de las últimas 20 semanas">
          {view.heat.map((c) => (
            <span key={c.date} title={`${shortDate(c.date)} · ${c.xp} XP`} className={cx('heat__cell', c.lvl >= 0 ? `is-${c.lvl}` : 'is-future', c.date === now && 'is-today')} />
          ))}
        </div>
      </Panel>
    </div>
  );
}
