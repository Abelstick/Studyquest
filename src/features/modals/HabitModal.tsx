import { useState } from 'react';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { newId, shortDate, today, WEEKDAYS_SHORT } from '@/core/dates';
import type { Frequency, Habit, Measure } from '@/core/domain';
import { Button, ChipGroup, Field, Modal, cx, linesToList, TextInput, NumberInput } from '@/ui/kit';
import { ConceptHint } from '../help/ConceptGuide';

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

const REPEATS: { value: number; label: string }[] = [
  { value: 0, label: 'No repetir' },
  { value: 15, label: 'Cada 15 min' },
  { value: 30, label: 'Cada 30 min' },
  { value: 60, label: 'Cada hora' },
];

const stepLine = (s: Habit['steps'][number]) => (s.minutes ? `${s.title} | ${s.minutes}` : s.title);

export function HabitModal({ id }: { id?: string }) {
  const close = useUi((s) => s.closeModal);
  const openModal = useUi((s) => s.openModal);
  const { habits, createHabit, updateHabit, deleteHabit } = useData();
  const editing = habits.find((h) => h.id === id);
  const f0 = editing?.frequency;

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
  const [xp, setXp] = useState(editing?.xp ?? 30);
  const [reminder, setReminder] = useState(editing?.reminder ?? '');
  const [repeat, setRepeat] = useState(editing?.reminderRepeatMin ?? 30);
  const [steps, setSteps] = useState(editing?.steps.map(stepLine).join('\n') ?? '');

  const toggleDay = (d: number) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()));
  const addDate = () => {
    if (dateDraft && !dates.includes(dateDraft)) setDates([...dates, dateDraft].sort());
  };
  const invalid = !title.trim() || (freq === 'days' && days.length === 0) || (freq === 'dates' && dates.length === 0);

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
    const data = {
      title: title.trim(),
      frequency: buildFrequency(),
      measure,
      target: measure === 'boolean' ? 1 : Math.max(1, target),
      xp: Math.max(0, xp),
      reminder: reminder || null,
      reminderRepeatMin: repeat,
      steps: parsedSteps,
    };
    if (editing) updateHabit(editing.id, data);
    else createHabit(data);
    close();
  };

  return (
    <Modal title={editing ? 'Editar hábito' : 'Nuevo hábito'} kicker="// Habilidad pasiva" onClose={close} wide>
      <form onSubmit={submit} className="form">
        {!editing && <ConceptHint id="habito" />}
        <Field label="Nombre">{(fid) => <TextInput id={fid} className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Estudiar Python" required maxLength={80} />}</Field>
        <Field label="Frecuencia">{() => <ChipGroup label="Frecuencia" value={freq} options={FREQS} onChange={setFreq} />}</Field>

        {freq === 'days' && (
          <div className="weekdays" role="group" aria-label="Días de la semana">
            {WEEKDAYS_SHORT.map((d, i) => (
              <button key={d} type="button" aria-pressed={days.includes(i)} className={cx('weekdays__day', days.includes(i) && 'is-on')} onClick={() => toggleDay(i)}>
                {d}
              </button>
            ))}
          </div>
        )}
        {freq === 'every' && <Field label="Cada cuántos días">{(fid) => <NumberInput id={fid} className="input" min={1} max={60} value={every} onValue={(n) => setEvery(n)}/>}</Field>}
        {freq === 'dates' && (
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
        {freq === 'yearly' && (
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
        {freq === 'custom' && (
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

        <Field label="Forma de medición">{() => <ChipGroup label="Forma de medición" value={measure} options={MEASURES} onChange={setMeasure} />}</Field>
        <div className="form__row">
          {measure !== 'boolean' && <Field label="Objetivo">{(fid) => <NumberInput id={fid} className="input" min={1} value={target} onValue={(n) => setTarget(n)}/>}</Field>}
          <Field label="Recompensa (XP)">{(fid) => <NumberInput id={fid} className="input input--xp" min={0} step={5} value={xp} onValue={(n) => setXp(n)}/>}</Field>
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
