import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { dueLabel, today } from '@/core/dates';
import type { Priority, Task, TaskStatus } from '@/core/domain';
import { bossHp, isBoss, recurrenceLabel } from '@/core/tasks';
import { Bar, Button, Empty, PageHead, cx } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';

const COLUMNS: { status: TaskStatus; title: string; sprite: 'qblock' | 'flower' | 'star' }[] = [
  { status: 'todo', title: 'Por jugar', sprite: 'qblock' },
  { status: 'doing', title: 'En juego', sprite: 'flower' },
  { status: 'done', title: 'Superada', sprite: 'star' },
];
const NEXT: Record<TaskStatus, { to: TaskStatus; label: string }> = {
  todo: { to: 'doing', label: '▶ Empezar' },
  doing: { to: 'done', label: '✔ Completar' },
  done: { to: 'todo', label: '↩ Reabrir' },
};
const PRIORITY_LABEL: Record<Priority, string> = { low: 'Baja', mid: 'Media', high: 'Alta', boss: 'Jefe final' };

function TaskCard({ task, courseName }: { task: Task; courseName: string }) {
  const setTaskStatus = useData((s) => s.setTaskStatus);
  const toggleSubtask = useData((s) => s.toggleSubtask);
  const openModal = useUi((s) => s.openModal);
  const overdue = task.status !== 'done' && !!task.dueDate && task.dueDate < today();
  const doneSubs = task.subtasks.filter((s) => s.done).length;
  const boss = isBoss(task) && task.subtasks.length > 0;
  // Los jefes muestran sus subtareas (sus «puntos débiles») desde el principio.
  const [open, setOpen] = useState(boss && task.status !== 'done');
  const next = NEXT[task.status];
  const hp = bossHp(task);

  return (
    <article
      className={cx('task', `task--${task.priority}`, task.status === 'done' && 'is-done', boss && hp.hp === 0 && 'is-defeated')}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
    >
      <div className="split">
        <span className="kicker">{courseName}</span>
        <span className="xp-text">+{task.xp}</span>
      </div>
      <h3 className="task__title">
        {task.priority === 'boss' && <Sprite name={boss ? 'boss' : 'skull'} size={boss ? 22 : 16} />} {task.title}
      </h3>
      {boss && (
        <div className="bossbar">
          <div className="bossbar__hearts" role="img" aria-label={`Vida del jefe: ${hp.hp} de ${hp.max}`}>
            {hp.max <= 10 ? (
              Array.from({ length: hp.max }, (_, i) => (
                <span key={i} className={cx(i >= hp.hp && 'is-empty')}>
                  <Sprite name="heart" size={15} />
                </span>
              ))
            ) : (
              <Bar pct={hp.pct} tone="red" label="Vida del jefe" />
            )}
          </div>
          <span className="kicker">{hp.hp === 0 ? '¡DERROTADO!' : `HP ${hp.hp}/${hp.max}`}</span>
        </div>
      )}
      <div className="tags">
        <span className={cx('tag', overdue ? 'tag--red' : 'tag--plain')}>{dueLabel(task.dueDate)}</span>
        {task.estimateMin > 0 && <span className="tag tag--plain">{task.estimateMin >= 60 ? `${+(task.estimateMin / 60).toFixed(1)} h` : `${task.estimateMin} min`}</span>}
        <span className="tag tag--plain">{PRIORITY_LABEL[task.priority]}</span>
        {task.recurrence && <span className="tag tag--blue" title="Al completarla se crea la siguiente">↻ {recurrenceLabel(task.recurrence)}</span>}
        {task.subtasks.length > 0 && (
          <button type="button" className="tag tag--plain tag--btn" onClick={() => setOpen(!open)} aria-expanded={open}>
            {doneSubs}/{task.subtasks.length} {boss ? 'golpes' : 'subtareas'} {open ? '−' : '+'}
          </button>
        )}
      </div>
      {open && (
        <ul className="subtasks">
          {task.subtasks.map((s) => (
            <li key={s.id}>
              <label>
                <input type="checkbox" checked={s.done} onChange={() => toggleSubtask(task.id, s.id)} disabled={task.status === 'done'} />
                <span className={cx(s.done && 'is-struck')}>{s.title}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="task__actions">
        <Button variant={task.status === 'doing' ? 'primary' : 'ghost'} small block onClick={() => setTaskStatus(task.id, next.to)}>
          {next.label}
        </Button>
        <Button small onClick={() => openModal({ type: 'task', id: task.id })} aria-label={`Editar ${task.title}`}>
          Editar
        </Button>
      </div>
    </article>
  );
}

export default function Tareas() {
  const tasks = useData((s) => s.tasks);
  const courses = useData((s) => s.courses);
  const openModal = useUi((s) => s.openModal);
  const [filter, setFilter] = useState('all');
  const [over, setOver] = useState<TaskStatus | null>(null);
  const setTaskStatus = useData((s) => s.setTaskStatus);
  const [params, setParams] = useSearchParams();

  // Atajo de la PWA: /tareas?nuevo=1
  useEffect(() => {
    if (params.get('nuevo')) {
      openModal({ type: 'task' });
      setParams({}, { replace: true });
    }
  }, [params, setParams, openModal]);

  const courseName = (id: string | null) => courses.find((c) => c.id === id)?.title ?? 'Side quest';
  const visible = useMemo(() => tasks.filter((t) => filter === 'all' || (filter === 'none' ? !t.courseId : t.courseId === filter)), [tasks, filter]);
  const byStatus = (st: TaskStatus) =>
    visible
      .filter((t) => t.status === st)
      .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || b.xp - a.xp);

  return (
    <div className="stack">
      <PageHead
        kicker="// Tablero de contratos"
        title="Tareas"
        sprite="qblock"
        right={
          <>
            <select className="input input--inline" aria-label="Filtrar por curso" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">Todos los cursos</option>
              <option value="none">Side quests</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <Button variant="primary" onClick={() => openModal({ type: 'task' })}>
              ＋ Nueva tarea
            </Button>
          </>
        }
      />
      {tasks.length === 0 ? (
        <div className="panel">
          <Empty sprite="qblock" title="Bloque ? sin romper">
            <p>Aquí vivirán tus tareas. Cada una que completes te da XP y monedas.</p>
            <Button variant="primary" onClick={() => openModal({ type: 'task' })}>
              Crear primera tarea
            </Button>
          </Empty>
        </div>
      ) : (
        <div className="board">
          {COLUMNS.map((col) => {
            const items = byStatus(col.status);
            return (
              <section
                key={col.status}
                className={cx('column', `column--${col.status}`, over === col.status && 'is-over')}
                aria-label={col.title}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (over !== col.status) setOver(col.status);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver(null);
                  const id = e.dataTransfer.getData('text/plain');
                  if (id) setTaskStatus(id, col.status);
                }}
              >
                <h2 className="column__head">
                  <Sprite name={col.sprite} size={18} />
                  {col.title} <span className="column__n">[{items.length}]</span>
                </h2>
                {items.length === 0 && <p className="muted small column__empty">{col.status === 'done' ? 'Aún no has superado ninguna.' : 'Vacío.'} Arrastra una tarea aquí.</p>}
                {items.map((t) => (
                  <TaskCard key={t.id} task={t} courseName={courseName(t.courseId)} />
                ))}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
