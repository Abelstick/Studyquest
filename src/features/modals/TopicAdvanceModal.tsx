import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { topicXp } from '@/core/game';
import { Button, Modal, Tag } from '@/ui/kit';
import { Icon } from '@/ui/Icon';

/** Cuántos temas pendientes se ofrecen: los siguientes del curso, que son los que se estudian ahora. */
const SHOWN = 6;

/**
 * «¿Qué tema avanzaste?»: tras una sesión de estudio, marca de un toque el tema que terminaste o el que dejaste a
 * medias, sin ir a buscarlo en el curso. Terminar un tema da su XP, igual que desde la ficha del curso.
 */
export function TopicAdvanceModal({ courseId }: Readonly<{ courseId: string }>) {
  const close = useUi((s) => s.closeModal);
  const course = useData((s) => s.courses.find((c) => c.id === courseId));
  const setTopicStatus = useData((s) => s.setTopicStatus);
  if (!course) return null;

  const pending = course.modules.flatMap((m) => m.topics.filter((t) => t.status !== 'done').map((t) => ({ topic: t, module: m })));
  // Primero lo que ya empezaste, después lo siguiente del temario.
  const ordered = [...pending.filter((x) => x.topic.status === 'doing'), ...pending.filter((x) => x.topic.status === 'todo')].slice(0, SHOWN);

  return (
    <Modal title="¿Qué tema avanzaste?" kicker={course.title} onClose={close}>
      <div className="form">
        {ordered.length === 0 ? (
          <p className="muted">No quedan temas por hacer en este curso. ¡Bien hecho!</p>
        ) : (
          <>
            <p className="muted small">Marca el que terminaste o el que dejaste a medias. Puedes marcar varios y cerrar cuando acabes.</p>
            <ul className="stack">
              {ordered.map(({ topic, module }) => (
                <li key={topic.id} className="tadv">
                  <div className="tadv__text">
                    <b>{topic.title}</b>
                    <span className="muted small">{module.title}</span>
                  </div>
                  {topic.status === 'doing' && <Tag tone="blue">En progreso</Tag>}
                  {topic.status === 'todo' && (
                    <Button small onClick={() => setTopicStatus(course.id, topic.id, 'doing')} aria-label={`Voy por aquí: ${topic.title}`}>
                      Voy por aquí
                    </Button>
                  )}
                  <Button small variant="green" onClick={() => setTopicStatus(course.id, topic.id, 'done')} title={`Terminar el tema: +${topicXp(module)} XP`} aria-label={`Terminé: ${topic.title}`}>
                    <Icon name="check" size={10} /> Terminé
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="modal__actions">
          <Button variant="primary" onClick={close}>
            Listo
          </Button>
        </div>
      </div>
    </Modal>
  );
}
