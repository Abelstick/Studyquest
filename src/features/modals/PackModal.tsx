import { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { AiError, generatePack } from '@/ai/gemini';
import { aiConfig } from '@/ai/config';
import { useAi } from '@/ai/store';
import { buildPackEntities, describePack, dropExisting, packPrompt, packXp, parsePack, type PackContext } from '@/core/pack';
import { PACE_OPTIONS, lastDue } from '@/core/pace';
import { availabilityText } from '@/core/routine';
import { longDate, shortDate, today } from '@/core/dates';
import { Button, ChipGroup, Field, Modal, NumberInput, Tag, TextInput } from '@/ui/kit';
import { Loader } from '@/ui/Loader';
import { WorksQuestion } from '../calendario/WorksQuestion';

const LEVELS = [
  { value: 'beginner' as const, label: 'Principiante' },
  { value: 'intermediate' as const, label: 'Intermedio' },
  { value: 'advanced' as const, label: 'Avanzado' },
];
const WEEKS = [
  { value: 4, label: '1 mes' },
  { value: 8, label: '2 meses' },
  { value: 12, label: '3 meses' },
  { value: 24, label: '6 meses' },
];

/** Reordena el JSON de la IA con sangría para poder revisarlo; si no es JSON, se deja como llegó. */
const pretty = (text: string): string => {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
};

/**
 * Importar con IA: cuentas qué quieres lograr (nivel, horas y plazo; usa tu horario de «Mi semana» si lo tienes) y la IA
 * devuelve cursos, metas, hábitos y tareas ya enlazados. Con tu clave de Gemini se genera aquí mismo; si prefieres ChatGPT,
 * Claude u otra, copias el prompt y pegas su respuesta. Antes de crear nada ves un resumen, y lo que ya tienes no se duplica.
 */
export function PackModal() {
  const close = useUi((s) => s.closeModal);
  const openModal = useUi((s) => s.openModal);
  const toast = useUi((s) => s.toast);
  const { courses, goals, projects, habits, tasks, events, habitLogs, importPack } = useData();
  const apiKey = useAi((s) => s.apiKey);
  const model = useAi((s) => s.model);

  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState<NonNullable<PackContext['level']>>('beginner');
  const [hours, setHours] = useState(5);
  const [weeks, setWeeks] = useState(8);
  const [raw, setRaw] = useState('');
  const [pace, setPace] = useState('same');
  const [skipExisting, setSkipExisting] = useState(true);
  const [showPrompt, setShowPrompt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const factor = PACE_OPTIONS.find((p) => p.id === pace)?.factor ?? 1;
  const availability = useMemo(() => availabilityText({ events, habits, tasks, habitLogs }, today()), [events, habits, tasks, habitLogs]);
  const ctx: PackContext = { level, hoursPerWeek: hours, weeks, ...(availability ? { availability } : {}) };

  const result = useMemo(() => (raw.trim() ? parsePack(raw) : null), [raw]);
  // Lo que ya tienes con el mismo nombre: se detecta siempre, y se omite si lo dejas marcado.
  const dupes = useMemo(() => (result?.ok ? dropExisting(result.pack, { courses, goals, projects, habits, tasks }) : null), [result, courses, goals, projects, habits, tasks]);
  const prepared = result?.ok && dupes ? (skipExisting ? dupes.pack : result.pack) : null;
  const entities = useMemo(
    () => (prepared ? buildPackEntities(prepared, courses, undefined, factor, { goals }) : null),
    [prepared, courses, goals, factor],
  );
  const lastTask = entities ? lastDue(entities.tasks) : null;
  const firstTask = entities?.tasks.filter((t) => t.dueDate).sort((a, b) => (a.dueDate as string).localeCompare(b.dueDate as string))[0];
  const nothingNew = !!entities && !entities.courses.length && !entities.goals.length && !entities.projects.length && !entities.habits.length && !entities.tasks.length;

  const generate = async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError(null);
    try {
      const cfg = aiConfig(controller.signal);
      if (!cfg) return;
      const { text } = await generatePack(cfg, { topic, ...ctx });
      setRaw(pretty(text));
    } catch (e) {
      if (!(e instanceof AiError && e.code === 'cancelled')) setError(e instanceof Error ? e.message : 'No se pudo generar el pack.');
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };

  const copy = async () => {
    setShowPrompt(true);
    try {
      await navigator.clipboard.writeText(packPrompt(topic, ctx));
      toast({ kind: 'info', title: 'Prompt copiado', body: 'Pégalo en tu IA favorita y vuelve con su respuesta.' });
    } catch {
      toast({ kind: 'error', title: 'No se pudo copiar', body: 'Selecciona el texto que se muestra debajo y cópialo a mano.' });
    }
  };

  const paste = async () => {
    try {
      setRaw(await navigator.clipboard.readText());
    } catch {
      toast({ kind: 'error', title: 'No pude leer el portapapeles', body: 'Pega con Ctrl+V (o mantén pulsado en el móvil) dentro del recuadro.' });
    }
  };

  const create = () => {
    if (!entities || nothingNew) return;
    importPack(entities);
    close();
  };

  return (
    <Modal title="Importar con IA" kicker="Pack de aprendizaje" onClose={close} wide>
      <div className="stack">
        <p className="muted small">
          Cuéntame qué quieres lograr y la IA arma de golpe el curso, la meta con su plazo, los hábitos (con versión mínima) y las tareas, ya enlazados entre sí. Antes de crear nada lo revisas.
        </p>

        <Field label="1 · ¿Qué quieres aprender o lograr?">
          {(id) => <TextInput id={id} className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ej.: SQL Server para análisis de datos" maxLength={300} />}
        </Field>
        <div className="form__row">
          <Field label="Tu nivel">{() => <ChipGroup label="Nivel" value={level} options={LEVELS} onChange={setLevel} />}</Field>
          <Field label="Horas por semana">{(id) => <NumberInput id={id} className="input" min={1} max={60} value={hours} onValue={setHours} />}</Field>
        </div>
        <Field label="¿En cuánto tiempo?">{() => <ChipGroup label="Plazo" value={weeks} options={WEEKS} onChange={setWeeks} />}</Field>
        {availability ? (
          <p className="muted small">
            Uso tu horario de «Mi semana»: <b>{availability}</b>.
          </p>
        ) : (
          <WorksQuestion />
        )}

        <section className="stack" aria-label="Generar el pack">
          <p className="field__label">2 · Genera el pack</p>
          {apiKey ? (
            busy ? (
              <Loader
                title="Armando tu ruta con IA"
                steps={['Leyendo tu objetivo', 'Eligiendo cursos y metas', 'Repartiendo las tareas', 'Preparando tus hábitos', 'Revisando el pack']}
                expect="Suele tardar de 15 a 40 segundos"
                onCancel={() => abortRef.current?.abort()}
              />
            ) : (
              <div className="row">
                <Button variant="primary" disabled={topic.trim().length < 3} onClick={() => void generate()}>
                  Generar aquí con Gemini
                </Button>
                <span className="muted small">Usa tu clave · modelo {model.replace(/^models\//, '')}</span>
              </div>
            )
          ) : (
            <p className="muted small">
              Con una clave gratuita de Gemini lo genero aquí mismo, sin copiar ni pegar.{' '}
              <button type="button" className="link" onClick={() => openModal({ type: 'ai' })}>
                Activar la IA
              </button>
            </p>
          )}
          {error && (
            <p className="field__hint" role="alert">
              {error}
            </p>
          )}
          <details open={showPrompt || !apiKey}>
            <summary className="small muted">O usa ChatGPT, Claude u otra IA (copiar y pegar)</summary>
            <div className="stack">
              <div className="row">
                <Button onClick={() => void copy()}>Copiar prompt para la IA</Button>
                <span className="muted small">Incluye lo que escribiste arriba. Pega su respuesta abajo.</span>
              </div>
              {showPrompt && <pre className="small" style={{ whiteSpace: 'pre-wrap', maxHeight: 220, overflow: 'auto' }}>{packPrompt(topic, ctx)}</pre>}
            </div>
          </details>
        </section>

        <Field label="3 · Respuesta de la IA" hint="Si usaste Gemini aquí, ya está puesta. Puedes corregir el texto antes de crear.">
          {(id) => (
            <>
              <textarea id={id} className="input" rows={8} value={raw} onChange={(e) => setRaw(e.target.value)} placeholder='{ "studyquest": "pack", "courses": [ … ] }' spellCheck={false} />
              <div className="row">
                <Button small onClick={() => void paste()}>
                  Pegar del portapapeles
                </Button>
                {raw && (
                  <Button small variant="ghost" onClick={() => setRaw('')}>
                    Borrar
                  </Button>
                )}
              </div>
            </>
          )}
        </Field>

        {result && !result.ok && (
          <p className="field__hint" role="alert">
            {result.error}
          </p>
        )}
        {result?.ok && prepared && dupes && entities && (
          <div className="stack" aria-label="Vista previa">
            <p>
              <Tag tone={nothingNew ? 'plain' : 'green'}>{nothingNew ? 'Nada nuevo que crear' : 'Listo para crear'}</Tag> {describePack(entities)}
              {!nothingNew && <span className="muted small"> · {packXp(prepared)} XP en juego</span>}
            </p>
            <ul className="small muted">
              {entities.courses.map((c) => <li key={c.id}>Curso: {c.title} · {c.modules.length} módulos{c.link ? ' · con enlace' : ''}</li>)}
              {entities.goals.map((g) => (
                <li key={g.id}>
                  Meta: {g.title} · {g.milestones.length} hitos{g.deadline ? ` · plazo ${longDate(g.deadline)}` : ' · sin plazo'}
                  {g.measure ? ' · con indicador' : ''}
                </li>
              ))}
              {entities.projects.map((p) => <li key={p.id}>Proyecto: {p.title} · {p.checkpoints.length} checkpoints</li>)}
              {entities.habits.map((h) => <li key={h.id}>Hábito: {h.title}{h.minTarget ? ` · mínimo ${h.minTarget}` : ''}{h.goalId ? ' · enlazado a su meta' : ''}</li>)}
              {entities.tasks.slice(0, 5).map((t) => <li key={t.id}>Tarea: {t.title}{t.dueDate ? ` · ${shortDate(t.dueDate)}` : ''}</li>)}
              {entities.tasks.length > 5 && <li>…y {entities.tasks.length - 5} tareas más</li>}
            </ul>
            {firstTask?.dueDate && <p className="rt__free">Tu primer paso: <b>{firstTask.title}</b> ({firstTask.dueDate === today() ? 'hoy' : shortDate(firstTask.dueDate)}).</p>}
            {dupes.dropped.length > 0 && (
              <label className="stepcheck">
                <input type="checkbox" checked={skipExisting} onChange={(e) => setSkipExisting(e.target.checked)} />
                <span>
                  Omitir lo que ya tengo para no duplicarlo{' '}
                  <span className="muted small">
                    ({dupes.dropped.slice(0, 3).join(', ')}
                    {dupes.dropped.length > 3 ? '…' : ''})
                  </span>
                </span>
              </label>
            )}
            {entities.tasks.length > 0 && (
              <div className="stack">
                <p className="field__label">Ritmo de las tareas</p>
                <ChipGroup label="Ritmo" value={pace} onChange={setPace} options={PACE_OPTIONS.map((p) => ({ value: p.id, label: p.label }))} />
                <p className="field__hint">
                  {PACE_OPTIONS.find((p) => p.id === pace)?.hint}.{lastTask && <> La última tarea caería el {longDate(lastTask)}.</>} Podrás cambiarlo después desde el curso con «Ajustar plazos».
                </p>
              </div>
            )}
            {result.warnings.map((w) => <p key={w} className="field__hint">{w}</p>)}
          </div>
        )}

        <div className="modal__actions">
          <Button onClick={close}>Cancelar</Button>
          <Button variant="primary" disabled={!result?.ok || nothingNew} onClick={create}>
            Crear todo
          </Button>
        </div>
      </div>
    </Modal>
  );
}
