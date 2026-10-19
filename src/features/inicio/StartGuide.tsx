import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { habitsWithoutTime } from '@/core/routine';
import { Button, cx } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';

const HIDDEN_KEY = 'sq.start.hidden';

const isHidden = (): boolean => {
  try {
    return localStorage.getItem(HIDDEN_KEY) === '1';
  } catch {
    return false;
  }
};

interface Step {
  id: string;
  title: string;
  body: string;
  done: boolean;
  /** Botón que lo resuelve. */
  cta: ReactNode;
  /** No tiene sentido todavía (falta un paso anterior). */
  waiting?: boolean;
}

/**
 * «Empieza aquí»: el camino más corto para quien no sabe por dónde empezar. Cinco pasos, siempre en el mismo orden
 * (contar la semana, elegir qué lograr, crear un hábito pequeño, ponerle hora, hacer la primera acción). Se deduce de
 * lo que ya existe, así que no hay nada que marcar a mano; marca el siguiente y se esconde al terminar o al descartarlo.
 */
export function StartGuide({ always }: Readonly<{ always?: boolean }>) {
  const events = useData((s) => s.events);
  const works = useData((s) => s.profile.works);
  const goals = useData((s) => s.goals);
  const courses = useData((s) => s.courses);
  const habits = useData((s) => s.habits);
  const xpEvents = useData((s) => s.xpEvents);
  const openModal = useUi((s) => s.openModal);
  const [hidden, setHidden] = useState(isHidden);

  const steps: Step[] = [
    {
      id: 'week', title: 'Cuenta cómo es tu semana', body: '¿Trabajas? Si sí, tu horario; y cuándo duermes. Así sé cuándo tienes tiempo libre y te sugiero día y hora para cada tarea y hábito.',
      done: events.length > 0 || works !== undefined, cta: <Button variant="primary" onClick={() => openModal({ type: 'routine' })}>Armar mi semana</Button>,
    },
    {
      id: 'goal', title: 'Elige qué quieres lograr', body: 'Un curso o una meta (aprender SQL, inglés B1…). El planificador reparte el trabajo en fechas según tu tiempo libre.',
      done: goals.length + courses.length > 0, cta: <Link className="btn btn--primary" to="/planificador">Planificar con el asistente</Link>,
    },
    {
      id: 'habit', title: 'Crea un hábito pequeño', body: 'Algo de 10 o 20 minutos que puedas repetir (estudiar, leer, caminar). Mejor pequeño y constante que grande y abandonado.',
      done: habits.length > 0, cta: <Button variant="primary" onClick={() => openModal({ type: 'habit' })}>Crear un hábito</Button>,
    },
    {
      id: 'time', title: 'Ponle hora a tus hábitos', body: 'La app propone la hora libre más natural y la deja en tu calendario, lista para llevarla a Google Calendar.',
      done: habits.length > 0 && habitsWithoutTime(habits, events).length === 0, waiting: habits.length === 0,
      cta: <Button variant="primary" onClick={() => openModal({ type: 'routine' })}>Elegir las horas</Button>,
    },
    {
      id: 'go', title: 'Haz tu primera acción', body: 'Diez minutos bastan. Lo importante es empezar: ganas XP y la racha arranca.',
      done: xpEvents.some((e) => e.amount > 0), cta: <Button variant="primary" onClick={() => openModal({ type: 'session', minutes: 10 })}>Estudiar 10 minutos</Button>,
    },
  ];
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length || (hidden && !always)) return null;
  const current = steps.find((s) => !s.done && !s.waiting) ?? steps.find((s) => !s.done);

  const hide = () => {
    setHidden(true);
    try {
      localStorage.setItem(HIDDEN_KEY, '1');
    } catch {
      // Sin almacenamiento la guía volverá a salir la próxima vez; no pasa nada.
    }
  };

  return (
    <section className="panel startguide" aria-labelledby="startguide-title">
      <div className="split">
        <div>
          <p className="kicker">// Empieza aquí · {done} de {steps.length}</p>
          <h2 id="startguide-title" className="panel__title">
            ¿Por dónde empiezo?
          </h2>
        </div>
        <div className="row">
          <Button small onClick={() => openModal({ type: 'howto' })}>
            ❓ Guía completa
          </Button>
          {!always && (
            <Button small variant="ghost" onClick={hide}>
              Ya sé usarla
            </Button>
          )}
        </div>
      </div>
      {current && (
        <div className="startguide__now">
          <Sprite name="star" size={32} />
          <div>
            <p className="kicker">Tu siguiente paso</p>
            <h3 className="startguide__title">{current.title}</h3>
            <p className="muted">{current.body}</p>
          </div>
          <div className="startguide__cta">{current.cta}</div>
        </div>
      )}
      <ol className="startguide__list" aria-label="Pasos">
        {steps.map((s) => (
          <li key={s.id} className={cx(s.done && 'is-done', s.id === current?.id && 'is-now')}>
            <span aria-hidden="true">{s.done ? '✔' : s.id === current?.id ? '▶' : '○'}</span> {s.title}
            <span className="sr-only">{s.done ? ' (hecho)' : ''}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
