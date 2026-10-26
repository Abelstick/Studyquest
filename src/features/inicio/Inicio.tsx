import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { addDays, today, weekStart, WEEKDAYS_SHORT, shortDate } from '@/core/dates';
import { computeStreak, goalLabel, isCounter, levelProgress, logFor, rankFor } from '@/core/game';
import { dailyMissions, dayProgress, deadlineText, tips } from '@/core/missions';
import { nextStep, type NextStep } from '@/core/nextStep';
import { HabitAction, HabitMinimumButton, HabitRecovery } from '@/features/habitos/HabitAction';
import { IfThenList } from '@/ui/IfThenList';
import { LateBanner } from '@/features/tareas/LateBanner';
import { activeEvents, canOpenChest, chestReward, type GameEvent } from '@/core/events';
import type { Profile, Snapshot } from '@/core/domain';
import { Avatar } from '@/ui/Avatar';
import { Bar, Button, Empty, Panel, cx } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';
import { Icon } from '@/ui/Icon';
import { Scramble, useInsertCoinTitle } from '@/ui/motion';
import { DaySummary } from './DaySummary';
import { MissionBoard } from './MissionBoard';
import { FoldPanel } from '@/ui/Fold';
import { ConflictBanner, ReviewNudge, TodayAgenda, TodayPriorities } from './TodayPlan';
import { NowStrip } from './NowStrip';
import { StartGuide } from './StartGuide';
import { HowToButton } from '@/features/help/HowToGuide';
import { CoursesInPlay } from '@/features/cursos/CoursesInPlay';

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
    <FoldPanel
      id="home-streak"
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
    </FoldPanel>
  );
}

/** Eventos de hoy (bonus de fin de semana, combo ×2) en una línea compacta dentro de la misión. */
function Events({ events }: { events: GameEvent[] }) {
  if (!events.length) return null;
  return (
    <ul className="events-line" aria-label="Eventos de hoy">
      {events.map((e) => (
        <li key={e.id} className={cx('events-line__item', `events-line__item--${e.id}`, e.active && 'is-active')}>
          <Sprite name={e.id === 'weekend' ? 'star' : 'flower'} size={18} className={cx(e.active && 'event__pulse')} />
          <span className="events-line__text">
            <b>{e.title}</b> <span className="muted">{e.body}</span>
          </span>
          {e.pct !== undefined && <Bar pct={e.pct} tone={e.active ? 'green' : 'yellow'} label={e.title} className="events-line__bar" />}
        </li>
      ))}
    </ul>
  );
}

/** Cofre diario: un botín distinto cada día, mejor cuanto más larga es la racha. */
function DailyChest({ streak }: { streak: number }) {
  const profile = useData((s) => s.profile);
  const openChest = useData((s) => s.openChest);
  const open = canOpenChest(profile);
  const preview = chestReward(today(), streak);
  return (
    <FoldPanel id="home-chest" kicker="Botín del día" title="Cofre diario" badge={open ? '¡Por abrir!' : undefined}>
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
    </FoldPanel>
  );
}

/** Para apuntar estudio sin abrir nada: sesión guiada o minutos ya hechos. */
function QuickLog() {
  const logSession = useData((s) => s.logSession);
  const openModal = useUi((s) => s.openModal);
  return (
    <FoldPanel id="home-quicklog" className="today-actions" kicker="Registro rápido" title="Sesión de estudio">
      <div className="row">
        <Button onClick={() => openModal({ type: 'session' })}>
          <Icon name="play" size={12} /> Iniciar sesión
        </Button>
        <Link className="btn btn--ghost" to="/tareas">
          Ver todas las tareas
        </Link>
      </div>
      <div className="row">
        <span className="kicker">¿Ya estudiaste? Márcalo</span>
        {[5, 10, 20, 30].map((m) => (
          <button key={m} type="button" className="chip" onClick={() => logSession({ minutes: m, courseId: null })} title={`Registrar ${m} min de estudio ya hecho, sin abrir nada más`}>
            <Icon name="check" size={10} /> {m} min
          </button>
        ))}
      </div>
    </FoldPanel>
  );
}

const STEP_KICKER: Record<NonNullable<NextStep>['kind'], string> = {
  'task-late': 'Tarea vencida · hazla primero',
  'task-today': 'Vence hoy',
  habit: 'Hábito de hoy',
  review: 'Repaso pendiente',
  topic: 'Tema en curso',
};

/** Enlace a Pomodoro con el curso del paso ya elegido. */
const focusHref = (courseId: string | null) => (courseId ? `/pomodoro?curso=${encodeURIComponent(courseId)}` : '/pomodoro');

/** Bloque principal de Hoy: una sola cosa que hacer ahora, con su acción a un toque. */
function NextStepCard({ step }: { step: NextStep | null }) {
  const courses = useData((s) => s.courses);
  const logs = useData((s) => s.habitLogs);
  const setTaskStatus = useData((s) => s.setTaskStatus);
  const setHabitValue = useData((s) => s.setHabitValue);
  const openModal = useUi((s) => s.openModal);
  const toast = useUi((s) => s.toast);
  const courseName = (id: string | null) => (id ? courses.find((c) => c.id === id)?.title : undefined);
  const ref = useRef<HTMLElement>(null);

  // Lo que acabas de cerrar desde aquí: se nombra unos segundos para que se vea qué pasó antes de saltar al siguiente.
  const [justDone, setJustDone] = useState<string | null>(null);
  useEffect(() => {
    if (!justDone) return;
    const t = setTimeout(() => setJustDone(null), 6000);
    return () => clearTimeout(t);
  }, [justDone]);
  /** Cierra el paso y ofrece deshacerlo. Deshacer devuelve el estado anterior y, con él, el XP (regla de siempre). */
  const finish = (name: string, undo: () => void) => {
    setJustDone(name);
    toast({
      kind: 'info',
      title: 'Hecho',
      body: name,
      action: {
        label: 'Deshacer',
        run: () => {
          undo();
          setJustDone(null);
        },
      },
    });
  };
  const doneLine = justDone && (
    <p className="nextstep__done" role="status">
      <Icon name="check" size={12} /> «{justDone}» hecho.{step ? ' Esto es lo siguiente:' : ''}
    </p>
  );
  // Cada paso nuevo entra con la animación protagonista: el título sube letra a letra, cuadro a cuadro.
  const stepKey = !step ? 'none' : step.kind === 'task-late' || step.kind === 'task-today' ? step.task.id : step.kind === 'habit' ? step.habit.id : step.kind === 'review' ? step.review.topicId : step.topic.id;
  useInsertCoinTitle(ref, '.nextstep__title', stepKey);

  if (!step) {
    return (
      <section ref={ref} className="nextstep nextstep--clear" aria-labelledby="nextstep-title">
        <Sprite name="star" size={56} />
        <div className="nextstep__body">
          {doneLine}
          <p className="kicker">Siguiente paso</p>
          <h2 id="nextstep-title" className="nextstep__title">
            ¡Todo al día!
          </h2>
          <p className="nextstep__detail">No hay tareas, hábitos ni repasos pendientes para hoy. Si te apetece, adelanta algo con una sesión de enfoque.</p>
        </div>
        <div className="nextstep__actions">
          <Link className="btn btn--primary" to="/pomodoro">
            <Sprite name="tomato" size={16} /> <span className="nextstep__long">Empezar </span>enfoque
          </Link>
          <Button onClick={() => openModal({ type: 'task' })}>
            <Icon name="plus" size={12} /> Nueva tarea
          </Button>
        </div>
      </section>
    );
  }

  let title: string;
  let detail: string;
  let action: ReactNode;
  let extra: ReactNode = null;
  switch (step.kind) {
    case 'task-late':
    case 'task-today': {
      const t = step.task;
      title = t.title;
      detail = [courseName(t.courseId), deadlineText(t), `+${t.xp} XP`].filter(Boolean).join(' · ');
      action = (
        <Button
          variant="primary"
          onClick={() => {
            const before = t.status;
            setTaskStatus(t.id, 'done');
            finish(t.title, () => setTaskStatus(t.id, before));
          }}
        >
          <Icon name="check" size={14} /> Completar
        </Button>
      );
      break;
    }
    case 'habit': {
      const h = step.habit;
      title = h.title;
      detail = `Hábito · ${goalLabel(h)} · +${h.xp} XP`;
      action = isCounter(h) ? (
        <HabitAction habit={h} log={logFor(logs, h.id, today())} />
      ) : (
        <>
          <Button
            variant="primary"
            onClick={() => {
              const before = logFor(logs, h.id, today())?.value ?? 0;
              setHabitValue(h.id, h.target);
              finish(h.title, () => setHabitValue(h.id, before));
            }}
          >
            <Icon name="check" size={14} /> Registrar
          </Button>
          <HabitMinimumButton habit={h} log={logFor(logs, h.id, today())} />
        </>
      );
      // Volver a la rutina tras un día perdido y el plan «si… entonces…» que el propio hábito se dio.
      extra = (
        <>
          <HabitRecovery habit={h} logs={logs} />
          <IfThenList plans={h.ifThen} compact />
        </>
      );
      break;
    }
    case 'review': {
      const r = step.review;
      title = r.title;
      detail = `${r.course} · ${r.late > 0 ? `atrasado ${r.late} ${r.late === 1 ? 'día' : 'días'}` : 'toca hoy'}${step.pending > 1 ? ` · ${step.pending} temas por repasar` : ''}`;
      action = (
        <Link className="btn btn--primary" to={`/repaso?curso=${encodeURIComponent(r.courseId)}&tema=${encodeURIComponent(r.topicId)}`}>
          <Icon name="play" size={12} /> Repasar
        </Link>
      );
      break;
    }
    case 'topic': {
      title = step.topic.title;
      detail = `${step.course.title} · lo dejaste a medias`;
      action = (
        <Link className="btn btn--primary" to={`/cursos/${step.course.id}`}>
          <Icon name="play" size={12} /> Continuar tema
        </Link>
      );
      break;
    }
  }

  return (
    <section ref={ref} className={cx('nextstep', `nextstep--${step.kind}`)} aria-labelledby="nextstep-title">
      <div className="nextstep__body">
        {doneLine}
        <p className="kicker">Siguiente paso · {STEP_KICKER[step.kind]}</p>
        <h2 id="nextstep-title" className="nextstep__title">
          {title}
        </h2>
        <p className="nextstep__detail">{detail}</p>
        {extra}
      </div>
      <div className="nextstep__actions">
        {action}
        <Link className="btn btn--ghost" to={focusHref(step.courseId)}>
          <Sprite name="tomato" size={16} /> <span className="nextstep__long">Empezar </span>enfoque
        </Link>
      </div>
    </section>
  );
}

/**
 * Ficha de nivel: un trozo de la caja carbón que asoma sobre el mundo. El número es el dato más grande de
 * la pantalla después del siguiente paso, y sube por encima de la ficha hasta montarse en el cielo.
 */
function LevelCard({ profile }: { profile: Profile }) {
  const openModal = useUi((s) => s.openModal);
  const lp = levelProgress(profile.xp);
  return (
    <section className="levelcard" aria-label={`Nivel ${lp.level}, ${rankFor(lp.level)}`}>
      <div className="levelcard__level" aria-hidden="true">
        <Scramble className="levelcard__num" value={String(lp.level)} />
        <span className="levelcard__label">Nivel</span>
      </div>
      <div className="levelcard__hi">
        <Avatar profile={profile} size={40} />
        <h1 className="levelcard__name">Buenas, {profile.displayName}</h1>
      </div>
      <p className="levelcard__rank">{rankFor(lp.level)}</p>
      <Bar pct={lp.pct} tone="yellow" label="Progreso al siguiente nivel" />
      <p className="levelcard__meta">
        Faltan <b>{lp.left.toLocaleString('en-US')} XP</b> para el nivel {lp.level + 1}
      </p>
      <div className="levelcard__actions">
        <Button small onClick={() => openModal({ type: 'routine' })} title="Tu horario de trabajo, la hora de tus hábitos y tus tareas">
          <Icon name="flag" size={12} /> Mi semana
        </Button>
        <HowToButton label="Cómo usar la app" />
      </div>
    </section>
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
  const notes = useData((s) => s.notes);
  const certifications = useData((s) => s.certifications);
  const sessions = useData((s) => s.sessions);
  const xpEvents = useData((s) => s.xpEvents);
  const notifications = useData((s) => s.notifications);
  const agenda = useData((s) => s.events);
  const openModal = useUi((s) => s.openModal);

  const snap: Snapshot = useMemo(
    () => ({ profile, tasks, habits, habitLogs, courses, goals, projects, notes, certifications, personalRewards, sessions, xpEvents, notifications, events: agenda }),
    [profile, tasks, habits, habitLogs, courses, goals, projects, notes, certifications, personalRewards, sessions, xpEvents, notifications, agenda],
  );
  const missions = useMemo(() => dailyMissions(snap), [snap]);
  const progress = useMemo(() => dayProgress(missions), [missions]);
  const step = useMemo(() => nextStep(snap), [snap]);
  const events = useMemo(() => activeEvents(habits, habitLogs, profile), [habits, habitLogs, profile]);
  const advice = useMemo(() => tips(snap), [snap]);
  const streak = useMemo(() => computeStreak(xpEvents, profile.frozenDates), [xpEvents, profile.frozenDates]);

  const isEmpty = !tasks.length && !habits.length && !courses.length;

  return (
    <div className="stack home">
      {/* Apoyados en el horizonte del mundo: lo que toca hacer (8 columnas) y dónde estás (4). */}
      <div className="home__hero">
        {!isEmpty && <NextStepCard step={step} />}
        <LevelCard profile={profile} />
      </div>

      {isEmpty ? (
        <>
          <StartGuide always />
          <Panel>
            <Empty sprite="qblock" title="O empieza por lo más simple">
              <p>Crea tu primera tarea, hábito o curso para empezar a ganar XP.</p>
              <div className="row">
                <Button onClick={() => openModal({ type: 'task' })}>Nueva tarea</Button>
                <Button onClick={() => openModal({ type: 'habit' })}>Nuevo hábito</Button>
                <Button onClick={() => openModal({ type: 'course' })}>Nuevo curso</Button>
              </div>
            </Empty>
          </Panel>
        </>
      ) : (
        <>
          <NowStrip />
          <StartGuide />
          <DaySummary progress={progress} streak={streak.current} streakAlive={streak.activeToday} />
          {/* Dos columnas en pantallas anchas: a la izquierda lo que se hace (siguiente paso y misiones), a la derecha
              el contexto del día. Cada panel se pliega, así nada empuja lo demás hacia abajo sin permiso. */}
          <div className="home__grid">
            <div className="stack home__main">
              <LateBanner />
              <ConflictBanner />
              <ReviewNudge />
              <Events events={events} />
              {missions.length === 0 ? (
                <Panel kicker="Quest diaria" title="Tu misión de hoy">
                  <Empty sprite="star" title="¡Nivel despejado!">
                    <p>No hay nada pendiente para hoy.</p>
                  </Empty>
                </Panel>
              ) : (
                <MissionBoard missions={missions} hasHabits={habits.length > 0} hasTasks={tasks.length > 0} />
              )}
              <CoursesInPlay where="inicio" />
            </div>
            <aside className="stack home__rail" aria-label="Tu día">
              <TodayPriorities />
              <TodayAgenda />
              <QuickLog />
              <StreakCalendar />
              <DailyChest streak={streak.current} />
              <FoldPanel id="home-tips" kicker="Inteligencia táctica" title="Consejos del Toad" badge={advice.length} defaultOpen={false}>
                <ul className="tips">
                  {advice.map((t) => (
                    <li key={t.title} className="tip">
                      <p className="tip__title">{t.title}</p>
                      <p className="muted small">{t.body}</p>
                    </li>
                  ))}
                </ul>
              </FoldPanel>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
