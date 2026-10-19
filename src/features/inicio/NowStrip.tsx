import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { today } from '@/core/dates';
import { durationLabel, toClock } from '@/core/agenda';
import { freeTimeIdeas, nowState, type Idea } from '@/core/routine';
import { Button } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';
import { useMinuteOfDay } from './useMinuteOfDay';

function IdeaChip({ idea }: Readonly<{ idea: Idea }>) {
  const openModal = useUi((s) => s.openModal);
  const open = () => openModal(idea.kind === 'habit' ? { type: 'habit-detail', id: idea.id } : { type: 'task-detail', id: idea.id });
  return (
    <li>
      <button type="button" className="chip chip--sm" onClick={open} aria-haspopup="dialog">
        {idea.kind === 'habit' ? '🌱' : '📌'} {idea.title}
        {idea.at ? ` · ${idea.at}` : idea.minutes ? ` · ${idea.minutes} min` : ''}
      </button>
    </li>
  );
}

/**
 * «Ahora»: qué hora es y qué toca según tu semana. Dentro de un bloque (tu jornada, una clase) dice hasta cuándo;
 * en tiempo libre dice cuánto queda y qué podrías hacer en ese rato. Si aún no has contado cómo es tu semana,
 * invita a hacerlo. Solo lee la agenda: no registra nada.
 */
export function NowStrip() {
  const events = useData((s) => s.events);
  const habits = useData((s) => s.habits);
  const tasks = useData((s) => s.tasks);
  const habitLogs = useData((s) => s.habitLogs);
  const openModal = useUi((s) => s.openModal);
  const nowMin = useMinuteOfDay();
  const date = today();
  const ctx = useMemo(() => ({ events, habits, tasks, habitLogs }), [events, habits, tasks, habitLogs]);
  const state = useMemo(() => nowState(ctx, date, nowMin), [ctx, date, nowMin]);
  const ideas = useMemo(() => (state.kind === 'free' ? freeTimeIdeas(ctx, date, nowMin, state.until) : []), [ctx, date, nowMin, state]);

  if (state.kind === 'empty') return null;
  const next = state.kind === 'block' || state.kind === 'free' ? state.next : null;

  let headline: string;
  let detail: string;
  if (state.kind === 'block') {
    headline = state.occ.title;
    detail = `Hasta las ${toClock(state.until)} · quedan ${durationLabel(state.until - nowMin)}`;
  } else if (state.kind === 'free') {
    headline = 'Tiempo libre';
    detail = `Hasta las ${toClock(state.until)} · ${durationLabel(state.until - nowMin)}`;
  } else {
    headline = 'Hora de descansar';
    detail = 'Fuera de tus horas despierto. Mañana será otro día.';
  }

  return (
    <section className="panel nowstrip" aria-label="Ahora">
      <div className="nowstrip__clock" aria-hidden="true">
        {toClock(nowMin)}
      </div>
      <div className="nowstrip__body">
        <p className="kicker">// Ahora {state.kind === 'block' ? '· ocupado' : state.kind === 'free' ? '· libre' : ''}</p>
        <h2 className="nowstrip__title">{headline}</h2>
        <p className="muted">{detail}</p>
        {next && (
          <p className="muted small">
            Después: <b>{next.title}</b> a las {toClock(next.start as number)}
          </p>
        )}
        {state.kind === 'free' &&
          (ideas.length > 0 ? (
            <>
              <p className="kicker">Para este rato</p>
              <ul className="chips">
                {ideas.map((i) => (
                  <IdeaChip key={`${i.kind}-${i.id}`} idea={i} />
                ))}
              </ul>
            </>
          ) : (
            <p className="muted small">
              Nada pendiente para este rato: descansa o adelanta algo con una{' '}
              <Link to="/pomodoro">sesión de enfoque</Link>.
            </p>
          ))}
      </div>
      <Button small variant="ghost" onClick={() => openModal({ type: 'routine' })}>
        <Sprite name="flag" size={14} /> Mi semana
      </Button>
    </section>
  );
}
