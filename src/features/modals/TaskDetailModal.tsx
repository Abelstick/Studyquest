import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { difficultyInfo, difficultyOf } from '@/core/difficulty';
import { deadlineText } from '@/core/missions';
import { NEXT_STATUS, PRIORITY_LABEL, STATUS_LABEL, bossHp, isBoss, isOverdue, recurrenceLabel, taskReward, timeLeftLabel } from '@/core/tasks';
import type { TaskStatus } from '@/core/domain';
import { Bar, Button, Modal, Tag, cx } from '@/ui/kit';
import { TaskScheduler } from '@/features/calendario/TaskScheduler';

const STATUS_TONE: Record<TaskStatus, 'plain' | 'blue' | 'green'> = { todo: 'plain', doing: 'blue', done: 'green' };

/** Ficha de una tarea desde Hoy: plazo, prioridad, desglose y las acciones de siempre sin salir de la pantalla. */
export function TaskDetailModal({ id }: { id: string }) {
  const task = useData((s) => s.tasks.find((t) => t.id === id));
  const course = useData((s) => s.courses.find((c) => c.id === task?.courseId));
  const setTaskStatus = useData((s) => s.setTaskStatus);
  const toggleSubtask = useData((s) => s.toggleSubtask);
  const close = useUi((s) => s.closeModal);
  const openModal = useUi((s) => s.openModal);

  // Si la tarea se borra mientras la ficha está abierta, no queda nada que enseñar.
  useEffect(() => {
    if (!task) close();
  }, [task, close]);
  if (!task) return null;

  const done = task.status === 'done';
  const overdue = isOverdue(task);
  const left = done ? null : timeLeftLabel(task);
  const boss = isBoss(task);
  const hp = bossHp(task);
  const doneSubs = task.subtasks.filter((s) => s.done).length;
  // Con el desglose terminado el siguiente paso ya no es «empezar», sino cerrarla.
  const ready = task.subtasks.length > 0 && doneSubs === task.subtasks.length && !done;
  const next = NEXT_STATUS[task.status];

  const facts: [string, string][] = [
    ['Plazo', deadlineText(task)],
    ...(left ? ([['Falta', left]] as [string, string][]) : []),
    ...(task.estimateMin > 0 ? ([['Estimación', task.estimateMin >= 60 ? `${+(task.estimateMin / 60).toFixed(1)} h` : `${task.estimateMin} min`]] as [string, string][]) : []),
    ...(difficultyOf(task) !== 'normal' ? ([['Dificultad', difficultyInfo(difficultyOf(task)).label]] as [string, string][]) : []),
    ...(task.recurrence ? ([['Se repite', recurrenceLabel(task.recurrence)]] as [string, string][]) : []),
    ...(task.tags.length > 0 ? ([['Etiquetas', task.tags.join(', ')]] as [string, string][]) : []),
    ['Recompensa', `+${taskReward(task)} XP`],
  ];

  return (
    <Modal title={task.title} kicker={`${course?.title ?? 'Side quest'}`} onClose={close} wide>
      <div className="detail__status">
        <Tag tone={STATUS_TONE[task.status]}>{STATUS_LABEL[task.status]}</Tag>
        <Tag tone={boss ? 'red' : 'plain'}>{PRIORITY_LABEL[task.priority]}</Tag>
        {overdue && <Tag tone="red">Vencida</Tag>}
      </div>

      {boss && (
        <section className="detail__today" aria-label="Vida del jefe">
          <div className="split">
            <span className="kicker">Vida del jefe</span>
            <b>{hp.hp === 0 ? '¡Derrotado!' : `HP ${hp.hp}/${hp.max}`}</b>
          </div>
          <Bar pct={hp.pct} tone="red" label="Vida del jefe" />
        </section>
      )}

      {task.subtasks.length > 0 && (
        <section aria-label={boss ? 'Golpes al jefe' : 'Subtareas'}>
          <div className="split">
            <p className="kicker">{boss ? 'Puntos débiles' : 'Subtareas'}</p>
            <span className="muted small">
              {doneSubs}/{task.subtasks.length}
            </span>
          </div>
          <ul className="subtasks">
            {task.subtasks.map((s) => (
              <li key={s.id}>
                <label>
                  <input type="checkbox" checked={s.done} onChange={() => toggleSubtask(task.id, s.id)} disabled={done} />
                  <span className={cx(s.done && 'is-struck')}>{s.title}</span>
                </label>
              </li>
            ))}
          </ul>
          {ready && <p className="task__ready">✔ Todo el desglose hecho: solo falta darla por terminada.</p>}
        </section>
      )}

      <section aria-label="Cuándo hacerla">
        <TaskScheduler task={task} />
      </section>

      <dl className="kv">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      <div className="modal__actions">
        <Button variant={ready || task.status === 'doing' ? 'primary' : 'ghost'} onClick={() => setTaskStatus(task.id, ready ? 'done' : next.to)}>
          {ready ? '✔ Completar' : next.label}
        </Button>
        <Button onClick={() => openModal({ type: 'task', id: task.id })}>Editar</Button>
        <Link className="btn btn--ghost" to={`/tareas?tarea=${encodeURIComponent(task.id)}`} onClick={close}>
          Ver en el tablero
        </Link>
      </div>
    </Modal>
  );
}
