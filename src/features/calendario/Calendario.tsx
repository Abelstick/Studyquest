import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { calendarDays, monthGrid } from '@/core/calendar';
import { longDate, monthName, today, toISODate, WEEKDAYS_SHORT } from '@/core/dates';
import type { ISODate, Task } from '@/core/domain';
import { recurrenceLabel } from '@/core/tasks';
import { Button, PageHead, Panel, cx } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';

const MAX_CHIPS = 3;

export default function Calendario() {
  const tasks = useData((s) => s.tasks);
  const courses = useData((s) => s.courses);
  const setTaskStatus = useData((s) => s.setTaskStatus);
  const updateTask = useData((s) => s.updateTask);
  const openModal = useUi((s) => s.openModal);
  const now = today();

  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState<ISODate>(now);
  const [over, setOver] = useState<ISODate | null>(null);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const grid = useMemo(() => monthGrid(year, month), [year, month]);
  const days = useMemo(() => calendarDays({ tasks, courses }, grid[0], grid[41], now), [tasks, courses, grid, now]);
  const shift = (n: number) => setCursor(new Date(year, month + n, 1));
  const goToday = () => {
    setCursor(new Date());
    setSelected(now);
  };

  const entry = days.get(selected);
  const undated = tasks.filter((t) => !t.dueDate && t.status !== 'done').length;
  const overdue = tasks.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate < now).length;

  const move = (id: string, date: ISODate) => {
    const t = tasks.find((x) => x.id === id);
    if (t && t.dueDate !== date) updateTask(id, { dueDate: date });
  };

  return (
    <div className="stack">
      <PageHead
        kicker="// Mapa del mundo"
        title="Calendario"
        sprite="flag"
        right={
          <>
            <Button small onClick={() => shift(-1)} aria-label="Mes anterior">
              ‹
            </Button>
            <span className="cal-month" aria-live="polite">
              {monthName(month)} {year}
            </span>
            <Button small onClick={() => shift(1)} aria-label="Mes siguiente">
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
          <div className="calgrid__head" aria-hidden="true">
            {WEEKDAYS_SHORT.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="calgrid__body" role="grid" aria-label={`${monthName(month)} ${year}`}>
            {grid.map((d) => {
              const e = days.get(d);
              const inMonth = d.slice(0, 7) === toISODate(new Date(year, month, 1)).slice(0, 7);
              const dayNum = Number(d.slice(8));
              const count = (e?.tasks.length ?? 0) + (e?.upcoming.length ?? 0) + (e?.reviews.length ?? 0);
              return (
                <div
                  key={d}
                  role="gridcell"
                  aria-selected={d === selected}
                  className={cx('calday', !inMonth && 'is-out', d === now && 'is-today', d === selected && 'is-selected', over === d && 'is-over', d < now && 'is-past')}
                  onDragOver={(ev) => {
                    ev.preventDefault();
                    if (over !== d) setOver(d);
                  }}
                  onDragLeave={() => setOver((o) => (o === d ? null : o))}
                  onDrop={(ev) => {
                    ev.preventDefault();
                    setOver(null);
                    const id = ev.dataTransfer.getData('text/plain');
                    if (id) move(id, d);
                  }}
                >
                  <button type="button" className="calday__num" onClick={() => setSelected(d)} aria-label={`${longDate(d)}${count ? `, ${count} ${count === 1 ? 'elemento' : 'elementos'}` : ''}`}>
                    {dayNum}
                  </button>
                  <ul className="calday__items">
                    {e?.tasks.slice(0, MAX_CHIPS).map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          draggable
                          onDragStart={(ev) => {
                            ev.dataTransfer.setData('text/plain', t.id);
                            ev.dataTransfer.effectAllowed = 'move';
                          }}
                          className={cx('chip-task', `chip-task--${t.priority}`, t.status === 'done' && 'is-done', t.status !== 'done' && t.dueDate! < now && 'is-late')}
                          onClick={() => {
                            setSelected(d);
                            openModal({ type: 'task', id: t.id });
                          }}
                          title={t.title}
                        >
                          {t.recurrence && <span aria-hidden="true">↻ </span>}
                          {t.title}
                        </button>
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
          <p className="muted small calgrid__legend">
            <span className="chip-task chip-task--boss">Jefe</span> <span className="chip-task chip-task--high">Alta</span> <span className="chip-task chip-task--mid">Media</span> <span className="chip-task chip-task--low">Baja</span>{' '}
            <span className="chip-task chip-task--ghost">↻ Repetida</span> <span className="chip-task chip-task--review">♪ Repaso</span> · Arrastra una tarea a otro día para cambiar su fecha.
          </p>
        </Panel>

        <div className="stack">
          <Panel kicker={selected === now ? '// Hoy' : '// Día elegido'} title={longDate(selected)} right={<Button small variant="primary" onClick={() => openModal({ type: 'task', dueDate: selected })}>＋ Tarea</Button>}>
            {!entry || (!entry.tasks.length && !entry.upcoming.length && !entry.reviews.length) ? (
              <p className="muted">Día libre. ¡Aprovéchalo o planifica algo!</p>
            ) : (
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
                          {courses.find((c) => c.id === t.courseId)?.title ?? 'Side quest'} · +{t.xp} XP{t.recurrence ? ` · ${recurrenceLabel(t.recurrence)}` : ''}
                        </span>
                      </span>
                    </label>
                    <Button small onClick={() => openModal({ type: 'task', id: t.id })}>
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
            )}
          </Panel>
          <Panel kicker="// Resumen" title="Pendientes">
            <dl className="stat-grid">
              <div>
                <dt>Vencidas</dt>
                <dd className={cx(overdue > 0 && 'is-hot')}>{overdue}</dd>
              </div>
              <div>
                <dt>Sin fecha</dt>
                <dd>{undated}</dd>
              </div>
            </dl>
            {undated > 0 && <p className="muted small">Las tareas sin fecha no salen en el calendario. Edítalas para ponerles una.</p>}
          </Panel>
        </div>
      </div>
    </div>
  );
}
