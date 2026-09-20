import { useState } from 'react';
import { useData } from '@/state';
import { useUi, type ModalState } from '@/state/ui';
import { Button, Modal } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';
import type { SpriteName } from '@/ui/sprites';

const ACTIONS: { label: string; sprite: SpriteName; modal: Exclude<ModalState, null>; primary?: boolean }[] = [
  { label: 'Nueva tarea', sprite: 'qblock', modal: { type: 'task' }, primary: true },
  { label: 'Nuevo hábito', sprite: 'flower', modal: { type: 'habit' } },
  { label: 'Registrar estudio', sprite: 'pacman', modal: { type: 'session' } },
  { label: 'Nueva meta', sprite: 'flag', modal: { type: 'goal' } },
  { label: 'Nuevo curso', sprite: 'pipe', modal: { type: 'course' } },
  { label: 'Nuevo proyecto', sprite: 'chest', modal: { type: 'project' } },
];

/** Hoja de acciones rápidas (botón "?" flotante en móvil). */
export function QuickSheet() {
  const { closeModal, openModal } = useUi();
  return (
    <Modal title="Registro rápido" kicker="// ¿Qué hacemos?" onClose={closeModal}>
      <div className="quick">
        {ACTIONS.map((a) => (
          <button key={a.label} type="button" className={a.primary ? 'quick__btn is-primary' : 'quick__btn'} onClick={() => openModal(a.modal)}>
            <Sprite name={a.sprite} size={26} />
            {a.label}
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function WelcomeModal() {
  const { profile, updateProfile, finishOnboarding } = useData();
  const closeModal = useUi((s) => s.closeModal);
  const [name, setName] = useState(profile.displayName === 'Jugador 1' ? '' : profile.displayName);

  const go = (demo: boolean) => {
    if (name.trim()) updateProfile({ displayName: name.trim() });
    void finishOnboarding(demo);
  };

  return (
    <Modal title="¡Bienvenido a StudyQuest!" kicker="// Press start" onClose={closeModal}>
      <div className="welcome">
        <div className="welcome__sprites" aria-hidden="true">
          <Sprite name="mushroom" size={34} />
          <Sprite name="qblock" size={34} />
          <Sprite name="star" size={34} />
          <Sprite name="pacman" size={34} />
          <Sprite name="flag" size={34} />
        </div>
        <p>Cada tarea es un bloque <b>?</b>, cada hábito un power-up y cada curso un mundo. Estudia, gana XP y monedas, y sube de nivel.</p>
        <label className="field__label" htmlFor="player-name">
          ¿Cómo te llamas, jugador?
        </label>
        <input id="player-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" maxLength={30} />
        <div className="modal__actions">
          <Button variant="primary" onClick={() => go(true)}>
            Cargar mundo de ejemplo
          </Button>
          <Button onClick={() => go(false)}>Empezar desde cero</Button>
        </div>
        <p className="muted small">El mundo de ejemplo crea cursos, tareas y hábitos para que pruebes todo. Puedes reiniciar la partida cuando quieras desde Perfil.</p>
      </div>
    </Modal>
  );
}
