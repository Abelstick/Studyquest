/**
 * Buscar y aplicar la última versión a mano (botón de Perfil). La app instalada sigue viva en segundo plano
 * durante días y el navegador solo busca versiones nuevas de vez en cuando; esto lo fuerza al momento.
 */
export type UpdateResult =
  /** Había versión nueva: se activa y la página se recarga sola. */
  | 'updated'
  /** Ya estaba en la última. */
  | 'latest'
  /** No hay service worker (modo desarrollo o navegador sin soporte): no hay nada que actualizar así. */
  | 'unavailable';

/** Lo mínimo de `navigator.serviceWorker` que hace falta; así se puede probar sin navegador. */
export interface UpdateHost {
  getRegistration(): Promise<ServiceWorkerRegistration | undefined>;
  addEventListener(type: 'controllerchange', cb: () => void, options?: { once?: boolean }): void;
}

/** Espera a que la versión nueva termine de descargarse; null si la instalación falla. */
function whenInstalled(worker: ServiceWorker): Promise<ServiceWorker | null> {
  if (worker.state === 'installed' || worker.state === 'activated') return Promise.resolve(worker);
  if (worker.state === 'redundant') return Promise.resolve(null);
  return new Promise((resolve) => {
    const onChange = () => {
      if (worker.state === 'installing') return;
      worker.removeEventListener('statechange', onChange);
      resolve(worker.state === 'redundant' ? null : worker);
    };
    worker.addEventListener('statechange', onChange);
  });
}

/**
 * Pregunta al servidor si hay versión nueva y, si la hay, la activa y recarga. Sin conexión, rechaza.
 * El service worker generado (registerType «prompt») espera el mensaje SKIP_WAITING para tomar el control.
 */
export async function updateApp(host: UpdateHost | undefined = typeof navigator === 'undefined' ? undefined : navigator.serviceWorker, reload: () => void = () => location.reload()): Promise<UpdateResult> {
  const reg = await host?.getRegistration();
  if (!host || !reg) return 'unavailable';
  await reg.update();
  const worker = reg.waiting ?? (reg.installing ? await whenInstalled(reg.installing) : null);
  if (!worker) return 'latest';
  // Se recarga cuando la versión nueva ya controla la página, no antes: si no, volvería a cargar la vieja.
  host.addEventListener('controllerchange', reload, { once: true });
  worker.postMessage({ type: 'SKIP_WAITING' });
  return 'updated';
}
