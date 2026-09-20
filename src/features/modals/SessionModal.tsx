import { useEffect, useRef, useState } from 'react';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { SESSION_XP_PER_MIN } from '@/core/game';
import { Button, ChipGroup, Field, Modal, Bar } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';
import { sfx } from '@/audio/sfx';

const MINUTES = [5, 10, 20, 30, 45, 60].map((m) => ({ value: m, label: `${m} min` }));
const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/** Sesión de estudio: temporizador (estilo "tiempo restante" de Mario) o registro manual. */
export function SessionModal({ courseId: initialCourse, minutes: initialMinutes }: { courseId?: string; minutes?: number }) {
  const close = useUi((s) => s.closeModal);
  const { courses, logSession } = useData();
  const [courseId, setCourseId] = useState(initialCourse ?? courses[0]?.id ?? '');
  const [minutes, setMinutes] = useState(initialMinutes ?? 20);
  const [custom, setCustom] = useState(false);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const finished = useRef(false);

  const running = endsAt !== null;
  const total = minutes * 60_000;
  const left = endsAt ? endsAt - now : total;

  const save = (mins: number) => {
    if (finished.current || mins < 1) return;
    finished.current = true;
    logSession({ minutes: mins, courseId: courseId || null });
    close();
  };

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (running && endsAt && now >= endsAt) {
      sfx.levelUp();
      save(minutes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  const start = () => {
    const t = Date.now();
    setStartedAt(t);
    setNow(t);
    setEndsAt(t + total);
    sfx.jump();
  };

  const elapsedMin = Math.floor((now - startedAt) / 60_000);

  return (
    <Modal title={running ? 'Sesión en curso' : 'Sesión de estudio'} kicker="// Tiempo" onClose={close}>
      {!running ? (
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
                {custom && <input className="input" type="number" min={1} max={480} value={minutes} onChange={(e) => setMinutes(Math.max(1, Number(e.target.value)))} aria-label="Minutos" style={{ marginTop: 8 }} />}
              </>
            )}
          </Field>
          <p className="muted">
            Ganas <b className="xp-text">+{minutes * SESSION_XP_PER_MIN} XP</b> al terminar.
          </p>
          <div className="modal__actions">
            <Button variant="primary" onClick={start}>
              ▶ Empezar
            </Button>
            <Button onClick={() => save(minutes)} title="Registrar el tiempo sin usar el temporizador">
              Ya lo hice
            </Button>
            <Button onClick={close}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <div className="timer">
          <Sprite name="pacman" size={40} className="timer__sprite" />
          <p className="timer__clock" aria-live="off">
            {fmt(left)}
          </p>
          <Bar pct={((total - left) / total) * 100} tone="yellow" tall label="Progreso de la sesión" />
          <p className="muted">Concéntrate: cada minuto vale {SESSION_XP_PER_MIN} XP.</p>
          <div className="modal__actions modal__actions--center">
            <Button variant="green" onClick={() => save(Math.max(1, elapsedMin))} disabled={elapsedMin < 1} title={elapsedMin < 1 ? 'Espera al menos un minuto' : undefined}>
              Terminar ahora ({Math.max(0, elapsedMin)} min)
            </Button>
            <Button variant="danger" onClick={close}>
              Descartar
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
