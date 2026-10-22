import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { today } from '@/core/dates';
import type { HabitChain } from '@/core/domain';
import { frequencyLabel, goalLabel, habitProgress, habitStreaks, isCounter, isDueOn, isHabitDone, logFor, MEASURE_LABEL } from '@/core/game';
import { chainOf } from '@/core/chains';
import { habitDayState, type HabitDayState } from '@/core/missions';
import { cleanDays, isQuit } from '@/core/quit';
import { HabitAction, HabitRecovery, minimumLabel } from '@/features/habitos/HabitAction';
import { isMinimumMet, minimumOf } from '@/core/minimum';
import { areaInfo } from '@/core/areas';
import { IfThenList } from '@/ui/IfThenList';
import { HabitScheduler } from '@/features/calendario/HabitScheduler';
import { HabitWeek } from '@/features/habitos/HabitWeek';
import { Bar, Button, Modal, Tag, cx } from '@/ui/kit';

/** Lista vacía estable: un `?? []` dentro del selector crea un array nuevo en cada render y provoca un bucle. */
const NO_CHAINS: HabitChain[] = [];

const STATE_TAG: Record<HabitDayState, { tone: 'green' | 'xp' | 'plain'; label: string }> = {
  done: { tone: 'green', label: 'Hecho' },
  partial: { tone: 'xp', label: 'A medias' },
  pending: { tone: 'plain', label: 'Pendiente' },
  off: { tone: 'plain', label: 'Hoy no toca' },
};

/** Ficha de un hábito desde Hoy: cómo va hoy, su racha y su semana, con las acciones a mano. */
export function HabitDetailModal({ id }: { id: string }) {
  const habit = useData((s) => s.habits.find((h) => h.id === id));
  const logs = useData((s) => s.habitLogs);
  const chains = useData((s) => s.profile.chains) ?? NO_CHAINS;
  const goal = useData((s) => s.goals.find((g) => g.id === habit?.goalId));
  const toggleStep = useData((s) => s.toggleHabitStep);
  const close = useUi((s) => s.closeModal);
  const openModal = useUi((s) => s.openModal);
  const now = today();

  // Si el hábito se borra mientras la ficha está abierta, no queda nada que enseñar.
  useEffect(() => {
    if (!habit) close();
  }, [habit, close]);

  const stats = useMemo(() => (habit ? habitStreaks(habit, logs, now) : null), [habit, logs, now]);
  if (!habit || !stats) return null;

  const log = logFor(logs, habit.id, now);
  const done = isHabitDone(habit, log);
  const due = isDueOn(habit, now, logs);
  const pct = Math.round(habitProgress(habit, log) * 100);
  const quit = isQuit(habit);
  const stepsDone = new Set(log?.stepsDone ?? []);
  const chain = chainOf(chains, habit.id);
  const state = habitDayState(done, pct, due);
  const minMet = isMinimumMet(habit, log);
  const status = STATE_TAG[state];
  const doneText = quit ? 'Hoy resistí' : 'Hecho hoy';
  const counted = isCounter(habit) ? `${log?.value ?? 0} / ${habit.target} ${MEASURE_LABEL[habit.measure].plural}` : null;
  const progressText = counted ?? (state === 'done' ? doneText : state === 'partial' ? `${pct}% del día` : 'Sin registrar');

  const facts: [string, string][] = [
    ['Frecuencia', frequencyLabel(habit.frequency)],
    ['Objetivo', goalLabel(habit)],
    ['Recompensa', `+${habit.xp} XP`],
    ['Recordatorio', habit.reminder ?? 'Sin recordatorio'],
    ...(minimumOf(habit) !== null ? ([['Versión mínima', `${minimumLabel(habit)} (mantiene la racha)`]] as [string, string][]) : []),
    ...(habit.area ? ([['Área', areaInfo(habit.area).label]] as [string, string][]) : []),
    ...(goal ? ([['Aporta a la meta', goal.title]] as [string, string][]) : []),
    ...(quit ? ([['Días limpio', String(cleanDays(habit, now))]] as [string, string][]) : []),
    ['Racha', `${stats.current} · mejor ${stats.best}`],
    ['Veces cumplido', String(stats.completions)],
    ...(chain ? ([['Cadena', chain.name]] as [string, string][]) : []),
  ];

  return (
    <Modal title={habit.title} kicker={quit ? 'Mal hábito a dejar' : 'Hábito'} onClose={close} wide>
      <div className="detail__status">
        <Tag tone={status.tone}>{state === 'done' ? `✔ ${doneText}` : status.label}</Tag>
        <Tag tone="xp">+{habit.xp} XP</Tag>
        {minMet && <Tag tone="green">Mínimo cumplido</Tag>}
        {stats.current > 0 && <Tag tone="plain">Racha {stats.current}</Tag>}
      </div>

      <section className={cx('detail__today', done && 'is-done')} aria-label="Progreso de hoy">
        <div className="split">
          <span className="kicker">Hoy</span>
          <b>{progressText}</b>
        </div>
        <Bar pct={pct} tone="green" label={`Progreso de hoy: ${habit.title}`} />
        <HabitAction habit={habit} log={log} />
        <HabitRecovery habit={habit} logs={logs} />
      </section>

      {!quit && (
        <section aria-label="Hora del hábito">
          <HabitScheduler habit={habit} />
        </section>
      )}

      {habit.ifThen && habit.ifThen.length > 0 && (
        <section aria-label="Si… entonces…">
          <p className="kicker">Si… entonces…</p>
          <IfThenList plans={habit.ifThen} />
        </section>
      )}

      {habit.steps.length > 0 && (
        <section aria-label="Pasos de la sesión">
          <p className="kicker">Pasos de hoy</p>
          <ul className="subtasks">
            {habit.steps.map((s) => (
              <li key={s.id}>
                <label>
                  <input type="checkbox" checked={stepsDone.has(s.id)} onChange={() => toggleStep(habit.id, s.id)} />
                  <span className={cx(stepsDone.has(s.id) && 'is-struck')}>{s.title}</span>
                  {s.minutes > 0 && <span className="muted small"> · {s.minutes} min</span>}
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Esta semana">
        <p className="kicker">Esta semana</p>
        <HabitWeek habit={habit} logs={logs} now={now} />
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
        <Button variant="primary" onClick={() => openModal({ type: 'habit', id: habit.id })}>
          Editar
        </Button>
        <Link className="btn btn--ghost" to={`/habitos/${habit.id}`} onClick={close}>
          Ver historial completo
        </Link>
        <Button onClick={close}>Cerrar</Button>
      </div>
    </Modal>
  );
}
