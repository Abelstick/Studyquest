import { useState } from 'react';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { newId, shortDate, today, WEEKDAYS_SHORT } from '@/core/dates';
import type { AreaId, Difficulty, Frequency, Habit, IfThen, Measure } from '@/core/domain';
import { Button, ChipGroup, Field, Modal, cx, linesToList, TextInput, NumberInput } from '@/ui/kit';
import { ConceptHint } from '../help/ConceptGuide';
import { Fold, IfThenEditor, OrganizeFields } from './LifeFields';
import { cleanMinimum } from '@/core/minimum';
import { cleanIfThen } from '@/core/ifthen';
import { isQuit } from '@/core/quit';
import { DIFFICULTIES, HABIT_BASE_XP, difficultyInfo, difficultyOf, xpForDifficulty } from '@/core/difficulty';

const FREQS: { value: Frequency['type']; label: string }[] = [
  { value: 'daily', label: 'Todos los días' },
  { value: 'days', label: 'Días específicos' },
  { value: 'every', label: 'Cada X días' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensual' },
  { value: 'dates', label: 'Fechas' },
  { value: 'yearly', label: 'Anual' },
  { value: 'custom', label: 'Personalizado' },
];
const MEASURES: { value: Measure; label: string }[] = [
  { value: 'times', label: 'Veces' },
  { value: 'minutes', label: 'Minutos' },
  { value: 'hours', label: 'Horas' },
  { value: 'pages', label: 'Páginas' },
  { value: 'exercises', label: 'Ejercicios' },
  { value: 'tasks', label: 'Tareas' },
  { value: 'percent', label: 'Porcentaje' },
  { value: 'boolean', label: 'Hecho / no hecho' },
];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const KINDS = [
  { value: 'build', label: 'Crear un hábito' },
  { value: 'quit', label: 'Dejar un mal hábito' },
];

const REPEATS: { value: number; label: string }[] = [
  { value: 0, label: 'No repetir' },
  { value: 15, label: 'Cada 15 min' },
  { value: 30, label: 'Cada 30 min' },
  { value: 60, label: 'Cada hora' },
];

const stepLine = (s: Habit['steps'][number]) => (s.minutes ? `${s.title} | ${s.minutes}` : s.title);

export function HabitModal({ id, goalId: presetGoal }: { id?: string; goalId?: string }) {
  const close = useUi((s) => s.closeModal);
  const openModal = useUi((s) => s.openModal);
  const { habits, createHabit, updateHabit, deleteHabit } = useData();
  const editing = habits.find((h) => h.id === id);
  const f0 = editing?.frequency;
  // Hábito normal o mal hábito a dejar. No se cambia al editar: el historial de uno no tiene sentido en el otro.
  const [quit, setQuit] = useState(editing ? isQuit(editing) : false);

  const [title, setTitle] = useState(editing?.title ?? '');
  const [freq, setFreq] = useState<Frequency['type']>(f0?.type ?? 'daily');
  const [days, setDays] = useState<number[]>(f0?.type === 'days' ? f0.days : [0, 2, 4]);
  const [every, setEvery] = useState(f0?.type === 'every' ? f0.every : 2);
  const [dates, setDates] = useState<string[]>(f0?.type === 'dates' ? f0.dates : []);
  const [dateDraft, setDateDraft] = useState(today());
  const [month, setMonth] = useState(f0?.type === 'yearly' ? f0.month : new Date().getMonth() + 1);
  const [day, setDay] = useState(f0?.type === 'yearly' ? f0.day : new Date().getDate());
  const [times, setTimes] = useState(f0?.type === 'custom' ? f0.times : 3);
  const [per, setPer] = useState<'week' | 'month'>(f0?.type === 'custom' ? f0.per : 'week');
  const [measure, setMeasure] = useState<Measure>(editing?.measure ?? 'minutes');
  const [target, setTarget] = useState(editing?.target ?? 30);
  const [difficulty, setDifficulty] = useState<Difficulty>(editing ? difficultyOf(editing) : 'normal');
  const [xp, setXp] = useState(editing?.xp ?? HABIT_BASE_XP);
  // Si el XP ya no coincide con el que propone su dificultad, es que lo personalizaste: no se lo pisamos.
  const [xpTouched, setXpTouched] = useState(!!editing && editing.xp !== xpForDifficulty(HABIT_BASE_XP, difficultyOf(editing)));
  const pickDifficulty = (d: Difficulty) => {
    setDifficulty(d);
    if (!xpTouched) setXp(xpForDifficulty(HABIT_BASE_XP, d));
  };
  const [reminder, setReminder] = useState(editing?.reminder ?? '');
  const [repeat, setRepeat] = useState(editing?.reminderRepeatMin ?? 30);
  const [steps, setSteps] = useState(editing?.steps.map(stepLine).join('\n') ?? '');

  const [area, setArea] = useState<AreaId | ''>(editing?.area ?? '');
  const [goalId, setGoalId] = useState(editing?.goalId ?? presetGoal ?? '');
  // 0 = sin versión mínima.
  const [minTarget, setMinTarget] = useState(editing?.minTarget ?? 0);
  const [ifThen, setIfThen] = useState<IfThen[]>(editing?.ifThen ?? []);

  const toggleDay = (d: number) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()));
  const addDate = () => {
    if (dateDraft && !dates.includes(dateDraft)) setDates([...dates, dateDraft].sort());
  };
  const invalid = !title.trim() || (!quit && freq === 'days' && days.length === 0) || (!quit && freq === 'dates' && dates.length === 0);

  const buildFrequency = (): Frequency => {
    switch (freq) {
      case 'days':
        return { type: 'days', days };
      case 'every':
        return { type: 'every', every: Math.max(1, every) };
      case 'dates':
        return { type: 'dates', dates };
      case 'yearly':
        return { type: 'yearly', month, day: Math.min(31, Math.max(1, day)) };
      case 'custom':
        return { type: 'custom', times: Math.max(1, times), per };
      default:
        return { type: freq } as Frequency;
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (invalid) return;
    const parsedSteps = linesToList(steps).map((line) => {
      const [t, m] = line.split('|').map((p) => p.trim());
      const title = t || line;
      const minutes = Number(m) || 0;
      const prev = editing?.steps.find((s) => s.title === title);
      return prev ? { ...prev, minutes } : { id: newId(), title, minutes };
    });
    // Dejar un mal hábito es siempre diario y de «hecho / no hecho» (hoy resistí): no hay nada más que configurar.
    const data = {
      title: title.trim(),
      frequency: quit ? ({ type: 'daily' } as const) : buildFrequency(),
      measure: quit ? ('boolean' as const) : measure,
      target: quit || measure === 'boolean' ? 1 : Math.max(1, target),
      xp: Math.max(0, xp),
      difficulty,
      reminder: reminder || null,
      reminderRepeatMin: repeat,
      steps: quit ? [] : parsedSteps,
      ...(quit ? { kind: 'quit' as const } : {}),
      area: area || undefined,
      goalId: goalId || undefined,
      // Vacío o incoherente (≥ objetivo, hecho/no hecho, mal hábito) = sin versión mínima.
      minTarget: cleanMinimum(minTarget, { target: quit || measure === 'boolean' ? 1 : Math.max(1, target), measure: quit ? 'boolean' : measure, kind: quit ? 'quit' : 'build' }),
      ifThen: cleanIfThen(ifThen),
    };
    if (editing) updateHabit(editing.id, data);
    else createHabit(data);
    close();
  };

  return (
    <Modal title={editing ? (quit ? 'Editar mal hábito' : 'Editar hábito') : quit ? 'Dejar un mal hábito' : 'Nuevo hábito'} kicker={quit ? 'Romper la maldición' : 'Habilidad pasiva'} onClose={close} wide>
      <form onSubmit={submit} className="form">
        {!editing && <ConceptHint id="habito" />}
        {!editing && (
          <Field label="¿Qué quieres hacer?">
            {() => <ChipGroup label="Tipo de hábito" value={quit ? 'quit' : 'build'} options={KINDS} onChange={(v) => setQuit(v === 'quit')} />}
          </Field>
        )}
        {quit && <p className="muted small">Cada día que resistas, lo registras y ganas XP. Si recaes, pulsas «Recaí»: el día no cuenta, el contador de días limpio vuelve a 0 y mañana empiezas de nuevo. Sin culpas.</p>}
        <Field label={quit ? 'Qué quieres dejar' : 'Nombre'}>{(fid) => <TextInput id={fid} className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={quit ? 'Mirar el celular en la cama' : 'Estudiar Python'} required maxLength={80} />}</Field>
        {!quit && <Field label="Frecuencia">{() => <ChipGroup label="Frecuencia" value={freq} options={FREQS} onChange={setFreq} />}</Field>}

        {!quit && freq === 'days' && (
          <div className="weekdays" role="group" aria-label="Días de la semana">
            {WEEKDAYS_SHORT.map((d, i) => (
              <button key={d} type="button" aria-pressed={days.includes(i)} className={cx('weekdays__day', days.includes(i) && 'is-on')} onClick={() => toggleDay(i)}>
                {d}
              </button>
            ))}
          </div>
        )}
        {!quit && freq === 'every' && <Field label="Cada cuántos días">{(fid) => <NumberInput id={fid} className="input" min={1} max={60} value={every} onValue={(n) => setEvery(n)}/>}</Field>}
        {!quit && freq === 'dates' && (
          <Field label="Fechas concretas" hint="Añade cada fecha en la que quieras que toque (cumpleaños, exámenes, entregas…).">
            {(fid) => (
              <>
                <div className="inline-form">
                  <input id={fid} className="input" type="date" value={dateDraft} onChange={(e) => setDateDraft(e.target.value)} />
                  <Button onClick={addDate} disabled={!dateDraft}>
                    Añadir
                  </Button>
                </div>
                <div className="chips">
                  {dates.length === 0 && <span className="muted small">Ninguna fecha todavía.</span>}
                  {dates.map((d) => (
                    <button key={d} type="button" className="chip chip--sm is-on" aria-label={`Quitar ${d}`} onClick={() => setDates(dates.filter((x) => x !== d))}>
                      {shortDate(d)} ✕
                    </button>
                  ))}
                </div>
              </>
            )}
          </Field>
        )}
        {!quit && freq === 'yearly' && (
          <div className="form__row">
            <Field label="Mes">
              {(fid) => (
                <select id={fid} className="input" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Día">{(fid) => <NumberInput id={fid} className="input" min={1} max={31} value={day} onValue={(n) => setDay(n)}/>}</Field>
          </div>
        )}
        {!quit && freq === 'custom' && (
          <div className="form__row">
            <Field label="Veces" hint="Los días que quieras, hasta llegar a esta cifra.">
              {(fid) => <NumberInput id={fid} className="input" min={1} max={31} value={times} onValue={(n) => setTimes(n)}/>}
            </Field>
            <Field label="Por">
              {(fid) => (
                <select id={fid} className="input" value={per} onChange={(e) => setPer(e.target.value as 'week' | 'month')}>
                  <option value="week">Semana</option>
                  <option value="month">Mes</option>
                </select>
              )}
            </Field>
          </div>
        )}

        {!quit && <Field label="Forma de medición">{() => <ChipGroup label="Forma de medición" value={measure} options={MEASURES} onChange={setMeasure} />}</Field>}
        <Field label="Dificultad" hint={`${difficultyInfo(difficulty).hint} Ajusta el XP que propone el hábito; puedes cambiarlo abajo.`}>
          {() => <ChipGroup label="Dificultad" value={difficulty} options={DIFFICULTIES.map((d) => ({ value: d.value, label: d.label }))} onChange={pickDifficulty} />}
        </Field>
        <div className="form__row">
          {!quit && measure !== 'boolean' && <Field label="Objetivo">{(fid) => <NumberInput id={fid} className="input" min={1} value={target} onValue={(n) => setTarget(n)}/>}</Field>}
          <Field label="Recompensa (XP)">{(fid) => <NumberInput id={fid} className="input input--xp" min={0} step={5} value={xp} onValue={(n) => { setXp(n); setXpTouched(true); }}/>}</Field>
          <Field label="Recordatorio" hint="Avisa dentro de la app (con sonido) y, si activas los push en Perfil, también con la app cerrada.">
            {(fid) => <input id={fid} className="input" type="time" value={reminder} onChange={(e) => setReminder(e.target.value)} />}
          </Field>
        </div>
        {reminder && (
          <Field label="Si no lo hago, avisar de nuevo" hint="Insiste hasta que lo marques como hecho (máximo 6 avisos al día).">
            {() => <ChipGroup label="Repetición del recordatorio" value={repeat} options={REPEATS} onChange={setRepeat} />}
          </Field>
        )}
        <Field label="Subtareas de la sesión" hint="Una por línea. Opcional: «Ver clase | 10» para indicar los minutos.">
          {(fid) => <textarea id={fid} className="input" rows={4} value={steps} onChange={(e) => setSteps(e.target.value)} placeholder={'Ver clase | 10\nTomar apuntes | 5'} />}
        </Field>
        <Fold summary="Para los días difíciles (opcional)" open={!!editing?.minTarget || !!editing?.ifThen?.length}>
          {!quit && measure !== 'boolean' && (
            <Field label="Versión mínima" hint={`La cantidad más pequeña que aún cuenta para mantener tu racha, siempre menor que el objetivo (${target}). En 0 se desactiva. Da solo el XP proporcional: no es un atajo para ganar más.`}>
              {(fid) => <NumberInput id={fid} className="input" min={0} max={Math.max(0, target - 1)} value={minTarget} onValue={(n) => setMinTarget(n)} />}
            </Field>
          )}
          <Field label="Si… entonces…" hint="Decide hoy qué harás cuando algo se cruce, para no improvisar ese día.">
            {() => <IfThenEditor value={ifThen} onChange={setIfThen} />}
          </Field>
        </Fold>
        <Fold summary="Área y meta (opcional)" open={!!area || !!goalId}>
          <OrganizeFields area={area} onArea={setArea} goalId={goalId} onGoal={setGoalId} />
        </Fold>
        <div className="modal__actions">
          <Button variant="primary" type="submit" disabled={invalid}>
            {editing ? 'Guardar cambios' : 'Crear hábito'}
          </Button>
          <Button onClick={close}>Cancelar</Button>
          {editing && (
            <Button
              variant="danger"
              className="push-right"
              onClick={() => openModal({ type: 'confirm', title: 'Borrar hábito', body: `Se eliminará "${editing.title}" y todo su historial.`, confirmLabel: 'Borrar', onConfirm: () => deleteHabit(editing.id) })}
            >
              Borrar
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
