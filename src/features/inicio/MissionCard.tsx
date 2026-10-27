import { useEffect, useRef, useState } from 'react';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { dayLabel, today } from '@/core/dates';
import { habitProgress, isCounter, logFor, stepForCounter } from '@/core/game';
import { isReadyToFinish, missionParts, type Mission } from '@/core/missions';
import { PRIORITY_LABEL, dueTimeOf, isBoss, isOverdue, timeLeftLabel } from '@/core/tasks';
import { chainOf, chainState } from '@/core/chains';
import { timesText } from '@/core/habitTime';
import { minimumOf } from '@/core/minimum';
import type { HabitChain, Priority } from '@/core/domain';
import { HabitAction, HabitMinimumButton, HabitRecovery } from '@/features/habitos/HabitAction';
import { Tag, cx } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';
import { Icon } from '@/ui/Icon';

/** Lista vacía estable: un `?? []` dentro del selector crea un array nuevo en cada render y provoca un bucle. */
const NO_CHAINS: HabitChain[] = [];

/** Cuántas barras se encienden en el indicador de prioridad (el jefe final lleva calavera). */
const PIPS: Record<Priority, number> = { low: 1, mid: 2, high: 3, boss: 3 };

/** Prioridad como indicador de señal: se reconoce sin leer, y el texto va en el atributo para lectores de pantalla. */
function PriorityMark({ priority }: { priority: Priority }) {
  return (
    <span className={cx('prio', `prio--${priority}`)} role="img" aria-label={`Prioridad: ${PRIORITY_LABEL[priority].toLowerCase()}`} title={`Prioridad ${PRIORITY_LABEL[priority].toLowerCase()}`}>
      {priority === 'boss' ? (
        <Sprite name="skull" size={14} />
      ) : (
        [1, 2, 3].map((i) => <i key={i} className={cx(i <= PIPS[priority] && 'is-on')} />)
      )}
    </span>
  );
}

/** Si el hábito es un eslabón de una cadena, se dice de qué rutina viene y a qué sigue. */
function ChainLine({ habitId }: { habitId: string }) {
  const logs = useData((s) => s.habitLogs);
  const habits = useData((s) => s.habits);
  const chains = useData((s) => s.profile.chains) ?? NO_CHAINS;
  const chain = chainOf(chains, habitId);
  if (!chain) return null;
  const now = chainState(chain, habits, logs);
  const link = now.links.find((l) => l.habit.id === habitId);
  return (
    <p className="mission__chain">
      Rutina {chain.name} · {now.doneCount}/{now.dueCount}
      {link?.after && <> · sigue a {link.after.title}</>}
    </p>
  );
}

/** Verdadero unos instantes cuando la misión pasa de pendiente a hecha: da pie al destello de «completada». */
function useJustDone(done: boolean): boolean {
  const prev = useRef(done);
  const [fx, setFx] = useState(false);
  useEffect(() => {
    const was = prev.current;
    prev.current = done;
    if (!done || was) return;
    setFx(true);
    const t = setTimeout(() => setFx(false), 700);
    return () => clearTimeout(t);
  }, [done]);
  return fx;
}

/**
 * Una misión de Hoy (hábito o tarea). El título abre su ficha y, con un botón «estirado», toda la tarjeta
 * es clicable; los controles de dentro (casilla, contador, desglose) quedan por encima y no la activan.
 */
export function MissionCard({ m, times }: { m: Mission; times?: string[] }) {
  const setTaskStatus = useData((s) => s.setTaskStatus);
  const setHabitValue = useData((s) => s.setHabitValue);
  const toggleSubtask = useData((s) => s.toggleSubtask);
  const toggleHabitStep = useData((s) => s.toggleHabitStep);
  const logs = useData((s) => s.habitLogs);
  const openModal = useUi((s) => s.openModal);
  const fx = useJustDone(m.done);

  // Un hábito de varias veces (8 vasos, 20 páginas) suma una cada vez que se pulsa la casilla y solo queda hecho al
  // llegar al total; ya hecho, la casilla lo deshace. El resto (una vez, minutos) se cumple de golpe.
  const counts = m.kind === 'habit' && isCounter(m.habit);
  const toggle = () => {
    if (m.kind === 'task') setTaskStatus(m.task.id, m.done ? 'todo' : 'done');
    else if (counts && !m.done) setHabitValue(m.habit.id, Math.min(m.habit.target, (logFor(logs, m.habit.id, today())?.value ?? 0) + stepForCounter(m.habit)));
    else setHabitValue(m.habit.id, m.done ? 0 : m.habit.target);
  };
  const openDetail = () => openModal(m.kind === 'task' ? { type: 'task-detail', id: m.task.id } : { type: 'habit-detail', id: m.habit.id });

  // Desglose de la misión: las subtareas de la tarea o los pasos de hoy del hábito.
  const parts = missionParts(m, logs);
  const boss = m.kind === 'task' && isBoss(m.task) && parts.length > 0;
  const noun = boss ? 'golpes' : m.kind === 'task' ? 'subtareas' : 'pasos';
  const doneParts = parts.filter((p) => p.done).length;
  // Los jefes enseñan sus puntos débiles desde el principio, como en Tareas.
  const [open, setOpen] = useState(boss && !m.done);
  const togglePart = (id: string) => (m.kind === 'task' ? toggleSubtask(m.task.id, id) : toggleHabitStep(m.habit.id, id));
  // Con todo el desglose hecho no la damos por terminada sola: se resalta para que la cierres tú.
  const ready = isReadyToFinish(m, parts);
  const late = m.kind === 'task' && !m.done && isOverdue(m.task);
  const habitLog = m.kind === 'habit' ? logFor(logs, m.habit.id, today()) : undefined;
  const checkLabel =
    m.kind === 'habit' && counts && !m.done
      ? `Sumar uno a: ${m.title} (${habitLog?.value ?? 0} de ${m.habit.target})`
      : `${m.done ? 'Deshacer' : 'Completar'}: ${m.title}${ready ? ' (ya tienes todo el desglose hecho)' : ''}`;
  // Avance a medias: de las subtareas/pasos o, en un hábito por cantidad, del contador.
  const progress = parts.length > 0 ? doneParts / parts.length : m.kind === 'habit' ? habitProgress(m.habit, habitLog) : 0;
  // Vencida en rojo, para hoy en oscuro (destaca sin competir con el amarillo del XP), el resto discreto.
  const dueTone = m.kind === 'task' && m.task.dueDate === today() ? 'dark' : 'plain';

  return (
    <li className={cx('mission', `mission--${m.kind}`, m.done && 'is-done', late && 'is-late', ready && 'is-ready', fx && 'is-fx')} data-flip-id={m.id}>
      <button
        type="button"
        className="mission__check"
        role="checkbox"
        aria-checked={m.done ? true : counts && (habitLog?.value ?? 0) > 0 ? 'mixed' : false}
        aria-label={checkLabel}
        title={ready ? '¡Todo listo! Pulsa para darla por terminada' : undefined}
        onClick={toggle}
      >
        {m.done ? <Icon name="check" size={16} /> : counts ? <Icon name="plus" size={14} /> : null}
      </button>
      <div className="mission__body">
        <button type="button" className="mission__open" onClick={openDetail} aria-haspopup="dialog" aria-label={`Ver detalle: ${m.title}`}>
          {boss && <Sprite name="skull" size={16} />}
          <span className="mission__title">{m.title}</span>
        </button>
        <p className="mission__sub">{m.subtitle}</p>
        {m.kind === 'habit' && <ChainLine habitId={m.habit.id} />}
        {m.kind === 'task' && (
          <div className="mission__meta">
            {!m.done && <Tag tone={late ? 'red' : dueTone}>{timeLeftLabel(m.task) ?? 'Sin fecha'}</Tag>}
            {/* La fecha exacta, con el día de la semana: «Vie 30 oct · 18:00». */}
            {m.task.dueDate && (
              <span className="mission__date">
                {dayLabel(m.task.dueDate)}
                {dueTimeOf(m.task) && ` · ${dueTimeOf(m.task)}`}
              </span>
            )}
            <PriorityMark priority={m.task.priority} />
          </div>
        )}
        {m.kind === 'habit' && (
          <div className="mission__meta">
            <span className="mission__date">
              Hoy · {dayLabel(today())}
              {times && times.length > 0 && (
                <>
                  {' · '}
                  <Icon name="bell" size={10} /> <span className="sr-only">a las </span>
                  {timesText(times)}
                </>
              )}
            </span>
          </div>
        )}
        {/* Hábitos por cantidad (agua, páginas, repeticiones…): se registra una repetición sin entrar al detalle. */}
        {m.kind === 'habit' && isCounter(m.habit) && (
          <div className="mission__counter">
            <HabitAction habit={m.habit} log={habitLog} />
          </div>
        )}
        {/* Los que no son contador no muestran control propio aquí: si tienen versión mínima, se ofrece al lado de la casilla. */}
        {m.kind === 'habit' && !isCounter(m.habit) && !m.done && minimumOf(m.habit) !== null && (
          <div className="mission__counter">
            <HabitMinimumButton habit={m.habit} log={habitLog} />
          </div>
        )}
        {m.kind === 'habit' && !m.done && <HabitRecovery habit={m.habit} logs={logs} />}
        {parts.length > 0 && (
          <button type="button" className={cx('tag tag--btn mission__more', ready ? 'tag--green' : 'tag--plain')} onClick={() => setOpen(!open)} aria-expanded={open} aria-label={`${doneParts}/${parts.length} ${noun} de ${m.title}`}>
            {doneParts}/{parts.length} {noun} {open ? '−' : '+'}
          </button>
        )}
        {!m.done && progress > 0 && progress < 1 && (
          <div className="mission__meter" aria-hidden="true">
            <i style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}
      </div>
      <Tag className="mission__xp" tone={m.done ? 'plain' : 'xp'}>
        +{m.xp} XP
      </Tag>
      {ready && <span className="mission__ready">¡Todo listo! Pulsa la casilla para terminarla.</span>}
      {open && parts.length > 0 && (
        <ul className="subtasks mission__subs">
          {parts.map((p) => (
            <li key={p.id}>
              <label>
                <input type="checkbox" checked={p.done} onChange={() => togglePart(p.id)} disabled={m.kind === 'task' && m.done} />
                <span className={cx(p.done && 'is-struck')}>{p.title}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
