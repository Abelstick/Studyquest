import { useUi } from '@/state/ui';
import { Modal } from '@/ui/kit';
import { SECTIONS } from '@/features/layout/nav';

const GENERAL: [string, string][] = [
  ['/', 'Buscar'],
  ['N', 'Crear (tarea, hábito, curso… según la pantalla)'],
  ['?', 'Ver estos atajos'],
  ['Esc', 'Cerrar un modal o el menú'],
];

/** Chuleta de atajos de teclado. */
export function ShortcutsModal() {
  const closeModal = useUi((s) => s.closeModal);
  return (
    <Modal title="Atajos de teclado" kicker="// Juega más rápido" onClose={closeModal}>
      <dl className="keys">
        {GENERAL.map(([k, what]) => (
          <div key={k} className="keys__row">
            <dt>
              <kbd>{k}</kbd>
            </dt>
            <dd>{what}</dd>
          </div>
        ))}
        {SECTIONS.map((s) => (
          <div key={s.id} className="keys__row">
            <dt>
              <kbd>G</kbd> <kbd>{s.key.toUpperCase()}</kbd>
            </dt>
            <dd>Ir a {s.label}</dd>
          </div>
        ))}
      </dl>
      <p className="muted small">En Repaso: espacio gira la tarjeta y 1, 2 o 3 califica. Los atajos no se activan mientras escribes.</p>
    </Modal>
  );
}
