import { Link } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { dueLabel, longDate, today } from '@/core/dates';
import type { Goal } from '@/core/domain';
import { frequencyLabel } from '@/core/game';
import { PACE_TEXT, actionsSummary, goalActions, goalPace, smartChecklist, smartScore, type PaceState } from '@/core/goals';
import { AreaTag } from '@/ui/Area';
import { Bar, Button, Panel, Tag, cx } from '@/ui/kit';
import { IfThenList } from '@/ui/IfThenList';
import { Icon } from '@/ui/Icon';

const PACE_TONE: Record<PaceState, 'plain' | 'green' | 'xp' | 'red'> = { none: 'plain', done: 'green', ahead: 'green', 'on-track': 'green', behind: 'xp', overdue: 'red' };
/** Cuántas tareas abiertas se enseñan antes de remitir a Tareas. */
const SHOW_TASKS = 6;

/** Plazo, ritmo y criterios SMART de una meta: ayuda a definirla bien sin obligar a rellenar nada. */
export function GoalSmartPanel({ goal }: Readonly<{ goal: Goal }>) {
  const tasks = useData((s) => s.tasks);
  const habits = useData((s) => s.habits);
  const openModal = useUi((s) => s.openModal);
  const actions = goalActions(goal.id, { tasks, habits });
  const items = smartChecklist(goal, actions);
  const score = smartScore(items);
  const pace = goalPace(goal);
  const edit = () => openModal({ type: 'goal', id: goal.id });
  const missing = items.filter((i) => !i.ok);

  return (
    <Panel kicker="Meta SMART" title={`${score} de 5 criterios`} right={<AreaTag area={goal.area} />}>
      {goal.deadline ? (
        <div className="goalpace">
          <div className="split">
            <span>
              Hasta el <b>{longDate(goal.deadline)}</b>
            </span>
            <Tag tone={PACE_TONE[pace.state]}>{PACE_TEXT[pace.state]}</Tag>
          </div>
          {pace.state !== 'done' && pace.daysLeft !== null && (
            <p className="muted small">{pace.daysLeft >= 0 ? `Faltan ${pace.daysLeft} ${pace.daysLeft === 1 ? 'día' : 'días'}.` : `Pasaron ${-pace.daysLeft} ${pace.daysLeft === -1 ? 'día' : 'días'} del plazo: puedes moverlo sin culpa.`}</p>
          )}
          <Bar pct={pace.elapsedPct} tone="blue" label="Tiempo transcurrido del plazo" />
          <p className="kicker">Tiempo transcurrido · {pace.elapsedPct}%</p>
          <Bar pct={pace.donePct} tone="green" label="Hitos conquistados" />
          <p className="kicker">Hitos conquistados · {pace.donePct}%</p>
        </div>
      ) : (
        <p className="muted small">Sin plazo todavía. Con una fecha límite podrás ver si vas a tiempo.</p>
      )}

      {(goal.measure || goal.why) && (
        <dl className="kv">
          {goal.measure && (
            <div>
              <dt>Cómo se mide</dt>
              <dd>{goal.measure}</dd>
            </div>
          )}
          {goal.why && (
            <div>
              <dt>Por qué importa</dt>
              <dd>{goal.why}</dd>
            </div>
          )}
        </dl>
      )}

      <ul className="smart" aria-label="Criterios SMART">
        {items.map((i) => (
          <li key={i.letter} className={cx('smart__item', i.ok && 'is-ok')}>
            <span className="smart__letter" aria-hidden="true">
              {i.letter}
            </span>
            <span>
              <b>{i.label}</b> <span className="sr-only">{i.ok ? '(cumplido)' : '(pendiente)'}</span>
              {!i.ok && <span className="muted small"> · {i.todo}</span>}
            </span>
          </li>
        ))}
      </ul>
      {missing.length > 0 && (
        <Button small onClick={edit}>
          Completar los datos de la meta
        </Button>
      )}
    </Panel>
  );
}

/** Tareas y hábitos que hacen avanzar la meta. Se gestionan donde siempre; aquí se ven juntos y se crean ya enlazados. */
export function GoalActionsPanel({ goal }: Readonly<{ goal: Goal }>) {
  const tasks = useData((s) => s.tasks);
  const habits = useData((s) => s.habits);
  const logs = useData((s) => s.habitLogs);
  const setTaskStatus = useData((s) => s.setTaskStatus);
  const openModal = useUi((s) => s.openModal);
  const actions = goalActions(goal.id, { tasks, habits });
  const sum = actionsSummary(actions, logs);
  const open = actions.tasks
    .filter((t) => t.status !== 'done')
    .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
  const empty = actions.tasks.length + actions.habits.length === 0;

  return (
    <Panel kicker="Acciones" title="Lo que la hace avanzar">
      {empty ? (
        <p className="muted small">Una meta se cumple con acciones: tareas con fecha y hábitos que repites. Crea la primera ya enlazada a esta meta.</p>
      ) : (
        <>
          {actions.habits.length > 0 && (
            <ul className="list">
              {sum.habits.map(({ habit, pct }) => (
                <li key={habit.id} className="list__row">
                  <span>
                    <button type="button" className="link" onClick={() => openModal({ type: 'habit-detail', id: habit.id })}>
                      {habit.title}
                    </button>
                    <span className="muted small"> · {frequencyLabel(habit.frequency)}</span>
                  </span>
                  <Tag tone={pct >= 75 ? 'green' : 'plain'}>{pct}% · 30 d</Tag>
                </li>
              ))}
            </ul>
          )}
          {open.length > 0 && (
            <ul className="list">
              {open.slice(0, SHOW_TASKS).map((t) => (
                <li key={t.id} className="list__row">
                  <label className="stepcheck">
                    <input type="checkbox" checked={false} onChange={() => setTaskStatus(t.id, 'done')} aria-label={`Completar: ${t.title}`} />
                    <button type="button" className="link" onClick={() => openModal({ type: 'task-detail', id: t.id })}>
                      {t.title}
                    </button>
                  </label>
                  <span className="muted small upper">{dueLabel(t.dueDate, today())}</span>
                </li>
              ))}
            </ul>
          )}
          {open.length > SHOW_TASKS && (
            <p className="muted small">
              y {open.length - SHOW_TASKS} más en <Link to="/tareas">Tareas</Link>.
            </p>
          )}
          <p className="kicker">
            Tareas {sum.tasksDone}/{sum.tasksTotal} hechas · {actions.habits.length} {actions.habits.length === 1 ? 'hábito' : 'hábitos'}
          </p>
        </>
      )}
      <div className="row">
        <Button small onClick={() => openModal({ type: 'task', goalId: goal.id })}>
          <Icon name="plus" size={12} /> Tarea
        </Button>
        <Button small onClick={() => openModal({ type: 'habit', goalId: goal.id })}>
          <Icon name="plus" size={12} /> Hábito
        </Button>
      </div>
    </Panel>
  );
}

/** Los planes «si… entonces…» de la meta, a la vista. */
export function GoalIfThenPanel({ goal }: Readonly<{ goal: Goal }>) {
  if (!goal.ifThen?.length) return null;
  return (
    <Panel kicker="Si… entonces…" title="Tu plan para los imprevistos">
      <IfThenList plans={goal.ifThen} />
    </Panel>
  );
}
