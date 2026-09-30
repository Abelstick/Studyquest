import { useMemo, useState } from 'react';
import { useData } from '@/state';
import type { Snapshot } from '@/core/domain';
import { addDays, shortDate, today, weekStart } from '@/core/dates';
import { computeStreak, levelProgress, monthlyCompliance, rankFor } from '@/core/game';
import { ACHIEVEMENTS, achievementById } from '@/core/achievements';
import type { SpriteName } from '@/ui/sprites';
import { Sprite } from '@/ui/Sprite';
import { computeStats, hoursBetween, timeDistribution, weeklyHours, weeklyXp, xpBetween, xpBySource, xpByDay, xpByWeekday } from '@/core/stats';
import { Bar, PageHead, Panel, Segmented, cx } from '@/ui/kit';
import { ChartCard, ColumnChart, HBars, LineChart, Sparkline } from './charts';

type Range = '30' | '90' | '180' | 'all';
const RANGES: { value: Range; label: string }[] = [
  { value: '30', label: '30 días' },
  { value: '90', label: '90 días' },
  { value: '180', label: '6 meses' },
  { value: 'all', label: 'Todo' },
];
const RANGE_TEXT: Record<Range, string> = { '30': 'los últimos 30 días', '90': 'los últimos 90 días', '180': 'los últimos 6 meses', all: 'todo el historial' };
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MAX_COURSES = 5;

const SOURCE_SPRITE: Record<string, SpriteName> = { task: 'qblock', habit: 'flower', topic: 'pipe', session: 'tomato', milestone: 'flag', checkpoint: 'flag', bonus: 'star', review: 'note', combo: 'fire', certification: 'trophy', legacy: 'mushroom' };

const level = (xp: number) => (xp <= 0 ? 0 : xp < 50 ? 1 : xp < 120 ? 2 : xp < 220 ? 3 : 4);
const fmt = (n: number) => Math.round(n).toLocaleString('es');
const hours = (n: number) => `${+n.toFixed(1)} h`;

/** Cambio respecto al periodo anterior, dicho en claro; null si no hay con qué comparar. */
function delta(now: number, before: number): { text: string; tone: 'up' | 'down' | 'flat' } | null {
  if (before <= 0) return now > 0 ? { text: 'Sin periodo previo con que comparar', tone: 'flat' } : null;
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return { text: 'Igual que el periodo anterior', tone: 'flat' };
  return { text: `${pct > 0 ? '▲ +' : '▼ '}${pct}% vs periodo anterior`, tone: pct > 0 ? 'up' : 'down' };
}

interface TileProps {
  label: string;
  value: string;
  note: string;
  change?: ReturnType<typeof delta>;
  spark?: number[];
  sprite?: SpriteName;
}
function StatTile({ label, value, note, change, spark, sprite }: TileProps) {
  return (
    <div className="kpi">
      <p className="kpi__label">
        {sprite && <Sprite name={sprite} size={18} />} {label}
      </p>
      <p className="kpi__value">{value}</p>
      {change ? <p className={cx('kpi__delta', `is-${change.tone}`)}>{change.text}</p> : <p className="kpi__delta">{note}</p>}
      {spark && spark.length > 1 && <Sparkline values={spark} />}
    </div>
  );
}

export default function Progreso() {
  const profile = useData((s) => s.profile);
  const tasks = useData((s) => s.tasks);
  const habits = useData((s) => s.habits);
  const habitLogs = useData((s) => s.habitLogs);
  const courses = useData((s) => s.courses);
  const goals = useData((s) => s.goals);
  const projects = useData((s) => s.projects);
  const personalRewards = useData((s) => s.personalRewards);
  const notes = useData((s) => s.notes);
  const certifications = useData((s) => s.certifications);
  const sessions = useData((s) => s.sessions);
  const xpEvents = useData((s) => s.xpEvents);
  const notifications = useData((s) => s.notifications);
  const [range, setRange] = useState<Range>('90');

  const snap: Snapshot = useMemo(
    () => ({ profile, tasks, habits, habitLogs, courses, goals, projects, notes, certifications, personalRewards, sessions, xpEvents, notifications }),
    [profile, tasks, habits, habitLogs, courses, goals, projects, notes, certifications, personalRewards, sessions, xpEvents, notifications],
  );
  const now = today();

  const view = useMemo(() => {
    const stats = computeStats(snap);
    const streak = computeStreak(xpEvents, profile.frozenDates);
    const days = range === 'all' ? null : Number(range);
    const since = days ? addDays(now, -days) : null;
    const tomorrow = addDays(now, 1);
    const prevSince = days ? addDays(now, -2 * days) : null;

    const firstSession = sessions.reduce<string | null>((m, s) => (m === null || s.date < m ? s.date : m), null);
    const weeksAll = firstSession ? Math.ceil((Date.parse(weekStart(now)) - Date.parse(weekStart(firstSession))) / (7 * 86_400_000)) + 1 : 8;
    const weekCount = range === '30' ? 5 : range === '90' ? 13 : range === '180' ? 26 : Math.min(52, Math.max(8, weeksAll));
    const hoursWeeks = weeklyHours(snap, weekCount);
    const xpWeeks = weeklyXp(snap, weekCount);

    const xpNow = since ? xpBetween(snap, since, tomorrow) : stats.xp;
    const hrsNow = since ? hoursBetween(snap, since, tomorrow) : stats.hoursTotal;
    const xpChange = since && prevSince ? delta(xpNow, xpBetween(snap, prevSince, since)) : null;
    const hrsChange = since && prevSince ? delta(hrsNow, hoursBetween(snap, prevSince, since)) : null;

    const doneInRange = tasks.filter((t) => t.status === 'done' && t.completedAt && (!since || t.completedAt >= since)).length;
    const compliance = habits.map((h) => ({ id: h.id, title: h.title, pct: monthlyCompliance(h, habitLogs, now) })).sort((a, b) => b.pct - a.pct);
    const avgCompliance = compliance.length ? Math.round(compliance.reduce((a, c) => a + c.pct, 0) / compliance.length) : 0;

    const dist = timeDistribution(snap, since);
    const distRows = dist.length > MAX_COURSES + 1 ? [...dist.slice(0, MAX_COURSES), { id: 'rest', label: 'Otros', hours: dist.slice(MAX_COURSES).reduce((a, d) => a + d.hours, 0), pct: dist.slice(MAX_COURSES).reduce((a, d) => a + d.pct, 0), minutes: 0 }] : dist;

    const perDay = xpByDay(snap);
    const start = addDays(weekStart(now), -19 * 7);
    const heat = Array.from({ length: 140 }, (_, i) => {
      const date = addDays(start, Math.floor(i / 7) * 7 + (i % 7));
      return { date, lvl: date > now ? -1 : level(perDay.get(date) ?? 0), xp: perDay.get(date) ?? 0 };
    });

    const lp = levelProgress(profile.xp);
    const unlocked = [...profile.achievements].reverse().map((a) => achievementById(a.id)).filter((a): a is NonNullable<typeof a> => !!a);
    return {
      lp, unlocked, stats, streak, xpNow, hrsNow, xpChange, hrsChange, doneInRange, compliance, avgCompliance, dist: distRows,
      hoursWeeks, xpWeeks, bySource: xpBySource(snap, since), byWeekday: xpByWeekday(snap, since), heat,
      milestones: goals.reduce((a, g) => a + g.milestones.length, 0), openProjects: projects.length - stats.projectsCompleted,
    };
  }, [snap, range, now, xpEvents, profile.frozenDates, profile.xp, profile.achievements, sessions, goals, projects, tasks, habits, habitLogs]);

  const { stats } = view;
  const xpPoints = view.xpWeeks.map((w) => ({ label: shortDate(w.from), value: w.xp }));
  const hourPoints = view.hoursWeeks.map((w) => ({ label: shortDate(w.from), value: +w.hours.toFixed(2) }));
  const weekdayPoints = view.byWeekday.map((d) => ({ label: WEEKDAYS[d.day], value: d.avg }));
  const bestDay = view.byWeekday.reduce((a, b) => (b.avg > a.avg ? b : a), view.byWeekday[0]);

  return (
    <div className="stack dash">
      <PageHead kicker="// Hoja de personaje" title="Progreso" sprite="star" right={<Segmented label="Rango de fechas" value={range} options={RANGES} onChange={setRange} />} />

      <section className="dashhero panel" aria-label="Resumen">
        <div className="dashhero__main">
          <p className="kpi__label">
            <Sprite name="coin" size={18} /> XP histórico
          </p>
          <p className="dashhero__figure">{fmt(stats.xp)}</p>
          <p className="muted">
            {fmt(view.xpNow)} XP en {RANGE_TEXT[range]}
          </p>
          <div className="dashhero__level">
            <div className="dashhero__levelhead">
              <span>
                NVL {view.lp.level} · {rankFor(view.lp.level)}
              </span>
              <span>
                {fmt(view.lp.into)} / {fmt(view.lp.needed)}
              </span>
            </div>
            <Bar pct={view.lp.pct} tone="yellow" tall label="Progreso al siguiente nivel" />
            <p className="muted small">
              Faltan {fmt(view.lp.left)} XP para el nivel {view.lp.level + 1} · {rankFor(view.lp.level + 1)}
            </p>
          </div>
          {view.xpChange && <p className={cx('kpi__delta', `is-${view.xpChange.tone}`)}>{view.xpChange.text}</p>}
          {view.xpWeeks.length > 1 && <Sparkline values={view.xpWeeks.slice(-12).map((w) => w.xp)} />}
        </div>
        <div className="kpis">
          <StatTile sprite="tomato" label="Horas estudiadas" value={hours(view.hrsNow)} note={`en ${RANGE_TEXT[range]}`} change={view.hrsChange} spark={view.hoursWeeks.slice(-12).map((w) => w.hours)} />
          <StatTile sprite="fire" label="Racha actual" value={`${view.streak.current} ${view.streak.current === 1 ? 'día' : 'días'}`} note={`récord ${view.streak.best}`} />
          <StatTile sprite="qblock" label="Tareas completadas" value={String(view.doneInRange)} note={`${tasks.filter((t) => t.status !== 'done').length} abiertas`} />
          <StatTile sprite="flower" label="Cumplimiento de hábitos" value={habits.length ? `${view.avgCompliance}%` : '—'} note={habits.length ? 'promedio de 30 días' : 'aún sin hábitos'} />
          <StatTile sprite="chest" label="Proyectos" value={String(stats.projectsCompleted)} note={`${view.openProjects} en curso`} />
          <StatTile sprite="flag" label="Hitos alcanzados" value={`${stats.milestonesDone} / ${view.milestones}`} note={goals.length ? `${goals.length} ${goals.length === 1 ? 'meta' : 'metas'}` : 'sin metas'} />
        </div>
      </section>

      <div className="cols">
        <ChartCard sprite="coin" title="XP ganado por semana" subtitle={`Tu ritmo en ${RANGE_TEXT[range]}. La última semana sigue en curso.`} table={{ head: ['Semana', 'XP'], rows: xpPoints.map((p) => [`Semana del ${p.label}`, fmt(p.value)]) }}>
          <LineChart points={xpPoints} unit="XP" label={`XP ganado por semana en ${RANGE_TEXT[range]}`} format={fmt} />
        </ChartCard>

        <ChartCard sprite="tomato" title="Horas de estudio por semana" subtitle="La semana actual va resaltada" table={{ head: ['Semana', 'Horas'], rows: hourPoints.map((p) => [`Semana del ${p.label}`, hours(p.value)]) }}>
          <ColumnChart points={hourPoints} unit="h" label={`Horas de estudio por semana en ${RANGE_TEXT[range]}`} format={(n) => `${+n.toFixed(1)}`} />
        </ChartCard>
      </div>

      <div className="cols">
        <ChartCard sprite="chest" title="De dónde viene tu XP" subtitle={`Por fuente, en ${RANGE_TEXT[range]}`} table={{ head: ['Fuente', 'XP'], rows: view.bySource.map((s) => [s.label, `${fmt(s.xp)} (${s.pct}%)`]) }}>
          {view.bySource.length === 0 ? <p className="muted">Todavía no hay XP en este rango.</p> : <HBars rows={view.bySource.map((s) => ({ label: s.label, value: s.xp, note: `${s.pct}%`, sprite: SOURCE_SPRITE[s.source] }))} unit="XP" format={fmt} />}
        </ChartCard>

        <ChartCard sprite="castle" title="En qué inviertes el tiempo" subtitle="Horas por curso" table={{ head: ['Curso', 'Horas'], rows: view.dist.map((d) => [d.label, `${hours(d.hours)} (${d.pct}%)`]) }}>
          {view.dist.length === 0 ? <p className="muted">Registra sesiones de estudio para ver en qué inviertes el tiempo.</p> : <HBars rows={view.dist.map((d) => ({ label: d.label, value: d.hours, note: `${d.pct}%` }))} unit="h" format={(n) => `${+n.toFixed(1)}`} />}
        </ChartCard>
      </div>

      <div className="cols">
        <ChartCard sprite="flower" title="Cumplimiento por hábito" subtitle="Últimos 30 días; un día a medias cuenta en proporción" table={{ head: ['Hábito', 'Cumplimiento'], rows: view.compliance.map((c) => [c.title, `${c.pct}%`]) }}>
          {view.compliance.length === 0 ? <p className="muted">Crea un hábito para ver cómo lo llevas.</p> : <HBars rows={view.compliance.map((c) => ({ label: c.title, value: c.pct }))} unit="%" max={100} />}
        </ChartCard>

        <ChartCard
          sprite="star"
          title="Tu mejor día de la semana"
          subtitle={bestDay && bestDay.avg > 0 ? `Los ${WEEKDAYS[bestDay.day].toLowerCase()} rindes más: ${fmt(bestDay.avg)} XP de media` : 'XP medio por día de la semana'}
          table={{ head: ['Día', 'XP medio'], rows: weekdayPoints.map((p) => [p.label, fmt(p.value)]) }}
        >
          <ColumnChart points={weekdayPoints} unit="XP" label="XP medio por día de la semana" highlightLast={false} format={fmt} />
        </ChartCard>
      </div>

      <Panel kicker="// Medallas" right={<span className="kicker">{view.unlocked.length} / {ACHIEVEMENTS.length} desbloqueadas</span>}>
        {view.unlocked.length === 0 ? (
          <p className="muted">Aún no tienes medallas. Completa una tarea para conseguir la primera.</p>
        ) : (
          <ul className="medals">
            {view.unlocked.slice(0, 8).map((a) => (
              <li key={a.id} className="medal" title={`${a.title}: ${a.hint}`}>
                <Sprite name={a.sprite} size={32} />
                <span>{a.title}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

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
