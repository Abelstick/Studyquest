/**
 * Cliente de Gemini que se ejecuta en el navegador con la clave del propio usuario (la suya, con su cuota).
 * Usa el SDK oficial `@google/genai` y su Interactions API (`ai.interactions.create`). El SDK se descarga solo cuando se usa la IA.
 * La clave viaja únicamente hacia Google; nunca a un servidor de la app ni en la URL.
 */
import type { GoogleGenAI } from '@google/genai';
import { ROADMAP_SCHEMA, buildPrompt, roadmapFromText, type Roadmap, type RoadmapRequest } from '@/core/roadmap';
import { CARDS_SCHEMA, buildCardsPrompt, cardsFromText, type CardsRequest, type SmartCard } from '@/core/smartCards';

import { DEFAULT_MODEL, modelChain, modelName } from './models';

export { DEFAULT_MODEL };
const TIMEOUT_MS = 60_000;

/** Cuánto se aparta un modelo que acaba de agotar su cuota (los límites por minuto se renuevan enseguida; los diarios, a medianoche del Pacífico). */
export const COOLDOWN_MS = 5 * 60_000;
const cooldown = new Map<string, number>();
const coolKey = (apiKey: string, model: string) => `${apiKey.slice(-10)}|${model}`;
export const resetCooldowns = () => cooldown.clear();

export type AiErrorCode = 'cancelled' | 'no_key' | 'invalid_key' | 'rate_limited' | 'model' | 'network' | 'timeout' | 'bad_output' | 'upstream';

export class AiError extends Error {
  constructor(
    message: string,
    readonly code: AiErrorCode,
    /** Estado HTTP de Google, si lo hubo. */
    readonly status?: number,
  ) {
    super(message);
    this.name = 'AiError';
  }
}

/** Lo único que usamos del SDK (se puede sustituir en las pruebas). */
export type GenAiClient = Pick<GoogleGenAI, 'interactions' | 'models'>;

/** Por qué se pasó a otro modelo. */
export type SwitchReason = 'quota' | 'unavailable' | 'overloaded';

export interface AiConfig {
  apiKey: string;
  /** Modelo principal. */
  model: string;
  /** Modelos gratuitos de reserva: si el principal agota su cuota o no responde, se prueba el siguiente. */
  fallbackModels?: string[];
  /** Se llama al pasar de un modelo a otro (para avisar al usuario). */
  onSwitch?: (e: { from: string; to: string; reason: SwitchReason }) => void;
  /** Se llama con el modelo que finalmente respondió. */
  onUsed?: (model: string) => void;
  /** Inyectable para pruebas; por defecto se crea el cliente real de `@google/genai`. */
  client?: GenAiClient;
  /** Permite cancelar la petición en curso (botón «Cancelar»). */
  signal?: AbortSignal;
}

/** Quita las comillas, espacios y saltos de línea que suelen colarse al principio o al final al pegar. */
export function cleanKey(raw: string): string {
  const quotes = new Set(['"', "'", '`']);
  let key = raw.trim();
  while (key && quotes.has(key[0])) key = key.slice(1).trimStart();
  while (key && quotes.has(key[key.length - 1])) key = key.slice(0, -1).trimEnd();
  return key;
}

/**
 * Solo filtra errores evidentes de pegado (vacío, con espacios o saltos de línea, texto suelto). NO comprueba el formato de Google:
 * las claves antiguas empiezan por «AIza», pero desde mayo de 2026 AI Studio crea «auth keys» con otro aspecto, y Google no documenta
 * su formato. Quien decide si vale es Google, con la comprobación de «Probar y activar».
 */
export const looksLikeKey = (key: string): boolean => /^[!-~]{16,400}$/.test(key);

export const maskKey = (key: string): string => (key.length > 10 ? `${key.slice(0, 4)}••••••${key.slice(-4)}` : '••••••');

async function clientFor(cfg: AiConfig): Promise<GenAiClient> {
  if (!cfg.apiKey) throw new AiError('Primero activa las funciones inteligentes con tu clave de Gemini.', 'no_key');
  if (cfg.client) return cfg.client;
  const { GoogleGenAI } = await import('@google/genai');
  return new GoogleGenAI({ apiKey: cfg.apiKey });
}

/** Saca estado HTTP y mensaje de Google de un error del SDK (llega como `ApiError` o como errores con `body` JSON). */
function describe(e: unknown): { status?: number; message: string; reason?: string; name: string } {
  const err = (e ?? {}) as { status?: unknown; statusCode?: unknown; body?: unknown; message?: unknown; name?: unknown };
  const status = [err.status, err.statusCode].find((v): v is number => typeof v === 'number');
  let message = '';
  let reason: string | undefined;
  for (const raw of [err.body, err.message]) {
    if (typeof raw !== 'string') continue;
    try {
      const parsed = JSON.parse(raw) as unknown;
      const first = (Array.isArray(parsed) ? parsed[0] : parsed) as { error?: { message?: string; details?: { reason?: string }[] } } | undefined;
      if (first?.error?.message) {
        message = first.error.message;
        reason = first.error.details?.find((d) => d.reason)?.reason;
        break;
      }
    } catch {
      message ||= raw;
    }
  }
  return { status, message: message || (typeof err.message === 'string' ? err.message : ''), reason, name: typeof err.name === 'string' ? err.name : '' };
}

/** Traduce cualquier fallo del SDK a un mensaje entendible. Nunca incluye la clave. */
export function toAiError(e: unknown, cfg: Pick<AiConfig, 'apiKey' | 'model'>): AiError {
  if (e instanceof AiError) return e;
  const { status, message, reason, name } = describe(e);
  if (status === 429) return new AiError('Se agotó la cuota gratuita de tu clave (por minuto o por día). Espera un poco e inténtalo otra vez.', 'rate_limited');
  if (status === 401 || status === 403 || reason === 'API_KEY_INVALID' || (status === 400 && /api key|api_key/i.test(message))) {
    return new AiError('Google no aceptó tu clave. Comprueba que esté bien copiada y activa (o crea una nueva en Google AI Studio).', 'invalid_key');
  }
  if (status === 404) return new AiError(`El modelo «${cfg.model}» no está disponible para tu clave. Prueba con otro en los ajustes de IA.`, 'model');
  if (/RequestTimeout|RequestAborted/.test(name) || /timed? ?out|abort/i.test(message)) return new AiError('Gemini tardó demasiado en responder. Inténtalo otra vez.', 'timeout');
  if (/ConnectionError/.test(name) || e instanceof TypeError || /failed to fetch|fetch failed|network|load failed/i.test(message)) {
    return new AiError('Sin conexión con Google. Comprueba tu internet.', 'network');
  }
  const detail = message && cfg.apiKey ? message.replaceAll(cfg.apiKey, '***').slice(0, 160) : message.slice(0, 160);
  return new AiError(`Gemini rechazó la petición${status ? ` (${status})` : ''}${detail ? `: ${detail}` : '.'}`, 'upstream', status);
}

/** Una petición a la Interactions API con UN modelo. `store: false`: Google no guarda la conversación. */
async function generateOnce(cfg: AiConfig, model: string, system: string, user: string, schema: Record<string, unknown>): Promise<string | undefined> {
  // Una sola señal para las dos cosas que pueden cortar la espera: el botón «Cancelar» y el tiempo máximo.
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);
  const onCancel = () => controller.abort();
  cfg.signal?.addEventListener('abort', onCancel);
  try {
    if (cfg.signal?.aborted) throw new AiError('Cancelado.', 'cancelled');
    const client = await clientFor(cfg);
    const interaction = await client.interactions.create(
      { model, input: user, system_instruction: system, store: false, response_format: { type: 'text', mime_type: 'application/json', schema } },
      { maxRetries: 0, fetchOptions: { signal: controller.signal } }, // sin reintentos automáticos: no gastar cuota de más
    );
    return interaction.output_text;
  } catch (e) {
    if (cfg.signal?.aborted) throw new AiError('Cancelado.', 'cancelled');
    if (timedOut) throw new AiError('Gemini tardó demasiado en responder. Inténtalo otra vez.', 'timeout');
    throw toAiError(e, { apiKey: cfg.apiKey, model });
  } finally {
    clearTimeout(timer);
    cfg.signal?.removeEventListener('abort', onCancel);
  }
}

const switchReason = (e: AiError): SwitchReason | null => (e.code === 'rate_limited' ? 'quota' : e.code === 'model' ? 'unavailable' : e.code === 'upstream' && e.status === 503 ? 'overloaded' : null);

/**
 * Prueba los modelos en orden (principal y reservas). Si uno agota su cuota (429), no existe para tu clave (404) o está saturado
 * (503), pasa al siguiente y lo avisa; los demás errores (clave inválida, cancelación, tiempo agotado…) se muestran tal cual.
 */
async function generateJson(cfg: AiConfig, system: string, user: string, schema: Record<string, unknown>): Promise<string | undefined> {
  const chain = modelChain(cfg.model, cfg.fallbackModels ?? [], (m) => (cooldown.get(coolKey(cfg.apiKey, m)) ?? 0) > Date.now());
  const failures: AiError[] = [];
  for (const [i, model] of chain.entries()) {
    try {
      const text = await generateOnce(cfg, model, system, user, schema);
      cooldown.delete(coolKey(cfg.apiKey, model));
      cfg.onUsed?.(model);
      return text;
    } catch (e) {
      const err = e instanceof AiError ? e : toAiError(e, { apiKey: cfg.apiKey, model });
      const reason = switchReason(err);
      if (err.code === 'rate_limited') cooldown.set(coolKey(cfg.apiKey, model), Date.now() + COOLDOWN_MS);
      const next = chain[i + 1];
      if (!reason || next === undefined) {
        failures.push(err);
        break;
      }
      failures.push(err);
      cfg.onSwitch?.({ from: model, to: next, reason });
    }
  }
  const last = failures.at(-1)!;
  if (failures.length > 1 && failures.every((f) => f.code === 'rate_limited')) {
    const tried = chain.slice(0, failures.length).map(modelName).join(', ');
    throw new AiError(`Se agotó la cuota gratuita de todos los modelos que probé (${tried}). Espera unos minutos (los límites por minuto se renuevan enseguida; los diarios, a medianoche, hora del Pacífico) o inténtalo mañana.`, 'rate_limited', 429);
  }
  throw last;
}

/** Comprueba que Google acepta la clave, sin gastar cuota de generación. (El modelo se comprueba al usarlo.) */
export async function testKey(cfg: AiConfig): Promise<void> {
  try {
    const client = await clientFor(cfg);
    await client.models.list({ config: { pageSize: 1 } });
  } catch (e) {
    throw toAiError(e, cfg);
  }
}

export async function generateRoadmap(cfg: AiConfig, req: RoadmapRequest): Promise<Roadmap> {
  const { system, user } = buildPrompt(req);
  const roadmap = roadmapFromText(await generateJson(cfg, system, user, ROADMAP_SCHEMA), req.goal);
  if (!roadmap) throw new AiError('La IA no devolvió una ruta utilizable. Inténtalo de nuevo o usa una plantilla.', 'bad_output');
  return roadmap;
}

export async function generateCards(cfg: AiConfig, req: CardsRequest): Promise<SmartCard[]> {
  const { system, user } = buildCardsPrompt(req);
  const cards = cardsFromText(await generateJson(cfg, system, user, CARDS_SCHEMA), req.existing);
  if (!cards.length) throw new AiError('La IA no devolvió tarjetas nuevas. Inténtalo otra vez.', 'bad_output');
  return cards;
}
