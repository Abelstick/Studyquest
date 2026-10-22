import { useEffect, useState, type ReactNode } from 'react';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { Button, Modal, cx } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';
import type { SpriteName } from '@/ui/sprites';
import { SECTIONS, tabsOf } from '@/features/layout/nav';

const SEEN_KEY = 'sq.tour.v1';

/** Si el tour ya se vio en este dispositivo. Sin almacenamiento disponible, se da por visto para no repetirlo en cada carga. */
function tourSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return true;
  }
}
function markTourSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Sin almacenamiento (modo privado): el tour volvería a salir, pero no rompe nada.
  }
}

/** Abre el tour una vez, cuando los datos están listos y la bienvenida ya terminó. */
export function useTour() {
  const status = useData((s) => s.status);
  const onboarded = useData((s) => s.profile.onboarded);
  const modal = useUi((s) => s.modal);
  const openModal = useUi((s) => s.openModal);
  useEffect(() => {
    if (status === 'ready' && onboarded && !modal && !tourSeen()) openModal({ type: 'tour' });
  }, [status, onboarded, modal, openModal]);
}

interface Step {
  sprite: SpriteName;
  title: string;
  body: ReactNode;
}

const STEPS: Step[] = [
  {
    sprite: 'castle',
    title: 'Todo en 5 secciones',
    body: (
      <>
        <p>El menú ahora tiene solo cinco secciones. Tus pantallas de siempre siguen ahí, como pestañas arriba de cada una:</p>
        <ul className="tour__sections">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <Sprite name={s.sprite} size={18} /> <b>{s.label}</b>
              <span className="muted"> · {tabsOf(s.id).map((t) => t.label).join(', ')}</span>
            </li>
          ))}
        </ul>
      </>
    ),
  },
  {
    sprite: 'star',
    title: 'Empieza por el siguiente paso',
    body: (
      <>
        <p>
          En <b>Hoy</b>, el bloque grande de arriba te dice qué hacer ahora: primero lo vencido, luego lo que vence hoy, tus hábitos y los repasos.
        </p>
        <p>Complétalo con un toque. Si te equivocas, pulsa «Deshacer» en el aviso. «Empezar enfoque» abre el Pomodoro con el curso ya elegido.</p>
      </>
    ),
  },
  {
    sprite: 'qblock',
    title: 'Busca o crea desde cualquier sitio',
    body: (
      <>
        <p>
          En el ordenador, el buscador de arriba lleva directo a la tarea, el apunte o la meta, y <b>Nuevo</b> crea lo propio de cada pantalla. Atajos: <kbd>/</kbd> buscar, <kbd>N</kbd> crear, <kbd>?</kbd> ver todos.
        </p>
        <p>
          En el móvil, el botón <b>+</b> de arriba hace las dos cosas: buscar y crear.
        </p>
      </>
    ),
  },
];

/** Tour de tres pasos para quien llega (o vuelve del menú antiguo de 17 pantallas). */
export function TourModal() {
  const closeModal = useUi((s) => s.closeModal);
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;
  const finish = () => {
    markTourSeen();
    closeModal();
  };
  return (
    <Modal title={step.title} kicker={`Novedades · ${i + 1} de ${STEPS.length}`} onClose={finish}>
      <div className="tour">
        <Sprite name={step.sprite} size={40} className="tour__sprite" />
        <div className="tour__body">{step.body}</div>
      </div>
      <ol className="tour__dots" aria-label={`Paso ${i + 1} de ${STEPS.length}`}>
        {STEPS.map((s, n) => (
          <li key={s.title} className={cx(n === i && 'is-on')} aria-current={n === i ? 'step' : undefined} />
        ))}
      </ol>
      <div className="modal__actions">
        {!last && <Button onClick={finish}>Saltar</Button>}
        {i > 0 && <Button onClick={() => setI(i - 1)}>‹ Anterior</Button>}
        <Button variant="primary" className="push-right" onClick={() => (last ? finish() : setI(i + 1))}>
          {last ? '¡A jugar!' : 'Siguiente ›'}
        </Button>
      </div>
    </Modal>
  );
}
