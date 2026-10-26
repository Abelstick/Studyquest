import { useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { dayProgress, missionUrgency, taskBucket, type Mission, type TaskBucket } from '@/core/missions';
import { Bar, Button, Empty, cx } from '@/ui/kit';
import { FoldToggle, useFold } from '@/ui/Fold';
import { Sprite } from '@/ui/Sprite';
import { Icon } from '@/ui/Icon';
import { useFlipReorder } from '@/ui/motion';
import { MissionCard } from './MissionCard';
import { ListSearch } from '@/ui/ListSearch';
import { matchesQuery } from '@/core/search';

type MissionSort = 'urgency' | 'xp' | 'name';
type Lane = 'habit' | 'task';

const SORTS: { value: MissionSort; label: string }[] = [
  { value: 'urgency', label: 'Más urgente' },
  { value: 'xp', label: 'Más XP' },
  { value: 'name', label: 'A–Z' },
];
/**
 * Cuántas tareas se enseñan de entrada en cada grupo; el resto queda tras «Ver más». Los hábitos de hoy se
 * enseñan todos: son pocos y cada uno es una casilla que marcar, esconder alguno parece que se perdió.
 */
const SHOW_URGENT = 6;
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

/**
 * Lista con «Ver más / Ver menos»: enseña las primeras y esconde el resto sin perderlas.
 * Al completar una misión, baja al final de la lista: Flip la lleva cuadro a cuadro desde su sitio viejo,
 * así se ve adónde fue en vez de desaparecer de golpe.
 */
function MissionList({ items, limit }: { items: Mission[]; limit: number }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, limit);
  const listRef = useRef<HTMLUListElement>(null);
  const order = shown.map((m) => `${m.id}:${Number(m.done)}`).join('|');
  const capture = useFlipReorder(listRef, '.mission', order);
  return (
    <>
      <ul className="missions" ref={listRef} onClickCapture={capture}>
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

interface LaneProps {
  kind: Lane;
  title: string;
  done: number;
  total: number;
  addLabel: string;
  onAdd: () => void;
  shown: boolean;
  children: ReactNode;
}

/**
 * Una columna: cabecera con nombre, cuántas van hechas, barra de avance y el botón de crear. El nombre pliega la
 * columna; plegada se queda en la cabecera, que ya cuenta lo que importa.
 */
function LaneSection({ kind, title, done, total, addLabel, onAdd, shown, children }: Readonly<LaneProps>) {
  const [open, toggle] = useFold(`home-lane-${kind}`);
  const bodyId = useId();
  return (
    <section className={cx('lane', `lane--${kind}`, shown && 'is-shown', !open && 'is-closed')} aria-labelledby={`lane-${kind}`}>
      <header className="lane__head">
        <h3 className="lane__title" id={`lane-${kind}`}>
          <FoldToggle open={open} onToggle={toggle} controls={bodyId}>
            <Sprite name={kind === 'habit' ? 'flower' : 'qblock'} size={18} />
            {title}
            <span className="lane__count">
              {done}/{total}
            </span>
          </FoldToggle>
        </h3>
        <button type="button" className="lane__add" onClick={onAdd} aria-label={addLabel} title={addLabel}>
          <Icon name="plus" size={14} />
        </button>
        <Bar className="lane__bar" pct={total ? (done / total) * 100 : 0} tone={kind === 'habit' ? 'green' : 'blue'} segments={total} label={`${title} hechos hoy`} />
      </header>
      <div className="lane__body" id={bodyId} hidden={!open}>
        {children}
      </div>
    </section>
  );
}

/** Un grupo de tareas por plazo. Lo vencido y lo de hoy empiezan abiertos; lo que puede esperar, plegado. */
function TaskGroup({ id, label, items, first, listKey }: Readonly<{ id: TaskBucket; label: string; items: Mission[]; first: boolean; listKey: string }>) {
  const urgent = id === 'late' || id === 'today';
  const [open, toggle] = useFold(`home-tasks-${id}`, urgent || first);
  const bodyId = useId();
  return (
    <div className={cx('lane__group', `lane__group--${id}`)}>
      <h4 className="lane__sub">
        <FoldToggle open={open} onToggle={toggle} controls={bodyId}>
          {label} <span className="lane__subn">{items.length}</span>
        </FoldToggle>
      </h4>
      <div id={bodyId} hidden={!open}>
        <MissionList key={listKey} items={items} limit={urgent ? SHOW_URGENT : SHOW_OTHER} />
      </div>
    </div>
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
  const habitsTotal = useData((s) => s.habits.length);
  const progress = useMemo(() => dayProgress(missions), [missions]);
  // En móvil, si hay tareas vencidas se abre directamente en Tareas: es lo que más apremia.
  const [lane, setLane] = useState<Lane>(() => (progress.late > 0 ? 'task' : 'habit'));
  const [sort, setSort] = useState<MissionSort>('urgency');
  const [onlyPending, setOnlyPending] = useState(false);
  const [query, setQuery] = useState('');
  // En móvil, ordenar y filtrar quedan plegados: casi nunca se tocan y empujan la lista hacia abajo.
  const [toolsOpen, setToolsOpen] = useState(false);

  const pick = (kind: Mission['kind']) => sortMissions(missions.filter((m) => m.kind === kind && (!onlyPending || !m.done) && matchesQuery([m.title, m.subtitle], query)), sort);
  const habits = pick('habit');
  const tasks = pick('task');
  // Las tareas se agrupan por cuándo tocan, para ver de un vistazo qué es de hoy y qué puede esperar.
  const taskGroups = BUCKETS.map((b) => ({ ...b, items: tasks.filter((m) => m.kind === 'task' && taskBucket(m.task) === b.id) })).filter((g) => g.items.length > 0);

  // Hábitos creados que hoy no tocan (por su frecuencia): no están en la misión, pero se avisa en vez de callarlo.
  const habitsOff = Math.max(0, habitsTotal - missions.filter((m) => m.kind === 'habit').length);
  const habitEmpty = !hasHabits ? 'none' : progress.habitsTotal === 0 ? 'off' : 'clear';
  const taskEmpty = !hasTasks ? 'none' : progress.tasksTotal === 0 ? 'off' : 'clear';
  const searching = query.trim() !== '';
  const toolsActive = onlyPending || sort !== 'urgency' || searching;

  const switcher: { id: Lane; label: string; sprite: 'flower' | 'qblock'; count: string; alert?: number }[] = [
    { id: 'habit', label: 'Hábitos', sprite: 'flower', count: `${progress.habitsDone}/${progress.habitsTotal}` },
    { id: 'task', label: 'Tareas', sprite: 'qblock', count: `${progress.tasksDone}/${progress.tasksTotal}`, alert: progress.late },
  ];

  return (
    <section className="today-board" aria-label="Misiones de hoy">
      <div className="today-board__bar">
        <div>
          <p className="kicker">Quest diaria</p>
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
            <ListSearch value={query} onChange={setQuery} what="hábitos y tareas" />
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
        <LaneSection kind="habit" title="Hábitos" done={progress.habitsDone} total={progress.habitsTotal} addLabel="Nuevo hábito" onAdd={() => openModal({ type: 'habit' })} shown={lane === 'habit'}>
          {habits.length > 0 ? (
            <MissionList key={`habit-${sort}-${onlyPending}-${query}`} items={habits} limit={habits.length} />
          ) : (
            <LaneEmpty kind="habit" state={habitEmpty} query={searching ? query.trim() : ''} onCreate={() => openModal({ type: 'habit' })} />
          )}
          {habitsOff > 0 && (
            <p className="muted small lane__off">
              {habitsOff} {habitsOff === 1 ? 'hábito más no toca' : 'hábitos más no tocan'} hoy. <Link to="/habitos">Ver todos los hábitos</Link>
            </p>
          )}
        </LaneSection>

        <LaneSection kind="task" title="Tareas" done={progress.tasksDone} total={progress.tasksTotal} addLabel="Nueva tarea" onAdd={() => openModal({ type: 'task' })} shown={lane === 'task'}>
          {taskGroups.length > 0 ? (
            taskGroups.map((g, i) => <TaskGroup key={g.id} id={g.id} label={g.label} items={g.items} first={i === 0} listKey={`${g.id}-${sort}-${onlyPending}-${query}`} />)
          ) : (
            <LaneEmpty kind="task" state={taskEmpty} query={searching ? query.trim() : ''} onCreate={() => openModal({ type: 'task' })} />
          )}
        </LaneSection>
      </div>
    </section>
  );
}

/** Qué decir cuando una columna no tiene nada que enseñar: no hay ninguno creado, hoy no toca, o ya está todo hecho. */
function LaneEmpty({ kind, state, query, onCreate }: { kind: Lane; state: 'none' | 'off' | 'clear'; query: string; onCreate: () => void }) {
  const habit = kind === 'habit';
  // Con una búsqueda activa, lo único cierto es que nada coincide; lo demás sigue ahí.
  if (query && state !== 'none') return <p className="lane__empty muted">Ningún {habit ? 'hábito' : 'tarea'} de hoy coincide con «{query}».</p>;
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
