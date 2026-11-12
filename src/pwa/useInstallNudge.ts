import { useEffect, useRef } from 'react';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { useInstallPrompt } from './hooks';

const KEY = 'sq:install-nudge';

/** Ya se ofreció en este dispositivo. Sin acceso al almacenamiento (modo privado) cuenta como ofrecido: mejor callar que insistir. */
function alreadyNudged(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return true;
  }
}
function rememberNudge(): void {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* modo privado: no pasa nada, el aviso ya se mostró en esta sesión */
  }
}

/**
 * Ofrece instalar la app justo después de ganar XP por primera vez en la sesión: es cuando se le ve el sentido.
 * Una sola vez por dispositivo; después, el botón sigue en Perfil.
 */
export function useInstallNudge(): void {
  const { canInstall, install } = useInstallPrompt();
  const earned = useData((s) => s.xpEvents.length);
  const atStart = useRef(earned);
  const run = useRef(install);
  useEffect(() => {
    run.current = install;
  });

  useEffect(() => {
    if (!canInstall || earned <= atStart.current || alreadyNudged()) return;
    rememberNudge();
    useUi.getState().toast({
      kind: 'info',
      title: 'Lleva StudyQuest en tu celular',
      body: 'Instálala para abrirla como una app, con avisos y sin conexión.',
      action: { label: 'Instalar', run: () => void run.current() },
    });
  }, [canInstall, earned]);
}
