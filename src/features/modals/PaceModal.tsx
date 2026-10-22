import { useMemo, useState } from 'react';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { longDate, shortDate, today } from '@/core/dates';
import { PACE_OPTIONS, lastDue, overdueOf, shiftTasks, slidePlan } from '@/core/pace';
import type { Task } from '@/core/domain';
import { Button, ChipGroup, Modal, Tag } from '@/ui/kit';

type LateMode = 'slide' | 'spread';
const LATE_MODES: { value: LateMode; label: string; hint: string }[] = [
  { value: 'slide', label: 'Mover todo el plan', hint: 'Empieza hoy y conserva el espaciado entre tareas, como estaba pensado.' },
  { value: 'spread', label: 'Solo las atrasadas', hint: 'Reparte las vencidas desde hoy, una por día; lo que viene no se mueve.' },
];

interface AlreadyDoneProps {
  tasks: readonly Task[];
  done: ReadonlySet<string>;
  onToggle: (id: string) => void;
  pledge: boolean;
  onPledge: (v: boolean) => void;
}

/** Lista de vencidas con «ya la hice» y, si se marca alguna, el contrato de honor que hay que firmar para cobrar su XP. */
function AlreadyDone({ tasks, done, onToggle, pledge, onPledge }: Readonly<AlreadyDoneProps>) {
  return (
    <fieldset className="stack">
      <legend className="kicker">¿Cuáles ya hiciste?</legend>
      <ul className="subtasks">
        {tasks.map((t) => (
          <li key={t.id}>
            <label>
              <input type="checkbox" checked={done.has(t.id)} onChange={() => onToggle(t.id)} />
              <span>{t.title} <span className="muted small">· vencía el {shortDate(t.dueDate as string)}</span></span>
            </label>
          </li>
        ))}
      </ul>
      <p className="small muted">Las que marques se completan y dan su XP, como si las hubieras terminado hoy. Se pueden reabrir después.</p>
      {done.size > 0 && (
        <label className="honor">
          <input type="checkbox" checked={pledge} onChange={(e) => onPledge(e.target.checked)} />
          <span>
            <b>Contrato de honor.</b> Doy mi palabra de que {done.size === 1 ? 'esta tarea sí la hice' : `estas ${done.size} tareas sí las hice`}. El XP es para mí, y el único que sale perdiendo si miento soy yo.
          </span>
        </label>
      )}
    </fieldset>
  );
}

/**
 * Estira, comprime o recompone las fechas de las tareas pendientes (plazo corto, largo o incumplido).
 * Con `courseId` solo las de ese curso; sin él, todas: sirve para retomar un plan tras días sin usar la app.
 * Antes de mover nada se puede indicar cuáles de las vencidas ya se hicieron: esas se completan y no se reprograman.
 */
export function PaceModal({ courseId }: Readonly<{ courseId?: string }>) {
  const close = useUi((s) => s.closeModal);
  const course = useData((s) => s.courses.find((c) => c.id === courseId));
  const allTasks = useData((s) => s.tasks);
  const shiftTasksDo = useData((s) => s.shiftTasks);
  const setTaskStatus = useData((s) => s.setTaskStatus);
  const tasks = useMemo(() => (courseId ? allTasks.filter((t) => t.courseId === courseId) : allTasks), [allTasks, courseId]);
  const now = today();
  const lateTasks = useMemo(() => tasks.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate < now).sort((a, b) => (a.dueDate as string).localeCompare(b.dueDate as string)), [tasks, now]);
  const [alreadyDone, setAlreadyDone] = useState<ReadonlySet<string>>(new Set());
  const [pledge, setPledge] = useState(false);
  const [pace, setPace] = useState('same');
  // Si la mayor parte del plan está vencida, lo normal es moverlo entero; si solo se atrasaron unas pocas, repartirlas.
  const [mode, setMode] = useState<LateMode>(() => (lateTasks.length * 2 >= tasks.filter((t) => t.status !== 'done' && t.dueDate).length ? 'slide' : 'spread'));
  const factor = PACE_OPTIONS.find((p) => p.id === pace)?.factor ?? 1;

  // Lo que quedaría tras marcar las que ya se hicieron: sobre eso se calculan las fechas nuevas.
  const effective = useMemo(() => tasks.map((t) => (alreadyDone.has(t.id) ? { ...t, status: 'done' as const } : t)), [tasks, alreadyDone]);
  const late = overdueOf(effective, now);
  const pending = effective.filter((t) => t.status !== 'done' && t.dueDate).length;
  const shifts = useMemo(() => (late > 0 && mode === 'slide' ? slidePlan(effective, factor, now) : shiftTasks(effective, factor, now)), [effective, factor, now, late, mode]);
  const after = useMemo(() => {
    const to = new Map(shifts.map((s) => [s.id, s.dueDate]));
    return lastDue(effective.filter((t) => t.status !== 'done').map((t) => ({ dueDate: to.get(t.id) ?? t.dueDate })));
  }, [effective, shifts]);

  const toggle = (id: string) => {
    const next = new Set(alreadyDone);
    if (!next.delete(id)) next.add(id);
    if (next.size === 0) setPledge(false); // cada vez que vuelves a marcar, vuelves a dar tu palabra
    setAlreadyDone(next);
  };
  // Sin firmar el contrato de honor no se completa nada: el XP de lo ya hecho se basa en la palabra de cada uno.
  const needsPledge = alreadyDone.size > 0 && !pledge;
  const apply = () => {
    if (needsPledge) return;
    for (const id of alreadyDone) setTaskStatus(id, 'done');
    shiftTasksDo(shifts);
    close();
  };

  if (courseId && !course) return null;
  const nothing = lateTasks.length === 0 && pending === 0;
  return (
    <Modal title="Ajustar plazos" kicker={`${course ? course.title : 'Todas las tareas'}`} onClose={close}>
      <div className="stack">
        {nothing ? (
          <p className="muted">{course ? 'Este curso no tiene' : 'No tienes'} tareas pendientes con fecha. Crea tareas con fecha (o importa un pack) para poder ajustar el ritmo.</p>
        ) : (
          <>
            <p className="muted small">
              {lateTasks.length > 0
                ? <>Te atrasaste en <b>{lateTasks.length}</b> {lateTasks.length === 1 ? 'tarea' : 'tareas'}, y no pasa nada: dinos cuáles ya hiciste y movemos el resto desde hoy. </>
                : <>Si el plazo te queda corto o largo, cambia el ritmo. </>}
              Solo se mueven las tareas pendientes; lo que ya hiciste no se toca.
            </p>
            {lateTasks.length > 0 && <AlreadyDone tasks={lateTasks} done={alreadyDone} onToggle={toggle} pledge={pledge} onPledge={setPledge} />}
            {late > 0 && (
              <>
                <ChipGroup label="Qué hacer con lo que sigue atrasado" value={mode} onChange={(v) => setMode(v as LateMode)} options={LATE_MODES.map((m) => ({ value: m.value, label: m.label }))} />
                <p className="small muted">{LATE_MODES.find((m) => m.value === mode)?.hint}</p>
              </>
            )}
            <ChipGroup label="Ritmo" value={pace} onChange={setPace} options={PACE_OPTIONS.map((p) => ({ value: p.id, label: p.label }))} />
            <p className="small muted">{PACE_OPTIONS.find((p) => p.id === pace)?.hint}</p>
            <p>
              {alreadyDone.size > 0 && <><Tag tone="green">{alreadyDone.size} {alreadyDone.size === 1 ? 'se completa' : 'se completan'}</Tag>{' '}</>}
              <Tag tone={shifts.length ? 'blue' : 'plain'}>{shifts.length} {shifts.length === 1 ? 'tarea cambia' : 'tareas cambian'} de día</Tag>{' '}
              {after && <span className="small">Terminarías el {longDate(after)}.</span>}
            </p>
          </>
        )}
        <div className="modal__actions">
          <Button variant="primary" disabled={needsPledge || (!shifts.length && !alreadyDone.size)} onClick={apply} title={needsPledge ? 'Firma el contrato de honor para completar las tareas marcadas' : undefined}>
            Aplicar
          </Button>
          <Button onClick={close}>Cancelar</Button>
        </div>
      </div>
    </Modal>
  );
}
