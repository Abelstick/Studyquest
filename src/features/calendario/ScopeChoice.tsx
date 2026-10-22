import type { EditScope } from '@/core/agenda';
import { useUi } from '@/state/ui';
import { Button, Modal } from '@/ui/kit';

/** «Solo esta / Esta y las siguientes / Todas»: a qué ocurrencias de una serie se aplica un cambio. */
export function ScopeChoice({ title, verb, oneHint, onPick, onBack }: { title: string; verb: string; oneHint?: string; onPick: (s: EditScope) => void; onBack: () => void }) {
  return (
    <div className="form">
      <p>
        <b>{title}</b> se repite. ¿A qué días quieres {verb} esta actividad?
      </p>
      <div className="scope">
        <Button variant="primary" onClick={() => onPick('one')}>
          Solo este día
        </Button>
        {oneHint && <p className="muted small">{oneHint}</p>}
        <Button onClick={() => onPick('following')}>Este y los siguientes</Button>
        <Button onClick={() => onPick('all')}>Todos los días de la serie</Button>
      </div>
      <div className="modal__actions">
        <Button onClick={onBack}>Volver</Button>
      </div>
    </div>
  );
}

/** Versión en modal, para los cambios hechos arrastrando en la cuadrícula. */
export function ScopeModal({ title, verb, onPick }: { title: string; verb: string; onPick: (s: EditScope) => void }) {
  const close = useUi((s) => s.closeModal);
  return (
    <Modal title="Actividad que se repite" kicker="Serie" onClose={close}>
      <ScopeChoice
        title={title}
        verb={verb}
        onPick={(s) => {
          onPick(s);
          close();
        }}
        onBack={close}
      />
    </Modal>
  );
}
