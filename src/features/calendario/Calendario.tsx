import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { calendarDays, monthGrid, overdueTasks, undatedTasks, weekDays, type DayEntry, type HabitDay } from '@/core/calendar';
import { catchUpDay } from '@/core/catchup';
import { longDate, monthName, shortDate, today, toISODate, WEEKDAYS_SHORT } from '@/core/dates';
import { isCounter, stepForCounter } from '@/core/game';
import type { ISODate, Task } from '@/core/domain';
import { recurrenceLabel } from '@/core/tasks';
import { Button, PageHead, Panel, cx } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';

const MAX_CHIPS = 3;
type View = 'week' | 'month';

const fmt = (n: number) => String(Math.round(n * 100) / 100);
const hoursLabel = (min: number) => (min >= 60 ? `${+(min / 60).toFixed(1)} h` : `${min} min`);

/** Punto de un hábito: verde si está hecho, ámbar si va a medias, hueco si tocaba y no se hizo. */
function HabitDot({ hd }: { hd: HabitDay }) {
  const state = hd.done ? 'done' : hd.progress > 0 ? 'partial' : 'due';
  return <span className={cx('hdot', `hdot--${state}`)} title={`${hd.habit.title}${hd.value > 0 ? ` · ${fmt(hd.value)}/${fmt(hd.habit.target)}` : ''}`} />;
}

/** Tarea arrastrable en forma de chip: sirve en el mes, en la semana y en las bandejas. */
function TaskChip({ t, now, onOpen, onSelect }: { t: Task; now: ISODate; onOpen: (id: string) => void; onSelect?: () => void }) {
  return (
    <button
      type="button"
      draggable
      onDragStart={(ev) => {
        ev.dataTransfer.setData('text/plain', t.id);
        ev.dataTransfer.effectAllowed = 'move';
      }}
      className={cx('chip-task', `chip-task--${t.priority}`, t.status === 'done' && 'is-done', t.status !== 'done' && !!t.dueDate && t.dueDate < now && 'is-late')}
      onClick={() => {
        onSelect?.();
        onOpen(t.id);
      }}
      title={t.title}
    >
      {t.recurrence && <span aria-hidden="true">↻ </span>}
      {t.title}
    </button>
  );
}

/** Hábito de un día dentro del panel: avance y, si se puede, registrarlo ahí mismo. */
function DayHabitRow({ hd, date, now }: { hd: HabitDay; date: ISODate; now: ISODate }) {
  const logs = useData((s) => s.habitLogs);
  const setValueOn = useData((s) => s.setHabitValueOn);
  const { habit: h } = hd;
  const future = date > now;
  const editable = !future && (date === now || catchUpDay(h, logs, date, now).editable);
  const step = stepForCounter(h);
  let status: string;
  if (hd.done) status = 'Hecho';
  else if (hd.progress > 0) status = `A medias · ${fmt(hd.value)}/${fmt(h.target)}`;
  else if (future) status = 'Programado';
  else status = 'Sin marcar';
  let control = null;
  if (editable && isCounter(h)) {
    control = (
      <div className="counter">
        <Button small aria-label={`Restar a ${h.title}`} onClick={() => setValueOn(h.id, date, Math.max(0, hd.value - step))} disabled={hd.value <= 0}>
          −
        </Button>
        <span className="counter__value">
          {fmt(hd.value)}/{fmt(h.target)}
        </span>
        <Button small aria-label={`Sumar a ${h.title}`} onClick={() => setValueOn(h.id, date, hd.value + step)}>
          +
        </Button>
      </div>
    );
  } else if (editable) {
    control = (
      <Button small variant={hd.done ? 'ghost' : 'primary'} aria-pressed={hd.done} onClick={() => setValueOn(h.id, date, hd.done ? 0 : h.target)}>
        {hd.done ? '✔ Hecho' : 'Marcar'}
      </Button>
    );
  }
  return (
    <li className="list__row dayhabit">
      <div className="dayhabit__text">
        <p className="list__title">
          <HabitDot hd={hd} /> {h.title}
        </p>
        <p className="muted small">{status}</p>
      </div>
      {control}
    </li>
  );
}

export default function Calendario() {
  const tasks = useData((s) => s.tasks);
  const courses = useData((s) => s.courses);
  const habits = useData((s) => s.habits);
  const habitLogs = useData((s) => s.habitLogs);
  const sessions = useData((s) => s.sessions);
  const setTaskStatus = useData((s) => s.setTaskStatus);
  const updateTask = useData((s) => s.updateTask);
  const openModal = useUi((s) => s.openModal);
  const now = today();

  const [view, setView] = useState<View>('week');
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState<ISODate>(now);
  const [over, setOver] = useState<ISODate | null>(null);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const cursorDate = toISODate(cursor);
  const range = useMemo(() => (view === 'week' ? weekDays(cursorDate) : monthGrid(year, month)), [view, cursorDate, year, month]);
  const source = useMemo(() => ({ tasks, courses, habits, habitLogs, sessions }), [tasks, courses, habits, habitLogs, sessions]);
  const days = useMemo(() => calendarDays(source, range[0], range[range.length - 1], now), [source, range, now]);

  const shift = (n: number) => setCursor(view === 'week' ? new Date(year, month, cursor.getDate() + 7 * n) : new Date(year, month + n, 1));
  const goToday = () => {
    setCursor(new Date());
    setSelected(now);
  };

  // El día elegido puede quedar fuera del rango visible (al cambiar de semana), así que se calcula aparte.
  const entry = days.get(selected) ?? calendarDays(source, selected, selected, now).get(selected);
  const undated = useMemo(() => undatedTasks(tasks), [tasks]);
  const overdue = useMemo(() => overdueTasks(tasks, now), [tasks, now]);

  const move = (id: string, date: ISODate) => {
    const t = tasks.find((x) => x.id === id);
    if (t && t.dueDate !== date) updateTask(id, { dueDate: date });
  };
  const openTask = (id: string) => openModal({ type: 'task', id });
  // Toda la casilla elige el día (no solo el número); el botón del número queda para el teclado.
  const dropProps = (d: ISODate) => ({
    onClick: () => setSelected(d),
    onDragOver: (ev: React.DragEvent) => {
      ev.preventDefault();
      if (over !== d) setOver(d);
    },
    onDragLeave: () => setOver((o) => (o === d ? null : o)),
    onDrop: (ev: React.DragEvent) => {
      ev.preventDefault();
      setOver(null);
      const id = ev.dataTransfer.getData('text/plain');
      if (id) move(id, d);
    },
  });

  const title = view === 'week' ? `${shortDate(range[0])} – ${shortDate(range[6])}` : `${monthName(month)} ${year}`;
  const weekMinutes = view === 'week' ? range.reduce((a, d) => a + (days.get(d)?.minutes ?? 0), 0) : 0;

  const summary = (d: ISODate, e?: DayEntry) => {
    const count = (e?.tasks.length ?? 0) + (e?.upcoming.length ?? 0) + (e?.reviews.length ?? 0) + (e?.habits.length ?? 0);
    return `${longDate(d)}${count ? `, ${count} ${count === 1 ? 'elemento' : 'elementos'}` : ''}`;
  };

  const dayIsEmpty = !entry || (!entry.tasks.length && !entry.upcoming.length && !entry.reviews.length && !entry.habits.length && !entry.minutes);

  return (
    <div className="stack">
      <PageHead
        kicker="// Mapa del mundo"
        title="Calendario"
        sprite="flag"
        right={
          <>
            <div className="tabs tabs--sm" role="tablist" aria-label="Vista del calendario">
              {(['week', 'month'] as const).map((v) => (
                <button key={v} type="button" role="tab" aria-selected={view === v} className={cx('tabs__tab', view === v && 'is-on')} onClick={() => setView(v)}>
                  {v === 'week' ? 'Semana' : 'Mes'}
                </button>
              ))}
            </div>
            <Button small onClick={() => shift(-1)} aria-label={view === 'week' ? 'Semana anterior' : 'Mes anterior'}>
              ‹
            </Button>
            <span className="cal-month" aria-live="polite">
              {title}
            </span>
            <Button small onClick={() => shift(1)} aria-label={view === 'week' ? 'Semana siguiente' : 'Mes siguiente'}>
              ›
            </Button>
            <Button small onClick={goToday}>
              Hoy
            </Button>
          </>
        }
      />

      <div className="cols cols--cal">
        <Panel className="calgrid">
          {view === 'week' ? (
            <>
              <p className="muted small">{weekMinutes > 0 ? `Estudiaste ${hoursLabel(weekMinutes)} esta semana.` : 'Aún no hay horas de estudio registradas esta semana.'}</p>
              <div className="calweek" role="grid" aria-label={title}>
                {range.map((d, i) => {
                  const e = days.get(d);
                  return (
                    <div key={d} role="gridcell" aria-selected={d === selected} className={cx('calweek__day', d === now && 'is-today', d === selected && 'is-selected', over === d && 'is-over', d < now && 'is-past')} {...dropProps(d)}>
                      <button type="button" className="calweek__head" onClick={() => setSelected(d)} aria-label={summary(d, e)}>
                        <span className="calweek__wd">{WEEKDAYS_SHORT[i]}</span>
                        <span className="calweek__num">{Number(d.slice(8))}</span>
                        {!!e?.minutes && <span className="calweek__min">{hoursLabel(e.minutes)}</span>}
                      </button>
                      <ul className="calweek__items">
                        {e?.habits.map((hd) => (
                          <li key={hd.habit.id} className={cx('calweek__habit', hd.done && 'is-done', !hd.done && hd.progress > 0 && 'is-partial')} style={{ '--p': `${Math.round(hd.progress * 100)}%` } as React.CSSProperties} title={hd.habit.title}>
                            <span className="calweek__hname">{hd.habit.title}</span>
                            {hd.done ? <span className="calweek__hval">✔</span> : hd.value > 0 && <span className="calweek__hval">{fmt(hd.value)}/{fmt(hd.habit.target)}</span>}
                          </li>
                        ))}
                        {e?.tasks.map((t) => (
                          <li key={t.id}>
                            <TaskChip t={t} now={now} onOpen={openTask} onSelect={() => setSelected(d)} />
                          </li>
                        ))}
                        {!!e?.upcoming.length && (
                          <li className="chip-task chip-task--ghost" title={e.upcoming.map((t) => t.title).join(', ')}>
                            ↻ {e.upcoming.length === 1 ? e.upcoming[0].title : `${e.upcoming.length} repetidas`}
                          </li>
                        )}
                        {!!e?.reviews.length && (
                          <li className="chip-task chip-task--review" title="Repasos">
                            ♪ {e.reviews.length} {e.reviews.length === 1 ? 'repaso' : 'repasos'}
                          </li>
                        )}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="calgrid__head" aria-hidden="true">
                {WEEKDAYS_SHORT.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              <div className="calgrid__body" role="grid" aria-label={title}>
                {range.map((d) => {
                  const e = days.get(d);
                  const inMonth = d.slice(0, 7) === toISODate(new Date(year, month, 1)).slice(0, 7);
                  const heat = Math.min(4, Math.ceil((e?.minutes ?? 0) / 30));
                  return (
                    <div key={d} role="gridcell" aria-selected={d === selected} className={cx('calday', !inMonth && 'is-out', d === now && 'is-today', d === selected && 'is-selected', over === d && 'is-over', d < now && 'is-past', heat > 0 && `calday--heat-${heat}`)} {...dropProps(d)}>
                      <button type="button" className="calday__num" onClick={() => setSelected(d)} aria-label={summary(d, e)}>
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
                        {e?.tasks.slice(0, MAX_CHIPS).map((t) => (
                          <li key={t.id}>
                            <TaskChip t={t} now={now} onOpen={openTask} onSelect={() => setSelected(d)} />
                          </li>
                        ))}
                        {(e?.tasks.length ?? 0) > MAX_CHIPS && <li className="calday__more">+{(e?.tasks.length ?? 0) - MAX_CHIPS} más</li>}
                        {!!e?.upcoming.length && (
                          <li className="chip-task chip-task--ghost" title={e.upcoming.map((t) => t.title).join(', ')}>
                            ↻ {e.upcoming.length === 1 ? e.upcoming[0].title : `${e.upcoming.length} repetidas`}
                          </li>
                        )}
                        {!!e?.reviews.length && (
                          <li className="chip-task chip-task--review" title="Repasos">
                            ♪ {e.reviews.length} {e.reviews.length === 1 ? 'repaso' : 'repasos'}
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
            <span className="chip-task chip-task--boss">Jefe</span> <span className="chip-task chip-task--high">Alta</span> <span className="chip-task chip-task--mid">Media</span> <span className="chip-task chip-task--low">Baja</span>{' '}
            <span className="chip-task chip-task--ghost">↻ Repetida</span> <span className="chip-task chip-task--review">♪ Repaso</span> <span className="hdot hdot--done" /> Hábito hecho <span className="hdot hdot--partial" /> A medias{' '}
            <span className="hdot hdot--due" /> Pendiente · Arrastra una tarea a otro día para cambiar su fecha.
          </p>
        </Panel>

        <div className="stack">
          <Panel kicker={selected === now ? '// Hoy' : '// Día elegido'} title={longDate(selected)} right={<Button small variant="primary" onClick={() => openModal({ type: 'task', dueDate: selected })}>＋ Tarea</Button>}>
            {dayIsEmpty || !entry ? (
              <p className="muted">Día libre. ¡Aprovéchalo o planifica algo!</p>
            ) : (
              <>
                {entry.minutes > 0 && <p className="dayminutes">📚 Estudiaste {hoursLabel(entry.minutes)}</p>}
                <ul className="list">
                  {entry.habits.map((hd) => (
                    <DayHabitRow key={hd.habit.id} hd={hd} date={selected} now={now} />
                  ))}
                  {entry.tasks.map((t: Task) => (
                    <li key={t.id} className="list__row">
                      <label className="list__check">
                        <input type="checkbox" checked={t.status === 'done'} onChange={() => setTaskStatus(t.id, t.status === 'done' ? 'todo' : 'done')} aria-label={`Completar ${t.title}`} />
                        <span>
                          <span className={cx('list__title', t.status === 'done' && 'is-struck')}>
                            {t.priority === 'boss' && <Sprite name="boss" size={14} />} {t.title}
                          </span>
                          <span className="muted small">
                            {courses.find((c) => c.id === t.courseId)?.title ?? 'Side quest'} · +{t.xp} XP{t.recurrence ? ` · ${recurrenceLabel(t.recurrence)}` : ''}
                          </span>
                        </span>
                      </label>
                      <Button small onClick={() => openTask(t.id)}>
                        Editar
                      </Button>
                    </li>
                  ))}
                  {entry.upcoming.map((t) => (
                    <li key={`up-${t.id}`} className="list__row">
                      <div>
                        <p className="list__title">↻ {t.title}</p>
                        <p className="muted small">Se repetirá este día · {t.recurrence ? recurrenceLabel(t.recurrence) : ''}</p>
                      </div>
                    </li>
                  ))}
                  {entry.reviews.length > 0 && (
                    <li className="list__row">
                      <div>
                        <p className="list__title">♪ {entry.reviews.length} {entry.reviews.length === 1 ? 'repaso' : 'repasos'} de flashcards</p>
                        <p className="muted small">{entry.reviews.map((r) => r.title).join(' · ')}</p>
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
            kicker="// Bandeja"
            title="Por programar"
            right={
              overdue.length > 0 ? (
                <Button small onClick={() => overdue.forEach((t) => move(t.id, now))} title="Pasa todas las tareas vencidas a hoy">
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
                <p className="muted small">Arrastra una tarea sobre un día del calendario para ponerle fecha.</p>
              </>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
