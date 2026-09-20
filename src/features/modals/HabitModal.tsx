import { useState } from 'react';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { newId, WEEKDAYS_SHORT } from '@/core/dates';
import type { Frequency, Habit, Measure } from '@/core/domain';
import { Button, ChipGroup, Field, Modal, cx, linesToList } from '@/ui/kit';

const FREQS: { value: Frequency['type']; label: string }[] = [
  { value: 'daily', label: 'Todos los días' },
  { value: 'days', label: 'Días específicos' },
  { value: 'every', label: 'Cada X días' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensual' },
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

const stepLine = (s: Habit['steps'][number]) => (s.minutes ? `${s.title} | ${s.minutes}` : s.title);

export function HabitModal({ id }: { id?: string }) {
  const close = useUi((s) => s.closeModal);
  const openModal = useUi((s) => s.openModal);
  const { habits, createHabit, updateHabit, deleteHabit } = useData();
  const editing = habits.find((h) => h.id === id);

  const [title, setTitle] = useState(editing?.title ?? '');
  const [freq, setFreq] = useState<Frequency['type']>(editing?.frequency.type ?? 'daily');
  const [days, setDays] = useState<number[]>(editing?.frequency.type === 'days' ? editing.frequency.days : [0, 2, 4]);
  const [every, setEvery] = useState(editing?.frequency.type === 'every' ? editing.frequency.every : 2);
  const [measure, setMeasure] = useState<Measure>(editing?.measure ?? 'minutes');
  const [target, setTarget] = useState(editing?.target ?? 30);
  const [xp, setXp] = useState(editing?.xp ?? 30);
  const [reminder, setReminder] = useState(editing?.reminder ?? '');
  const [steps, setSteps] = useState(editing?.steps.map(stepLine).join('\n') ?? '');

  const toggleDay = (d: number) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || (freq === 'days' && days.length === 0)) return;
    const frequency: Frequency = freq === 'days' ? { type: 'days', days } : freq === 'every' ? { type: 'every', every: Math.max(1, every) } : ({ type: freq } as Frequency);
    const parsedSteps = linesToList(steps).map((line) => {
      const [t, m] = line.split('|').map((p) => p.trim());
      const title = t || line;
      const minutes = Number(m) || 0;
      return editing?.steps.find((s) => s.title === title) ? { ...editing.steps.find((s) => s.title === title)!, minutes } : { id: newId(), title, minutes };
    });
    const data = {
      title: title.trim(),
      frequency,
      measure,
      target: measure === 'boolean' ? 1 : Math.max(1, target),
      xp: Math.max(0, xp),
      reminder: reminder || null,
      steps: parsedSteps,
    };
    if (editing) updateHabit(editing.id, data);
    else createHabit(data);
    close();
  };

  return (
    <Modal title={editing ? 'Editar hábito' : 'Nuevo hábito'} kicker="// Habilidad pasiva" onClose={close} wide>
      <form onSubmit={submit} className="form">
        <Field label="Nombre">{(fid) => <input id={fid} className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Estudiar Python" required maxLength={80} />}</Field>
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
        {freq === 'every' && <Field label="Cada cuántos días">{(fid) => <input id={fid} className="input" type="number" min={1} max={60} value={every} onChange={(e) => setEvery(Number(e.target.value))} />}</Field>}
        <Field label="Forma de medición">{() => <ChipGroup label="Forma de medición" value={measure} options={MEASURES} onChange={setMeasure} />}</Field>
        <div className="form__row">
          {measure !== 'boolean' && <Field label="Objetivo">{(fid) => <input id={fid} className="input" type="number" min={1} value={target} onChange={(e) => setTarget(Number(e.target.value))} />}</Field>}
          <Field label="Recompensa (XP)">{(fid) => <input id={fid} className="input input--xp" type="number" min={0} step={5} value={xp} onChange={(e) => setXp(Number(e.target.value))} />}</Field>
          <Field label="Recordatorio">{(fid) => <input id={fid} className="input" type="time" value={reminder} onChange={(e) => setReminder(e.target.value)} />}</Field>
        </div>
        <Field label="Subtareas de la sesión" hint="Una por línea. Opcional: «Ver clase | 10» para indicar los minutos.">
          {(fid) => <textarea id={fid} className="input" rows={4} value={steps} onChange={(e) => setSteps(e.target.value)} placeholder={'Ver clase | 10\nTomar apuntes | 5'} />}
        </Field>
        <div className="modal__actions">
          <Button variant="primary" type="submit" disabled={!title.trim() || (freq === 'days' && days.length === 0)}>
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
