import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { minutesOfDay, today } from '@/core/dates';
import type { Task } from '@/core/domain';
import { validateEvent } from '@/core/agenda';
import { planTaskSlots, slotLabel, taskBlockDrafts, taskBlocks } from '@/core/routine';
import { Button, Tag } from '@/ui/kit';

/**
 * Cuándo hacer una tarea: propone ratos libres (fuera de tu trabajo y de lo que ya tienes, antes de su plazo) y, al
 * aceptar, los reserva en el calendario como bloques vinculados a la tarea. Completarla se sigue haciendo en la tarea.
 */
export function TaskScheduler({ task }: Readonly<{ task: Task }>) {
  const events = useData((s) => s.events);
  const habits = useData((s) => s.habits);
  const tasks = useData((s) => s.tasks);
  const habitLogs = useData((s) => s.habitLogs);
  const createEvent = useData((s) => s.createEvent);
  const openModal = useUi((s) => s.openModal);
  const toast = useUi((s) => s.toast);
  const blocks = taskBlocks(events, task.id);
  const now = today();

  const plan = useMemo(
    () => (blocks.length || task.status === 'done' || !events.length ? null : planTaskSlots([task], { events, habits, tasks, habitLogs }, now, minutesOfDay())),
    [blocks.length, task, events, habits, tasks, habitLogs, now],
  );

  if (task.status === 'done') return null;

  if (blocks.length > 0) {
    return (
      <div className="sched sched--done">
        <p className="kicker">Cuándo hacerla</p>
        <ul className="sched__list">
          {blocks.slice(0, 4).map((b) => (
            <li key={b.id}>
              <Tag tone="green">🕒</Tag> {slotLabel({ date: b.date, start: b.start ?? '00:00', minutes: b.minutes }, now)}
            </li>
          ))}
        </ul>
        <p className="muted small">
          {blocks.length > 4 && `y ${blocks.length - 4} más. `}Cámbialo en el <Link to="/calendario">calendario</Link>.
        </p>
      </div>
    );
  }

  if (!events.length) {
    return (
      <div className="sched">
        <p className="kicker">Cuándo hacerla</p>
        <p className="muted small">
          Cuéntame tu horario y te sugiero un rato libre para esta tarea.{' '}
          <button type="button" className="link" onClick={() => openModal({ type: 'routine' })}>
            Contar mi horario
          </button>
        </p>
      </div>
    );
  }

  const apply = () => {
    if (!plan?.slots.length) return;
    const drafts = taskBlockDrafts(task, plan.slots);
    const problem = drafts.map((d) => validateEvent(d)).find(Boolean);
    if (problem) return void toast({ kind: 'error', title: 'No se pudo reservar', body: problem });
    drafts.forEach((d) => createEvent(d));
    toast({ kind: 'info', title: 'Rato reservado', body: `${task.title}: ${drafts.length === 1 ? slotLabel(plan.slots[0], now) : `${drafts.length} sesiones en tu calendario`}.` });
  };

  return (
    <div className="sched">
      <p className="kicker">Cuándo hacerla</p>
      {plan?.slots.length ? (
        <>
          <ul className="sched__list">
            {plan.slots.map((s) => (
              <li key={`${s.date}${s.start}`}>🕒 {slotLabel(s, now)}</li>
            ))}
          </ul>
          <div className="row">
            <Button small variant="primary" onClick={apply}>
              Reservar en mi calendario
            </Button>
          </div>
        </>
      ) : (
        <p className="muted small">No encuentro un rato libre antes de su plazo. Libera tiempo en el calendario o muévele la fecha.</p>
      )}
      {plan && plan.unplaced.length > 0 && plan.slots.length > 0 && <p className="muted small">⚠ No cabe todo antes del plazo: faltarían {plan.unplaced[0].left} min. Considera moverle la fecha.</p>}
    </div>
  );
}
