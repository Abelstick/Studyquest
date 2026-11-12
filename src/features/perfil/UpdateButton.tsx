import { useState } from 'react';
import { useUi } from '@/state/ui';
import { updateApp } from '@/pwa/update';
import { Button } from '@/ui/kit';
import { Icon } from '@/ui/Icon';

/** Busca la última versión de la app y, si la hay, la carga. Para no esperar a que el navegador la encuentre solo. */
export function UpdateButton() {
  const toast = useUi((s) => s.toast);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const result = await updateApp();
      if (result === 'latest') {
        toast({ kind: 'info', title: 'Ya tienes la última versión', body: `StudyQuest v${__APP_VERSION__}` });
      } else if (result === 'unavailable') {
        // Sin service worker no hay versión guardada que cambiar: recargar ya trae lo último del servidor.
        location.reload();
        return;
      } else {
        toast({ kind: 'info', title: 'Versión nueva encontrada', body: 'La app se recarga en un momento.' });
        return; // se queda «buscando» hasta que la página se recargue
      }
    } catch (e) {
      console.warn('[update]', e);
      toast({ kind: 'error', title: 'No se pudo buscar la actualización', body: 'Revisa tu conexión e inténtalo otra vez.' });
    }
    setBusy(false);
  };

  return (
    <Button small onClick={() => void run()} disabled={busy} title="Comprueba si hay una versión nueva de la app y la carga">
      <Icon name="sync" size={12} /> {busy ? 'Buscando…' : 'Buscar actualización'}
    </Button>
  );
}
