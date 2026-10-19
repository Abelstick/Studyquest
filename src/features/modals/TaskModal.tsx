import { useMemo, useState } from 'react';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { XP_BY_PRIORITY } from '@/core/game';
import { DIFFICULTIES, difficultyInfo, difficultyOf, xpForDifficulty } from '@/core/difficulty';
import { isClockTime, minutesOfDay, newId, today } from '@/core/dates';
import { planTaskSlots, slotLabel, taskBlockDrafts, taskBlocks } from '@/core/routine';
import { WorksQuestion } from '../calendario/WorksQuestion';
import type { AreaId, Difficulty, Priority, Recurrence, TaskStatus } from '@/core/domain';
import { BOSS_BONUS_XP, RECURRENCE_UNITS } from '@/core/tasks';
import { Button, Field, Modal, Segmented, linesToList, TextInput, NumberInput } from '@/ui/kit';
import { ConceptHint } from '../help/ConceptGuide';
import { Fold, OrganizeFields } from './LifeFields';

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Baja' },
  { value: 'mid', label: 'Media' },
  { value: 'high', label: 'Alta' },
  { value: 'boss', label: 'Jefe final' },
];
const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'Por jugar' },
  { value: 'doing', label: 'En juego' },
  { value: 'done', label: 'Superada' },
];

export function TaskModal({ id, dueDate, goalId: presetGoal }: { id?: string; dueDate?: string; goalId?: string }) {
  const close = useUi((s) => s.closeModal);
  const openModal = useUi((s) => s.openModal);
  const { tasks, courses, events, habits, habitLogs, createTask, updateTask, deleteTask, createEvent } = useData();
  const editing = tasks.find((t) => t.id === id);

  const [title, setTitle] = useState(editing?.title ?? '');
  const [courseId, setCourseId] = useState(editing?.courseId ?? '');
  const [due, setDue] = useState(editing?.dueDate ?? dueDate ?? '');
  const [dueTime, setDueTime] = useState(editing?.dueTime ?? '');
  const [repeat, setRepeat] = useState<Recurrence | null>(editing?.recurrence ?? null);
  const [priority, setPriority] = useState<Priority>(editing?.priority ?? 'mid');
  const [estimate, setEstimate] = useState(editing?.estimateMin ?? 30);
  const [difficulty, setDifficulty] = useState<Difficulty>(editing ? difficultyOf(editing) : 'normal');
  const [xp, setXp] = useState(editing?.xp ?? XP_BY_PRIORITY.mid);
  // Si el XP ya no coincide con el que propone su prioridad y dificultad, es que lo personalizaste: no se lo pisamos.
  const [xpTouched, setXpTouched] = useState(!!editing && editing.xp !== xpForDifficulty(XP_BY_PRIORITY[editing.priority], difficultyOf(editing)));
  const [subs, setSubs] = useState(editing?.subtasks.map((s) => s.title).join('\n') ?? '');
  const [tags, setTags] = useState(editing?.tags.join(', ') ?? '');
  const [status, setStatus] = useState<TaskStatus>(editing?.status ?? 'todo');
  const [area, setArea] = useState<AreaId | ''>(editing?.area ?? '');
  const [goalId, setGoalId] = useState(editing?.goalId ?? presetGoal ?? '');
  // Reservar un rato en el calendario: por defecto al crear (si ya hay horario) y nunca si la tarea ya tiene uno.
  const [reserve, setReserve] = useState(true);
  const hasBlocks = !!editing && taskBlocks(events, editing.id).length > 0;
  const draftTask = { id: editing?.id ?? 'nueva', title, dueDate: due || null, dueTime: due && isClockTime(dueTime) ? dueTime : undefined, estimateMin: Math.max(0, estimate), priority, courseId: courseId || null, area: area || undefined };
  const plan = useMemo(
    () => (!events.length || hasBlocks || status === 'done' ? null : planTaskSlots([draftTask], { events, habits, tasks, habitLogs }, today(), minutesOfDay())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, hasBlocks, status, due, dueTime, estimate, priority, courseId, area, habits, tasks, habitLogs],
  );

  const pickPriority = (p: Priority) => {
    setPriority(p);
    if (!xpTouched) setXp(xpForDifficulty(XP_BY_PRIORITY[p], difficulty));
  };
  const pickDifficulty = (d: Difficulty) => {
    setDifficulty(d);
    if (!xpTouched) setXp(xpForDifficulty(XP_BY_PRIORITY[priority], d));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const previous = editing?.subtasks ?? [];
    const subtasks = linesToList(subs).map((t) => previous.find((p) => p.title === t) ?? { id: newId(), title: t, done: false });
    const data = {
      title: title.trim(),
      courseId: courseId || null,
      priority,
      dueDate: due || null,
      // La hora solo vale con fecha; sin ella la tarea vence al terminar el día.
      dueTime: due && isClockTime(dueTime) ? dueTime : undefined,
      estimateMin: Math.max(0, estimate),
      xp: Math.max(0, xp),
      difficulty,
      subtasks,
      tags: tags.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean),
      recurrence: repeat ? { unit: repeat.unit, interval: Math.max(1, Math.min(365, Math.floor(repeat.interval) || 1)) } : undefined,
      area: area || undefined,
      goalId: goalId || undefined,
    };
    let id: string;
    if (editing) {
      updateTask(editing.id, { ...data, status });
      id = editing.id;
    } else id = createTask({ ...data, status });
    // El rato sugerido pasa a ser un bloque del calendario vinculado a la tarea; la tarea sigue siendo quien se completa.
    if (reserve && plan?.slots.length) taskBlockDrafts({ ...draftTask, id }, plan.slots.map((s) => ({ ...s, taskId: id }))).forEach((d) => createEvent(d));
    close();
  };

  return (
    <Modal title={editing ? 'Editar tarea' : 'Crear tarea'} kicker={editing ? '// Contrato' : '// Nuevo contrato'} onClose={close}>
      <form onSubmit={submit} className="form">
        {!editing && <ConceptHint id="tarea" />}
        <Field label="Título">{(fid) => <TextInput id={fid} className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Terminar ejercicios de JOIN" required maxLength={120} />}</Field>
        <div className="form__row">
          <Field label="Curso">
            {(fid) => (
              <select id={fid} className="input" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                <option value="">Side quest (sin curso)</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Fecha límite">{(fid) => <input id={fid} className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />}</Field>
          <Field label="Hora límite" hint={!due ? 'Elige primero una fecha.' : dueTime ? 'Te avisamos una hora antes.' : 'Opcional. Sin hora, vale todo el día.'}>
            {(fid) => <input id={fid} className="input" type="time" value={due ? dueTime : ''} disabled={!due} onChange={(e) => setDueTime(e.target.value)} />}
          </Field>
        </div>
        <Field label="Prioridad">{() => <Segmented label="Prioridad" value={priority} options={PRIORITIES} onChange={pickPriority} />}</Field>
        <Field label="Dificultad" hint={`${difficultyInfo(difficulty).hint} Ajusta el XP que propone la tarea; puedes cambiarlo abajo.`}>
          {() => <Segmented label="Dificultad" value={difficulty} options={DIFFICULTIES.map((d) => ({ value: d.value, label: d.label }))} onChange={pickDifficulty} />}
        </Field>
        {priority === 'boss' && (
          <p className="form__info">
            ☠ Un jefe final tiene una vida por subtarea: cada una que completes le quita una. Al caer el último golpe ganas su XP y un botín extra de <b>+{BOSS_BONUS_XP} XP</b>. Añade subtareas abajo para darle vida.
          </p>
        )}
        <div className="form__row">
          <Field label="Tiempo estimado (min)">{(fid) => <NumberInput id={fid} className="input" min={0} step={5} value={estimate} onValue={(n) => setEstimate(n)}/>}</Field>
          <Field label="Recompensa (XP)">
            {(fid) => (
              <NumberInput
                id={fid}
                className="input input--xp"
                min={0}
                step={5}
                value={xp}
                onValue={(n) => {
                  setXp(n);
                  setXpTouched(true);
                }}/>
            )}
          </Field>
        </div>
        {plan && (
          <div className="sched">
            {plan.slots.length > 0 ? (
              <label className="stepcheck">
                <input type="checkbox" checked={reserve} onChange={(e) => setReserve(e.target.checked)} />
                <span>
                  <b>Reservar un rato en mi calendario:</b> {plan.slots.slice(0, 2).map((s) => slotLabel(s, today())).join(' · ')}
                  {plan.slots.length > 2 && ` y ${plan.slots.length - 2} más`} <span className="muted small">(fuera de tu horario laboral)</span>
                </span>
              </label>
            ) : (
              <p className="muted small">No encuentro un rato libre antes del plazo; revisa la fecha o libera tiempo en el calendario.</p>
            )}
            {plan.unplaced.length > 0 && plan.slots.length > 0 && <p className="muted small">⚠ No cabe todo antes del plazo (faltarían {plan.unplaced[0].left} min).</p>}
          </div>
        )}
        {!events.length && !editing && <WorksQuestion />}
        <Field label="Repetir" hint={repeat ? 'Al completarla se crea la siguiente con su nueva fecha.' : 'Al completarla se crea sola la siguiente.'}>
          {() => (
            <div className="repeat">
              <Segmented
                label="Repetición"
                value={repeat ? repeat.unit : 'none'}
                options={[{ value: 'none', label: 'No' }, ...RECURRENCE_UNITS]}
                onChange={(v) => setRepeat(v === 'none' ? null : { unit: v, interval: repeat?.interval ?? 1 })}
              />
              {repeat && (
                <label className="repeat__every">
                  Cada
                  <NumberInput className="input input--inline" min={1} max={365} value={repeat.interval} onValue={(n) => setRepeat({ ...repeat, interval: n })} aria-label="Cada cuántos" />
                  {repeat.unit === 'day' ? 'días' : repeat.unit === 'week' ? 'semanas' : 'meses'}
                </label>
              )}
            </div>
          )}
        </Field>
        {editing && <Field label="Estado">{() => <Segmented label="Estado" value={status} options={STATUSES} onChange={setStatus} />}</Field>}
        <Fold summary="Área y meta (opcional)" open={!!area || !!goalId}>
          <OrganizeFields area={area} onArea={setArea} goalId={goalId} onGoal={setGoalId} />
        </Fold>
        <Field label="Subtareas" hint="Una por línea.">{(fid) => <textarea id={fid} className="input" rows={3} value={subs} onChange={(e) => setSubs(e.target.value)} placeholder={'Repasar INNER vs LEFT\nResolver los 8 ejercicios'} />}</Field>
        <Field label="Etiquetas" hint="Separadas por comas.">{(fid) => <TextInput id={fid} className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="sql, práctica" />}</Field>
        <div className="modal__actions">
          <Button variant="primary" type="submit" disabled={!title.trim()}>
            {editing ? 'Guardar cambios' : 'Crear tarea'}
          </Button>
          <Button onClick={close}>Cancelar</Button>
          {editing && (
            <Button
              variant="danger"
              className="push-right"
              onClick={() =>
                openModal({ type: 'confirm', title: 'Borrar tarea', body: `Se eliminará "${editing.title}". Si estaba completada, recuperarás los XP.`, confirmLabel: 'Borrar', onConfirm: () => {
                  if (editing.status === 'done') updateTask(editing.id, { status: 'todo' });
                  deleteTask(editing.id);
                } })
              }
            >
              Borrar
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
