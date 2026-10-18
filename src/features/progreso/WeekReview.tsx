import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { addDays, dueLabel, isoNow, longDate, shortDate, today } from '@/core/dates';
import type { ID, ISODate, Snapshot, Task } from '@/core/domain';
import { XP_BY_PRIORITY } from '@/core/game';
import { categoryInfo } from '@/core/agenda';
import { areaInfo } from '@/core/areas';
import { PACE_TEXT } from '@/core/goals';
import { COMMON_OBSTACLES, MAX_PRIORITIES, buildWeekReview, recurringObstacles, reviewOf, spreadTasks, type HabitReviewRow } from '@/core/weekReview';
import { Button, Panel, Tag, cx } from '@/ui/kit';

const hours = (min: number) => `${+(min / 60).toFixed(1)} h`;

function Section({ id, title, hint, children }: Readonly<{ id: string; title: string; hint?: string; children: React.ReactNode }>) {
  return (
    <section className="rv__sec" aria-labelledby={`rv-${id}`}>
      <h3 id={`rv-${id}`} className="rv__title">
        {title}
      </h3>
      {hint && <p className="muted small">{hint}</p>}
      {children}
    </section>
  );
}

function trend(row: HabitReviewRow): { text: string; tone: 'green' | 'plain' | 'xp' } | null {
  if (row.prevPct === null) return null;
  const d = row.pct - row.prevPct;
  if (Math.abs(d) < 5) return { text: 'igual que la semana pasada', tone: 'plain' };
  return d > 0 ? { text: `▲ ${d} pts sobre la semana pasada`, tone: 'green' } : { text: `▼ ${-d} pts bajo la semana pasada`, tone: 'xp' };
}

function HabitRow({ row }: Readonly<{ row: HabitReviewRow }>) {
  const t = trend(row);
  return (
    <li className="rv__row">
      <div>
        <p className="rv__name">{row.habit.title}</p>
        <p className="muted small">
          Previstos {row.due} · hechos {row.done}
          {row.minimum > 0 && ` · solo el mínimo ${row.minimum}`}
          {row.partial > 0 && ` · a medias ${row.partial}`}
          {row.missed > 0 && ` · omitidos ${row.missed}`}
        </p>
      </div>
      <div className="rv__side">
        <b>{row.pct}%</b>
        {t && <Tag tone={t.tone}>{t.text}</Tag>}
      </div>
    </li>
  );
}

function PendingRow({ task, nextFrom }: Readonly<{ task: Task; nextFrom: ISODate }>) {
  const updateTask = useData((s) => s.updateTask);
  const deleteTask = useData((s) => s.deleteTask);
  const openModal = useUi((s) => s.openModal);
  const toast = useUi((s) => s.toast);
  const [date, setDate] = useState(nextFrom);

  const move = () => {
    if (!date) return;
    const before = task.dueDate;
    updateTask(task.id, { dueDate: date });
    toast({ kind: 'info', title: `Movida al ${shortDate(date)}`, body: task.title, action: { label: 'Deshacer', run: () => updateTask(task.id, { dueDate: before }) } });
  };

  return (
    <li className="rv__row rv__row--pending">
      <div>
        <p className="rv__name">{task.title}</p>
        <p className="muted small">Estaba para: {dueLabel(task.dueDate)} {task.dueDate && `(${shortDate(task.dueDate)})`}{task.estimateMin > 0 && ` · ${task.estimateMin} min`}</p>
      </div>
      <div className="rv__acts">
        <label className="rv__date">
          <span className="sr-only">Nueva fecha para {task.title}</span>
          <input className="input input--inline" type="date" value={date} min={today()} onChange={(e) => setDate(e.target.value)} />
        </label>
        <Button small variant="primary" onClick={move} disabled={!date}>
          Mover
        </Button>
        <Button small onClick={() => openModal({ type: 'task', id: task.id })}>
          Reducir o editar
        </Button>
        <Button
          small
          variant="ghost"
          onClick={() => openModal({ type: 'confirm', title: 'Quitar tarea', body: `Se eliminará "${task.title}". A veces lo más sano es soltar lo que ya no tiene sentido.`, confirmLabel: 'Quitar', onConfirm: () => deleteTask(task.id) })}
        >
          Quitar
        </Button>
      </div>
    </li>
  );
}

/**
 * Revisión de una semana: qué se planificó y qué se hizo, cómo van hábitos y metas, qué hacer con lo pendiente
 * (mover, reducir o quitar: nunca un fracaso), qué se interpuso y qué tres tareas importan la semana siguiente.
 * Todo lo que enseña se calcula con los datos de siempre; solo se guarda la reflexión y las prioridades.
 */
export function WeekReviewPanel({ week, onClose }: Readonly<{ week: ISODate; onClose: () => void }>) {
  const store = useData();
  const createTask = useData((s) => s.createTask);
  const shiftTasks = useData((s) => s.shiftTasks);
  const saveWeekReview = useData((s) => s.saveWeekReview);
  const now = today();
  const nextFrom = addDays(week, 7);

  const snap: Snapshot = useMemo(
    () => ({
      profile: store.profile, tasks: store.tasks, habits: store.habits, habitLogs: store.habitLogs, courses: store.courses, goals: store.goals, projects: store.projects, notes: store.notes,
      certifications: store.certifications, personalRewards: store.personalRewards, sessions: store.sessions, xpEvents: store.xpEvents, notifications: store.notifications, events: store.events,
    }),
    [store.profile, store.tasks, store.habits, store.habitLogs, store.courses, store.goals, store.projects, store.notes, store.certifications, store.personalRewards, store.sessions, store.xpEvents, store.notifications, store.events],
  );
  const data = useMemo(() => buildWeekReview(snap, week, now), [snap, week, now]);
  const saved = reviewOf(store.profile, week);
  const repeated = useMemo(() => recurringObstacles(store.profile.reviews, week), [store.profile.reviews, week]);

  const [obstacles, setObstacles] = useState<string[]>(saved?.obstacles ?? []);
  const [custom, setCustom] = useState('');
  const [wins, setWins] = useState(saved?.wins ?? '');
  const [adjustment, setAdjustment] = useState(saved?.adjustment ?? '');
  const [adjustmentTask, setAdjustmentTask] = useState(false);
  const [priorities, setPriorities] = useState<ID[]>(saved ? saved.priorities : data.next.candidates.slice(0, MAX_PRIORITIES).map((t) => t.id));
  const [newPriority, setNewPriority] = useState('');
  const [justSaved, setJustSaved] = useState(false);

  const byId = useMemo(() => new Map(store.tasks.map((t) => [t.id, t])), [store.tasks]);
  const open = (id: ID) => byId.get(id)?.status === 'todo' || byId.get(id)?.status === 'doing';
  const chosen = priorities.filter(open);
  // Las elegidas aparecen siempre, aunque ya no figuren entre las sugeridas.
  const options = useMemo(() => {
    const seen = new Set<ID>();
    return [...chosen.flatMap((id) => byId.get(id) ?? []), ...data.next.candidates].filter((t) => !seen.has(t.id) && !!seen.add(t.id));
  }, [chosen, byId, data.next.candidates]);

  const habitTotals = data.habits.reduce((a, r) => ({ due: a.due + r.due, done: a.done + r.done, minimum: a.minimum + r.minimum, missed: a.missed + r.missed }), { due: 0, done: 0, minimum: 0, missed: 0 });
  const stalled = data.goals.filter((g) => !g.moved);
  const cats = Object.entries(data.next.minutesByCategory).sort((a, b) => b[1] - a[1]);
  const areaRows = data.areas.rows.filter((r) => r.tasksDone + r.habitDays + r.open > 0);

  const toggleObstacle = (o: string) => setObstacles((cur) => (cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o].slice(0, 8)));
  const addCustom = () => {
    const t = custom.trim().slice(0, 200);
    if (t && !obstacles.some((o) => o.toLowerCase() === t.toLowerCase())) setObstacles((cur) => [...cur, t].slice(0, 8));
    setCustom('');
  };
  const togglePriority = (id: ID) => setPriorities((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(0, MAX_PRIORITIES)));
  const addPriorityTask = () => {
    const title = newPriority.trim();
    if (!title || chosen.length >= MAX_PRIORITIES) return;
    const id = createTask({ title, courseId: null, priority: 'mid', status: 'todo', dueDate: nextFrom, estimateMin: 30, xp: XP_BY_PRIORITY.mid, subtasks: [], tags: ['revisión'] });
    setPriorities([...chosen, id]);
    setNewPriority('');
  };
  const adjustmentToTask = () => {
    const title = adjustment.trim();
    if (!title || adjustmentTask) return;
    createTask({ title, courseId: null, priority: 'mid', status: 'todo', dueDate: nextFrom, estimateMin: 30, xp: XP_BY_PRIORITY.mid, subtasks: [], tags: ['revisión'] });
    setAdjustmentTask(true);
  };
  const save = () => {
    saveWeekReview({ week, obstacles, wins: wins.trim(), adjustment: adjustment.trim(), priorities: chosen, savedAt: isoNow() });
    setJustSaved(true);
  };

  return (
    <Panel
      className="rv"
      kicker={`// Revisión semanal · del ${shortDate(data.from)} al ${shortDate(data.to)}`}
      title="¿Cómo fue tu semana?"
      right={
        <Button small variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      <p className="muted">
        {data.inProgress ? 'La semana aún no termina: esto es lo que llevas hasta hoy. ' : ''}Mira lo hecho sin juzgarte: lo pendiente no es un fracaso, es información para decidir qué mover, reducir o soltar.
      </p>

      <Section id="resumen" title="Lo planificado frente a lo hecho">
        <dl className="stat-grid">
          <div>
            <dt>Tareas previstas</dt>
            <dd className={cx(data.tasks.planned > 0 && data.tasks.plannedDone === data.tasks.planned && 'is-hot')}>
              {data.tasks.plannedDone}/{data.tasks.planned}
            </dd>
          </div>
          <div>
            <dt>Hechas sin prever</dt>
            <dd>{data.tasks.extraDone}</dd>
          </div>
          <div>
            <dt>Hábitos (días)</dt>
            <dd>
              {habitTotals.done}/{habitTotals.due}
            </dd>
          </div>
          <div>
            <dt>Bloques del calendario</dt>
            <dd>
              {data.agenda.done}/{data.agenda.planned}
            </dd>
          </div>
          <div>
            <dt>Estudio</dt>
            <dd>
              {data.studyHours.toFixed(1)} / {data.studyGoalHours} h
            </dd>
          </div>
        </dl>
        {data.agenda.unmarked > 0 && <p className="muted small">{data.agenda.unmarked} bloques ya pasaron sin marcar: puede que los hicieras y no lo apuntaste. No cuentan en tu contra.</p>}
        {areaRows.length > 0 && (
          <div className="chips" aria-label="Equilibrio por área">
            {areaRows.map((r) => (
              <span key={r.area} className="chip chip--sm" title="Solo informa: descansar o enfocarte en otra cosa también es una decisión válida">
                {areaInfo(r.area).icon} {areaInfo(r.area).label}: {r.tasksDone} hechas · {r.habitDays} días de hábito
              </span>
            ))}
          </div>
        )}
      </Section>

      <Section id="habitos" title="Hábitos" hint="Omitido es lo que tocaba y no se registró. Lo que no tocaba ese día nunca cuenta como omisión.">
        {data.habits.length === 0 ? (
          <p className="muted small">Ningún hábito tocaba esta semana.</p>
        ) : (
          <ul className="rv__list">
            {data.habits.map((r) => (
              <HabitRow key={r.habit.id} row={r} />
            ))}
          </ul>
        )}
      </Section>

      <Section id="metas" title="Metas">
        {data.goals.length === 0 ? (
          <p className="muted small">Aún no tienes metas abiertas.</p>
        ) : (
          <ul className="rv__list">
            {data.goals.map((g) => (
              <li key={g.goal.id} className="rv__row">
                <div>
                  <p className="rv__name">{g.goal.title}</p>
                  <p className="muted small">
                    {g.moved
                      ? `Avanzó: ${[g.milestones && `${g.milestones} ${g.milestones === 1 ? 'hito' : 'hitos'}`, g.tasksDone && `${g.tasksDone} ${g.tasksDone === 1 ? 'tarea' : 'tareas'}`, g.habitDays && `${g.habitDays} ${g.habitDays === 1 ? 'día' : 'días'} de hábito`].filter(Boolean).join(', ')}.`
                      : 'Sin movimiento esta semana. ¿Sigue siendo una prioridad o toca darle una acción pequeña?'}
                  </p>
                </div>
                <div className="rv__side">
                  {g.goal.deadline && <Tag tone={g.pace.state === 'behind' || g.pace.state === 'overdue' ? 'xp' : 'green'}>{PACE_TEXT[g.pace.state]}</Tag>}
                  <Link className="btn btn--ghost btn--sm" to={`/metas?meta=${g.goal.id}`}>
                    Ver meta
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
        {stalled.length > 0 && data.goals.length > 1 && <p className="muted small">{stalled.length} sin movimiento: elegir qué no vas a empujar ahora también es avanzar.</p>}
      </Section>

      <Section id="pendiente" title="Lo que quedó pendiente" hint="Muévelo a una fecha realista, reduce su alcance o quítalo. La misma tarea cambia de día: no se crea otra.">
        {data.tasks.pending.length === 0 ? (
          <p className="muted small">¡Nada pendiente de esta semana ni de antes!</p>
        ) : (
          <>
            <ul className="rv__list">
              {data.tasks.pending.map((t) => (
                <PendingRow key={t.id} task={t} nextFrom={nextFrom < now ? now : nextFrom} />
              ))}
            </ul>
            {data.tasks.pending.length > 2 && (
              <Button small onClick={() => shiftTasks(spreadTasks(data.tasks.pending, nextFrom < now ? now : nextFrom))}>
                Repartirlas entre lunes y viernes de la próxima semana
              </Button>
            )}
          </>
        )}
      </Section>

      <Section id="reflexion" title="Qué se interpuso y qué aprendiste">
        {repeated.length > 0 && (
          <p className="rv__repeat" role="note">
            Se repite: {repeated.map((o) => `«${o.text}» (${o.count} de las últimas semanas)`).join(', ')}. Quizá convenga diseñar una respuesta con un «si… entonces…» en el hábito afectado.
          </p>
        )}
        <div className="chips" role="group" aria-label="Obstáculos de la semana">
          {[...COMMON_OBSTACLES, ...obstacles.filter((o) => !(COMMON_OBSTACLES as readonly string[]).includes(o))].map((o) => (
            <button key={o} type="button" aria-pressed={obstacles.includes(o)} className={cx('chip chip--sm', obstacles.includes(o) && 'is-on')} onClick={() => toggleObstacle(o)}>
              {o}
            </button>
          ))}
        </div>
        <div className="inline-form">
          <input className="input" value={custom} maxLength={200} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustom())} placeholder="Otro obstáculo…" aria-label="Añadir otro obstáculo" />
          <Button small onClick={addCustom} disabled={!custom.trim()}>
            Añadir
          </Button>
        </div>
        <label className="field">
          <span className="field__label">¿Qué funcionó?</span>
          <textarea className="input" rows={2} maxLength={600} value={wins} onChange={(e) => setWins(e.target.value)} />
        </label>
        <label className="field">
          <span className="field__label">¿Qué cambio haré la próxima semana?</span>
          <textarea className="input" rows={2} maxLength={300} value={adjustment} onChange={(e) => { setAdjustment(e.target.value); setAdjustmentTask(false); }} />
        </label>
        {adjustment.trim() && (
          <Button small onClick={adjustmentToTask} disabled={adjustmentTask}>
            {adjustmentTask ? `✔ Tarea creada para el ${shortDate(nextFrom)}` : 'Convertirlo en tarea'}
          </Button>
        )}
      </Section>

      <Section id="siguiente" title={`Semana siguiente · del ${shortDate(nextFrom)}`} hint="Una semana realista cabe: trabajo, estudio, movimiento, descanso y compromisos.">
        <p className="muted small">
          {data.next.blocks} bloques en el calendario · {data.next.tasksDue} tareas con fecha{data.next.tasksMinutes > 0 && ` (~${hours(data.next.tasksMinutes)})`}.
        </p>
        {cats.length > 0 && (
          <ul className="rv__cats" aria-label="Horas por tipo de bloque">
            {cats.map(([cat, min]) => (
              <li key={cat}>
                <span aria-hidden="true">{categoryInfo(cat as Parameters<typeof categoryInfo>[0]).icon}</span> {categoryInfo(cat as Parameters<typeof categoryInfo>[0]).label}: <b>{hours(min)}</b>
              </li>
            ))}
          </ul>
        )}
        {data.next.notes.map((n) => (
          <p key={n} className="rv__repeat" role="note">
            {n}{' '}
            <Link to="/calendario">Abrir el calendario</Link>
          </p>
        ))}
        <p className="kicker">Tus {MAX_PRIORITIES} prioridades · {chosen.length}/{MAX_PRIORITIES}</p>
        {options.length === 0 ? (
          <p className="muted small">No hay tareas candidatas. Escribe abajo la primera prioridad de la semana.</p>
        ) : (
          <ul className="rv__list">
            {options.map((t) => {
              const on = chosen.includes(t.id);
              return (
                <li key={t.id} className="rv__row">
                  <label className="stepcheck">
                    <input type="checkbox" checked={on} disabled={!on && chosen.length >= MAX_PRIORITIES} onChange={() => togglePriority(t.id)} />
                    <span>{t.title}</span>
                  </label>
                  <span className="muted small upper">{t.dueDate ? `${dueLabel(t.dueDate)} · ${shortDate(t.dueDate)}` : 'Sin fecha'}</span>
                </li>
              );
            })}
          </ul>
        )}
        <div className="inline-form">
          <input className="input" value={newPriority} maxLength={120} onChange={(e) => setNewPriority(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPriorityTask())} placeholder="Nueva tarea prioritaria…" aria-label="Crear una tarea como prioridad" />
          <Button small onClick={addPriorityTask} disabled={!newPriority.trim() || chosen.length >= MAX_PRIORITIES}>
            Crear y priorizar
          </Button>
        </div>
      </Section>

      <div className="rv__foot">
        <Button variant="primary" onClick={save}>
          {saved ? 'Actualizar revisión' : 'Guardar revisión'}
        </Button>
        <span className="muted small" role="status">
          {justSaved ? `Guardada. Tus prioridades aparecerán en Hoy durante la semana del ${longDate(nextFrom)}.` : saved ? 'Ya guardaste esta revisión; puedes corregirla.' : 'Nada se guarda hasta que pulses el botón.'}
        </span>
      </div>
    </Panel>
  );
}
