import { useEffect, useId, useMemo, useState } from 'react';
import { useData } from '@/state';
import { shortDate, today } from '@/core/dates';
import type { Course, Evaluation } from '@/core/domain';
import {
  EVALUATION_TITLE_MAX, FULL_WEIGHT, GRADE_SCALES, MAX_EVALUATIONS, evaluationWhen, fmtGrade, fmtWeight, gradeScaleOf, gradeSummary, gradeVerdict, nextEvaluation, sortEvaluations,
} from '@/core/grades';
import { Button, NumberInput, Panel, TextInput, cx } from '@/ui/kit';
import { Icon } from '@/ui/Icon';

/** Casilla de la nota: se puede dejar vacía (aún sin nota) y se guarda al salir de ella o con Enter. */
function ScoreInput({ evaluation, max, onSave }: Readonly<{ evaluation: Evaluation; max: number; onSave: (score: number | undefined) => void }>) {
  const shown = evaluation.score === undefined ? '' : String(evaluation.score);
  const [text, setText] = useState(shown);
  useEffect(() => setText(shown), [shown]);

  const commit = () => {
    const raw = text.trim().replace(',', '.');
    const n = Number(raw);
    const next = raw === '' ? undefined : Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : evaluation.score;
    if (next !== evaluation.score) onSave(next);
    else setText(shown);
  };

  return (
    <input
      className="input input--inline input--num"
      inputMode="decimal"
      enterKeyHint="done"
      value={text}
      placeholder="—"
      aria-label={`Nota de ${evaluation.title}, sobre ${max}`}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}

/**
 * Notas del curso: cada evaluación con su peso y su nota, el promedio que llevas y cuánto necesitas en lo que falta
 * para aprobar. Solo informa: no da XP ni cambia el avance del curso.
 */
export function CourseGrades({ course }: Readonly<{ course: Course }>) {
  const saveEvaluation = useData((s) => s.saveEvaluation);
  const removeEvaluation = useData((s) => s.removeEvaluation);
  const setGradeScale = useData((s) => s.setGradeScale);
  const formId = useId();

  const scale = gradeScaleOf(course);
  const list = useMemo(() => sortEvaluations(course.evaluations ?? []), [course.evaluations]);
  const summary = useMemo(() => gradeSummary(list, scale), [list, scale]);
  const verdict = gradeVerdict(summary);
  const upcoming = nextEvaluation(list);
  const now = today();

  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [weight, setWeight] = useState(() => Math.max(0, FULL_WEIGHT - summary.weightTotal));
  const [date, setDate] = useState('');

  const reset = (usedWeight: number) => {
    setEditing(null);
    setTitle('');
    setDate('');
    setWeight(Math.max(0, FULL_WEIGHT - usedWeight));
  };
  const edit = (e: Evaluation) => {
    setEditing(e.id);
    setTitle(e.title);
    setWeight(e.weight);
    setDate(e.date ?? '');
  };

  const current = editing ? list.find((e) => e.id === editing) : undefined;
  const full = !current && list.length >= MAX_EVALUATIONS;
  const tone = summary.state === 'failed' || summary.state === 'unreachable' ? 'is-bad' : summary.state === 'passed' || summary.state === 'secured' ? 'is-good' : '';
  const isCustomScale = !GRADE_SCALES.some((g) => g.max === scale.max);

  return (
    <Panel kicker="Notas" title="Evaluaciones">
      {list.length === 0 ? (
        <p className="muted small">Anota tus exámenes y trabajos con lo que pesa cada uno. Verás tu promedio y cuánto necesitas sacar en lo que falta para aprobar.</p>
      ) : (
        <>
          <dl className="kv">
            <div>
              <dt>Promedio actual</dt>
              <dd>{summary.average === null ? 'Sin notas todavía' : `${fmtGrade(summary.average)} de ${scale.max} · ${fmtWeight(summary.weightGraded)} evaluado`}</dd>
            </div>
            {upcoming?.date && (
              <div>
                <dt>Próxima</dt>
                <dd>
                  {upcoming.title} · {evaluationWhen(upcoming.date, now)}
                </dd>
              </div>
            )}
          </dl>
          {verdict && (
            <p className={cx('cgrades__verdict', tone)} role="status">
              {verdict}
            </p>
          )}
          {summary.weightsOff && <p className="muted small">Los pesos suman {fmtWeight(summary.weightTotal)}, no 100 %: el cálculo se hace en proporción a lo que hay.</p>}
          <ul className="cgrades">
            {list.map((e) => (
              <li key={e.id} className={cx('cgrades__item', e.id === editing && 'is-editing')}>
                <button type="button" className="cgrades__open" onClick={() => edit(e)} aria-label={`Editar ${e.title}`}>
                  <span className="cgrades__title">{e.title}</span>
                  <span className="muted small">
                    {fmtWeight(e.weight)}
                    {e.date ? ` · ${shortDate(e.date)}` : ''}
                    {e.score === undefined && e.date && e.date < now ? ' · falta la nota' : ''}
                  </span>
                </button>
                <ScoreInput evaluation={e} max={scale.max} onSave={(score) => saveEvaluation(course.id, { ...e, score })} />
                <button
                  type="button"
                  className="icon-btn icon-btn--sm"
                  aria-label={`Quitar ${e.title}`}
                  onClick={() => {
                    removeEvaluation(course.id, e.id);
                    if (e.id === editing) reset(summary.weightTotal - e.weight);
                  }}
                >
                  <Icon name="close" size={10} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <form
        className="cgrades__form"
        aria-label={current ? `Editar ${current.title}` : 'Nueva evaluación'}
        onSubmit={(ev) => {
          ev.preventDefault();
          if (!title.trim() || full) return;
          saveEvaluation(course.id, { ...(current ?? {}), title: title.trim(), weight, date: date || undefined });
          reset(summary.weightTotal - (current?.weight ?? 0) + weight);
        }}
      >
        <TextInput className="input cgrades__name" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={current ? 'Nombre' : '+ Examen, práctica, trabajo…'} aria-label="Nombre de la evaluación" maxLength={EVALUATION_TITLE_MAX} />
        <label className="cgrades__field" htmlFor={`${formId}-w`}>
          <span className="muted small">Peso %</span>
          <NumberInput id={`${formId}-w`} className="input input--inline input--num" value={weight} onValue={setWeight} min={0} max={FULL_WEIGHT} />
        </label>
        <label className="cgrades__field" htmlFor={`${formId}-d`}>
          <span className="muted small">Fecha</span>
          <input id={`${formId}-d`} className="input input--inline" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <div className="row">
          <Button type="submit" disabled={!title.trim() || full}>
            {current ? 'Guardar' : 'Añadir'}
          </Button>
          {current && (
            <Button type="button" onClick={() => reset(summary.weightTotal)}>
              Cancelar
            </Button>
          )}
        </div>
      </form>
      {full && <p className="muted small">Llegaste al máximo de {MAX_EVALUATIONS} evaluaciones por curso.</p>}

      <div className="cgrades__scale">
        <label className="cgrades__field" htmlFor={`${formId}-s`}>
          <span className="muted small">Escala</span>
          <select
            id={`${formId}-s`}
            className="input input--inline"
            value={scale.max}
            onChange={(e) => {
              const picked = GRADE_SCALES.find((g) => g.max === Number(e.target.value));
              if (picked) setGradeScale(course.id, picked);
            }}
          >
            {isCustomScale && <option value={scale.max}>0 a {scale.max}</option>}
            {GRADE_SCALES.map((g) => (
              <option key={g.max} value={g.max}>
                0 a {g.max}
              </option>
            ))}
          </select>
        </label>
        <label className="cgrades__field" htmlFor={`${formId}-p`}>
          <span className="muted small">Apruebas con</span>
          <NumberInput
            id={`${formId}-p`}
            className="input input--inline input--num"
            value={scale.pass}
            min={0}
            max={scale.max}
            step="any"
            onValue={(pass) => {
              if (pass > 0 && pass <= scale.max && pass !== scale.pass) setGradeScale(course.id, { max: scale.max, pass });
            }}
          />
        </label>
      </div>
    </Panel>
  );
}
