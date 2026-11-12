/**
 * Lo que llega al compartir hacia la app desde otra (menú «Compartir» de Android): se convierte en el
 * título de una tarea nueva. Chrome suele mandar el título de la página y el enlace dentro de `text`.
 */
export interface SharedContent {
  title?: string | null;
  text?: string | null;
  url?: string | null;
}

/** Tope para que un texto largo compartido no se convierta en un título imposible de leer. */
export const SHARED_TITLE_MAX = 160;

const URL_RE = /https?:\/\/\S+/i;

const clean = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim();

/** Título propuesto para la tarea: el texto (sin el enlace repetido) y, detrás, el enlace. Vacío si no llegó nada. */
export function sharedTaskTitle(shared: SharedContent): string {
  const text = clean(shared.text);
  const link = clean(shared.url) || (URL_RE.exec(text)?.[0] ?? '');
  const words = clean(shared.title) || clean(link ? text.replace(link, '') : text);
  if (!words) return link;
  if (!link) return words.slice(0, SHARED_TITLE_MAX);
  // El enlace va entero o no sirve: lo que se recorta es el texto.
  const room = Math.max(0, SHARED_TITLE_MAX - link.length - 3);
  return room >= 12 ? `${words.slice(0, room)} · ${link}` : words.slice(0, SHARED_TITLE_MAX);
}
