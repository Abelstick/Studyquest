/** Planes «si ocurre X, haré Y» (intenciones de implementación). Funciones puras. */
import type { IfThen } from './domain';
import { newId } from './dates';

export const MAX_IF_THEN = 3;
const MAX_TEXT = 140;

const squash = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT) : '');

/** Limpia la lista que llega de un formulario o de una copia: recorta, descarta los incompletos y limita la cantidad. */
export function cleanIfThen(raw: unknown, makeId: () => string = newId): IfThen[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: IfThen[] = [];
  for (const x of raw) {
    if (typeof x !== 'object' || x === null) continue;
    const o = x as Record<string, unknown>;
    const when = squash(o.when);
    const then = squash(o.then);
    if (!when || !then) continue;
    out.push({ id: typeof o.id === 'string' && o.id ? o.id : makeId(), when, then });
    if (out.length === MAX_IF_THEN) break;
  }
  return out.length ? out : undefined;
}

/** «Si termino cansado → descanso 15 min». El «si» se quita si el usuario ya lo escribió. */
export const ifThenText = (p: Pick<IfThen, 'when' | 'then'>): { when: string; then: string } => ({
  when: p.when.replace(/^si\s+/i, ''),
  then: p.then,
});
