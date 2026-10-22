import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUi } from '@/state/ui';
import { Button, Modal, cx } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';
import type { SpriteName } from '@/ui/sprites';
import { Icon } from '@/ui/Icon';

interface Action {
  label: string;
  /** Qué hace al pulsarlo: abrir un formulario o ir a una pantalla. */
  run: (go: { open: ReturnType<typeof useUi.getState>['openModal']; nav: (to: string) => void }) => void;
}

interface Chapter {
  id: string;
  sprite: SpriteName;
  title: string;
  lead: string;
  points: string[];
  actions?: Action[];
}

const CHAPTERS: Chapter[] = [
  {
    id: 'idea',
    sprite: 'mushroom',
    title: 'La idea en 30 segundos',
    lead: 'StudyQuest te dice qué hacer ahora y convierte constancia en juego.',
    points: [
      'Una tarea se hace una vez. Un hábito se repite. Una meta es lo que quieres lograr y un proyecto es algo que construyes.',
      'Todo lo que completas da XP y monedas; subir de nivel desbloquea cosas. Si te equivocas, deshacer devuelve el XP.',
      'No tienes que usarlo todo. Con una meta, un hábito y tu horario ya funciona.',
    ],
    actions: [{ label: 'Ver la diferencia con ejemplos', run: ({ open }) => open({ type: 'guide' }) }],
  },
  {
    id: 'empezar',
    sprite: 'star',
    title: 'Primeros pasos (10 minutos)',
    lead: 'Haz estos cinco pasos en orden y la app trabaja por ti.',
    points: [
      '1. Cuenta tu semana: cuándo trabajas y cuándo duermes. Así sabe cuándo tienes tiempo libre.',
      '2. Elige qué quieres lograr con el planificador: escribes «quiero aprender SQL en 3 meses» y arma las fechas.',
      '3. Crea un hábito pequeño: 10 o 20 minutos. Mejor pequeño y constante que grande y abandonado.',
      '4. Ponle hora a ese hábito: la app propone la hora libre más natural.',
      '5. Haz tu primera acción, aunque sean 10 minutos.',
    ],
    actions: [
      { label: '1 · Armar mi semana', run: ({ open }) => open({ type: 'routine' }) },
      { label: '2 · Planificar una meta', run: ({ nav }) => nav('/planificador') },
      { label: '3 · Crear un hábito', run: ({ open }) => open({ type: 'habit' }) },
    ],
  },
  {
    id: 'dia',
    sprite: 'castle',
    title: 'Tu día a día',
    lead: 'Abre Hoy y deja que la pantalla te guíe; no necesitas decidir nada.',
    points: [
      '«Ahora» te dice qué hora es y qué toca: tu jornada, o tu tiempo libre y qué podrías hacer en él.',
      '«Siguiente paso» es lo más importante de hacer: primero lo vencido, luego lo de hoy, tus hábitos y los repasos.',
      'Tus 3 prioridades y tu agenda del día te dan el resumen. El tablero de abajo tiene todas las misiones.',
      'Un mal día: usa «Solo lo mínimo» en tu hábito. Mantiene la racha y no hace falta compensar lo de ayer.',
      'Para concentrarte, «Empezar enfoque» abre el Pomodoro.',
    ],
    actions: [{ label: 'Ir a Hoy', run: ({ nav }) => nav('/') }],
  },
  {
    id: 'semana',
    sprite: 'flag',
    title: 'Cada semana, 2 minutos',
    lead: 'Una revisión corta evita que todo se acumule.',
    points: [
      'El domingo (o hasta el miércoles) Hoy te invita a revisar tu semana, o ábrela en Progreso.',
      'Ves lo planificado frente a lo hecho. Lo pendiente no es un fracaso: lo mueves, lo reduces o lo quitas.',
      'Anotas qué se interpuso y eliges tus 3 prioridades de la semana siguiente; aparecen en Hoy.',
    ],
    actions: [{ label: 'Abrir Progreso', run: ({ nav }) => nav('/progreso') }],
  },
  {
    id: 'calendario',
    sprite: 'chest',
    title: 'Calendario y Google Calendar',
    lead: 'Todo lo que tiene hora vive en el Calendario.',
    points: [
      'Los bloques de tus hábitos y tareas aparecen ahí y avisan antes de empezar.',
      'Para llevarlo a Google Calendar usa «Exportar» (archivo .ics) y en Google: Configuración → Importar y exportar. Es una copia del momento: si cambias algo, vuelve a exportar; no duplica.',
      'Puedes instalar StudyQuest como app en el móvil desde Perfil y usarla sin conexión.',
    ],
    actions: [
      { label: 'Abrir Mi semana', run: ({ open }) => open({ type: 'routine' }) },
      { label: 'Ir al Calendario', run: ({ nav }) => nav('/calendario') },
    ],
  },
  {
    id: 'ayuda',
    sprite: 'pacman',
    title: 'Si te pierdes',
    lead: 'Siempre hay una salida.',
    points: [
      'El botón de ayuda (?) de arriba abre esta guía en cualquier momento. «¿Cuál uso?» aparece en Tareas, Hábitos y Metas.',
      'Pulsa ? en el teclado para ver los atajos; / busca cualquier cosa y N crea.',
      'Nada es definitivo: puedes editar, deshacer, exportar una copia y reiniciar la partida desde Perfil.',
    ],
  },
];

/**
 * Guía de uso paso a paso, siempre a un toque (❓ en la barra y en Hoy). Cada capítulo explica una idea corta y
 * trae botones que llevan directo a la acción, para pasar de leer a hacer sin buscar el menú.
 */
export function HowToGuide() {
  const close = useUi((s) => s.closeModal);
  const open = useUi((s) => s.openModal);
  const navigate = useNavigate();
  const [i, setI] = useState(0);
  const ch = CHAPTERS[i];
  const last = i === CHAPTERS.length - 1;

  const run = (a: Action) => {
    // Primero se cierra la guía: el formulario o la pantalla elegida pasa a ser lo único abierto.
    close();
    a.run({ open, nav: (to) => navigate(to) });
  };

  return (
    <Modal title={ch.title} kicker={`Guía de uso · ${i + 1} de ${CHAPTERS.length}`} onClose={close} wide>
      <nav aria-label="Capítulos de la guía">
        <ol className="howto__tabs">
          {CHAPTERS.map((c, n) => (
            <li key={c.id}>
              <button type="button" className={cx('chip chip--sm', n === i && 'is-on')} aria-current={n === i ? 'step' : undefined} onClick={() => setI(n)}>
                {n + 1}. {c.title.replace(/ \(.*\)$/, '')}
              </button>
            </li>
          ))}
        </ol>
      </nav>
      <div className="howto">
        <Sprite name={ch.sprite} size={40} className="tour__sprite" />
        <div className="howto__body">
          <p className="howto__lead">{ch.lead}</p>
          <ul className="howto__points">
            {ch.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          {ch.actions && (
            <div className="row">
              {ch.actions.map((a, n) => (
                <Button key={a.label} small variant={n === 0 ? 'primary' : 'ghost'} onClick={() => run(a)}>
                  {a.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="modal__actions">
        {i > 0 && <Button onClick={() => setI(i - 1)}>‹ Anterior</Button>}
        <Button variant="primary" className="push-right" onClick={() => (last ? close() : setI(i + 1))}>
          {last ? 'Entendido' : 'Siguiente ›'}
        </Button>
      </div>
    </Modal>
  );
}

/** Botón ❓ «Guía» para cualquier cabecera. */
export function HowToButton({ label = 'Guía' }: Readonly<{ label?: string }>) {
  const open = useUi((s) => s.openModal);
  return (
    <Button small onClick={() => open({ type: 'howto' })} title="Cómo usar StudyQuest paso a paso">
      <Icon name="help" size={12} /> {label}
    </Button>
  );
}
