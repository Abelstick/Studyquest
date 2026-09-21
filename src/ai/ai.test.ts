import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiError, DEFAULT_MODEL, COOLDOWN_MS, cleanKey, resetCooldowns, generateCards, generateRoadmap, looksLikeKey, maskKey, testKey, type GenAiClient } from './gemini';
import { createAiStore, type KeyStorage } from './store';
import { DEFAULT_FALLBACKS, FREE_MODELS, isFreeModel, isModelId, modelChain, modelName } from './models';
import { cardsFromText } from '@/core/smartCards';

const KEY = 'AIzaSyA-1234567890abcdefghijklmnopqrstu';
const roadmapJson = { summary: 's', modules: [{ title: 'A', hours: 10, topics: ['a1'] }, { title: 'B', hours: 5, topics: ['b1'] }], project: { title: 'P', hours: 8, steps: ['p1'] } };

describe('formato de la clave', () => {
  it('limpia comillas y espacios al pegar', () => {
    expect(cleanKey(`  "${KEY}"\n`)).toBe(KEY);
    expect(cleanKey(`'${KEY}'`)).toBe(KEY);
  });
  it('acepta el formato clásico (AIza…) y el de las «auth keys» nuevas, que Google no documenta (pueden llevar puntos, ser más largas…)', () => {
    expect(looksLikeKey(KEY)).toBe(true);
    expect(looksLikeKey('AQ.Ab8RN6Kexample_key-with.dots~and+symbols=1234567890')).toBe(true);
    expect(looksLikeKey('x'.repeat(200))).toBe(true);
  });
  it('rechaza solo lo que evidentemente no es una clave', () => {
    expect(looksLikeKey('')).toBe(false);
    expect(looksLikeKey('corta')).toBe(false);
    expect(looksLikeKey('con espacios en medio de la clave falsa')).toBe(false);
    expect(looksLikeKey(['clave-larga-pero', 'con-salto-de-linea-dentro'].join(String.fromCharCode(10)))).toBe(false);
    expect(looksLikeKey('clavé-con-acento-y-más-cosas-largas')).toBe(false);
    expect(looksLikeKey('x'.repeat(401))).toBe(false);
  });
  it('al pegar solo recorta los bordes: una frase con espacios no se convierte en «clave»', () => {
    expect(cleanKey('esto no es una clave real de google')).toBe('esto no es una clave real de google');
    expect(looksLikeKey(cleanKey('esto no es una clave real de google'))).toBe(false);
  });
  it('enmascara la clave para mostrarla', () => {
    expect(maskKey(KEY)).toBe('AIza••••••rstu');
    expect(maskKey(KEY)).not.toContain('1234567890');
  });
});

/** Errores con la forma real que devuelve @google/genai (capturada contra la API con una clave falsa). */
const sdkError = (name: string, status: number, message: string, reason?: string) =>
  Object.assign(new Error(`${status} API error occurred: {"httpMeta":{"response":{},"request":{}}}`), {
    name,
    status,
    statusCode: status,
    body: JSON.stringify([{ error: { code: status, message, status: 'X', details: reason ? [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason }] : [] } }]),
  });
const apiError = (status: number, message: string) => Object.assign(new Error(JSON.stringify({ error: { code: status, message } })), { name: 'ApiError', status });

const fakeClient = (create: ReturnType<typeof vi.fn>, list: ReturnType<typeof vi.fn> = vi.fn(async () => ({}))) => ({ interactions: { create }, models: { list } }) as unknown as GenAiClient;
const cfg = (client: GenAiClient, model = DEFAULT_MODEL) => ({ apiKey: KEY, model, client });
const out = (text: unknown) => vi.fn(async () => ({ id: 'i1', output_text: typeof text === 'string' ? text : JSON.stringify(text) }));
const req = { goal: 'Análisis de datos', level: 'beginner' as const, weeks: 12, hoursPerWeek: 8 };

describe('cliente de Gemini (SDK @google/genai, Interactions API)', () => {
  it('usa el modelo 3.8 flash por defecto', () => {
    expect(DEFAULT_MODEL).toBe('gemini-3.8-flash');
  });

  it('pide JSON con esquema, con instrucciones de sistema, sin guardar la conversación y sin reintentos', async () => {
    const create = out(roadmapJson);
    const r = await generateRoadmap(cfg(fakeClient(create)), req);
    expect(r.modules).toHaveLength(2);
    const [params, options] = create.mock.calls[0] as unknown as [Record<string, unknown>, Record<string, unknown>];
    expect(params.model).toBe('gemini-3.8-flash');
    expect(params.store).toBe(false); // Google no retiene la petición
    expect(String(params.input)).toContain('Análisis de datos');
    expect(String(params.system_instruction)).toMatch(/JSON/);
    expect(params.response_format).toMatchObject({ type: 'text', mime_type: 'application/json', schema: { type: 'object', required: expect.arrayContaining(['modules']) } });
    expect(options).toMatchObject({ maxRetries: 0 });
    expect((options.fetchOptions as { signal: AbortSignal }).signal).toBeInstanceOf(AbortSignal); // permite cancelar y cortar por tiempo
  });

  it('la clave nunca va dentro de la petición (el SDK la manda en la cabecera)', async () => {
    const create = out(roadmapJson);
    await generateRoadmap(cfg(fakeClient(create)), req);
    expect(JSON.stringify(create.mock.calls)).not.toContain(KEY);
  });

  it('acepta el JSON envuelto en un bloque de código', async () => {
    const r = await generateRoadmap(cfg(fakeClient(out('```json\n' + JSON.stringify(roadmapJson) + '\n```'))), req);
    expect(r.modules).toHaveLength(2);
  });

  it('sin clave no llama a nadie', async () => {
    const create = out({});
    const list = vi.fn();
    await expect(testKey({ apiKey: '', model: 'm', client: fakeClient(create, list) })).rejects.toMatchObject({ code: 'no_key' });
    await expect(generateRoadmap({ apiKey: '', model: 'm', client: fakeClient(create, list) }, req)).rejects.toMatchObject({ code: 'no_key' });
    expect(create).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
  });

  it('comprobar la clave lista un modelo (no gasta cuota de generación)', async () => {
    const create = out({});
    const list = vi.fn(async () => ({}));
    await testKey(cfg(fakeClient(create, list)));
    expect(list).toHaveBeenCalledWith({ config: { pageSize: 1 } });
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    ['clave inválida (error real de la API)', sdkError('BadRequestError', 400, 'API key not valid. Please pass a valid API key.', 'API_KEY_INVALID'), 'invalid_key'],
    ['clave inválida (ApiError de models)', apiError(400, 'API key not valid. Please pass a valid API key.'), 'invalid_key'],
    ['403', sdkError('PermissionDeniedError', 403, 'forbidden'), 'invalid_key'],
    ['401', sdkError('AuthenticationError', 401, 'unauthenticated'), 'invalid_key'],
    ['cuota (429)', sdkError('RateLimitError', 429, 'quota exceeded'), 'rate_limited'],
    ['modelo inexistente (404)', sdkError('NotFoundError', 404, 'model not found'), 'model'],
    ['tiempo agotado', Object.assign(new Error('Request timed out'), { name: 'RequestTimeoutError' }), 'timeout'],
    ['petición abortada', Object.assign(new Error('aborted'), { name: 'RequestAbortedError' }), 'timeout'],
    ['sin red', new TypeError('fetch failed'), 'network'],
    ['sin conexión (SDK)', Object.assign(new Error('Connection error.'), { name: 'ConnectionError' }), 'network'],
    ['error del servidor', sdkError('InternalServerError', 500, 'boom'), 'upstream'],
  ])('traduce «%s» a un mensaje entendible', async (_, error, code) => {
    const e = await generateRoadmap(cfg(fakeClient(vi.fn(async () => { throw error; }))), req).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(AiError);
    expect((e as AiError).code).toBe(code);
    expect((e as AiError).message).not.toContain(KEY);
  });

  it('un 400 que no es de la clave muestra el motivo (para poder corregir el modelo) y nunca la clave', async () => {
    const error = sdkError('BadRequestError', 400, `Unsupported value for thinking_level (key ${KEY})`);
    const e = (await generateRoadmap(cfg(fakeClient(vi.fn(async () => { throw error; }))), req).catch((x: unknown) => x)) as AiError;
    expect(e.code).toBe('upstream');
    expect(e.message).toContain('Unsupported value');
    expect(e.message).not.toContain(KEY);
    expect(e.message).toContain('***');
  });

  it('los fallos al comprobar la clave se traducen igual', async () => {
    const list = vi.fn(async () => { throw apiError(400, 'API key not valid. Please pass a valid API key.'); });
    await expect(testKey(cfg(fakeClient(out({}), list)))).rejects.toMatchObject({ code: 'invalid_key' });
  });

  it('una respuesta vacía o ilegible es un error claro, no una pantalla rota', async () => {
    await expect(generateRoadmap(cfg(fakeClient(vi.fn(async () => ({})))), req)).rejects.toMatchObject({ code: 'bad_output' });
    await expect(generateRoadmap(cfg(fakeClient(out('no es json'))), req)).rejects.toMatchObject({ code: 'bad_output' });
    await expect(generateCards(cfg(fakeClient(out({ cards: [] }))), { topic: 't', course: 'c', count: 3, existing: [] })).rejects.toMatchObject({ code: 'bad_output' });
  });

  it('genera tarjetas limpias y sin repetir las que ya existen', async () => {
    const create = out({ cards: [{ q: '¿Qué es un JOIN?', a: 'Une tablas.' }, { q: '¿Qué es un INNER JOIN?', a: 'Solo coincidencias' }, { q: '', a: 'x' }] });
    const cards = await generateCards(cfg(fakeClient(create)), { topic: 'JOIN', course: 'SQL', count: 5, existing: ['¿qué es un join?'] });
    expect(cards).toEqual([{ q: '¿Qué es un INNER JOIN?', a: 'Solo coincidencias' }]);
    const params = (create.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(String(params.input)).toContain('JOIN');
    expect(String(params.input)).toContain('SQL');
    expect(params.response_format).toMatchObject({ schema: { required: ['cards'] } });
  });
});

describe('modelos gratuitos de Google', () => {
  it('el catálogo son los modelos con nivel gratuito según la documentación (y ningún Pro)', () => {
    expect(FREE_MODELS.map((m) => m.id)).toEqual([
      'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite',
    ]);
    expect(FREE_MODELS.some((m) => /pro/i.test(m.id))).toBe(false);
    expect(isFreeModel('gemini-3.1-flash-lite')).toBe(false); // sin nivel gratuito y con fecha de retirada
    expect(FREE_MODELS.every((m) => isModelId(m.id) && m.note.length > 10)).toBe(true);
    expect(DEFAULT_MODEL).toBe(FREE_MODELS[0].id);
    expect(modelName('gemini-3.5-flash-lite')).toBe('Gemini 3.5 Flash-Lite');
    expect(modelName('otro-modelo')).toBe('otro-modelo');
  });

  it('la cadena empieza por el principal, no repite y descarta ids inválidos', () => {
    expect(modelChain('a-model', ['b-model', 'a-model', 'c-model', 'b-model', '../mal'])).toEqual(['a-model', 'b-model', 'c-model']);
    expect(modelChain('a-model', [])).toEqual(['a-model']);
  });

  it('los modelos que acaban de agotar su cuota pasan al final de la cadena', () => {
    expect(modelChain('a-model', ['b-model', 'c-model'], (m) => m === 'a-model')).toEqual(['b-model', 'c-model', 'a-model']);
    expect(modelChain('a-model', ['b-model'], () => true)).toEqual(['a-model', 'b-model']);
  });
});

describe('cambio automático de modelo', () => {
  beforeEach(() => resetCooldowns());
  const quota = () => sdkError('RateLimitError', 429, 'quota exceeded');
  /** Un cliente cuyo comportamiento depende del modelo pedido. */
  const byModel = (behaviour: Record<string, unknown>) =>
    vi.fn(async (params: { model: string }) => {
      const b = behaviour[params.model];
      if (b instanceof Error) throw b;
      return { id: 'i', output_text: JSON.stringify(b ?? roadmapJson) };
    });
  const withFallbacks = (client: GenAiClient, extra: Partial<Parameters<typeof generateRoadmap>[0]> = {}) => ({
    apiKey: KEY, model: 'gemini-3.8-flash', fallbackModels: ['gemini-3.7-flash', 'gemini-3.5-flash-lite'], client, ...extra,
  });
  const calledModels = (create: ReturnType<typeof vi.fn>) => create.mock.calls.map((c) => (c[0] as { model: string }).model);

  it('si el principal agota su cuota (429), sigue con el siguiente y lo avisa', async () => {
    const create = byModel({ 'gemini-3.8-flash': quota() });
    const onSwitch = vi.fn();
    const onUsed = vi.fn();
    const r = await generateRoadmap(withFallbacks(fakeClient(create), { onSwitch, onUsed }), req);
    expect(r.modules).toHaveLength(2);
    expect(calledModels(create)).toEqual(['gemini-3.8-flash', 'gemini-3.7-flash']);
    expect(onSwitch).toHaveBeenCalledWith({ from: 'gemini-3.8-flash', to: 'gemini-3.7-flash', reason: 'quota' });
    expect(onUsed).toHaveBeenCalledWith('gemini-3.7-flash');
  });

  it('recorre varios modelos hasta encontrar uno con cuota', async () => {
    const create = byModel({ 'gemini-3.8-flash': quota(), 'gemini-3.7-flash': quota() });
    const onSwitch = vi.fn();
    await generateRoadmap(withFallbacks(fakeClient(create), { onSwitch }), req);
    expect(calledModels(create)).toEqual(['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash-lite']);
    expect(onSwitch).toHaveBeenCalledTimes(2);
  });

  it('un modelo que no existe para tu clave (404) o está saturado (503) también pasa al siguiente', async () => {
    const create = byModel({ 'gemini-3.8-flash': sdkError('NotFoundError', 404, 'not found'), 'gemini-3.7-flash': sdkError('ServiceUnavailableError', 503, 'The model is overloaded') });
    const reasons: string[] = [];
    await generateRoadmap(withFallbacks(fakeClient(create), { onSwitch: (e) => reasons.push(e.reason) }), req);
    expect(reasons).toEqual(['unavailable', 'overloaded']);
    expect(calledModels(create)).toEqual(['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash-lite']);
  });

  it('si TODOS agotan su cuota, explica cuáles probó y cuándo se renueva', async () => {
    const create = byModel({ 'gemini-3.8-flash': quota(), 'gemini-3.7-flash': quota(), 'gemini-3.5-flash-lite': quota() });
    const e = (await generateRoadmap(withFallbacks(fakeClient(create)), req).catch((x: unknown) => x)) as AiError;
    expect(e.code).toBe('rate_limited');
    expect(e.message).toContain('Gemini 3.8 Flash');
    expect(e.message).toContain('Gemini 3.5 Flash-Lite');
    expect(e.message).toMatch(/medianoche/);
    expect(calledModels(create)).toHaveLength(3);
  });

  it('un error que no es de cuota NO cambia de modelo (clave inválida, petición mal formada…)', async () => {
    for (const error of [sdkError('BadRequestError', 400, 'API key not valid.', 'API_KEY_INVALID'), sdkError('BadRequestError', 400, 'Invalid JSON payload'), sdkError('InternalServerError', 500, 'boom')]) {
      resetCooldowns();
      const create = byModel({ 'gemini-3.8-flash': error });
      const onSwitch = vi.fn();
      await expect(generateRoadmap(withFallbacks(fakeClient(create), { onSwitch }), req)).rejects.toBeInstanceOf(AiError);
      expect(calledModels(create)).toEqual(['gemini-3.8-flash']);
      expect(onSwitch).not.toHaveBeenCalled();
    }
  });

  it('sin modelos de reserva (cambio automático desactivado) se comporta como antes: un solo intento', async () => {
    const create = byModel({ 'gemini-3.8-flash': quota() });
    const e = (await generateRoadmap({ apiKey: KEY, model: 'gemini-3.8-flash', client: fakeClient(create) }, req).catch((x: unknown) => x)) as AiError;
    expect(e.code).toBe('rate_limited');
    expect(e.message).toMatch(/cuota gratuita de tu clave/);
    expect(calledModels(create)).toEqual(['gemini-3.8-flash']);
  });

  it('cancelar en mitad de la cadena la detiene (no sigue probando modelos)', async () => {
    const controller = new AbortController();
    const create = vi.fn(async (params: { model: string }) => {
      if (params.model === 'gemini-3.8-flash') {
        controller.abort();
        throw quota();
      }
      return { output_text: JSON.stringify(roadmapJson) };
    });
    await expect(generateRoadmap(withFallbacks(fakeClient(create as never), { signal: controller.signal }), req)).rejects.toMatchObject({ code: 'cancelled' });
    expect(calledModels(create as never)).toEqual(['gemini-3.8-flash']);
  });

  it('un modelo sin cuota se aparta unos minutos: la siguiente petición empieza por uno que sí responde', async () => {
    const create = byModel({ 'gemini-3.8-flash': quota() });
    await generateRoadmap(withFallbacks(fakeClient(create)), req);
    create.mockClear();
    await generateRoadmap(withFallbacks(fakeClient(create)), req);
    expect(calledModels(create)).toEqual(['gemini-3.7-flash']); // no se malgasta otra petición en el 3.8
  });

  it('pasado el tiempo de espera, el modelo vuelve a probarse primero', async () => {
    vi.useFakeTimers();
    try {
      const create = byModel({ 'gemini-3.8-flash': quota() });
      await generateRoadmap(withFallbacks(fakeClient(create)), req);
      create.mockClear();
      await vi.advanceTimersByTimeAsync(COOLDOWN_MS + 1000);
      const ok = byModel({});
      await generateRoadmap(withFallbacks(fakeClient(ok)), req);
      expect(calledModels(ok)).toEqual(['gemini-3.8-flash']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('las tarjetas también cambian de modelo', async () => {
    const create = vi.fn(async (params: { model: string }) => {
      if (params.model === 'gemini-3.8-flash') throw quota();
      return { output_text: JSON.stringify({ cards: [{ q: '¿A?', a: 'B' }] }) };
    });
    const cards = await generateCards(withFallbacks(fakeClient(create as never)), { topic: 't', course: 'c', count: 3, existing: [] });
    expect(cards).toHaveLength(1);
    expect(calledModels(create as never)).toEqual(['gemini-3.8-flash', 'gemini-3.7-flash']);
  });

  it('DEFAULT_FALLBACKS incluye todos los gratuitos', () => {
    expect(DEFAULT_FALLBACKS).toEqual(FREE_MODELS.map((m) => m.id));
  });
});

describe('cancelar y tiempo máximo', () => {
  /** Una petición que no termina nunca, salvo que su señal se aborte (como hace fetch). */
  const hanging = () =>
    vi.fn((_params: unknown, options: { fetchOptions: { signal: AbortSignal } }) => new Promise((_, reject) => options.fetchOptions.signal.addEventListener('abort', () => reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })))));

  it('«Cancelar» corta la petición en curso y lo comunica como cancelación, no como error', async () => {
    const create = hanging();
    const controller = new AbortController();
    const pending = generateRoadmap({ ...cfg(fakeClient(create as never)), signal: controller.signal }, req);
    await Promise.resolve();
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'cancelled' });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('una señal ya cancelada ni siquiera llama a Google', async () => {
    const create = out(roadmapJson);
    const controller = new AbortController();
    controller.abort();
    await expect(generateRoadmap({ ...cfg(fakeClient(create)), signal: controller.signal }, req)).rejects.toMatchObject({ code: 'cancelled' });
    expect(create).not.toHaveBeenCalled();
  });

  it('pasado el tiempo máximo (60 s) se corta con un mensaje de tiempo agotado', async () => {
    vi.useFakeTimers();
    try {
      const pending = generateRoadmap(cfg(fakeClient(hanging() as never)), req);
      const assertion = expect(pending).rejects.toMatchObject({ code: 'timeout' });
      await vi.advanceTimersByTimeAsync(60_000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('si responde a tiempo no se queda ningún temporizador pendiente', async () => {
    vi.useFakeTimers();
    try {
      await generateRoadmap(cfg(fakeClient(out(roadmapJson))), req);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('tarjetas con IA', () => {
  it('limpia el separador «::», los textos enormes y el máximo de tarjetas', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ q: `Pregunta ${i}`, a: 'r' }));
    expect(cardsFromText(JSON.stringify({ cards: many }))).toHaveLength(10);
    const [c] = cardsFromText(JSON.stringify({ cards: [{ q: `a::b ${'x'.repeat(999)}`, a: 'c::d' }] }));
    expect(c.q).not.toContain('::');
    expect(c.q.length).toBeLessThanOrEqual(300);
    expect(c.a).toBe('c:d');
  });
  it('ignora basura', () => {
    expect(cardsFromText(undefined)).toEqual([]);
    expect(cardsFromText('no json')).toEqual([]);
    expect(cardsFromText(JSON.stringify({ cards: 'no' }))).toEqual([]);
    expect(cardsFromText(JSON.stringify({ cards: [null, 3, { q: 'sin respuesta' }] }))).toEqual([]);
  });
});

class MemStore implements KeyStorage {
  data = new Map<string, string>();
  getItem = (k: string) => this.data.get(k) ?? null;
  setItem = (k: string, v: string) => void this.data.set(k, v);
  removeItem = (k: string) => void this.data.delete(k);
}

describe('almacén de la clave', () => {
  it('empieza sin clave y guarda una válida solo en el dispositivo', () => {
    const storage = new MemStore();
    const ai = createAiStore(storage);
    expect(ai.getState().apiKey).toBeNull();
    expect(ai.getState().setKey(`  "${KEY}" `, 'gemini-2.5-flash-lite')).toBe(true);
    expect(ai.getState()).toMatchObject({ apiKey: KEY, model: 'gemini-2.5-flash-lite' });
    // se recupera al recargar
    expect(createAiStore(storage).getState().apiKey).toBe(KEY);
  });

  it('rechaza claves con mala pinta y no guarda nada', () => {
    const storage = new MemStore();
    const ai = createAiStore(storage);
    expect(ai.getState().setKey('hola')).toBe(false);
    expect(ai.getState().apiKey).toBeNull();
    expect(storage.data.size).toBe(0);
  });

  it('quitar la clave la borra del dispositivo', () => {
    const storage = new MemStore();
    const ai = createAiStore(storage);
    ai.getState().setKey(KEY);
    ai.getState().clear();
    expect(ai.getState().apiKey).toBeNull();
    expect(createAiStore(storage).getState().apiKey).toBeNull();
    expect(storage.data.size).toBe(0);
  });

  it('ignora datos corruptos o manipulados en el almacenamiento', () => {
    const storage = new MemStore();
    storage.setItem('sq:ai', '{no es json');
    expect(createAiStore(storage).getState().apiKey).toBeNull();
    storage.setItem('sq:ai', JSON.stringify({ apiKey: 'x y z', model: '../../etc' }));
    expect(createAiStore(storage).getState()).toMatchObject({ apiKey: null, model: DEFAULT_MODEL });
  });

  it('respeta el modelo elegido, incluidos los 2.5 (siguen siendo gratuitos) y uno personalizado', () => {
    for (const model of ['gemini-2.5-flash', 'gemini-3.5-flash-lite', 'gemini-flash-latest']) {
      const st = new MemStore();
      st.setItem('sq:ai', JSON.stringify({ apiKey: KEY, model }));
      expect(createAiStore(st).getState().model).toBe(model);
    }
  });

  it('el cambio automático de modelo está activado por defecto, con todos los gratuitos de reserva, y se guarda', () => {
    const st = new MemStore();
    const ai = createAiStore(st);
    expect(ai.getState()).toMatchObject({ fallbackEnabled: true, fallbackModels: DEFAULT_FALLBACKS });
    ai.getState().setKey(KEY);
    ai.getState().setFallback(false, ['gemini-2.5-flash', 'gemini-2.5-flash', 'no válido!']);
    expect(ai.getState()).toMatchObject({ fallbackEnabled: false, fallbackModels: ['gemini-2.5-flash'] });
    const again = createAiStore(st).getState();
    expect(again).toMatchObject({ apiKey: KEY, fallbackEnabled: false, fallbackModels: ['gemini-2.5-flash'] });
  });

  it('cambiar de modelo se guarda, y un id manipulado se ignora', () => {
    const st = new MemStore();
    const ai = createAiStore(st);
    ai.getState().setKey(KEY);
    ai.getState().setModel('gemini-3.7-flash');
    ai.getState().setModel('../../etc/passwd');
    ai.getState().setModel('a');
    expect(ai.getState().model).toBe('gemini-3.7-flash');
    expect(createAiStore(st).getState().model).toBe('gemini-3.7-flash');
    st.setItem('sq:ai', JSON.stringify({ apiKey: KEY, model: 'x/y', fallbackModels: ['ok-model', '../mal', 5] }));
    expect(createAiStore(st).getState()).toMatchObject({ model: DEFAULT_MODEL, fallbackModels: ['ok-model'] });
  });

  it('funciona aunque no haya almacenamiento (modo privado)', () => {
    const ai = createAiStore(null);
    expect(ai.getState().setKey(KEY)).toBe(true);
    expect(ai.getState().apiKey).toBe(KEY);
  });

  it('la clave no aparece en las copias de seguridad', async () => {
    const { buildBackup } = await import('@/core/backup');
    const { buildDemo } = await import('@/core/seed');
    const { defaultProfile } = await import('@/core/game');
    createAiStore(new MemStore()).getState().setKey(KEY);
    expect(JSON.stringify(buildBackup(buildDemo(defaultProfile('u'), '2026-09-16')))).not.toContain(KEY);
  });
});
