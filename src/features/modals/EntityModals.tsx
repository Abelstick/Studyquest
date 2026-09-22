import { useState } from 'react';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { newId, today } from '@/core/dates';
import type { Mentor } from '@/core/domain';
import { Button, ChipGroup, Field, Modal, linesToList, TextInput } from '@/ui/kit';
import { ConceptHint } from '../help/ConceptGuide';

/** "Título | 120" → { title, xp }. */
const parseXpLine = (line: string, fallback: number) => {
  const [title, xp] = line.split('|').map((p) => p.trim());
  return { title: title || line, xp: Number(xp) > 0 ? Number(xp) : fallback };
};

export function CourseModal({ id }: { id?: string }) {
  const close = useUi((s) => s.closeModal);
  const openModal = useUi((s) => s.openModal);
  const { courses, createCourse, updateCourse, deleteCourse } = useData();
  const editing = courses.find((c) => c.id === id);

  const [title, setTitle] = useState(editing?.title ?? '');
  const [professor, setProfessor] = useState(editing?.professor ?? '');
  const [field, setField] = useState(editing?.field ?? '');
  const [modules, setModules] = useState('');
  const [mentorName, setMentorName] = useState(editing?.mentor?.name ?? '');
  const [mentorSkills, setMentorSkills] = useState(editing?.mentor?.skills ?? '');
  const [feedback, setFeedback] = useState(editing?.mentor?.feedback ?? '');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const mentor: Mentor | null = mentorName.trim()
      ? { name: mentorName.trim(), skills: mentorSkills.trim(), feedback: feedback.trim(), feedbackAt: feedback.trim() && feedback.trim() !== editing?.mentor?.feedback ? today() : (editing?.mentor?.feedbackAt ?? null) }
      : null;
    const base = { title: title.trim(), professor: professor.trim(), field: field.trim(), mentor };
    if (editing) updateCourse(editing.id, base);
    else {
      createCourse({
        ...base,
        modules: linesToList(modules).map((l) => {
          const { title: t, xp } = parseXpLine(l, 200);
          return { id: newId(), title: t, summary: '', xp, topics: [] };
        }),
      });
    }
    close();
  };

  return (
    <Modal title={editing ? 'Editar curso' : 'Nuevo curso'} kicker="// Mundo" onClose={close}>
      <form onSubmit={submit} className="form">
        <Field label="Nombre del curso">{(fid) => <TextInput id={fid} className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Análisis de Datos" required maxLength={80} />}</Field>
        <div className="form__row">
          <Field label="Profesor/a">{(fid) => <TextInput id={fid} className="input" value={professor} onChange={(e) => setProfessor(e.target.value)} placeholder="Prof. Marta Núñez" />}</Field>
          <Field label="Área">{(fid) => <TextInput id={fid} className="input" value={field} onChange={(e) => setField(e.target.value)} placeholder="ciencia de datos" />}</Field>
        </div>
        {!editing && (
          <Field label="Módulos" hint="Uno por línea; añade «| 300» para darle XP. Los temas los agregas después, dentro del curso.">
            {(fid) => <textarea id={fid} className="input" rows={4} value={modules} onChange={(e) => setModules(e.target.value)} placeholder={'Fundamentos | 300\nSQL | 600\nPandas | 600'} />}
          </Field>
        )}
        <fieldset className="fieldset">
          <legend className="kicker">Mentor/a (opcional)</legend>
          <div className="form__row">
            <Field label="Nombre">{(fid) => <TextInput id={fid} className="input" value={mentorName} onChange={(e) => setMentorName(e.target.value)} />}</Field>
            <Field label="Especialidades">{(fid) => <TextInput id={fid} className="input" value={mentorSkills} onChange={(e) => setMentorSkills(e.target.value)} placeholder="SQL · Python" />}</Field>
          </div>
          <Field label="Último feedback">{(fid) => <textarea id={fid} className="input" rows={2} value={feedback} onChange={(e) => setFeedback(e.target.value)} />}</Field>
        </fieldset>
        <div className="modal__actions">
          <Button variant="primary" type="submit" disabled={!title.trim()}>
            {editing ? 'Guardar cambios' : 'Crear curso'}
          </Button>
          <Button onClick={close}>Cancelar</Button>
          {editing && (
            <Button variant="danger" className="push-right" onClick={() => openModal({ type: 'confirm', title: 'Borrar curso', body: `Se eliminará "${editing.title}" con todos sus módulos, temas y tareas.`, confirmLabel: 'Borrar', onConfirm: () => deleteCourse(editing.id) })}>
              Borrar
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}

export function GoalModal() {
  const close = useUi((s) => s.closeModal);
  const createGoal = useData((s) => s.createGoal);
  const [title, setTitle] = useState('');
  const [rewardTitle, setRewardTitle] = useState('');
  const [rewardDescription, setRewardDescription] = useState('');
  const [milestones, setMilestones] = useState('');

  const items = linesToList(milestones);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !items.length) return;
    createGoal({
      title: title.trim(),
      rewardTitle: rewardTitle.trim() || 'Título: Leyenda',
      rewardDescription: rewardDescription.trim(),
      milestones: items.map((l) => {
        const { title: t, xp } = parseXpLine(l, 100);
        return { id: newId(), title: t, summary: '', xp, done: false, skills: [] };
      }),
    });
    close();
  };

  return (
    <Modal title="Nueva meta" kicker="// Árbol de habilidades" onClose={close}>
      <form onSubmit={submit} className="form">
        <ConceptHint id="meta" />
        <Field label="Meta">{(fid) => <TextInput id={fid} className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Aprender Análisis de Datos" required maxLength={100} />}</Field>
        <Field label="Hitos" hint="Uno por línea, en orden. Añade «| 300» para darle XP (por defecto 100).">
          {(fid) => <textarea id={fid} className="input" rows={5} value={milestones} onChange={(e) => setMilestones(e.target.value)} placeholder={'Aprender Excel | 100\nAprender SQL | 200\nProyecto final | 1000'} required />}
        </Field>
        <Field label="Recompensa final">{(fid) => <TextInput id={fid} className="input" value={rewardTitle} onChange={(e) => setRewardTitle(e.target.value)} placeholder="Título: Analista de Datos Jr." />}</Field>
        <Field label="Descripción de la recompensa">{(fid) => <textarea id={fid} className="input" rows={2} value={rewardDescription} onChange={(e) => setRewardDescription(e.target.value)} />}</Field>
        <div className="modal__actions">
          <Button variant="primary" type="submit" disabled={!title.trim() || !items.length}>
            Crear meta
          </Button>
          <Button onClick={close}>Cancelar</Button>
        </div>
      </form>
    </Modal>
  );
}

export function ProjectModal() {
  const close = useUi((s) => s.closeModal);
  const createProject = useData((s) => s.createProject);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [kind, setKind] = useState<'main' | 'side'>('side');
  const [checkpoints, setCheckpoints] = useState('');

  const items = linesToList(checkpoints);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !items.length) return;
    createProject({
      title: title.trim(),
      summary: summary.trim(),
      kind,
      checkpoints: items.map((l) => {
        const { title: t, xp } = parseXpLine(l, 100);
        return { id: newId(), title: t, summary: '', xp, done: false };
      }),
    });
    close();
  };

  return (
    <Modal title="Nuevo proyecto" kicker="// Mazmorra" onClose={close}>
      <form onSubmit={submit} className="form">
        <ConceptHint id="proyecto" />
        <Field label="Nombre">{(fid) => <TextInput id={fid} className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Crear mi primer portafolio" required maxLength={100} />}</Field>
        <Field label="Descripción">{(fid) => <textarea id={fid} className="input" rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} />}</Field>
        <Field label="Tipo">
          {() => (
            <ChipGroup
              label="Tipo"
              value={kind}
              options={[
                { value: 'main', label: 'Operación principal' },
                { value: 'side', label: 'Side quest' },
              ]}
              onChange={setKind}
            />
          )}
        </Field>
        <Field label="Checkpoints" hint="Uno por línea, en orden. Añade «| 300» para darle XP (por defecto 100).">
          {(fid) => <textarea id={fid} className="input" rows={5} value={checkpoints} onChange={(e) => setCheckpoints(e.target.value)} placeholder={'Diseñar la página | 150\nCrear el frontend | 300\nPublicar | 300'} required />}
        </Field>
        <div className="modal__actions">
          <Button variant="primary" type="submit" disabled={!title.trim() || !items.length}>
            Crear proyecto
          </Button>
          <Button onClick={close}>Cancelar</Button>
        </div>
      </form>
    </Modal>
  );
}

export function RewardModal() {
  const close = useUi((s) => s.closeModal);
  const createReward = useData((s) => s.createReward);
  const [title, setTitle] = useState('');
  const [condition, setCondition] = useState('');
  const [target, setTarget] = useState(5);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createReward({ title: title.trim(), condition: condition.trim(), target: Math.max(1, target) });
    close();
  };

  return (
    <Modal title="Recompensa personal" kicker="// Premio de la vida real" onClose={close}>
      <form onSubmit={submit} className="form">
        <Field label="Premio">{(fid) => <TextInput id={fid} className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ver una película sin culpa" required maxLength={100} />}</Field>
        <Field label="Condición">{(fid) => <TextInput id={fid} className="input" value={condition} onChange={(e) => setCondition(e.target.value)} placeholder="Si completo 5 días seguidos de estudio" />}</Field>
        <Field label="Pasos para conseguirlo" hint="Podrás sumar avances con +1 en el Arsenal.">{(fid) => <input id={fid} className="input" type="number" min={1} max={999} value={target} onChange={(e) => setTarget(Number(e.target.value))} />}</Field>
        <div className="modal__actions">
          <Button variant="primary" type="submit" disabled={!title.trim()}>
            Crear recompensa
          </Button>
          <Button onClick={close}>Cancelar</Button>
        </div>
      </form>
    </Modal>
  );
}
