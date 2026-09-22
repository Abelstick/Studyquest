import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { addDays, today, weekStart, WEEKDAYS_SHORT, shortDate } from '@/core/dates';
import { computeStreak, isDueOn, levelProgress, rankFor, worldFor } from '@/core/game';
import { dailyMissions, isReadyToFinish, missionParts, tips, type Mission } from '@/core/missions';
import { dueReviews } from '@/core/review';
import { isBoss } from '@/core/tasks';
import { activeEvents, canOpenChest, chestReward, type GameEvent } from '@/core/events';
import { weeklyReport } from '@/core/stats';
import type { Snapshot } from '@/core/domain';
import { Avatar } from '@/ui/Avatar';
import { Bar, Button, Empty, Panel, Tag, cx } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';
import { PixelArt } from '@/ui/PixelArt';
import { buildingRows } from '@/ui/city-art';
import { CITY_MAX } from '@/core/city';
import { useCity } from '@/features/ciudad/useCity';

function MissionRow({ m }: { m: Mission }) {
  const setTaskStatus = useData((s) => s.setTaskStatus);
  const setHabitValue = useData((s) => s.setHabitValue);
  const toggleSubtask = useData((s) => s.toggleSubtask);
  const toggleHabitStep = useData((s) => s.toggleHabitStep);
  const logs = useData((s) => s.habitLogs);
  const toggle = () => {
    if (m.kind === 'task') setTaskStatus(m.task.id, m.done ? 'todo' : 'done');
    else setHabitValue(m.habit.id, m.done ? 0 : m.habit.target);
  };

  // Desglose de la misión: las subtareas de la tarea o los pasos de hoy del hábito.
  const parts = missionParts(m, logs);
  const boss = m.kind === 'task' && isBoss(m.task) && parts.length > 0;
  const noun = boss ? 'golpes' : m.kind === 'task' ? 'subtareas' : 'pasos';
  const doneParts = parts.filter((p) => p.done).length;
  // Los jefes enseñan sus puntos débiles desde el principio, como en Tareas.
  const [open, setOpen] = useState(boss && !m.done);
  const togglePart = (id: string) => (m.kind === 'task' ? toggleSubtask(m.task.id, id) : toggleHabitStep(m.habit.id, id));
  // Con todo el desglose hecho no la damos por terminada sola: se resalta para que la cierres tú.
  const ready = isReadyToFinish(m, parts);

  return (
    <li className={cx('mission', m.done && 'is-done', ready && 'is-ready')}>
      <button
        type="button"
        className={cx('check', ready && 'is-ready')}
        role="checkbox"
        aria-checked={m.done}
        aria-label={`${m.done ? 'Deshacer' : 'Completar'}: ${m.title}${ready ? ' (ya tienes todo el desglose hecho)' : ''}`}
        title={ready ? '¡Todo listo! Pulsa para darla por terminada' : undefined}
        onClick={toggle}
      >
        {m.done ? '✔' : ''}
      </button>
      <div className="mission__text">
        <p className="mission__title">{m.title}</p>
        <p className="mission__sub">{m.subtitle}</p>
        {parts.length > 0 && (
          <button type="button" className={cx('tag tag--btn mission__more', ready ? 'tag--green' : 'tag--plain')} onClick={() => setOpen(!open)} aria-expanded={open} aria-label={`${open ? 'Ocultar' : 'Ver'} ${noun} de ${m.title}`}>
            {doneParts}/{parts.length} {noun} {open ? '−' : '+'}
          </button>
        )}
      </div>
      <Tag tone={m.done ? 'plain' : 'xp'}>+{m.xp} XP</Tag>
      {ready && <span className="mission__ready">¡Todo listo! Pulsa ✔ para terminarla.</span>}
      {open && parts.length > 0 && (
        <ul className="subtasks mission__subs">
          {parts.map((p) => (
            <li key={p.id}>
              <label>
                <input type="checkbox" checked={p.done} onChange={() => togglePart(p.id)} disabled={m.kind === 'task' && m.done} />
                <span className={cx(p.done && 'is-struck')}>{p.title}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function StreakCalendar() {
  const events = useData((s) => s.xpEvents);
  const profile = useData((s) => s.profile);
  const freeze = useData((s) => s.freezeToday);
  const streak = useMemo(() => computeStreak(events, profile.frozenDates), [events, profile.frozenDates]);
  const now = today();
  const start = addDays(weekStart(now), -28);
  const cells = Array.from({ length: 35 }, (_, i) => addDays(start, i));
  const frozenToday = profile.frozenDates.includes(now);

  return (
    <Panel
      title={`Racha · ${streak.current} ${streak.current === 1 ? 'día' : 'días'}`}
      right={<span className="kicker">Récord {streak.best}</span>}
    >
      <div className="cal" role="img" aria-label={`Calendario de las últimas 5 semanas. Racha actual de ${streak.current} días.`}>
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} className="cal__head">
            {WEEKDAYS_SHORT[i]}
          </span>
        ))}
        {cells.map((d) => {
          const active = streak.days.has(d);
          const frozen = profile.frozenDates.includes(d);
          return <span key={d} title={shortDate(d)} className={cx('cal__cell', active && 'is-on', frozen && 'is-frozen', d === now && 'is-today', d > now && 'is-future')} />;
        })}
      </div>
      <p className="muted small">
        {profile.streakFreezes > 0 ? (
          <>
            Tienes <b>{profile.streakFreezes}</b> {profile.streakFreezes === 1 ? 'congelador' : 'congeladores'}.{' '}
            {!frozenToday && !streak.activeToday && (
              <button type="button" className="link" onClick={freeze}>
                Congelar hoy
              </button>
            )}
          </>
        ) : (
          <>
            Compra <b>Congelar racha</b> en el <Link to="/arsenal">Arsenal</Link> por 200 monedas si el jueves se pone feo.
          </>
        )}
      </p>
    </Panel>
  );
}

/** Eventos de racha de hoy: bonus de fin de semana y progreso del combo ×2. */
function Events({ events }: { events: GameEvent[] }) {
  if (!events.length) return null;
  return (
    <div className="events">
      {events.map((e) => (
        <div key={e.id} className={cx('event', `event--${e.id}`, e.active && 'is-active')}>
          <Sprite name={e.id === 'weekend' ? 'star' : 'flower'} size={30} className={cx(e.active && 'event__pulse')} />
          <div className="event__text">
            <p className="event__title">{e.title}</p>
            <p className="event__body">{e.body}</p>
            {e.pct !== undefined && <Bar pct={e.pct} tone={e.active ? 'green' : 'yellow'} label={e.title} />}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Resumen de tu ciudad: los seis edificios y cuál está más cerca de mejorar. */
function CityMini() {
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

/** Cofre diario: un botín distinto cada día, mejor cuanto más larga es la racha. */
function DailyChest({ streak }: { streak: number }) {
  const profile = useData((s) => s.profile);
  const openChest = useData((s) => s.openChest);
  const open = canOpenChest(profile);
  const preview = chestReward(today(), streak);
  return (
    <Panel kicker="// Botín del día" title="Cofre diario">
      <div className={cx('chestbox', !open && 'is-open')}>
        <Sprite name="chest" size={64} className={cx(open && 'chestbox__sprite')} />
        <div>
          {open ? (
            <>
              <p className="muted small">Hay un cofre esperándote. Tu racha de {streak} {streak === 1 ? 'día' : 'días'} mejora el botín (+{Math.min(30, streak) * 2} monedas).</p>
              <Button variant="coin" onClick={openChest}>
                Abrir cofre
              </Button>
            </>
          ) : (
            <>
              <p className="list__title">¡Cofre abierto hoy!</p>
              <p className="muted small">Vuelve mañana por otro. Llevas {profile.chests ?? 0} {(profile.chests ?? 0) === 1 ? 'cofre' : 'cofres'} en total.</p>
            </>
          )}
        </div>
      </div>
      {open && <p className="kicker">Botín de hoy: desde {preview.coins} monedas</p>}
    </Panel>
  );
}

function WeeklyReport({ snap }: { snap: Snapshot }) {
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

export default function Inicio() {
  const profile = useData((s) => s.profile);
  const tasks = useData((s) => s.tasks);
  const habits = useData((s) => s.habits);
  const habitLogs = useData((s) => s.habitLogs);
  const courses = useData((s) => s.courses);
  const goals = useData((s) => s.goals);
  const projects = useData((s) => s.projects);
  const personalRewards = useData((s) => s.personalRewards);
  const sessions = useData((s) => s.sessions);
  const xpEvents = useData((s) => s.xpEvents);
  const notifications = useData((s) => s.notifications);
  const openModal = useUi((s) => s.openModal);

  const snap: Snapshot = useMemo(
    () => ({ profile, tasks, habits, habitLogs, courses, goals, projects, personalRewards, sessions, xpEvents, notifications }),
    [profile, tasks, habits, habitLogs, courses, goals, projects, personalRewards, sessions, xpEvents, notifications],
  );
  const missions = useMemo(() => dailyMissions(snap), [snap]);
  const review = useMemo(() => dueReviews(snap), [snap]);
  const events = useMemo(() => activeEvents(habits, habitLogs, profile), [habits, habitLogs, profile]);
  const advice = useMemo(() => tips(snap), [snap]);
  const streak = useMemo(() => computeStreak(xpEvents, profile.frozenDates).current, [xpEvents, profile.frozenDates]);

  const lp = levelProgress(profile.xp);
  const done = missions.filter((m) => m.done).length;
  const inPlay = missions.filter((m) => !m.done).reduce((a, m) => a + m.xp, 0);
  const time = new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  const isEmpty = !tasks.length && !habits.length && !courses.length;

  return (
    <div className="stack">
      <section className="hero panel">
        <div className="hero__stripe" aria-hidden="true" />
        <div className="hero__body">
          <div className="hero__who">
            <Avatar profile={profile} size={76} />
            <div>
              <p className="kicker">Sesión activa · {time}</p>
              <h1 className="hero__hi">Buenas, {profile.displayName}</h1>
              <p className="hero__rank">
                Nivel {lp.level} — <b>{rankFor(lp.level)}</b> · Mundo {worldFor(lp.level)}
              </p>
            </div>
          </div>
          <dl className="scoreboard">
            <div>
              <dt>XP total</dt>
              <dd>{profile.xp.toLocaleString('en-US')}</dd>
            </div>
            <div>
              <dt>Racha</dt>
              <dd className="is-hot">
                <Sprite name="fire" size={20} /> {streak}
              </dd>
            </div>
            <div>
              <dt>Monedas</dt>
              <dd>
                <Sprite name="coin" size={18} /> {profile.credits.toLocaleString('en-US')}
              </dd>
            </div>
          </dl>
        </div>
        <div className="hero__progress">
          <div className="hero__progress-head">
            <p className="kicker">
              Siguiente mundo — Nvl {lp.level + 1} · {rankFor(lp.level + 1)}
            </p>
            <p className="hero__xp">
              <b>{lp.into.toLocaleString('en-US')}</b> / {lp.needed.toLocaleString('en-US')} XP
            </p>
          </div>
          <Bar pct={lp.pct} tone="yellow" tall label="Progreso al siguiente nivel" />
          <p className="muted small">
            Faltan {lp.left.toLocaleString('en-US')} XP — {inPlay >= lp.left ? 'tus misiones de hoy alcanzan' : 'dos misiones y un café'}.
          </p>
        </div>
      </section>

      {isEmpty ? (
        <Panel>
          <Empty sprite="qblock" title="Todavía no hay bloques ? por romper">
            <p>Crea tu primera tarea, hábito o curso para empezar a ganar XP.</p>
            <div className="row">
              <Button variant="primary" onClick={() => openModal({ type: 'task' })}>
                Nueva tarea
              </Button>
              <Button onClick={() => openModal({ type: 'habit' })}>Nuevo hábito</Button>
              <Button onClick={() => openModal({ type: 'course' })}>Nuevo curso</Button>
            </div>
          </Empty>
        </Panel>
      ) : (
        <div className="cols">
          <div className="stack">
            <Events events={events} />
            <Panel kicker="// Quest diaria" title="Tu misión de hoy" right={<span className="kicker">{done} / {missions.length} · {inPlay} XP en juego</span>}>
              {missions.length === 0 ? (
                <Empty sprite="star" title="¡Nivel despejado!">
                  <p>No hay nada pendiente para hoy.</p>
                </Empty>
              ) : (
                <ul className="missions">
                  {missions.map((m) => (
                    <MissionRow key={m.id} m={m} />
                  ))}
                </ul>
              )}
              <div className="row row--top">
                <Link className="btn btn--ghost" to="/tareas">
                  Ver todas las tareas
                </Link>
                <Button onClick={() => openModal({ type: 'session' })}>▶ Iniciar sesión de estudio</Button>
                <Link className="btn btn--ghost" to="/pomodoro">
                  <Sprite name="tomato" size={16} /> Pomodoro
                </Link>
              </div>
            </Panel>

            <Panel
              kicker="// Repaso espaciado"
              title="Flashcards de hoy"
              right={
                review.length > 0 ? (
                  <Link className="btn btn--primary btn--sm" to="/repaso">
                    Repasar ahora ({review.length})
                  </Link>
                ) : undefined
              }
            >
              {review.length === 0 ? (
                <p className="muted">Nada que repasar hoy. Marca un tema con «Necesito repasar» dentro de un curso y volverá a los 1, 3, 7 y 14 días.</p>
              ) : (
                <ul className="list">
                  {review.slice(0, 4).map((r) => (
                    <li key={r.topicId} className="list__row">
                      <div>
                        <p className="list__title">{r.title}</p>
                        <p className="muted small">
                          {r.late > 0 ? `Atrasado ${r.late} ${r.late === 1 ? 'día' : 'días'}` : 'Toca hoy'} · {r.course}
                        </p>
                      </div>
                      <Link className="btn btn--ghost btn--sm" to={`/cursos/${r.courseId}`}>
                        Ver curso
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <div className="row row--top">
                <span className="kicker">Sesión rápida</span>
                {[5, 10, 20, 30].map((m) => (
                  <button key={m} type="button" className="chip" onClick={() => openModal({ type: 'session', minutes: m })}>
                    {m} min
                  </button>
                ))}
              </div>
            </Panel>
          </div>

          <div className="stack">
            <DailyChest streak={streak} />
            <CityMini />
            <StreakCalendar />
            <WeeklyReport snap={snap} />
            <Panel kicker="// Inteligencia táctica" title="Consejos del Toad">
              <ul className="tips">
                {advice.map((t) => (
                  <li key={t.title} className="tip">
                    <p className="tip__title">{t.title}</p>
                    <p className="muted small">{t.body}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
