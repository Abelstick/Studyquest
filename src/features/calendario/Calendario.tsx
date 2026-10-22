import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { calendarDays, monthGrid, overdueTasks, undatedTasks, weekDays, type DayEntry } from '@/core/calendar';
import { addDays, addMonths, fromISODate, longDate, minutesOfDay, monthName, shortDate, today, WEEKDAYS_SHORT } from '@/core/dates';
import type { ISODate, Task } from '@/core/domain';
import { recurrenceLabel } from '@/core/tasks';
import { DAY_MIN, durationLabel, freeMinutes, occurrencesBetween, segmentsOn, toClock, type EditScope, type Occurrence } from '@/core/agenda';
import { Button, PageHead, Panel, cx } from '@/ui/kit';
import { findConflicts } from '@/core/conflicts';
import { Sprite } from '@/ui/Sprite';
import { Icon } from '@/ui/Icon';
import { TimeGrid } from './TimeGrid';
import { AgendaList } from './AgendaList';
import { DayHabitRow, HabitDot, TaskChip, eventClass, hoursLabel, kindIcon, occurrenceLabel, rangeLabel } from './parts';

const MAX_CHIPS = 3;
type View = 'month' | 'week' | 'day' | 'agenda';
const VIEWS: { id: View; label: string }[] = [
  { id: 'month', label: 'Mes' },
  { id: 'week', label: 'Semana' },
  { id: 'day', label: 'Día' },
  { id: 'agenda', label: 'Agenda' },
];
const AGENDA_DAYS = 30;

/** En el móvil se empieza por el día: la semana con horas no cabe bien en 360 px. */
const initialView = (): View => (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 700px)').matches ? 'day' : 'week');

/** Una actividad en la lista del día: hora, nombre y marcar hecha o cancelada sin abrir el editor. */
function OccurrenceRow({ o, onOpen }: { o: Occurrence; onOpen: (o: Occurrence) => void }) {
  const setStatus = useData((s) => s.setEventStatus);
  const linked = !!(o.event.habitId || o.event.taskId);
  return (
    <li className="list__row dayev">
      <button type="button" className={cx(eventClass(o.event, o.status), 'agev--row')} onClick={() => onOpen(o)} aria-label={`Editar: ${occurrenceLabel(o)}`}>
        <span className="agev__time">{rangeLabel(o)}</span>
        <span className="agev__title">
          {kindIcon(o)} {o.title}
        </span>
        {o.minutes > 0 && o.start !== null && <span className="muted small">{durationLabel(o.minutes)}</span>}
      </button>
      {/* Los bloques de un hábito o tarea se dan por hechos desde el hábito o la tarea: aquí solo se cancelan. */}
      {o.status === 'pending' && !linked && (
        <Button small onClick={() => setStatus(o.event.id, o.original, 'done')} aria-label={`Marcar hecha: ${o.title}`}>
          <Icon name="check" size={12} />
        </Button>
      )}
      {o.status !== 'pending' && o.exception?.status && (
        <Button small onClick={() => setStatus(o.event.id, o.original, null)} aria-label={`Volver a pendiente: ${o.title}`}>
          <Icon name="sync" size={12} />
        </Button>
      )}
    </li>
  );
}

export default function Calendario() {
  const tasks = useData((s) => s.tasks);
  const courses = useData((s) => s.courses);
  const habits = useData((s) => s.habits);
  const habitLogs = useData((s) => s.habitLogs);
  const sessions = useData((s) => s.sessions);
  const events = useData((s) => s.events);
  const setTaskStatus = useData((s) => s.setTaskStatus);
  const updateTask = useData((s) => s.updateTask);
  const changeEventOccurrence = useData((s) => s.changeEventOccurrence);
  const openModal = useUi((s) => s.openModal);
  const now = today();

  const [view, setView] = useState<View>(initialView);
  const [cursor, setCursor] = useState<ISODate>(now);
  const [selected, setSelected] = useState<ISODate>(now);
  const [over, setOver] = useState<ISODate | null>(null);
  const cur = fromISODate(cursor);
  const year = cur.getFullYear();
  const month = cur.getMonth();

  const range = useMemo(() => {
    if (view === 'month') return monthGrid(year, month);
    if (view === 'week') return weekDays(cursor);
    if (view === 'day') return [cursor];
    return Array.from({ length: AGENDA_DAYS }, (_, i) => addDays(cursor, i));
  }, [view, cursor, year, month]);
  const from = range[0];
  const to = range[range.length - 1];

  const source = useMemo(() => ({ tasks, courses, habits, habitLogs, sessions }), [tasks, courses, habits, habitLogs, sessions]);
  const ctx = useMemo(() => ({ habits, tasks, logs: habitLogs }), [habits, tasks, habitLogs]);
  // Ratos reservados (de tareas y hábitos) que se pisan con otra cosa en las próximas dos semanas.
  const conflictCount = useMemo(() => findConflicts({ events, habits, tasks, habitLogs }, today(), addDays(today(), 13)).length, [events, habits, tasks, habitLogs]);
  const days = useMemo(() => calendarDays(source, from, to, now), [source, from, to, now]);
  const occs = useMemo(() => occurrencesBetween(events, from, to, ctx), [events, from, to, ctx]);

  // El día elegido puede quedar fuera del rango visible, así que se calcula aparte.
  const entry = days.get(selected) ?? calendarDays(source, selected, selected, now).get(selected);
  const dayOccs = useMemo(() => occurrencesBetween(events, selected, selected, ctx), [events, selected, ctx]);
  const undated = useMemo(() => undatedTasks(tasks), [tasks]);
  const overdue = useMemo(() => overdueTasks(tasks, now), [tasks, now]);

  const shift = (n: number) => {
    const next = view === 'month' ? addMonths(`${cursor.slice(0, 7)}-01`, n) : addDays(cursor, n * (view === 'week' ? 7 : view === 'day' ? 1 : 7));
    setCursor(next);
    if (view === 'day') setSelected(next);
  };
  const goToday = () => {
    setCursor(now);
    setSelected(now);
  };
  const openDay = (d: ISODate) => {
    setSelected(d);
    setCursor(d);
    setView('day');
  };

  const moveTask = (id: string, date: ISODate) => {
    const t = tasks.find((x) => x.id === id);
    if (t && t.dueDate !== date) updateTask(id, { dueDate: date });
  };
  const openTask = (id: string) => openModal({ type: 'task', id });
  const openOcc = (o: Occurrence) => openModal({ type: 'event', id: o.event.id, original: o.original });
  const createAt = (date: ISODate, start?: number) => openModal({ type: 'event', date, ...(start !== undefined ? { start: toClock(start), minutes: 60 } : {}) });

  /** Cambios por arrastre: si es una serie, se pregunta a qué ocurrencias afecta. */
  const applyChange = (o: Occurrence, change: { date?: ISODate; start?: string; minutes?: number }, verb: string) => {
    if (!o.recurring) return changeEventOccurrence(o.event.id, o.original, change, 'all');
    openModal({ type: 'scope', title: o.title, verb, onPick: (scope: EditScope) => changeEventOccurrence(o.event.id, o.original, change, scope) });
  };

  const exportVisible = () => openModal({ type: 'export', from: view === 'month' ? `${cursor.slice(0, 7)}-01` : from, to: view === 'month' ? addDays(addMonths(`${cursor.slice(0, 7)}-01`, 1), -1) : to });

  const title =
    view === 'month' ? `${monthName(month)} ${year}` : view === 'week' ? `${shortDate(from)} – ${shortDate(to)}` : view === 'day' ? longDate(cursor) : `${shortDate(from)} – ${shortDate(to)}`;
  const shiftLabel = view === 'month' ? 'mes' : view === 'day' ? 'día' : 'semana';

  // ¿Cuánto tiempo queda libre? Desde ahora (hoy) o en todo el día, sin contar lo cancelado ni los recordatorios.
  const busy = segmentsOn(dayOccs.filter((o) => o.status !== 'cancelled' && o.minutes > 0), selected).map((s) => ({ start: s.start, end: s.end }));
  const freeFrom = selected === now ? minutesOfDay() : selected < now ? DAY_MIN : 0;
  const free = freeMinutes(busy, freeFrom, DAY_MIN);
  const pendingOccs = dayOccs.filter((o) => o.status === 'pending');

  const summary = (d: ISODate, e?: DayEntry, n = 0) => {
    const count = (e?.tasks.length ?? 0) + (e?.upcoming.length ?? 0) + (e?.reviews.length ?? 0) + (e?.habits.length ?? 0) + n;
    return `${longDate(d)}${count ? `, ${count} ${count === 1 ? 'elemento' : 'elementos'}` : ''}`;
  };
  // Toda la casilla elige el día (no solo el número); el botón del número queda para el teclado.
  const dropProps = (d: ISODate) => ({
    onClick: () => setSelected(d),
    onDoubleClick: () => openDay(d),
    onDragOver: (ev: React.DragEvent) => {
      ev.preventDefault();
      if (over !== d) setOver(d);
    },
    onDragLeave: () => setOver((o) => (o === d ? null : o)),
    onDrop: (ev: React.DragEvent) => {
      ev.preventDefault();
      setOver(null);
      const id = ev.dataTransfer.getData('text/plain');
      if (id) moveTask(id, d);
    },
  });

  const dayIsEmpty = !dayOccs.length && (!entry || (!entry.tasks.length && !entry.upcoming.length && !entry.reviews.length && !entry.habits.length && !entry.minutes));

  return (
    <div className="stack">
      <PageHead
        kicker="Mapa del mundo"
        title="Calendario"
        sprite="flag"
        right={
          <>
            <div className="tabs tabs--sm" role="tablist" aria-label="Vista del calendario">
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  role="tab"
                  aria-selected={view === v.id}
                  className={cx('tabs__tab', view === v.id && 'is-on')}
                  onClick={() => {
                    setView(v.id);
                    if (v.id === 'day') setCursor(selected);
                  }}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <Button small onClick={() => shift(-1)} aria-label={`${shiftLabel} anterior`}>
              ‹
            </Button>
            <span className="cal-month" aria-live="polite">
              {title}
            </span>
            <Button small onClick={() => shift(1)} aria-label={`${shiftLabel} siguiente`}>
              ›
            </Button>
            <Button small onClick={goToday}>
              Hoy
            </Button>
            <Button small variant="primary" onClick={() => createAt(view === 'day' ? cursor : selected)}>
              <Icon name="plus" size={12} /> Actividad
            </Button>
            {conflictCount > 0 && (
              <Button small variant="danger" onClick={() => openModal({ type: 'conflicts' })} title="Ratos reservados que se pisan con otra cosa">
                {conflictCount} {conflictCount === 1 ? 'cruce' : 'cruces'}
              </Button>
            )}
            <Button small onClick={() => openModal({ type: 'routine' })} title="Tu horario de trabajo, la hora de tus hábitos y la exportación">
              Mi semana
            </Button>
            <Button small onClick={exportVisible} title="Descarga un .ics para Google Calendar, Outlook o Apple">
              Exportar
            </Button>
          </>
        }
      />

      <div className="cols cols--cal">
        <Panel className="calgrid">
          {(view === 'week' || view === 'day') && (
            <TimeGrid
              days={range}
              occs={occs}
              entries={days}
              now={now}
              selected={selected}
              onSelectDay={setSelected}
              onOpenDay={openDay}
              onCreate={createAt}
              onOpen={openOcc}
              onMove={(o, date, start) => applyChange(o, { date, start: toClock(start) }, 'mover')}
              onResize={(o, minutes) => applyChange(o, { minutes }, 'cambiar la duración de')}
              onOpenTask={openTask}
              onDropTask={moveTask}
            />
          )}

          {view === 'agenda' && <AgendaList from={from} to={to} occs={occs} entries={days} now={now} onOpen={openOcc} onOpenTask={openTask} onOpenDay={openDay} />}

          {view === 'month' && (
            <>
              <div className="calgrid__head" aria-hidden="true">
                {WEEKDAYS_SHORT.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              <div className="calgrid__body" role="grid" aria-label={title}>
                {range.map((d) => {
                  const e = days.get(d);
                  const inMonth = d.slice(0, 7) === cursor.slice(0, 7);
                  const heat = Math.min(4, Math.ceil((e?.minutes ?? 0) / 30));
                  const mine = occs.filter((o) => o.date === d);
                  const shown = mine.slice(0, 2);
                  return (
                    <div key={d} role="gridcell" aria-selected={d === selected} className={cx('calday', !inMonth && 'is-out', d === now && 'is-today', d === selected && 'is-selected', over === d && 'is-over', d < now && 'is-past', heat > 0 && `calday--heat-${heat}`)} {...dropProps(d)}>
                      <button type="button" className="calday__num" onClick={() => setSelected(d)} aria-label={summary(d, e, mine.length)}>
                        {Number(d.slice(8))}
                      </button>
                      {!!e?.habits.length && (
                        <div className="calday__dots" aria-hidden="true">
                          {e.habits.slice(0, 8).map((hd) => (
                            <HabitDot key={hd.habit.id} hd={hd} />
                          ))}
                        </div>
                      )}
                      <ul className="calday__items">
                        {shown.map((o) => (
                          <li key={o.key}>
                            <button
                              type="button"
                              className={cx(eventClass(o.event, o.status), 'agev--mini')}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                openOcc(o);
                              }}
                              title={occurrenceLabel(o)}
                            >
                              {o.start !== null && <b>{toClock(o.start)} </b>}
                              {o.title}
                            </button>
                          </li>
                        ))}
                        {mine.length > shown.length && <li className="calday__more">+{mine.length - shown.length} actividades</li>}
                        {e?.tasks.slice(0, MAX_CHIPS).map((t) => (
                          <li key={t.id}>
                            <TaskChip t={t} now={now} onOpen={openTask} onSelect={() => setSelected(d)} />
                          </li>
                        ))}
                        {(e?.tasks.length ?? 0) > MAX_CHIPS && <li className="calday__more">+{(e?.tasks.length ?? 0) - MAX_CHIPS} más</li>}
                        {!!e?.upcoming.length && (
                          <li className="chip-task chip-task--ghost" title={e.upcoming.map((t) => t.title).join(', ')}>
                            <Icon name="sync" size={10} /> {e.upcoming.length === 1 ? e.upcoming[0].title : `${e.upcoming.length} repetidas`}
                          </li>
                        )}
                        {!!e?.reviews.length && (
                          <li className="chip-task chip-task--review" title="Repasos">
                            <Icon name="cards" size={10} /> {e.reviews.length} {e.reviews.length === 1 ? 'repaso' : 'repasos'}
                          </li>
                        )}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <p className="muted small calgrid__legend">
            <span className="agev agev--study agev--legend">Estudio</span> <span className="agev agev--work agev--legend">Trabajo</span> <span className="agev agev--meeting agev--legend">Reunión</span>{' '}
            <span className="agev agev--health agev--legend">Salud</span> <span className="agev agev--meal agev--legend">Comida</span> <span className="agev agev--rest agev--legend">Descanso</span>{' '}
            <span className="agev agev--personal agev--legend">Personal</span> · <Icon name="habit" size={10} /> hábito · <Icon name="task" size={10} /> tarea · <Icon name="flag" size={10} /> fecha límite · <Icon name="sync" size={10} /> se repite ·{' '}
            {view === 'week' || view === 'day'
              ? 'Pulsa una hora libre para crear. Con ratón, arrastra un bloque para moverlo o su borde inferior para cambiar la duración.'
              : 'Arrastra una tarea a otro día para cambiar su fecha. Doble clic en un día para ver sus horas.'}
          </p>
        </Panel>

        <div className="stack">
          <Panel
            kicker={selected === now ? 'Hoy' : 'Día elegido'}
            title={longDate(selected)}
            right={
              <div className="row">
                <Button small variant="primary" onClick={() => createAt(selected)}>
                  <Icon name="plus" size={12} /> Actividad
                </Button>
                <Button small onClick={() => openModal({ type: 'task', dueDate: selected })}>
                  <Icon name="plus" size={12} /> Tarea
                </Button>
              </div>
            }
          >
            {selected >= now && (
              <p className="dayfree">
                <b>{free > 0 ? durationLabel(free) : '0 min'}</b> {selected === now ? 'sin programar desde ahora hasta medianoche' : 'sin programar en el día'}
                {pendingOccs.length > 0 && ` · ${pendingOccs.length} ${pendingOccs.length === 1 ? 'actividad pendiente' : 'actividades pendientes'}`}
              </p>
            )}
            {dayIsEmpty || !entry ? (
              <p className="muted">Día libre. ¡Aprovéchalo o planifica algo!</p>
            ) : (
              <>
                {entry.minutes > 0 && <p className="dayminutes">
                    <Icon name="book" size={12} /> Estudiaste {hoursLabel(entry.minutes)}
                  </p>}
                {dayOccs.length > 0 && (
                  <>
                    <p className="kicker">Horario</p>
                    <ul className="list">
                      {dayOccs.map((o) => (
                        <OccurrenceRow key={o.key} o={o.date !== selected ? { ...o, title: `${o.title} (desde ayer)` } : o} onOpen={openOcc} />
                      ))}
                    </ul>
                  </>
                )}
                {entry.habits.length > 0 && <p className="kicker">Hábitos del día</p>}
                <ul className="list">
                  {entry.habits.map((hd) => (
                    <DayHabitRow key={hd.habit.id} hd={hd} date={selected} now={now} />
                  ))}
                </ul>
                {(entry.tasks.length > 0 || entry.upcoming.length > 0) && <p className="kicker">Tareas que vencen</p>}
                <ul className="list">
                  {entry.tasks.map((t: Task) => (
                    <li key={t.id} className="list__row">
                      <label className="list__check">
                        <input type="checkbox" checked={t.status === 'done'} onChange={() => setTaskStatus(t.id, t.status === 'done' ? 'todo' : 'done')} aria-label={`Completar ${t.title}`} />
                        <span>
                          <span className={cx('list__title', t.status === 'done' && 'is-struck')}>
                            {t.priority === 'boss' && <Sprite name="boss" size={14} />} {t.title}
                          </span>
                          <span className="muted small">
                            {t.dueTime ? `Vence a las ${t.dueTime} · ` : ''}
                            {t.courseId && courses.some((c) => c.id === t.courseId) ? (
                              <Link to={`/cursos/${t.courseId}`}>{courses.find((c) => c.id === t.courseId)?.title}</Link>
                            ) : (
                              'Side quest'
                            )}{' '}
                            · +{t.xp} XP{t.recurrence ? ` · ${recurrenceLabel(t.recurrence)}` : ''}
                          </span>
                        </span>
                      </label>
                      <div className="row">
                        <Link className="btn btn--ghost btn--sm" to={`/tareas?tarea=${encodeURIComponent(t.id)}`} aria-label={`Ver ${t.title} en Tareas`}>
                          Ver
                        </Link>
                        {t.status !== 'done' && (
                          <Button small onClick={() => openModal({ type: 'event', taskId: t.id, date: selected })} title="Reservar tiempo en el calendario para hacerla">
                            Agendar
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                  {entry.upcoming.map((t) => (
                    <li key={`up-${t.id}`} className="list__row">
                      <div>
                        <p className="list__title">
                          <Icon name="sync" size={11} /> {t.title}
                        </p>
                        <p className="muted small">Se repetirá este día · {t.recurrence ? recurrenceLabel(t.recurrence) : ''}</p>
                      </div>
                    </li>
                  ))}
                  {entry.reviews.length > 0 && (
                    <li className="list__row">
                      <div>
                        <p className="list__title">
                          <Icon name="cards" size={11} /> {entry.reviews.length} {entry.reviews.length === 1 ? 'repaso' : 'repasos'} de flashcards</p>
                        <p className="muted small">
                          {entry.reviews.map((r, i) => (
                            <span key={r.topicId}>
                              {i > 0 && ' · '}
                              {selected <= now ? <Link to={`/repaso?curso=${encodeURIComponent(r.courseId)}&tema=${encodeURIComponent(r.topicId)}`}>{r.title}</Link> : r.title}
                            </span>
                          ))}
                        </p>
                      </div>
                      {selected <= now && (
                        <Link className="btn btn--ghost btn--sm" to="/repaso">
                          Repasar
                        </Link>
                      )}
                    </li>
                  )}
                </ul>
              </>
            )}
          </Panel>

          <Panel
            kicker="Bandeja"
            title="Por programar"
            right={
              overdue.length > 0 ? (
                <Button small onClick={() => overdue.forEach((t) => moveTask(t.id, now))} title="Pasa todas las tareas vencidas a hoy">
                  Vencidas → hoy
                </Button>
              ) : undefined
            }
          >
            {overdue.length === 0 && undated.length === 0 ? (
              <p className="muted">Todo está programado y al día.</p>
            ) : (
              <>
                {overdue.length > 0 && (
                  <div className="tray">
                    <p className="kicker">Vencidas ({overdue.length})</p>
                    <ul className="tray__list">
                      {overdue.map((t) => (
                        <li key={t.id}>
                          <TaskChip t={t} now={now} onOpen={openTask} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {undated.length > 0 && (
                  <div className="tray">
                    <p className="kicker">Sin fecha ({undated.length})</p>
                    <ul className="tray__list">
                      {undated.map((t) => (
                        <li key={t.id}>
                          <TaskChip t={t} now={now} onOpen={openTask} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="muted small">Arrastra una tarea sobre un día para ponerle fecha límite, o ábrela y pulsa «Agendar» en el día para reservarle tiempo.</p>
              </>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
