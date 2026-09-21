/**
 * Modelos de Gemini con nivel gratuito, según la documentación de Google (ai.google.dev/gemini-api/docs/pricing, comprobado en
 * septiembre de 2026). Los modelos Pro NO tienen nivel gratuito, y `gemini-3.1-flash-lite` no figura como gratuito y tiene fecha de
 * retirada, por eso no están aquí. Los límites (peticiones por minuto, tokens por minuto y peticiones por día) se aplican por
 * proyecto **y por modelo**: cuando uno agota su cuota, otro modelo puede seguir funcionando.
 */
export interface FreeModel {
  id: string;
  name: string;
  note: string;
}

export const FREE_MODELS: FreeModel[] = [
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', note: 'El más inteligente de la familia Flash. Recomendado.' },
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', note: 'Generación anterior: una buena alternativa cuando el 3.8 agota su cuota.' },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', note: 'Generación anterior, con su propia cuota.' },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', note: 'Generación anterior, con su propia cuota.' },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite', note: 'Versión ligera: la más rápida y económica de la serie 3.5.' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', note: 'Serie 2.5, estable.' },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', note: 'Serie 2.5 ligera, estable.' },
];

export const DEFAULT_MODEL = 'gemini-3.8-flash';

/** Modelos de reserva por defecto: todos los gratuitos (el principal se descarta al armar la cadena). */
export const DEFAULT_FALLBACKS: string[] = FREE_MODELS.map((m) => m.id);

/** Solo letras, números, puntos y guiones: así un valor manipulado no puede colarse en la URL de la petición. */
export const isModelId = (id: unknown): id is string => typeof id === 'string' && /^[\w.-]{3,60}$/.test(id);

export const isFreeModel = (id: string) => FREE_MODELS.some((m) => m.id === id);

/** «Gemini 3.8 Flash» (o el id tal cual si no está en el catálogo). */
export const modelName = (id: string) => FREE_MODELS.find((m) => m.id === id)?.name ?? id;

/**
 * Orden en que se prueban los modelos: el principal y después los de reserva, sin repetir. Los que agotaron su cuota hace
 * poco (`cooling`) pasan al final, así no se malgasta una petición en uno que seguramente volverá a fallar.
 */
export function modelChain(primary: string, fallbacks: readonly string[], cooling: (id: string) => boolean = () => false): string[] {
  const all = [...new Set([primary, ...fallbacks.filter(isModelId)])];
  return [...all.filter((m) => !cooling(m)), ...all.filter((m) => cooling(m))];
}
