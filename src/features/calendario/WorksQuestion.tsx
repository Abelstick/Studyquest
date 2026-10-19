import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { findRoutine } from '@/core/routine';
import { Button } from '@/ui/kit';

/**
 * «¿Trabajas?»: la pregunta que hace falta para repartir tareas y hábitos fuera de tu horario laboral. Si ya contestaste
 * (o ya hay una jornada en el calendario), no aparece. Con «Sí» abre «Mi semana»; con «No» se recuerda y no vuelve a preguntar.
 */
export function WorksQuestion({ className }: Readonly<{ className?: string }>) {
  const works = useData((s) => s.profile.works);
  const hasWork = useData((s) => !!findRoutine(s.events).work);
  const updateProfile = useData((s) => s.updateProfile);
  const openModal = useUi((s) => s.openModal);
  if (works !== undefined || hasWork) return null;
  return (
    <div className={className ? `worksq ${className}` : 'worksq'} role="group" aria-label="¿Trabajas?">
      <p>
        <b>¿Trabajas?</b> Si me dices tu horario, pongo tareas y hábitos fuera de él y no en medio de tu jornada.
      </p>
      <div className="row">
        <Button small variant="primary" onClick={() => openModal({ type: 'routine' })}>
          Sí, contar mi horario
        </Button>
        <Button small onClick={() => updateProfile({ works: false })}>
          No trabajo
        </Button>
      </div>
    </div>
  );
}
