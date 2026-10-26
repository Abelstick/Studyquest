import { deadlineSummary, paceText, type CourseDeadline } from '@/core/courseDeadline';
import { Icon } from '@/ui/Icon';
import { cx } from '@/ui/kit';

interface Props {
  d: CourseDeadline;
  /** Abre la edición del curso para fijar el plazo; sin esto, un curso sin plazo solo dice que no lo tiene. */
  onSet?: () => void;
  /** Nombre del curso: da un nombre distinto a cada «Fijar plazo» cuando hay varios en pantalla. */
  course?: string;
  className?: string;
}

/**
 * Hasta cuándo tienes para terminar un curso: la fecha, cuánto falta, de dónde sale (la fijaste tú o la deduce la
 * última tarea) y el ritmo de temas por semana que hace falta. Rojo si venció, destacado si termina en una semana.
 */
export function DeadlineLine({ d, onSet, course, className }: Readonly<Props>) {
  const pace = paceText(d);
  return (
    <p className={cx('cdead', `cdead--${d.state}`, className)}>
      <Icon name="flag" size={11} />
      <span className="cdead__text">{deadlineSummary(d)}</span>
      {d.state === 'soon' && <span className="sr-only">Termina pronto.</span>}
      {d.source === 'tasks' && d.state !== 'done' && <span className="muted small">según tus tareas</span>}
      {d.state === 'none' && onSet && (
        <button type="button" className="link" onClick={onSet} aria-label={course ? `Fijar plazo de ${course}` : undefined}>
          Fijar plazo
        </button>
      )}
      {pace && <span className="muted small cdead__pace">{pace}</span>}
      {d.atRisk && d.state !== 'late' && <span className="rwarn">Ritmo insuficiente</span>}
    </p>
  );
}
