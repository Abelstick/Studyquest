import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { AiError, generateRoadmap } from '@/ai/gemini';
import { aiConfig } from '@/ai/config';
import { FREE_MODELS, isFreeModel, modelName } from '@/ai/models';
import { useAi } from '@/ai/store';
import { addDays, diffDays, longDate, shortDate, today } from '@/core/dates';
import {
  DEFAULT_WEEK_MINUTES, TEMPLATES, blankRoadmap, buildPlanEntities, busyMinutes, cleanGoal, cleanRoadmap, matchTemplate, sanitizeWeek, schedulePlan, templateRoadmap, validateRoadmap, weekTotal,
  type Level, type Roadmap, type Template,
} from '@/core/planner';
import { Bar, Button, ChipGroup, Field, PageHead, Panel, Tag, cx } from '@/ui/kit';
import { Loader } from '@/ui/Loader';
import { RouteEditor } from './RouteEditor';

const STORAGE_KEY = 'sq:planner-week';
const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DEADLINES = [
  { value: 4, label: '1 mes' },
  { value: 8, label: '2 meses' },
  { value: 12, label: '3 meses' },
  { value: 24, label: '6 meses' },
];
const LEVELS: { value: Level; label: string }[] = [
  { value: 'beginner', label: 'Principiante' },
  { value: 'intermediate', label: 'Intermedio' },
  { value: 'advanced', label: 'Avanzado' },
];
const PRESETS: { label: string; week: number[] }[] = [
  { label: '1 h al día', week: [60, 60, 60, 60, 60, 60, 60] },
  { label: '2 h al día', week: [120, 120, 120, 120, 120, 120, 120] },
  { label: 'Entre semana 1 h · finde 3 h', week: [60, 60, 60, 60, 60, 180, 180] },
  { label: 'Solo fines de semana', week: [0, 0, 0, 0, 0, 240, 240] },
];

const hm = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
const hours = (min: number) => `${+(min / 60).toFixed(1)} h`;

function loadWeek(): number[] {
  try {
    return sanitizeWeek(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'));
  } catch {
    return DEFAULT_WEEK_MINUTES;
  }
}

function Stepper({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="tstep" role="group" aria-label={label}>
      <button type="button" className="tstep__btn" onClick={() => onChange(Math.max(0, value - 15))} aria-label={`Menos tiempo el ${label}`} disabled={value <= 0}>
        −
      </button>
      <output className={cx('tstep__val', value === 0 && 'is-off')}>{value === 0 ? 'libre' : hm(value)}</output>
      <button type="button" className="tstep__btn" onClick={() => onChange(Math.min(720, value + 15))} aria-label={`Más tiempo el ${label}`}>
        +
      </button>
    </div>
  );
}

const STEPS = ['Objetivo', 'Tiempo', 'Plan'];

export default function Planificador() {
  const navigate = useNavigate();
  const { tasks, habits, habitLogs, addPlan } = useData();
  const apiKey = useAi((s) => s.apiKey);
  const model = useAi((s) => s.model);
  const lastUsed = useAi((s) => s.lastUsed);
  const remote = useAi((s) => s.remote);
  const openModal = useUi((s) => s.openModal);
  const now = today();

  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState('');
  const [deadline, setDeadline] = useState(() => addDays(now, 12 * 7));
  const [level, setLevel] = useState<Level>('beginner');
  const [week, setWeek] = useState<number[]>(loadWeek);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [blockDraft, setBlockDraft] = useState('');
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [source, setSource] = useState<'ai' | 'template' | 'manual'>('template');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<AiError | Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const waitRef = useRef<HTMLDivElement>(null);
  // Si sales de la pantalla mientras la IA trabaja, se cancela la petición.
  useEffect(() => () => abortRef.current?.abort(), []);

  const weeks = Math.max(1, Math.round(diffDays(deadline, now) / 7));
  const suggested = useMemo(() => matchTemplate(goal), [goal]);
  const busy = useMemo(() => busyMinutes({ tasks, habits, habitLogs }, now, deadline), [tasks, habits, habitLogs, now, deadline]);
  const busyTotal = Object.values(busy).reduce((a, b) => a + b, 0);

  const start = addDays(now, 0);
  // Lo que se planifica es la ruta ya limpia (sin temas vacíos, textos recortados). Mientras tenga huecos por rellenar, no hay calendario.
  const cleaned = useMemo(() => (roadmap ? cleanRoadmap(roadmap) : null), [roadmap]);
  const problems = useMemo(() => (cleaned ? validateRoadmap(cleaned) : []), [cleaned]);
  const schedule = useMemo(
    () => (cleaned && problems.length === 0 ? schedulePlan({ roadmap: cleaned, start, end: deadline, weekly: week, busy, blocked }) : null),
    [cleaned, problems, start, deadline, week, busy, blocked],
  );

  const setDay = (i: number, v: number) => {
    const next = week.map((m, j) => (j === i ? v : m));
    setWeek(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* modo privado */
    }
  };
  const applyPreset = (w: number[]) => {
    setWeek(w);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(w));
    } catch {
      /* modo privado */
    }
  };

  const pickTemplate = (t: Template) => {
    setRoadmap(templateRoadmap(t, cleanGoal(goal) || t.name, (weekTotal(week) / 60) * weeks));
    setSource('template');
    setError(null);
    setStep(2);
  };

  const startManual = () => {
    setRoadmap(blankRoadmap(cleanGoal(goal) || goal));
    setSource('manual');
    setError(null);
    setStep(2);
  };

  const generate = async () => {
    if (!apiKey) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setGenerating(true);
    setError(null);
    // En móvil el panel puede quedar fuera de la pantalla: lo traemos a la vista para que se vea que está trabajando.
    setTimeout(() => waitRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' }), 50);
    try {
      const cfg = aiConfig(controller.signal);
      if (!cfg) return;
      const r = await generateRoadmap(cfg, { goal: goal.trim(), level, weeks, hoursPerWeek: Math.max(1, Math.round((weekTotal(week) / 60) * 2) / 2) });
      setRoadmap({ ...r, goal: cleanGoal(goal) || r.goal });
      setSource('ai');
      setStep(2);
    } catch (e) {
      if (!(e instanceof AiError && e.code === 'cancelled')) setError(e instanceof Error ? e : new Error('No se pudo generar la ruta.'));
    } finally {
      abortRef.current = null;
      setGenerating(false);
    }
  };

  const create = () => {
    if (!cleaned || !schedule?.ok) return;
    addPlan(buildPlanEntities(cleaned, schedule, week, now));
    navigate('/calendario');
  };

  const canNext = goal.trim().length >= 3 && weeks >= 1;
  const total = schedule ? schedule.items.reduce((a, i) => a + i.minutes, 0) : 0;
  const span = Math.max(1, diffDays(deadline, start));

  return (
    <div className="stack">
      <PageHead kicker="// Estratega" title="Planificador inteligente" sprite="sword" />

      <ol className="wizard" aria-label="Pasos">
        {STEPS.map((s, i) => (
          <li key={s} className={cx(i === step && 'is-now', i < step && 'is-done')}>
            <button type="button" disabled={i > step || (i === 2 && !roadmap)} onClick={() => setStep(i)} aria-current={i === step ? 'step' : undefined}>
              <b>{i + 1}</b> {s}
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <Panel kicker="// Paso 1" title="¿Qué quieres aprender?">
          <div className="form">
            <Field label="Tu objetivo" hint="Escríbelo con tus palabras: «Aprender análisis de datos», «Inglés B1», «Crear mi portafolio web»…">
              {(id) => <input id={id} className="input" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Quiero aprender análisis de datos" maxLength={120} autoFocus />}
            </Field>
            <Field label="¿En cuánto tiempo?">
              {() => (
                <div className="row">
                  <ChipGroup label="Plazo" value={DEADLINES.some((d) => d.value === weeks) ? weeks : -1} options={DEADLINES} onChange={(w) => setDeadline(addDays(now, w * 7))} />
                  <label className="row planner__date">
                    <span className="muted small">o fecha:</span>
                    <input className="input input--inline" type="date" min={addDays(now, 7)} value={deadline} onChange={(e) => e.target.value && setDeadline(e.target.value)} aria-label="Fecha objetivo" />
                  </label>
                </div>
              )}
            </Field>
            <p className="muted small">
              Son <b>{weeks}</b> {weeks === 1 ? 'semana' : 'semanas'}: hasta el {longDate(deadline)}.
            </p>
            <Field label="Tu nivel de partida">{() => <ChipGroup label="Nivel" value={level} options={LEVELS} onChange={setLevel} />}</Field>
            <div className="modal__actions">
              <Button variant="primary" disabled={!canNext} onClick={() => setStep(1)}>
                Siguiente: mi tiempo →
              </Button>
            </div>
          </div>
        </Panel>
      )}

      {step === 1 && (
        <div className="cols cols--side">
          <Panel kicker="// Paso 2" title="¿Cuánto tiempo tienes?">
            <p className="muted small">Marca cuánto puedes estudiar cada día de la semana. Los días en «libre» no se planifican.</p>
            <div className="presets">
              {PRESETS.map((p) => (
                <button key={p.label} type="button" className="chip chip--sm" onClick={() => applyPreset(p.week)}>
                  {p.label}
                </button>
              ))}
            </div>
            <ul className="plweek">
              {DAYS.map((d, i) => (
                <li key={d}>
                  <span className={cx('plweek__day', i >= 5 && 'is-weekend')}>{d}</span>
                  <Stepper value={week[i]} onChange={(v) => setDay(i, v)} label={d} />
                </li>
              ))}
            </ul>
            <p className="planner__total">
              Tu semana: <b>{hours(weekTotal(week))}</b> · en {weeks} semanas: <b>{hours(weekTotal(week) * weeks)}</b>
            </p>

            <Field label="Días que no puedes estudiar" hint="Viajes, exámenes, vacaciones…">
              {() => (
                <div className="row">
                  <input className="input input--inline" type="date" min={now} max={deadline} value={blockDraft} onChange={(e) => setBlockDraft(e.target.value)} aria-label="Día bloqueado" />
                  <Button
                    small
                    disabled={!blockDraft || blocked.includes(blockDraft)}
                    onClick={() => {
                      setBlocked([...blocked, blockDraft].sort());
                      setBlockDraft('');
                    }}
                  >
                    Añadir
                  </Button>
                  {blocked.map((b) => (
                    <button key={b} type="button" className="chip chip--sm is-on" onClick={() => setBlocked(blocked.filter((x) => x !== b))} aria-label={`Quitar ${shortDate(b)}`}>
                      {shortDate(b)} ✕
                    </button>
                  ))}
                </div>
              )}
            </Field>
          </Panel>

          <div className="stack">
            <Panel kicker="// Agenda actual" title="Lo que ya tienes">
              <p className="muted small">
                Tus tareas con fecha y tus hábitos medidos en minutos ya ocupan <b>{hours(busyTotal)}</b> de aquí al plazo. El plan los descuenta para no saturarte.
              </p>
            </Panel>
            <Panel kicker="// Paso 3" title="Elige cómo crear tu ruta" tone="yellow">
              {error && (
                <div className="form__error" role="alert">
                  <p>
                    {error.message}{' '}
                    {error instanceof AiError && (error.code === 'invalid_key' || error.code === 'model') && (
                      <button type="button" className="link" onClick={() => openModal({ type: 'ai' })}>
                        Revisar mi clave
                      </button>
                    )}
                  </p>
                  {error instanceof AiError && (error.code === 'rate_limited' || error.code === 'model') && (
                    <div className="row">
                      <span className="small">Prueba con otro modelo gratuito:</span>
                      {FREE_MODELS.filter((m) => m.id !== model)
                        .slice(0, 4)
                        .map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            className="chip chip--sm"
                            onClick={() => {
                              useAi.getState().setModel(m.id);
                              void generate();
                            }}
                          >
                            {m.name.replace('Gemini ', '')}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )}
              {generating && (
                <div ref={waitRef}>
                  <Loader
                    title="Diseñando tu ruta con IA"
                    steps={['Leyendo tu objetivo', 'Eligiendo los módulos', 'Ordenando los temas', 'Estimando las horas', 'Preparando el proyecto final', 'Revisando la ruta']}
                    expect="Suele tardar de 10 a 30 segundos"
                    onCancel={() => abortRef.current?.abort()}
                  />
                </div>
              )}
              {apiKey && !generating ? (
                <>
                  <Button variant="primary" block disabled={!canNext || weekTotal(week) === 0} onClick={() => void generate()}>
                    ✨ Generar con IA
                  </Button>
                  <label className="modelpick">
                    <span className="muted small">Modelo</span>
                    <select className="input input--inline" value={model} onChange={(e) => useAi.getState().setModel(e.target.value)} aria-label="Modelo de Gemini">
                      {!isFreeModel(model) && <option value={model}>{model}</option>}
                      {FREE_MODELS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : !apiKey ? (
                <div className="ai__cta">
                  <p className="muted small">Con la IA puedes planificar <b>cualquier objetivo</b>. Se activa con tu propia clave gratuita de Google.</p>
                  <Button variant="primary" block onClick={() => openModal({ type: 'ai' })}>
                    {remote === 'encrypted' ? '🔓 Desbloquear funciones inteligentes' : '🔑 Activar funciones inteligentes'}
                  </Button>
                </div>
              ) : null}
              <p className="kicker">{apiKey ? 'O sin IA' : 'Sin IA'}</p>
              <button type="button" className="template template--own" disabled={!canNext || generating} onClick={startManual}>
                <b>✍ Crear mi propia ruta</b>
                <span>Empiezas en blanco: tú pones los módulos, los temas y las horas.</span>
              </button>
              <p className="kicker">O parte de una plantilla (podrás editarla)</p>
              <div className="templates">
                {TEMPLATES.map((t) => (
                  <button key={t.id} type="button" className={cx('template', suggested?.id === t.id && 'is-suggested')} disabled={weekTotal(week) === 0 || generating} onClick={() => pickTemplate(t)}>
                    <b>{t.name}</b>
                    <span>{t.modules.length} módulos + proyecto</span>
                    {suggested?.id === t.id && <Tag tone="xp">Sugerida</Tag>}
                  </button>
                ))}
              </div>
              <Button disabled={generating} onClick={() => setStep(0)}>
                ← Volver
              </Button>
            </Panel>
          </div>
        </div>
      )}

      {step === 2 && roadmap && (
        <div className="cols cols--side">
          <div className="stack">
            <Panel
              kicker={source === 'ai' ? '// Ruta generada con IA' : source === 'manual' ? '// Tu ruta' : '// Ruta de plantilla'}
              title="Edita tu ruta"
              right={<Tag tone={source === 'ai' ? 'green' : 'plain'}>{source === 'ai' ? `✨ ${modelName(lastUsed ?? model)}` : source === 'manual' ? '✍ Hecha por ti' : 'Plantilla'}</Tag>}
            >
              {roadmap.summary && <p className="muted">{roadmap.summary}</p>}
              <p className="muted small">Cambia lo que quieras: nombres, horas, el orden, y añade o quita módulos, temas y pasos. El calendario se recalcula solo.</p>
              <RouteEditor roadmap={roadmap} onChange={setRoadmap} />
            </Panel>

            <Panel kicker="// Calendario" title="Tu línea de tiempo">
              {!schedule ? (
                <p className="muted">Completa la ruta (a la izquierda) para ver tu calendario.</p>
              ) : schedule.ok ? (
                <div className="gantt" role="list">
                  {schedule.ranges.map((r) => {
                    const item = schedule.items[r.item];
                    const left = (diffDays(r.start, start) / span) * 100;
                    const width = Math.max(2, ((diffDays(r.end, r.start) + 1) / span) * 100);
                    return (
                      <div key={r.item} className="gantt__row" role="listitem">
                        <span className="gantt__label">{item.title}</span>
                        <span className="gantt__track">
                          <span className={cx('gantt__bar', item.kind === 'project' && 'is-boss')} style={{ left: `${left}%`, width: `${width}%` }} />
                        </span>
                        <span className="gantt__dates muted small">
                          {shortDate(r.start)} → {shortDate(r.end)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="muted">No hay tiempo libre en este periodo.</p>
              )}
            </Panel>
          </div>

          <div className="stack">
            <Panel kicker="// Resumen" title="Tu plan">
              {!schedule && (
                <>
                  <ul className="planner__problems" role="status">
                    {problems.map((p) => (
                      <li key={p}>⚠ {p}</li>
                    ))}
                  </ul>
                  <div className="modal__actions">
                    <Button variant="primary" disabled>
                      ✔ Crear mi plan
                    </Button>
                    <Button onClick={() => setStep(1)}>← Ajustar tiempo</Button>
                  </div>
                </>
              )}
              {schedule && (
                <>
              <dl className="stat-grid">
                <div>
                  <dt>Estudio</dt>
                  <dd className="is-hot">{hours(total)}</dd>
                </div>
                <div>
                  <dt>Termina</dt>
                  <dd>{schedule.endsOn ? shortDate(schedule.endsOn) : '—'}</dd>
                </div>
                <div>
                  <dt>Tareas</dt>
                  <dd>{schedule.chunks.filter((c) => schedule.items[c.item].kind === 'module').length + 1}</dd>
                </div>
                <div>
                  <dt>Cabe</dt>
                  <dd className={cx(schedule.coverage < 1 && 'is-hot')}>{Math.round(schedule.coverage * 100)}%</dd>
                </div>
              </dl>
              <Bar pct={schedule.coverage * 100} tone={schedule.coverage >= 1 ? 'green' : 'red'} label="Cuánto de la ruta cabe en tu tiempo" />
              {schedule.warnings.map((w) => (
                <p key={w} className={cx('planner__warn', schedule.coverage < 1 && 'is-bad')} role="status">
                  {schedule.coverage < 1 ? '⚠ ' : 'ℹ '}
                  {w}
                </p>
              ))}
              <p className="muted small">
                Al crear el plan se añaden: un <b>curso</b> con sus temas, una <b>meta</b> con un hito por módulo, una <b>tarea por semana y módulo</b> con fecha (verás todo en el calendario), el proyecto final como <b>jefe</b> y un <b>hábito</b> de estudio.
              </p>
              <div className="modal__actions">
                <Button variant="primary" disabled={!schedule.ok} onClick={create}>
                  ✔ Crear mi plan
                </Button>
                <Button onClick={() => setStep(1)}>← Ajustar tiempo</Button>
              </div>
                </>
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
