import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { usePomodoro } from '@/state/pomodoro';
import { SESSION_XP_PER_MIN } from '@/core/game';
import { Button, ChipGroup, Field, Modal, NumberInput } from '@/ui/kit';

const MINUTES = [5, 10, 20, 30, 45, 60].map((m) => ({ value: m, label: `${m} min` }));

/**
 * Registrar una sesión de estudio: al instante («ya lo hice») o con temporizador en vivo.
 *
 * El temporizador en vivo vive en el Pomodoro (`state/pomodoro.ts`), no aquí: ese store
 * sobrevive a cambiar de pantalla y a recargar la página. Antes este modal tenía su propio
 * cronómetro local y, como una ventana modal se cierra sola con Escape o al tocar fuera,
 * cerrarla sin querer perdía toda la sesión en marcha. Ahora «Empezar» solo dice qué vas a
 * estudiar y por cuánto, y te lleva al Pomodoro ya con eso puesto.
 */
export function SessionModal({ courseId: initialCourse, minutes: initialMinutes }: { courseId?: string; minutes?: number }) {
  const close = useUi((s) => s.closeModal);
  const navigate = useNavigate();
  const { courses, logSession } = useData();
  const { setCourse, setConfig } = usePomodoro();
  const [courseId, setCourseId] = useState(initialCourse ?? courses[0]?.id ?? '');
  const [minutes, setMinutes] = useState(initialMinutes ?? 20);
  const [custom, setCustom] = useState(false);

  const startPomodoro = () => {
    setCourse(courseId || null);
    setConfig({ focus: minutes });
    close();
    navigate('/pomodoro');
  };

  const logNow = () => {
    if (minutes < 1) return;
    logSession({ minutes, courseId: courseId || null });
    close();
  };

  return (
    <Modal title="Sesión de estudio" kicker="// Tiempo" onClose={close}>
      <div className="form">
        <Field label="¿Qué vas a estudiar?">
          {(fid) => (
            <select id={fid} className="input" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">Estudio libre</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Duración">
          {() => (
            <>
              <ChipGroup
                label="Duración"
                value={custom ? -1 : minutes}
                options={[...MINUTES, { value: -1, label: 'Otro' }]}
                onChange={(v) => (v === -1 ? setCustom(true) : (setCustom(false), setMinutes(v)))}
              />
              {custom && <NumberInput className="input" min={1} max={480} value={minutes} onValue={(n) => setMinutes(n)} aria-label="Minutos" style={{ marginTop: 8 }} />}
            </>
          )}
        </Field>
        <p className="muted">
          Ganas <b className="xp-text">+{minutes * SESSION_XP_PER_MIN} XP</b> por estos {minutes} min.
        </p>

        <div className="session__choice">
          <p className="session__question">¿Vas a estudiar ahora, o ya terminaste?</p>
          <div className="modal__actions">
            <Button variant="primary" onClick={startPomodoro} title="Abre el Pomodoro con este curso y esta duración de enfoque ya puestos">
              ▶ Voy a estudiar: abrir el Pomodoro
            </Button>
            <Button variant="green" onClick={logNow} title="Marca estos minutos como estudiados ahora mismo, sin temporizador">
              ✔ Ya estudié: registrar {minutes} min
            </Button>
          </div>
          <p className="muted small">
            El Pomodoro sigue corriendo aunque cambies de pantalla: no se cancela por cerrar esta ventana ni por moverte a otra.
          </p>
        </div>

        <Button onClick={close}>Cancelar</Button>
      </div>
    </Modal>
  );
}
