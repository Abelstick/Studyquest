import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { diffDays, dueLabel, today } from '@/core/dates';
import type { Task, TaskStatus } from '@/core/domain';
import { NEXT_STATUS, PRIORITY_LABEL, bossHp, dueTimeOf, isBoss, isOverdue, recurrenceLabel, timeLeftLabel } from '@/core/tasks';
import { CONCEPTS } from '@/core/concepts';
import { GuideButton } from '@/features/help/ConceptGuide';
import { difficultyInfo, difficultyOf } from '@/core/difficulty';
import { Bar, Button, Empty, PageHead, cx } from '@/ui/kit';
import { LateBanner } from './LateBanner';
import { AreaFilterSelect, AreaTag } from '@/ui/Area';
import { slotLabel, taskBlocks } from '@/core/routine';
import { matchesArea, type AreaFilter } from '@/core/areas';
import type { AreaId } from '@/core/domain';
import { Sprite } from '@/ui/Sprite';
import { Icon } from '@/ui/Icon';
import { useFlipReorder } from '@/ui/motion';

const COLUMNS: { status: TaskStatus; title: string; sprite: 'qblock' | 'flower' | 'star' }[] = [
  { status: 'todo', title: 'Por jugar', sprite: 'qblock' },
  { status: 'doing', title: 'En juego', sprite: 'flower' },
  { status: 'done', title: 'Superada', sprite: 'star' },
];
/** Orden por vencimiento: fecha y, dentro del día, hora (las de sin hora al final del día; sin fecha, al final). */
const dueKey = (t: Task) => `${t.dueDate ?? '9999'} ${dueTimeOf(t) ?? '99'}`;

function TaskCard({ task, courseName, highlighted }: { task: Task; courseName: string; highlighted?: boolean }) {
  const setTaskStatus = useData((s) => s.setTaskStatus);
  const toggleSubtask = useData((s) => s.toggleSubtask);
  const openModal = useUi((s) => s.openModal);
  const overdue = isOverdue(task);
  const nextBlock = useData((s) => taskBlocks(s.events, task.id).find((b) => b.date >= today()));
  const daysLeft = timeLeftLabel(task);
  const dueTime = dueTimeOf(task);
  const soon = !overdue && !!task.dueDate && diffDays(task.dueDate, today()) <= 2;
  const doneSubs = task.subtasks.filter((s) => s.done).length;
  const boss = isBoss(task) && task.subtasks.length > 0;
  // Los jefes muestran sus subtareas (sus «puntos débiles») desde el principio.
  const [open, setOpen] = useState(boss && task.status !== 'done');
  const next = NEXT_STATUS[task.status];
  const hp = bossHp(task);
  // Subtareas todas hechas: no se cierra sola, pero se nota que solo falta pulsar «Completar».
  const ready = task.subtasks.length > 0 && doneSubs === task.subtasks.length && task.status !== 'done';

  return (
    <article
      id={`tarea-${task.id}`}
      className={cx('task', `task--${task.priority}`, task.status === 'done' && 'is-done', boss && hp.hp === 0 && 'is-defeated', ready && 'is-ready', highlighted && 'is-target')}
      data-flip-id={task.id}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
    >
      <div className="split">
        {/* El curso lleva a su pantalla; las side quests no tienen adónde ir. */}
        {task.courseId ? (
          <Link className="kicker task__course" to={`/cursos/${task.courseId}`} draggable={false}>
            {courseName}
          </Link>
        ) : (
          <span className="kicker">{courseName}</span>
        )}
        <span className="task__xp">+{task.xp} XP</span>
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
        <span className={cx('tag', overdue ? 'tag--red' : 'tag--plain')}>{dueLabel(task.dueDate)}{dueTime && ` · ${dueTime}`}</span>
        {task.status !== 'done' && daysLeft && <span className={cx('tag', overdue ? 'tag--red' : soon ? 'tag--xp' : 'tag--plain')}>{daysLeft}</span>}
        {task.estimateMin > 0 && <span className="tag tag--plain">{task.estimateMin >= 60 ? `${+(task.estimateMin / 60).toFixed(1)} h` : `${task.estimateMin} min`}</span>}
        <span className="tag tag--plain">{PRIORITY_LABEL[task.priority]}</span>
        <AreaTag area={task.area} />
        {nextBlock && task.status !== 'done' && <span className="tag tag--blue" title="Rato reservado en tu calendario">{slotLabel({ date: nextBlock.date, start: nextBlock.start ?? '00:00', minutes: nextBlock.minutes }, today())}</span>}
        {difficultyOf(task) !== 'normal' && <span className="tag tag--xp" title={difficultyInfo(difficultyOf(task)).hint}>{difficultyInfo(difficultyOf(task)).label}</span>}
        {task.recurrence && (
          <span className="tag tag--blue" title="Al completarla se crea la siguiente">
            <Icon name="sync" size={10} /> {recurrenceLabel(task.recurrence)}
          </span>
        )}
        {task.subtasks.length > 0 && (
          <button type="button" className={cx('tag tag--btn', ready ? 'tag--green' : 'tag--plain')} onClick={() => setOpen(!open)} aria-expanded={open}>
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
      {ready && (
        <p className="task__ready">
          <Icon name="check" size={10} /> Todo el desglose hecho: solo falta darla por terminada.
        </p>
      )}
      <div className="task__actions">
        {/* Con el desglose terminado el siguiente paso ya no es «empezar», sino cerrarla. */}
        <Button variant={ready || task.status === 'doing' ? 'primary' : 'ghost'} small block onClick={() => setTaskStatus(task.id, ready ? 'done' : next.to)}>
          {ready ? (
            <>
              <Icon name="check" size={12} /> Completar
            </>
          ) : (
            next.label
          )}
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
  const [areaFilter, setAreaFilter] = useState<AreaFilter>('all');
  const [over, setOver] = useState<TaskStatus | null>(null);
  const setTaskStatus = useData((s) => s.setTaskStatus);
  const [params, setParams] = useSearchParams();

  // Enlace directo a una tarea (/tareas?tarea=<id>, desde la búsqueda o el calendario): se muestra, se trae a la vista y se resalta.
  const target = params.get('tarea');
  const [highlight, setHighlight] = useState<string | null>(null);
  const targetExists = !!target && tasks.some((t) => t.id === target);
  useEffect(() => {
    if (!target || !targetExists) return;
    setFilter('all');
    setHighlight(target);
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('tarea');
        return next;
      },
      { replace: true },
    );
  }, [target, targetExists, setParams]);
  useEffect(() => {
    if (!highlight) return;
    document.getElementById(`tarea-${highlight}`)?.scrollIntoView({ block: 'center' });
    const t = setTimeout(() => setHighlight(null), 2500);
    return () => clearTimeout(t);
  }, [highlight]);

  // Atajo de la PWA: /tareas?nuevo=1
  useEffect(() => {
    if (params.get('nuevo')) {
      openModal({ type: 'task' });
      setParams({}, { replace: true });
    }
  }, [params, setParams, openModal]);

  const courseName = (id: string | null) => courses.find((c) => c.id === id)?.title ?? 'Side quest';
  const usedAreas = useMemo(() => new Set<AreaId>(tasks.flatMap((t) => (t.area ? [t.area] : []))), [tasks]);
  const visible = useMemo(
    () => tasks.filter((t) => (filter === 'all' || (filter === 'none' ? !t.courseId : t.courseId === filter)) && matchesArea(t, areaFilter)),
    [tasks, filter, areaFilter],
  );
  const byStatus = (st: TaskStatus) =>
    visible
      .filter((t) => t.status === st)
      .sort((a, b) => dueKey(a).localeCompare(dueKey(b)) || b.xp - a.xp);
  // Una tarea que cambia de columna (con su botón o arrastrándola) viaja hasta su sitio nuevo con Flip.
  const boardRef = useRef<HTMLDivElement>(null);
  const order = visible.map((t) => `${t.id}:${t.status}`).join('|');
  const capture = useFlipReorder(boardRef, '.task', order);

  return (
    <div className="stack">
      <PageHead
        kicker="Tablero de contratos"
        title="Tareas"
        sprite="qblock"
        hint={CONCEPTS.tarea.hint}
        right={
          <>
            <GuideButton />
            <select className="input input--inline" aria-label="Filtrar por curso" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">Todos los cursos</option>
              <option value="none">Side quests</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <AreaFilterSelect value={areaFilter} onChange={setAreaFilter} used={usedAreas} />
            <Button variant="primary" onClick={() => openModal({ type: 'task' })}>
              <Icon name="plus" size={12} /> Nueva tarea
            </Button>
          </>
        }
      />
      <LateBanner />
      {tasks.length === 0 ? (
        <div className="panel">
          <Empty sprite="qblock" title="Aún no hay contratos">
            <p>Una tarea es algo concreto que haces una vez y se termina: entregar un trabajo, resolver unos ejercicios. Cada una que completes te da XP y monedas.</p>
            <p className="muted small">¿Algo que repites cada día? Eso es un hábito. ¿Dudas? Pulsa «¿Cuál uso?».</p>
            <Button variant="primary" onClick={() => openModal({ type: 'task' })}>
              Crear primera tarea
            </Button>
          </Empty>
        </div>
      ) : (
        <div className="board" ref={boardRef} onClickCapture={capture} onDropCapture={capture}>
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
                  <Sprite name={col.sprite} size={20} />
                  {col.title} <span className="column__n">{items.length}</span>
                </h2>
                {items.length === 0 && <p className="muted small column__empty">{col.status === 'done' ? 'Aún no has superado ninguna.' : 'Vacío.'} Arrastra una tarea aquí.</p>}
                {items.map((t) => (
                  <TaskCard key={t.id} task={t} courseName={courseName(t.courseId)} highlighted={t.id === highlight} />
                ))}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
