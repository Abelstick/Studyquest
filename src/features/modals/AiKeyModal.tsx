import { useUi } from '@/state/ui';
import { Modal } from '@/ui/kit';
import { AiSetup } from '../ai/AiSetup';

/** Ventana para activar las funciones inteligentes desde cualquier pantalla que las necesite. */
export function AiKeyModal() {
  const close = useUi((s) => s.closeModal);
  return (
    <Modal title="Funciones inteligentes" kicker="// Activar la IA" onClose={close}>
      <AiSetup onDone={close} />
    </Modal>
  );
}
