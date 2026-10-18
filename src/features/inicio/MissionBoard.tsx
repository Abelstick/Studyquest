import { useMemo, useState } from 'react';
import { useUi } from '@/state/ui';
import { dayProgress, missionUrgency, taskBucket, type Mission, type TaskBucket } from '@/core/missions';
import { Bar, Button, Empty, cx } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';
import { MissionCard } from './MissionCard';

type MissionSort = 'urgency' | 'xp' | 'name';
type Lane = 'habit' | 'task';

const SORTS: { value: MissionSort; label: string }[] = [
  { value: 'urgency', label: 'Más urgente' },
  { value: 'xp', label: 'Más XP' },
  { value: 'name', label: 'A–Z' },
];
/** Cuántas misiones se enseñan de entrada en cada grupo; el resto queda tras «Ver más». */
const SHOW_HABITS = 8;
const SHOW_URGENT = 8;
const SHOW_OTHER = 3;

const BUCKETS: { id: TaskBucket; label: string }[] = [
  { id: 'late', label: 'Vencidas · hazlas primero' },
  { id: 'today', label: 'Para hoy' },
  { id: 'soon', label: 'Próximos 7 días' },
  { id: 'later', label: 'Más adelante' },
  { id: 'none', label: 'Sin fecha' },
];

/** Ordena sin mover lo hecho de sitio: lo pendiente va primero y, dentro, el criterio elegido. */
function sortMissions(items: Mission[], sort: MissionSort): Mission[] {
  const by = (a: Mission, b: Mission) => {
    if (sort === 'xp') return b.xp - a.xp;
    if (sort === 'name') return a.title.localeCompare(b.title, 'es');
    return missionUrgency(a) - missionUrgency(b) || b.xp - a.xp;
  };
  return [...items].sort((a, b) => Number(a.done) - Number(b.done) || by(a, b));
}

/** Lista con «Ver más / Ver menos»: enseña las primeras y esconde el resto sin perderlas. */
function MissionList({ items, limit }: { items: Mission[]; limit: number }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, limit);
  return (
    <>
      <ul className="missions">
        {shown.map((m) => (
          <MissionCard key={m.id} m={m} />
        ))}
      </ul>
      {items.length > limit && (
        <button type="button" className="btn btn--ghost btn--sm missions__more" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
          {expanded ? 'Ver menos' : `Ver ${items.length - shown.length} más`}
        </button>
      )}
    </>
  );
}

interface LaneHeadProps {
  kind: Lane;
  title: string;
  done: number;
  total: number;
  addLabel: string;
  onAdd: () => void;
}

/** Cabecera de una columna: nombre, cuántas van hechas, barra de avance y el botón de crear. */
function LaneHead({ kind, title, done, total, addLabel, onAdd }: LaneHeadProps) {
  return (
    <header className="lane__head">
      <h3 className="lane__title" id={`lane-${kind}`}>
        <Sprite name={kind === 'habit' ? 'flower' : 'qblock'} size={18} />
        {title}
        <span className="lane__count">
          {done}/{total}
        </span>
      </h3>
      <button type="button" className="lane__add" onClick={onAdd} aria-label={addLabel} title={addLabel}>
        ＋
      </button>
      <Bar className="lane__bar" pct={total ? (done / total) * 100 : 0} tone={kind === 'habit' ? 'green' : 'blue'} segments={total} label={`${title} hechos hoy`} />
    </header>
  );
}

interface MissionBoardProps {
  missions: Mission[];
  /** Si no hay ninguno creado, la columna invita a crear el primero en vez de decir que hoy no toca. */
  hasHabits: boolean;
  hasTasks: boolean;
}

/**
 * Las misiones de hoy en dos columnas con identidad propia: hábitos (constancia) y tareas (plazos y prioridad).
 * En pantallas pequeñas se ve una columna a la vez y se cambia con el selector de arriba.
 */
export function MissionBoard({ missions, hasHabits, hasTasks }: Readonly<MissionBoardProps>) {
  const openModal = useUi((s) => s.openModal);
  const progress = useMemo(() => dayProgress(missions), [missions]);
  // En móvil, si hay tareas vencidas se abre directamente en Tareas: es lo que más apremia.
  const [lane, setLane] = useState<Lane>(() => (progress.late > 0 ? 'task' : 'habit'));
  const [sort, setSort] = useState<MissionSort>('urgency');
  const [onlyPending, setOnlyPending] = useState(false);
  // En móvil, ordenar y filtrar quedan plegados: casi nunca se tocan y empujan la lista hacia abajo.
  const [toolsOpen, setToolsOpen] = useState(false);

  const pick = (kind: Mission['kind']) => sortMissions(missions.filter((m) => m.kind === kind && (!onlyPending || !m.done)), sort);
  const habits = pick('habit');
  const tasks = pick('task');
  // Las tareas se agrupan por cuándo tocan, para ver de un vistazo qué es de hoy y qué puede esperar.
  const taskGroups = BUCKETS.map((b) => ({ ...b, items: tasks.filter((m) => m.kind === 'task' && taskBucket(m.task) === b.id) })).filter((g) => g.items.length > 0);

  const habitEmpty = !hasHabits ? 'none' : progress.habitsTotal === 0 ? 'off' : 'clear';
  const taskEmpty = !hasTasks ? 'none' : progress.tasksTotal === 0 ? 'off' : 'clear';
  const toolsActive = onlyPending || sort !== 'urgency';

  const switcher: { id: Lane; label: string; sprite: 'flower' | 'qblock'; count: string; alert?: number }[] = [
    { id: 'habit', label: 'Hábitos', sprite: 'flower', count: `${progress.habitsDone}/${progress.habitsTotal}` },
    { id: 'task', label: 'Tareas', sprite: 'qblock', count: `${progress.tasksDone}/${progress.tasksTotal}`, alert: progress.late },
  ];

  return (
    <section className="today-board" aria-label="Misiones de hoy">
      <div className="today-board__bar">
        <div>
          <p className="kicker">// Quest diaria</p>
          <h2 className="today-board__title">Tu misión de hoy</h2>
        </div>
        <div className="today-board__ctl">
          <span className="kicker today-board__xp">{progress.xpLeft} XP en juego</span>
          <button type="button" className="btn btn--ghost btn--sm mtools__toggle" aria-expanded={toolsOpen} aria-controls="mtools" onClick={() => setToolsOpen(!toolsOpen)}>
            {toolsOpen ? 'Ocultar orden y filtros' : `Ordenar y filtrar${toolsActive ? ' (activos)' : ''}`}
          </button>
          <div className={cx('mtools', toolsOpen && 'is-open')} id="mtools">
            <label className="mtools__sort">
              <span className="muted small">Ordenar</span>
              <select className="input input--inline" value={sort} onChange={(e) => setSort(e.target.value as MissionSort)} aria-label="Ordenar misiones">
                {SORTS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="mtools__check">
              <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} /> <span className="small">Solo pendientes</span>
            </label>
          </div>
        </div>
      </div>

      <div className="tabs lane-switch" role="group" aria-label="Qué columna ver">
        {switcher.map((t) => (
          <button key={t.id} type="button" aria-pressed={t.id === lane} className={cx('tabs__tab', `tabs__tab--${t.id}`, t.id === lane && 'is-on')} onClick={() => setLane(t.id)}>
            <Sprite name={t.sprite} size={16} />
            {t.label}
            <span className="tabs__count">{t.count}</span>
            {!!t.alert && (
              <span className="tabs__alert" title={`${t.alert} vencidas`}>
                {t.alert}
                <span className="sr-only"> vencidas</span>
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="lanes">
        <section className={cx('lane lane--habit', lane === 'habit' && 'is-shown')} aria-labelledby="lane-habit">
          <LaneHead kind="habit" title="Hábitos" done={progress.habitsDone} total={progress.habitsTotal} addLabel="Nuevo hábito" onAdd={() => openModal({ type: 'habit' })} />
          {habits.length > 0 ? (
            <MissionList key={`habit-${sort}-${onlyPending}`} items={habits} limit={SHOW_HABITS} />
          ) : (
            <LaneEmpty kind="habit" state={habitEmpty} onCreate={() => openModal({ type: 'habit' })} />
          )}
        </section>

        <section className={cx('lane lane--task', lane === 'task' && 'is-shown')} aria-labelledby="lane-task">
          <LaneHead kind="task" title="Tareas" done={progress.tasksDone} total={progress.tasksTotal} addLabel="Nueva tarea" onAdd={() => openModal({ type: 'task' })} />
          {taskGroups.length > 0 ? (
            taskGroups.map((g) => (
              <div key={g.id} className={cx('lane__group', `lane__group--${g.id}`)}>
                <h4 className="lane__sub">
                  {g.label} <span className="lane__subn">{g.items.length}</span>
                </h4>
                <MissionList key={`${g.id}-${sort}-${onlyPending}`} items={g.items} limit={g.id === 'late' || g.id === 'today' ? SHOW_URGENT : SHOW_OTHER} />
              </div>
            ))
          ) : (
            <LaneEmpty kind="task" state={taskEmpty} onCreate={() => openModal({ type: 'task' })} />
          )}
        </section>
      </div>
    </section>
  );
}

/** Qué decir cuando una columna no tiene nada que enseñar: no hay ninguno creado, hoy no toca, o ya está todo hecho. */
function LaneEmpty({ kind, state, onCreate }: { kind: Lane; state: 'none' | 'off' | 'clear'; onCreate: () => void }) {
  const habit = kind === 'habit';
  if (state === 'none') {
    return (
      <Empty sprite={habit ? 'flower' : 'qblock'} title={habit ? 'Aún no tienes hábitos' : 'Aún no tienes tareas'}>
        <p className="muted small">{habit ? 'Un hábito es algo que repites: estudiar, leer, hacer ejercicio.' : 'Una tarea es algo concreto que haces una vez y se termina.'}</p>
        <Button variant="primary" small onClick={onCreate}>
          {habit ? 'Crear hábito' : 'Crear tarea'}
        </Button>
      </Empty>
    );
  }
  const text = state === 'off' ? (habit ? 'Hoy no te toca ningún hábito.' : 'No tienes tareas pendientes.') : habit ? '¡Hábitos de hoy completos!' : '¡Tareas al día!';
  return <p className="lane__empty muted">{text}</p>;
}
