import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { addDays, today } from '@/core/dates';
import { useMinuteOfDay } from './useMinuteOfDay';
import { toClock } from '@/core/agenda';
import { deadlineText } from '@/core/missions';
import { PRIORITY_REASON_TEXT, agendaToday, topPriorities, type AgendaItem, type TodayPriority } from '@/core/today';
import { reviewOf, reviewWeekFor } from '@/core/weekReview';
import { findConflicts } from '@/core/conflicts';
import { Button, Tag, cx } from '@/ui/kit';
import { FoldPanel } from '@/ui/Fold';
import { Sprite } from '@/ui/Sprite';
import { Icon } from '@/ui/Icon';
import { CATEGORY_ICON } from '@/ui/domainIcons';

/** Bloques de la agenda que se enseñan de entrada; el resto está en el calendario. */
const SHOW_AGENDA = 4;

function PriorityRow({ p }: Readonly<{ p: TodayPriority }>) {
  const setTaskStatus = useData((s) => s.setTaskStatus);
  const updateTask = useData((s) => s.updateTask);
  const openModal = useUi((s) => s.openModal);
  const toast = useUi((s) => s.toast);
  const t = p.task;

  const complete = () => {
    const before = t.status;
    setTaskStatus(t.id, 'done');
    toast({ kind: 'info', title: 'Hecho', body: t.title, action: { label: 'Deshacer', run: () => setTaskStatus(t.id, before) } });
  };
  /** Reprogramar sin crear nada nuevo: la misma tarea, con otra fecha. Se puede deshacer. */
  const toTomorrow = () => {
    const before = { dueDate: t.dueDate, dueTime: t.dueTime };
    updateTask(t.id, { dueDate: addDays(today(), 1) });
    toast({ kind: 'info', title: 'Movida a mañana', body: t.title, action: { label: 'Deshacer', run: () => updateTask(t.id, { dueDate: before.dueDate, dueTime: before.dueTime }) } });
  };

  return (
    <li className={cx('mission mission--task', p.reason === 'late' && 'is-late')}>
      <button type="button" className="mission__check" role="checkbox" aria-checked={false} aria-label={`Completar: ${t.title}`} onClick={complete} />
      <div className="mission__body">
        <button type="button" className="mission__open" onClick={() => openModal({ type: 'task-detail', id: t.id })} aria-haspopup="dialog" aria-label={`Ver detalle: ${t.title}`}>
          <span className="mission__title">{t.title}</span>
        </button>
        <p className="mission__sub">
          <b>{PRIORITY_REASON_TEXT[p.reason]}</b> · {deadlineText(t)}
        </p>
      </div>
      <div className="mission__counter">
        <Button small variant="ghost" onClick={toTomorrow} aria-label={`Mover a mañana: ${t.title}`}>
          Mañana
        </Button>
      </div>
    </li>
  );
}

const STATE_TAG: Partial<Record<AgendaItem['state'], { tone: 'blue' | 'xp'; label: string }>> = {
  now: { tone: 'blue', label: 'Ahora' },
  next: { tone: 'xp', label: 'Siguiente' },
};

function AgendaRow({ item }: Readonly<{ item: AgendaItem }>) {
  const setEventStatus = useData((s) => s.setEventStatus);
  const openModal = useUi((s) => s.openModal);
  const { occ } = item;
  const start = occ.start as number;
  const range = occ.minutes > 0 ? `${toClock(start)}–${toClock(start + occ.minutes)}` : toClock(start);
  const done = occ.status === 'done';
  const tag = STATE_TAG[item.state];
  const focusable = occ.event.category === 'study' || occ.event.category === 'work';

  return (
    <li className={cx('tagenda__row', item.state === 'now' && 'is-now', done && 'is-done')}>
      <span className="tagenda__time">{range}</span>
      <span className="tagenda__what">
        <button type="button" className="link" onClick={() => openModal({ type: 'event', id: occ.event.id, original: occ.original })}>
          <Icon name={CATEGORY_ICON[occ.event.category]} size={11} /> {occ.title}
        </button>
        {tag && <Tag tone={tag.tone}>{tag.label}</Tag>}
        {item.linked && <span className="muted small">{item.linked === 'habit' ? 'se registra en el hábito' : 'se cierra en la tarea'}</span>}
      </span>
      <span className="tagenda__acts">
        {focusable && !done && (
          <Link className="btn btn--ghost btn--sm" to="/pomodoro">
            <Sprite name="tomato" size={14} /> Enfoque
          </Link>
        )}
        {/* Los bloques de un hábito o una tarea nunca registran progreso por su cuenta: se cierran en su hábito o tarea. */}
        {!item.linked && (
          <Button small variant={done ? 'ghost' : 'plain'} aria-pressed={done} onClick={() => setEventStatus(occ.event.id, occ.original, done ? null : 'done')} aria-label={`${done ? 'Desmarcar' : 'Marcar como hecho'}: ${occ.title}`}>
            <Icon name={done ? 'sync' : 'check'} size={12} />
          </Button>
        )}
      </span>
    </li>
  );
}

/** Las tres prioridades de hoy, si hay al menos dos que elegir. Si no, no ocupa sitio. */
export function TodayPriorities() {
  const tasks = useData((s) => s.tasks);
  const profile = useData((s) => s.profile);
  const nowMin = useMinuteOfDay();
  const priorities = useMemo(() => topPriorities({ tasks, profile }, today(), nowMin), [tasks, profile, nowMin]);
  if (priorities.length < 2) return null;

  return (
    <FoldPanel id="home-priorities" className="tprio" kicker="Lo que más importa" title={`Tus ${priorities.length} prioridades de hoy`}>
      <ul className="missions">
        {priorities.map((p) => (
          <PriorityRow key={p.task.id} p={p} />
        ))}
      </ul>
    </FoldPanel>
  );
}

/** Los bloques con hora que quedan hoy en el calendario. Si no queda ninguno, no ocupa sitio. */
export function TodayAgenda() {
  const tasks = useData((s) => s.tasks);
  const events = useData((s) => s.events);
  const habits = useData((s) => s.habits);
  const habitLogs = useData((s) => s.habitLogs);
  const nowMin = useMinuteOfDay();
  const agenda = useMemo(() => agendaToday({ events, habits, tasks, habitLogs }, today(), nowMin), [events, habits, tasks, habitLogs, nowMin]);
  const upcoming = agenda.filter((a) => a.state !== 'past');
  if (upcoming.length === 0) return null;

  return (
    <FoldPanel
      id="home-agenda"
      className="tagenda"
      kicker="Calendario"
      title="Tu agenda de hoy"
      badge={upcoming.length}
      right={
        <Link className="btn btn--ghost btn--sm" to="/calendario">
          Ver calendario
        </Link>
      }
    >
      <ul className="tagenda__list">
        {upcoming.slice(0, SHOW_AGENDA).map((a) => (
          <AgendaRow key={a.occ.key} item={a} />
        ))}
      </ul>
      {upcoming.length > SHOW_AGENDA && <p className="muted small">y {upcoming.length - SHOW_AGENDA} más hoy.</p>}
    </FoldPanel>
  );
}

/** Invitación breve a revisar la semana cuando toca (domingo y primeros días de la siguiente) y aún no se hizo. */
export function ReviewNudge() {
  const hasData = useData((s) => s.tasks.length + s.habits.length > 0);
  const profile = useData((s) => s.profile);
  const week = reviewWeekFor(today());
  if (!hasData || !week || reviewOf(profile, week)) return null;
  return (
    <section className="panel catchup" role="status">
      <Sprite name="flag" size={24} />
      <p className="grow">
        <b>Es buen momento para revisar tu semana.</b> Dos minutos para ver qué avanzó, ajustar lo pendiente sin culpas y elegir tus prioridades de la próxima.
      </p>
      <Link className="btn btn--primary btn--sm" to={`/progreso?revision=${week}`}>
        Revisar mi semana
      </Link>
    </section>
  );
}

/** Aviso de cruces de horario en los próximos 7 días, con la puerta a arreglarlos. */
export function ConflictBanner() {
  const events = useData((s) => s.events);
  const habits = useData((s) => s.habits);
  const tasks = useData((s) => s.tasks);
  const habitLogs = useData((s) => s.habitLogs);
  const openModal = useUi((s) => s.openModal);
  const n = useMemo(() => findConflicts({ events, habits, tasks, habitLogs }, today(), addDays(today(), 6)).length, [events, habits, tasks, habitLogs]);
  if (!n) return null;
  return (
    <section className="panel catchup" role="status">
      <Sprite name="ghost" size={24} />
      <p className="grow">
        <b>
          {n} {n === 1 ? 'cruce de horario' : 'cruces de horario'} esta semana.
        </b>{' '}
        Un rato que reservaste se pisa con otra cosa; se arregla en un toque.
      </p>
      <Button small variant="primary" onClick={() => openModal({ type: 'conflicts' })}>
        Resolver
      </Button>
    </section>
  );
}
