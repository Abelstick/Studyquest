import { useState } from 'react';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { XP_BY_PRIORITY } from '@/core/game';
import { newId } from '@/core/dates';
import type { Priority, TaskStatus } from '@/core/domain';
import { Button, Field, Modal, Segmented, linesToList } from '@/ui/kit';

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

export function TaskModal({ id }: { id?: string }) {
  const close = useUi((s) => s.closeModal);
  const openModal = useUi((s) => s.openModal);
  const { tasks, courses, createTask, updateTask, deleteTask } = useData();
  const editing = tasks.find((t) => t.id === id);

  const [title, setTitle] = useState(editing?.title ?? '');
  const [courseId, setCourseId] = useState(editing?.courseId ?? '');
  const [due, setDue] = useState(editing?.dueDate ?? '');
  const [priority, setPriority] = useState<Priority>(editing?.priority ?? 'mid');
  const [estimate, setEstimate] = useState(editing?.estimateMin ?? 30);
  const [xp, setXp] = useState(editing?.xp ?? XP_BY_PRIORITY.mid);
  const [xpTouched, setXpTouched] = useState(!!editing);
  const [subs, setSubs] = useState(editing?.subtasks.map((s) => s.title).join('\n') ?? '');
  const [tags, setTags] = useState(editing?.tags.join(', ') ?? '');
  const [status, setStatus] = useState<TaskStatus>(editing?.status ?? 'todo');

  const pickPriority = (p: Priority) => {
    setPriority(p);
    if (!xpTouched) setXp(XP_BY_PRIORITY[p]);
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
      estimateMin: Math.max(0, estimate),
      xp: Math.max(0, xp),
      subtasks,
      tags: tags.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean),
    };
    if (editing) updateTask(editing.id, { ...data, status });
    else createTask({ ...data, status });
    close();
  };

  return (
    <Modal title={editing ? 'Editar tarea' : 'Crear tarea'} kicker={editing ? '// Contrato' : '// Nuevo contrato'} onClose={close}>
      <form onSubmit={submit} className="form">
        <Field label="Título">{(fid) => <input id={fid} className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Terminar ejercicios de JOIN" required maxLength={120} />}</Field>
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
        </div>
        <Field label="Prioridad">{() => <Segmented label="Prioridad" value={priority} options={PRIORITIES} onChange={pickPriority} />}</Field>
        <div className="form__row">
          <Field label="Tiempo estimado (min)">{(fid) => <input id={fid} className="input" type="number" min={0} step={5} value={estimate} onChange={(e) => setEstimate(Number(e.target.value))} />}</Field>
          <Field label="Recompensa (XP)">
            {(fid) => (
              <input
                id={fid}
                className="input input--xp"
                type="number"
                min={0}
                step={5}
                value={xp}
                onChange={(e) => {
                  setXp(Number(e.target.value));
                  setXpTouched(true);
                }}
              />
            )}
          </Field>
        </div>
        {editing && <Field label="Estado">{() => <Segmented label="Estado" value={status} options={STATUSES} onChange={setStatus} />}</Field>}
        <Field label="Subtareas" hint="Una por línea.">{(fid) => <textarea id={fid} className="input" rows={3} value={subs} onChange={(e) => setSubs(e.target.value)} placeholder={'Repasar INNER vs LEFT\nResolver los 8 ejercicios'} />}</Field>
        <Field label="Etiquetas" hint="Separadas por comas.">{(fid) => <input id={fid} className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="sql, práctica" />}</Field>
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
