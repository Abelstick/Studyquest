import { useState } from 'react';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { addDays, diffDays, newId, today } from '@/core/dates';
import type { AreaId, IfThen, Mentor } from '@/core/domain';
import { cleanIfThen } from '@/core/ifthen';
import { safeUrl } from '@/core/certifications';
import { Button, ChipGroup, Field, Modal, linesToList, TextInput, NumberInput } from '@/ui/kit';
import { describeExtras, planOfCourse } from '@/core/plans';
import { AreaChips } from '@/ui/Area';
import { ConceptHint } from '../help/ConceptGuide';
import { Fold, IfThenEditor } from './LifeFields';

/** "Título | 120" → { title, xp }. */
const parseXpLine = (line: string, fallback: number) => {
  const [title, xp] = line.split('|').map((p) => p.trim());
  return { title: title || line, xp: Number(xp) > 0 ? Number(xp) : fallback };
};

export function CourseModal({ id }: { id?: string }) {
  const close = useUi((s) => s.closeModal);
  const openModal = useUi((s) => s.openModal);
  const { courses, goals, habits, tasks, createCourse, updateCourse, deleteCourse, deletePlanExtras } = useData();
  const editing = courses.find((c) => c.id === id);

  const [title, setTitle] = useState(editing?.title ?? '');
  const [professor, setProfessor] = useState(editing?.professor ?? '');
  const [field, setField] = useState(editing?.field ?? '');
  const [link, setLink] = useState(editing?.link ?? '');
  const badLink = link.trim().length > 0 && safeUrl(link) === null;
  const [modules, setModules] = useState('');
  const [mentorName, setMentorName] = useState(editing?.mentor?.name ?? '');
  const [mentorSkills, setMentorSkills] = useState(editing?.mentor?.skills ?? '');
  const [feedback, setFeedback] = useState(editing?.mentor?.feedback ?? '');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || badLink) return;
    const mentor: Mentor | null = mentorName.trim()
      ? { name: mentorName.trim(), skills: mentorSkills.trim(), feedback: feedback.trim(), feedbackAt: feedback.trim() && feedback.trim() !== editing?.mentor?.feedback ? today() : (editing?.mentor?.feedbackAt ?? null) }
      : null;
    const base = { title: title.trim(), professor: professor.trim(), field: field.trim(), mentor, link: safeUrl(link) ?? undefined };
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
        <Field label="Enlace del curso (opcional)" hint="Si es de una plataforma (Udemy, Coursera, YouTube…), para abrirlo desde aquí.">
          {(fid) => <TextInput id={fid} className="input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="udemy.com/course/..." spellCheck={false} aria-invalid={badLink || undefined} />}
        </Field>
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
          <Button variant="primary" type="submit" disabled={!title.trim() || badLink}>
            {editing ? 'Guardar cambios' : 'Crear curso'}
          </Button>
          <Button onClick={close}>Cancelar</Button>
          {editing && (
            <Button
              variant="danger"
              className="push-right"
              onClick={() => {
                // Si el curso salió del planificador, se ofrece borrar también la meta y el hábito
                // que nacieron con él: si no, quedaban sueltos por ahí.
                const plan = planOfCourse(editing, { courses, goals, habits, tasks });
                const extras = plan ? describeExtras(plan) : '';
                openModal({
                  type: 'confirm',
                  title: 'Borrar curso',
                  body: `Se eliminará "${editing.title}" con todos sus módulos, temas y tareas.`,
                  confirmLabel: 'Borrar',
                  extra: extras ? { label: `Borrar también ${extras}`, hint: 'se crearon con este plan', defaultChecked: true } : undefined,
                  onConfirm: (tambien) => {
                    deleteCourse(editing.id);
                    if (tambien && plan) deletePlanExtras(plan);
                  },
                });
              }}
            >
              Borrar
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}

/** Plazos rápidos de una meta, en días desde hoy. */
const GOAL_DEADLINES = [
  { value: 30, label: '30 días' },
  { value: 90, label: '90 días' },
  { value: 180, label: '6 meses' },
];

/**
 * Crear o editar una meta. Además de los hitos y la recompensa, guía a definirla con criterio SMART:
 * plazo, cómo se mide y por qué importa. Todo es opcional: una meta sin completar sigue siendo válida.
 * Al editar, los hitos existentes no se tocan (su XP ya está contabilizado); solo se pueden añadir nuevos.
 */
export function GoalModal({ id }: { id?: string }) {
  const close = useUi((s) => s.closeModal);
  const { goals, createGoal, updateGoal } = useData();
  const editing = goals.find((g) => g.id === id);
  const [title, setTitle] = useState(editing?.title ?? '');
  const [rewardTitle, setRewardTitle] = useState(editing?.rewardTitle ?? '');
  const [rewardDescription, setRewardDescription] = useState(editing?.rewardDescription ?? '');
  const [milestones, setMilestones] = useState('');
  const [deadline, setDeadline] = useState(editing?.deadline ?? '');
  const [measure, setMeasure] = useState(editing?.measure ?? '');
  const [why, setWhy] = useState(editing?.why ?? '');
  const [area, setArea] = useState<AreaId | ''>(editing?.area ?? '');
  const [ifThen, setIfThen] = useState<IfThen[]>(editing?.ifThen ?? []);

  const items = linesToList(milestones);
  const canSave = !!title.trim() && (!!editing || items.length > 0);
  const chipDays = deadline ? diffDays(deadline, today()) : -1;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    const fresh = items.map((l) => {
      const { title: t, xp } = parseXpLine(l, 100);
      return { id: newId(), title: t, summary: '', xp, done: false, skills: [] };
    });
    const data = {
      title: title.trim(),
      rewardTitle: rewardTitle.trim() || 'Título: Leyenda',
      rewardDescription: rewardDescription.trim(),
      deadline: deadline || undefined,
      measure: measure.trim() || undefined,
      why: why.trim() || undefined,
      area: area || undefined,
      ifThen: cleanIfThen(ifThen),
    };
    if (editing) updateGoal(editing.id, { ...data, milestones: [...editing.milestones, ...fresh] });
    else createGoal({ ...data, milestones: fresh });
    close();
  };

  return (
    <Modal title={editing ? 'Editar meta' : 'Nueva meta'} kicker="// Árbol de habilidades" onClose={close}>
      <form onSubmit={submit} className="form">
        {!editing && <ConceptHint id="meta" />}
        <Field label="Meta" hint="Concreta: qué quieres lograr, no un tema general.">
          {(fid) => <TextInput id={fid} className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Aprender Análisis de Datos" required maxLength={100} />}
        </Field>
        <Field
          label={editing ? 'Añadir hitos' : 'Hitos'}
          hint={editing ? `Uno por línea; se suman a los ${editing.milestones.length} que ya tiene. Los hitos existentes no se cambian aquí.` : 'Uno por línea, en orden. Añade «| 300» para darle XP (por defecto 100).'}
        >
          {(fid) => <textarea id={fid} className="input" rows={editing ? 3 : 5} value={milestones} onChange={(e) => setMilestones(e.target.value)} placeholder={'Aprender Excel | 100\nAprender SQL | 200\nProyecto final | 1000'} required={!editing} />}
        </Field>
        <Field label="Plazo" hint="Una fecha límite convierte el deseo en compromiso y permite ver si vas a tiempo.">
          {(fid) => (
            <div className="row">
              <input id={fid} className="input input--inline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              <ChipGroup label="Plazo rápido" value={GOAL_DEADLINES.some((d) => d.value === chipDays) ? chipDays : -1} options={GOAL_DEADLINES} onChange={(d) => setDeadline(addDays(today(), d))} />
            </div>
          )}
        </Field>
        <Field label="Cómo lo mido" hint="Qué te dirá que avanzas: horas, entregables, cifras. Ej.: «3 sesiones de SQL por semana y una API publicada».">
          {(fid) => <TextInput id={fid} className="input" value={measure} onChange={(e) => setMeasure(e.target.value)} maxLength={300} />}
        </Field>
        <Field label="Por qué me importa" hint="Lo que recordarás el día que no tengas ganas.">
          {(fid) => <TextInput id={fid} className="input" value={why} onChange={(e) => setWhy(e.target.value)} maxLength={300} />}
        </Field>
        <Field label="Recompensa final">{(fid) => <TextInput id={fid} className="input" value={rewardTitle} onChange={(e) => setRewardTitle(e.target.value)} placeholder="Título: Analista de Datos Jr." />}</Field>
        <Field label="Descripción de la recompensa">{(fid) => <textarea id={fid} className="input" rows={2} value={rewardDescription} onChange={(e) => setRewardDescription(e.target.value)} />}</Field>
        <Fold summary="Área y planes «si… entonces…» (opcional)" open={!!area || ifThen.length > 0}>
          <Field label="Área de la vida">{() => <AreaChips value={area} onChange={setArea} />}</Field>
          <Field label="Si… entonces…" hint="Qué harás cuando algo amenace esta meta.">
            {() => <IfThenEditor value={ifThen} onChange={setIfThen} />}
          </Field>
        </Fold>
        {!editing && <p className="muted small">Después podrás enlazar tareas y hábitos a esta meta desde su ficha: ahí viven las acciones.</p>}
        <div className="modal__actions">
          <Button variant="primary" type="submit" disabled={!canSave}>
            {editing ? 'Guardar cambios' : 'Crear meta'}
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
        <Field label="Pasos para conseguirlo" hint="Podrás sumar avances con +1 en el Arsenal.">{(fid) => <NumberInput id={fid} className="input" min={1} max={999} value={target} onValue={(n) => setTarget(n)}/>}</Field>
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
