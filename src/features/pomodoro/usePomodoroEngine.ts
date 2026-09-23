import { useEffect } from 'react';
import { sfx } from '@/audio/sfx';
import { usePomodoro } from '@/state/pomodoro';
import { useUi } from '@/state/ui';
import { PHASE_LABEL, formatClock } from '@/core/pomodoro';
import { startMusic, stopMusic } from '@/audio/music';

/**
 * Motor del Pomodoro: cierra las fases, pone la música de fondo y muestra la cuenta atrás en el título de la pestaña.
 * Se monta una sola vez en AppShell, para que el temporizador siga vivo al cambiar de pantalla.
 */
export function usePomodoroEngine() {
  const status = usePomodoro((s) => s.status);
  const phase = usePomodoro((s) => s.phase);
  const tick = usePomodoro((s) => s.tick);
  const music = useUi((s) => s.music);
  const sound = useUi((s) => s.sound);

  useEffect(() => {
    if (status !== 'running') return;
    const base = document.title;
    let lastBeep = 0; // para no repetir el pitido dentro del mismo segundo
    const update = () => {
      const now = Date.now();
      tick(now);
      const { endsAt, phase: p, status: st } = usePomodoro.getState();
      // Últimos 5 segundos: cuenta atrás, como el aviso de tiempo de un nivel.
      if (st === 'running' && endsAt) {
        const left = Math.ceil((endsAt - now) / 1000);
        if (left > 0 && left <= 5 && left !== lastBeep) {
          lastBeep = left;
          sfx.tick();
        }
      }
      document.title = st === 'running' && endsAt ? `${formatClock(endsAt - now)} · ${PHASE_LABEL[p]} — StudyQuest` : base;
    };
    update();
    const t = setInterval(update, 500);
    document.addEventListener('visibilitychange', update);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', update);
      document.title = base;
    };
  }, [status, tick]);

  useEffect(() => {
    if (status === 'running' && music && sound) startMusic(phase === 'focus' ? 'focus' : 'break');
    else stopMusic();
    return () => stopMusic();
  }, [status, phase, music, sound]);
}
