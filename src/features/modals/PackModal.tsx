import { useMemo, useState } from 'react';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { buildPackEntities, describePack, packPrompt, parsePack } from '@/core/pack';
import { Button, Field, Modal, Tag, TextInput } from '@/ui/kit';

/** Copia el prompt para la IA y pega aquí su respuesta (JSON): crea cursos, metas, proyectos, hábitos y tareas de una vez. */
export function PackModal() {
  const close = useUi((s) => s.closeModal);
  const toast = useUi((s) => s.toast);
  const courses = useData((s) => s.courses);
  const importPack = useData((s) => s.importPack);
  const [topic, setTopic] = useState('');
  const [raw, setRaw] = useState('');

  const result = useMemo(() => (raw.trim() ? parsePack(raw) : null), [raw]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(packPrompt(topic));
      toast({ kind: 'info', title: 'Prompt copiado', body: 'Pégalo en tu IA favorita y vuelve con su respuesta.' });
    } catch {
      toast({ kind: 'error', title: 'No se pudo copiar', body: 'Selecciona el texto de abajo y cópialo a mano.' });
    }
  };

  const create = () => {
    if (!result?.ok) return;
    importPack(buildPackEntities(result.pack, courses));
    close();
  };

  return (
    <Modal title="Importar con IA" kicker="// Pack de aprendizaje" onClose={close} wide>
      <div className="stack">
        <p className="muted small">
          1) Copia el prompt y dáselo a ChatGPT, Claude o Gemini. 2) Pega aquí su respuesta. Se crean de golpe los cursos, metas, proyectos, hábitos y tareas que traiga.
        </p>

        <Field label="1 · ¿Qué quieres aprender?" hint="Opcional: se incluye en el prompt. Añade tu nivel y el tiempo que tienes.">
          {(id) => <TextInput id={id} className="input" rows={2} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ej.: SQL para análisis de datos, nivel principiante, 5 h por semana, 2 meses" />}
        </Field>
        <details>
          <summary className="small muted">Ver el prompt completo</summary>
          <pre className="small" style={{ whiteSpace: 'pre-wrap', maxHeight: 220, overflow: 'auto' }}>{packPrompt(topic)}</pre>
        </details>
        <div className="row">
          <Button variant="primary" onClick={() => void copy()}>
            Copiar prompt para la IA
          </Button>
        </div>

        <Field label="2 · Pega aquí la respuesta de la IA">
          {(id) => <TextInput id={id} className="input" rows={8} value={raw} onChange={(e) => setRaw(e.target.value)} placeholder='{ "studyquest": "pack", "courses": [ … ] }' spellCheck={false} />}
        </Field>

        {result && !result.ok && <p className="field__hint" role="alert">{result.error}</p>}
        {result?.ok && (
          <div className="stack">
            <p>
              <Tag tone="green">Listo para crear</Tag> {describePack(result.pack)}
            </p>
            <ul className="small muted">
              {result.pack.courses.map((c) => <li key={`c${c.title}`}>Curso: {c.title} · {c.modules.length} módulos{c.link ? ' · con enlace' : ''}</li>)}
              {result.pack.goals.map((g) => <li key={`g${g.title}`}>Meta: {g.title} · {g.milestones.length} hitos</li>)}
              {result.pack.projects.map((p) => <li key={`p${p.title}`}>Proyecto: {p.title} · {p.checkpoints.length} checkpoints</li>)}
              {result.pack.habits.map((h) => <li key={`h${h.title}`}>Hábito: {h.title}</li>)}
              {result.pack.tasks.slice(0, 5).map((t) => <li key={`t${t.title}`}>Tarea: {t.title}</li>)}
              {result.pack.tasks.length > 5 && <li>…y {result.pack.tasks.length - 5} tareas más</li>}
            </ul>
            {result.warnings.map((w) => <p key={w} className="field__hint">⚠ {w}</p>)}
          </div>
        )}

        <div className="modal__actions">
          <Button onClick={close}>Cancelar</Button>
          <Button variant="primary" disabled={!result?.ok} onClick={create}>
            Crear todo
          </Button>
        </div>
      </div>
    </Modal>
  );
}
