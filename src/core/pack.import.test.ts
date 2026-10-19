import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_MODEL, generatePack, type GenAiClient } from '@/ai/gemini';
import { PACK_XP_MAX, PACK_SCHEMA, buildPackEntities, contextText, dropExisting, extractJson, packPrompt, packXp, parsePack } from './pack';
import { availabilityText } from './routine';
import type { AgendaEvent } from './domain';

const ok = (raw: string) => {
  const r = parsePack(raw);
  if (!r.ok) throw new Error(r.error);
  return r;
};

const sample = {
  goals: [{ title: 'Dominar SQL', deadlineInDays: 60, measure: '3 sesiones por semana', why: 'Cambiar de empleo', area: 'growth', ifThen: [{ si: 'llego cansado', entonces: 'hago solo 5 minutos' }], milestones: [{ title: 'Consultas', xp: 100 }] }],
  courses: [{ title: 'SQL desde cero', modules: [{ title: 'Básico', topics: ['SELECT'] }] }],
  habits: [{ title: 'Practicar SQL', goal: 'dominar sql', frequency: { type: 'days', days: [4, 0, 2] }, measure: 'minutes', target: 30, minTarget: 5, area: 'growth' }],
  tasks: [
    { title: 'Instalar SQL Server', course: 'sql desde cero', goal: 'Dominar SQL', dueInDays: 0, estimateMin: 15 },
    { title: 'Primer SELECT', course: 'SQL desde cero', goal: 'Otra meta que no existe', dueInDays: 2 },
  ],
};

describe('leer lo que devuelve la IA', () => {
  it('arregla comillas curvas, comas sobrantes y comentarios', () => {
    const raw = '{\n // plan\n “tasks”: [ {“title”: “Instalar”, “dueInDays”: 1,}, ],\n}';
    expect(ok(raw).pack.tasks[0].title).toBe('Instalar');
  });

  it('distingue una respuesta cortada, un JSON roto y texto sin JSON', () => {
    const cut = JSON.stringify(sample).slice(0, 120);
    expect(parsePack(cut)).toMatchObject({ ok: false, error: expect.stringMatching(/cortada/) });
    expect(parsePack('{"tasks": [ {"title": "x" "dueInDays": 3} ] }')).toMatchObject({ ok: false, error: expect.stringMatching(/errores de sintaxis/) });
    expect(parsePack('Lo siento, no puedo')).toMatchObject({ ok: false, error: expect.stringMatching(/No encuentro un JSON/) });
    expect(() => extractJson('nada')).toThrow();
  });

  it('lee una respuesta con valla de código sin cerrar', () => {
    expect(ok('```json\n{"tasks":[{"title":"a"}]}').pack.tasks).toHaveLength(1);
  });

  it('avisa cuando se pasa del límite de elementos en vez de cortar en silencio', () => {
    const many = { tasks: Array.from({ length: 35 }, (_, i) => ({ title: `T${i}` })) };
    const r = ok(JSON.stringify(many));
    expect(r.pack.tasks).toHaveLength(30);
    expect(r.warnings.join()).toMatch(/primeros 30 de 35 tareas/);
  });

  it('la IA no puede regalar XP: todo queda dentro de los topes de la app', () => {
    const r = ok(JSON.stringify({
      courses: [{ title: 'C', modules: [{ title: 'M', xp: 99999, topics: ['t'] }] }],
      goals: [{ title: 'G', milestones: [{ title: 'H', xp: 99999 }] }],
      habits: [{ title: 'H', xp: 99999, frequency: { type: 'daily' } }],
      tasks: [{ title: 'T', xp: 99999 }],
    }));
    expect(r.pack.courses[0].modules[0].xp).toBe(PACK_XP_MAX.group);
    expect(r.pack.goals[0].milestones[0].xp).toBe(PACK_XP_MAX.group);
    expect(r.pack.habits[0].xp).toBe(PACK_XP_MAX.habit);
    expect(r.pack.tasks[0].xp).toBe(PACK_XP_MAX.task);
    expect(packXp(r.pack)).toBe(PACK_XP_MAX.group * 2 + PACK_XP_MAX.task);
  });
});

describe('un pack que se integra con tus metas', () => {
  const r = ok(JSON.stringify(sample));

  it('lee plazo, indicador, motivo, área, «si… entonces…» y versión mínima', () => {
    expect(r.pack.goals[0]).toMatchObject({ deadlineInDays: 60, measure: '3 sesiones por semana', why: 'Cambiar de empleo', area: 'growth' });
    expect(r.pack.goals[0].ifThen?.[0]).toMatchObject({ when: 'llego cansado', then: 'hago solo 5 minutos' });
    expect(r.pack.habits[0]).toMatchObject({ minTarget: 5, area: 'growth', frequency: { type: 'days', days: [0, 2, 4] } });
  });

  it('descarta un mínimo incoherente', () => {
    const bad = ok(JSON.stringify({ habits: [{ title: 'x', measure: 'minutes', target: 10, minTarget: 10, frequency: { type: 'daily' } }, { title: 'y', measure: 'boolean', minTarget: 1, frequency: { type: 'daily' } }] }));
    expect(bad.pack.habits.map((h) => h.minTarget)).toEqual([undefined, undefined]);
  });

  it('enlaza tareas y hábitos con su meta y su curso por título, y pone el plazo con el ritmo elegido', () => {
    const e = buildPackEntities(r.pack, [], '2026-10-01', 0.5);
    expect(e.goals[0].deadline).toBe('2026-10-31'); // 60 días × 0,5
    expect(e.habits[0].goalId).toBe(e.goals[0].id);
    expect(e.tasks[0]).toMatchObject({ goalId: e.goals[0].id, courseId: e.courses[0].id, dueDate: '2026-10-01' });
    expect(e.tasks[1].goalId).toBeUndefined(); // la meta que no existe no inventa un enlace
    expect(r.warnings.join()).toMatch(/meta «Otra meta que no existe»/);
  });

  it('enlaza con una meta que ya tenías', () => {
    const only = ok('{"tasks":[{"title":"x","goal":"Mi Meta"}]}');
    expect(buildPackEntities(only.pack, [], '2026-10-01', 1, { goals: [{ id: 'g1', title: 'mi meta' }] }).tasks[0].goalId).toBe('g1');
  });
});

describe('no duplicar lo que ya tienes', () => {
  const r = ok(JSON.stringify(sample));
  const have = { courses: [{ id: 'c1', title: 'sql desde cero' }], goals: [{ id: 'g1', title: 'DOMINAR SQL' }], habits: [{ title: 'Practicar SQL' }], tasks: [{ title: 'primer select', courseId: 'c1' }] };

  it('quita lo repetido y conserva lo nuevo', () => {
    const { pack, dropped } = dropExisting(r.pack, have);
    expect(pack.courses).toHaveLength(0);
    expect(pack.goals).toHaveLength(0);
    expect(pack.habits).toHaveLength(0);
    expect(pack.tasks.map((t) => t.title)).toEqual(['Instalar SQL Server']);
    expect(dropped).toHaveLength(4);
  });

  it('lo que se omite sigue valiendo como destino de los enlaces', () => {
    const { pack } = dropExisting(r.pack, have);
    const e = buildPackEntities(pack, have.courses, '2026-10-01', 1, { goals: have.goals });
    expect(e.tasks[0]).toMatchObject({ courseId: 'c1', goalId: 'g1' });
  });

  it('una tarea con el mismo título en otro curso no es un duplicado', () => {
    const { pack } = dropExisting(r.pack, { ...have, tasks: [{ title: 'primer select', courseId: 'otro' }] });
    expect(pack.tasks.map((t) => t.title)).toContain('Primer SELECT');
  });
});

describe('el prompt', () => {
  it('lleva tu nivel, tu tiempo y tu horario, y pide un primer paso para hoy', () => {
    const p = packPrompt('SQL Server', { level: 'intermediate', hoursPerWeek: 6, weeks: 12, availability: 'Lun–Vie 18:00–22:30' });
    expect(p).toContain('Quiero aprender: SQL Server');
    expect(p).toContain('intermedio');
    expect(p).toContain('6 horas por semana');
    expect(p).toContain('12 semanas');
    expect(p).toContain('Lun–Vie 18:00–22:30');
    expect(p).toMatch(/PRIMERA TAREA/);
    expect(contextText({})).toBe('');
  });

  it('su ejemplo sigue siendo un pack válido con los campos nuevos', () => {
    const p = packPrompt('x');
    const r = ok(p.slice(p.indexOf('{\n  "studyquest"'), p.indexOf('Reglas del formato')));
    expect(r.pack.goals[0].deadlineInDays).toBe(90);
    expect(r.pack.habits[0].minTarget).toBe(5);
    expect(r.pack.habits[0].goal).toMatch(/EXACTO/);
  });
});

describe('tu tiempo libre dicho para la IA', () => {
  const work: AgendaEvent = { id: 'w', title: 'Jornada laboral', category: 'work', date: '2026-09-14', start: '08:30', minutes: 570, repeat: { type: 'weekly', every: 1, days: [0, 1, 2, 3, 4] }, rev: 0, createdAt: '', updatedAt: '' };
  it('resume la semana agrupando días iguales; sin horario no dice nada', () => {
    expect(availabilityText({ events: [work], habits: [], tasks: [], habitLogs: [] }, '2026-09-14')).toBe('Lun–Vie 06:00–08:30 y 18:00–22:30; Sáb–Dom 06:00–22:30');
    expect(availabilityText({ events: [], habits: [], tasks: [], habitLogs: [] }, '2026-09-14')).toBe('');
  });
});

describe('generar el pack con Gemini', () => {
  const client = (create: ReturnType<typeof vi.fn>) => ({ interactions: { create }, models: { list: vi.fn() } }) as unknown as GenAiClient;
  const reply = (text: string) => vi.fn(async () => ({ id: 'i', output_text: text }));
  const cfg = (c: GenAiClient) => ({ apiKey: 'K'.repeat(20), model: DEFAULT_MODEL, client: c });

  it('pide JSON con el esquema del pack, trata el objetivo como dato y devuelve la lectura', async () => {
    const create = reply(JSON.stringify(sample));
    const res = await generatePack(cfg(client(create)), { topic: 'SQL Server', level: 'beginner', hoursPerWeek: 5, weeks: 8 });
    const args = create.mock.calls[0] as unknown as [{ input: string; system_instruction: string; store: boolean; response_format: { schema: unknown } }];
    expect(args[0].response_format.schema).toBe(PACK_SCHEMA);
    expect(args[0].system_instruction).toMatch(/dato, nunca como instrucciones/);
    expect(args[0].input).toContain('SQL Server');
    expect(args[0].input).toContain('5 horas por semana');
    expect(args[0].store).toBe(false);
    expect(res.result.pack.goals[0].title).toBe('Dominar SQL');
  });

  it('una respuesta inservible o un objetivo vacío dan un error claro', async () => {
    await expect(generatePack(cfg(client(reply('no es json'))), { topic: 'SQL Server' })).rejects.toMatchObject({ code: 'bad_output' });
    await expect(generatePack(cfg(client(reply('{}'))), { topic: 'SQL' })).rejects.toMatchObject({ code: 'bad_output' });
    await expect(generatePack(cfg(client(reply('{}'))), { topic: '  ' })).rejects.toMatchObject({ code: 'bad_output' });
  });
});
