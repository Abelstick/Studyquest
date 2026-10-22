import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { overdueOf } from '@/core/pace';
import { Button } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';

/** Desde cuántas tareas vencidas se ofrece retomar el plan. Con una sola, la etiqueta roja de la tarea basta. */
const MIN_LATE = 2;

/** Aviso amable para quien volvió tras días sin usar la app: ofrece reprogramar sin culpas. */
export function LateBanner() {
  const late = useData((s) => overdueOf(s.tasks));
  const openModal = useUi((s) => s.openModal);
  if (late < MIN_LATE) return null;
  return (
    <section className="panel catchup" role="status">
      <Sprite name="qblock" size={24} />
      <p className="grow">
        <b>Tienes {late} tareas con la fecha vencida.</b> Es normal si pasaron días sin usar la app: dinos cuáles ya hiciste y mueve el resto para seguir desde hoy.
      </p>
      <Button small variant="primary" onClick={() => openModal({ type: 'pace' })}>
        Retomar mi plan
      </Button>
    </section>
  );
}
