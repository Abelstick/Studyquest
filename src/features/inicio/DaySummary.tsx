import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '@/state';
import { addDays, today } from '@/core/dates';
import type { computeStreak } from '@/core/game';
import type { DayProgress } from '@/core/missions';
import type { HabitWeek, Tally, TaskScopes } from '@/core/overview';
import { Bar, cx } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';
import { Scramble } from '@/ui/motion';
import type { SpriteName } from '@/ui/sprites';

/** Días que se dibujan en la tira de la racha. */
const STRIP_DAYS = 14;

interface TileProps {
  tone: 'main' | 'habit' | 'task' | 'streak';
  sprite: SpriteName;
  label: string;
  value: string;
  note?: string;
  alert?: boolean;
  clear?: boolean;
  bar?: { pct: number; segments: number; tone: 'green' | 'yellow' | 'red' | 'blue' };
  /** Detalle bajo la cifra (desglose por periodo, tira de días…). */
  children?: ReactNode;
}

function Tile({ tone, sprite, label, value, note, alert, clear, bar, children }: Readonly<TileProps>) {
  return (
    <div className={cx('daysum__tile', `daysum__tile--${tone}`, clear && 'is-clear', alert && 'is-alert')} role="group" aria-label={`${label}: ${value === '—' ? 'sin datos' : value}${note ? `. ${note}` : ''}`}>
      <div className="daysum__text">
        <p className="daysum__k">{label}</p>
        <p className="daysum__v">
          <Scramble value={value} />
        </p>
        {note && <p className="daysum__note">{note}</p>}
      </div>
      <Sprite name={sprite} size={tone === 'main' ? 40 : 24} className="daysum__sprite" />
      {bar && <Bar className="daysum__bar" pct={bar.pct} segments={bar.segments} tone={bar.tone} label={label} />}
      {children}
    </div>
  );
}

const ratio = (t: Pick<Tally, 'done' | 'total'>) => `${t.done}/${t.total}`;

/** Tira de los últimos días: de un vistazo se ve si la racha viene sólida. Sustituye al calendario de 5 semanas. */
function StreakStrip({ streak }: Readonly<{ streak: ReturnType<typeof computeStreak> }>) {
  const frozen = useData((s) => s.profile.frozenDates);
  const now = today();
  const days = Array.from({ length: STRIP_DAYS }, (_, i) => addDays(now, i - (STRIP_DAYS - 1)));
  return (
    <div className="daysum__strip" role="img" aria-label={`Últimos ${STRIP_DAYS} días: ${days.filter((d) => streak.days.has(d)).length} con actividad`}>
      {days.map((d) => (
        <i key={d} className={cx(streak.days.has(d) && 'is-on', frozen.includes(d) && 'is-frozen', d === now && 'is-today')} />
      ))}
    </div>
  );
}

/** Congelar el día cuando la racha peligra: el atajo vive en la propia casilla en vez de en un panel aparte. */
function FreezeAction({ streak }: Readonly<{ streak: ReturnType<typeof computeStreak> }>) {
  const freezes = useData((s) => s.profile.streakFreezes);
  const frozenToday = useData((s) => s.profile.frozenDates.includes(today()));
  const freeze = useData((s) => s.freezeToday);
  if (streak.activeToday || frozenToday) return null;
  if (freezes > 0) {
    return (
      <button type="button" className="link daysum__link" onClick={freeze}>
        Congelar hoy ({freezes})
      </button>
    );
  }
  if (streak.current > 0) {
    return (
      <Link className="daysum__link" to="/arsenal" title="Congelar racha, en el Arsenal">
        Sin congeladores
      </Link>
    );
  }
  return null;
}

interface Props {
  progress: DayProgress;
  scopes: TaskScopes;
  habitWeek: HabitWeek;
  streak: ReturnType<typeof computeStreak>;
}

/**
 * Resumen del día. Jerarquía: el avance de hoy manda (cifra enorme); hábitos, tareas y racha lo acompañan y cada
 * una da lo que el número de hoy no cuenta. Hábitos: cómo va la semana. Tareas: por semana, con hoy, el mes y el
 * año al lado y cuántas hay abiertas en total. Racha: el récord y los últimos días.
 */
export function DaySummary({ progress, scopes, habitWeek, streak }: Readonly<Props>) {
  const clear = progress.total > 0 && progress.done === progress.total;
  const mainNote = progress.total === 0 ? 'Nada programado para hoy' : `${progress.done}/${progress.total} de lo de hoy · ${clear ? '¡día completo!' : `${progress.xpLeft} XP en juego`}`;
  const week = scopes.week;
  const alive = streak.activeToday;
  const danger = streak.current > 0 && !alive;

  return (
    <section className="daysum" aria-label="Resumen del día">
      <Tile
        tone="main"
        sprite={clear ? 'trophy' : 'star'}
        label="Progreso del día"
        value={progress.total === 0 ? '—' : `${progress.pct}%`}
        note={mainNote}
        clear={clear}
        bar={{ pct: progress.pct, segments: progress.total, tone: 'yellow' }}
      />
      <Tile
        tone="habit"
        sprite="flower"
        label="Hábitos hoy"
        value={`${progress.habitsDone}/${progress.habitsTotal}`}
        note={habitWeek.due > 0 ? `Semana ${habitWeek.pct}% · ${habitWeek.done}/${habitWeek.due}` : undefined}
        clear={progress.habitsTotal > 0 && progress.habitsDone === progress.habitsTotal}
      />
      <Tile
        tone="task"
        sprite="qblock"
        label="Tareas · esta semana"
        value={week.total === 0 ? '—' : ratio(week)}
        note={week.late > 0 ? `${week.late} ${week.late === 1 ? 'vencida' : 'vencidas'}` : week.total === 0 ? 'Ninguna con fecha esta semana' : undefined}
        alert={week.late > 0}
        clear={week.total > 0 && week.done === week.total}
      >
        <dl className="daysum__sub">
          <div>
            <dt>Hoy</dt>
            <dd>{ratio(scopes.day)}</dd>
          </div>
          <div>
            <dt>Mes</dt>
            <dd>{ratio(scopes.month)}</dd>
          </div>
          <div>
            <dt>Año</dt>
            <dd>{ratio(scopes.year)}</dd>
          </div>
          <div>
            <dt>Abiertas</dt>
            <dd>{scopes.open}</dd>
          </div>
        </dl>
      </Tile>
      <Tile tone="streak" sprite="fire" label="Racha" value={`${streak.current} ${streak.current === 1 ? 'día' : 'días'}`} note={danger ? 'Peligra hoy' : `Récord ${streak.best}`} alert={danger}>
        <StreakStrip streak={streak} />
        <FreezeAction streak={streak} />
      </Tile>
    </section>
  );
}
