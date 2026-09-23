import { useState, type FormEvent } from 'react';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { newId } from '@/core/dates';
import type { HabitChain } from '@/core/domain';
import { CHAIN_BONUS_XP, MAX_CHAIN_LINKS, looseHabits } from '@/core/chains';
import { Button, Field, Modal, TextInput } from '@/ui/kit';

/** Lista vacía estable: un `?? []` dentro del selector crea un array nuevo en cada render y provoca un bucle. */
const NO_CHAINS: HabitChain[] = [];

/** Crear o editar una cadena: nombre y los hábitos en el orden de la rutina. */
export function ChainModal({ id }: { id?: string }) {
  const habits = useData((s) => s.habits);
  const chains = useData((s) => s.profile.chains) ?? NO_CHAINS;
  const saveChain = useData((s) => s.saveChain);
  const deleteChain = useData((s) => s.deleteChain);
  const close = useUi((s) => s.closeModal);
  const openModal = useUi((s) => s.openModal);

  const editing = chains.find((c) => c.id === id);
  const [name, setName] = useState(editing?.name ?? 'Rutina de mañana');
  const [picked, setPicked] = useState<string[]>(editing?.habitIds ?? []);

  // Un hábito solo puede estar en una cadena; al editar, los suyos siguen disponibles.
  const available = looseHabits(habits, chains, editing?.id);
  const title = (hid: string) => habits.find((h) => h.id === hid)?.title ?? '';

  const toggle = (hid: string) =>
    setPicked((p) => (p.includes(hid) ? p.filter((x) => x !== hid) : p.length >= MAX_CHAIN_LINKS ? p : [...p, hid]));
  const move = (i: number, d: -1 | 1) =>
    setPicked((p) => {
      const next = [...p];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || picked.length < 2) return;
    saveChain({ id: editing?.id ?? newId(), name: name.trim(), habitIds: picked });
    close();
  };

  return (
    <Modal title={editing ? 'Editar cadena' : 'Nueva cadena de hábitos'} kicker="// Rutina" onClose={close}>
      <form onSubmit={submit} className="form">
        <p className="form__info">
          Pon tus hábitos en orden: cada uno será la señal del siguiente. No se bloquea nada — puedes registrar cualquiera cuando quieras — y si completas la cadena entera en un día ganas <b>+{CHAIN_BONUS_XP} XP</b>.
        </p>

        <Field label="Nombre de la rutina">
          {(fid) => <TextInput id={fid} className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Rutina de mañana" required maxLength={60} />}
        </Field>

        <fieldset className="fieldset">
          <legend className="kicker">Hábitos de la cadena ({picked.length} de {MAX_CHAIN_LINKS})</legend>
          {picked.length === 0 ? (
            <p className="muted small">Elige abajo al menos dos hábitos.</p>
          ) : (
            <ol className="chainpick">
              {picked.map((hid, i) => (
                <li key={hid}>
                  <span className="chainpick__n">{i + 1}</span>
                  <span className="grow">{title(hid)}</span>
                  <button type="button" className="icon-btn icon-btn--sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Subir ${title(hid)}`}>
                    ↑
                  </button>
                  <button type="button" className="icon-btn icon-btn--sm" onClick={() => move(i, 1)} disabled={i === picked.length - 1} aria-label={`Bajar ${title(hid)}`}>
                    ↓
                  </button>
                  <button type="button" className="icon-btn icon-btn--sm" onClick={() => toggle(hid)} aria-label={`Quitar ${title(hid)} de la cadena`}>
                    ✕
                  </button>
                </li>
              ))}
            </ol>
          )}
        </fieldset>

        <Field label="Añadir hábitos" hint="Se añaden al final; luego los ordenas con las flechas.">
          {() => (
            <div className="chips">
              {available.filter((h) => !picked.includes(h.id)).map((h) => (
                <button key={h.id} type="button" className="chip" onClick={() => toggle(h.id)} disabled={picked.length >= MAX_CHAIN_LINKS}>
                  ＋ {h.title}
                </button>
              ))}
              {available.every((h) => picked.includes(h.id)) && <p className="muted small">No quedan hábitos libres: los demás ya están en otra cadena.</p>}
            </div>
          )}
        </Field>

        <div className="modal__actions">
          <Button variant="primary" type="submit" disabled={!name.trim() || picked.length < 2}>
            {editing ? 'Guardar cadena' : 'Crear cadena'}
          </Button>
          <Button onClick={close}>Cancelar</Button>
          {editing && (
            <Button
              variant="danger"
              className="push-right"
              onClick={() =>
                openModal({
                  type: 'confirm',
                  title: 'Borrar cadena',
                  body: `Se deshará "${editing.name}". Tus hábitos y su historial no se tocan: solo dejan de estar enlazados.`,
                  confirmLabel: 'Borrar',
                  onConfirm: () => deleteChain(editing.id),
                })
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
