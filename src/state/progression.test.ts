import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage, createLocalRepository } from '@/data/local';
import type { Repository } from '@/data/ports';
import type { XpEvent } from '@/core/domain';
import { DISCIPLINE, attributeTotals, totalXp, xpToReach } from '@/core/progression';
import { defaultProfile } from '@/core/game';
import { createDataStore } from './data';
import { useUi } from './ui';

let repo: Repository;
let store: ReturnType<typeof createDataStore>;
const flush = () => new Promise((r) => setTimeout(r, 20));
const xp = () => totalXp(store.getState().xpEvents);

const draft = (over = {}) => ({ title: 'Ir al gimnasio', courseId: null, priority: 'mid' as const, status: 'todo' as const, dueDate: null, estimateMin: 30, subtasks: [], tags: [], ...over });
const WEDNESDAY = new Date(2026, 8, 16, 12, 0, 0);

afterEach(() => vi.useRealTimers());
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(WEDNESDAY);
  repo = createLocalRepository(new MemoryStorage());
  store = createDataStore(repo);
  useUi.setState({ toasts: [], levelUp: null, modal: null });
  await store.getState().load('u1');
});

describe('progresión en el store', () => {
  it('una tarea alimenta los atributos de su categoría (Gimnasio → Fuerza 70 % / Vitalidad 30 %)', () => {
    store.getState().createTask(draft());
    expect(store.getState().tasks[0].category).toBe('gimnasio');
    store.getState().setTaskStatus(store.getState().tasks[0].id, 'done');
    expect(attributeTotals(store.getState().xpEvents)).toMatchObject({ fue: 15, vit: 7, int: 0 });
  });

  it('el reparto elegido a mano manda sobre la categoría', () => {
    store.getState().createTask(draft({ attributes: { primary: 'cre', secondary: null } }));
    store.getState().setTaskStatus(store.getState().tasks[0].id, 'done');
    expect(attributeTotals(store.getState().xpEvents)).toMatchObject({ cre: 22, fue: 0 });
  });

  it('marcar, desmarcar y volver a marcar no acumula XP: deshacer borra las filas', async () => {
    store.getState().createTask(draft());
    const id = store.getState().tasks[0].id;
    store.getState().setTaskStatus(id, 'done');
    const once = xp();
    store.getState().setTaskStatus(id, 'todo');
    expect(store.getState().xpEvents).toEqual([]);
    store.getState().setTaskStatus(id, 'done');
    expect(xp()).toBe(once);
    await flush();
    expect(totalXp(await repo.xpEvents.list())).toBe(once);
    expect((await repo.xpEvents.list()).every((e) => e.amount > 0)).toBe(true);
  });

  it('cumplir una tarea a tiempo suma Disciplina extra', () => {
    store.getState().createTask(draft({ dueDate: '2026-09-20' }));
    store.getState().setTaskStatus(store.getState().tasks[0].id, 'done');
    expect(attributeTotals(store.getState().xpEvents).dis).toBe(DISCIPLINE.onTimeBonus);
  });

  it('con la racha viva, cada acción completada suma un poco de Disciplina', () => {
    // Ayer hubo actividad: la racha sigue viva hoy.
    store.setState({ xpEvents: [{ id: 'y', date: '2026-09-15', attribute: 'esp', amount: 10, source: 'bonus', sourceId: 'ayer', label: '' }] });
    store.getState().createTask(draft());
    store.getState().setTaskStatus(store.getState().tasks[0].id, 'done');
    expect(attributeTotals(store.getState().xpEvents).dis).toBe(DISCIPLINE.streakBonus);
  });

  it('subir de nivel da monedas y el nivel sale solo del ledger', () => {
    const before = store.getState().profile.credits;
    store.setState({ xpEvents: [{ id: 's', date: '2026-01-01', attribute: 'cre', amount: 95, source: 'bonus', sourceId: 'seed', label: '' }] });
    store.getState().createTask(draft());
    store.getState().setTaskStatus(store.getState().tasks[0].id, 'done');
    expect(useUi.getState().levelUp?.level).toBe(2);
    expect(store.getState().profile.credits).toBeGreaterThan(before);
    expect('xp' in store.getState().profile).toBe(false);
  });
});

describe('categorías de lo que ya existía', () => {
  it('al cargar, lo que no tiene categoría recibe la sugerida y se guarda una sola vez', async () => {
    const r = createLocalRepository(new MemoryStorage());
    await r.courses.create({ id: 'c1', title: 'Inglés B1', professor: '', field: 'Idiomas', modules: [], mentor: null, createdAt: '' });
    await r.tasks.create({ ...draft({ title: 'Repasar capítulo 3', courseId: 'c1' }), id: 't1', createdAt: '', completedAt: null });
    await r.habits.create({ id: 'h1', title: 'Meditar', frequency: { type: 'daily' }, measure: 'boolean', target: 1, reminder: null, steps: [], startDate: '2026-09-01', createdAt: '', category: 'arte' });
    const s = createDataStore(r);
    await s.getState().load('u1');
    await flush();
    expect((await r.courses.list())[0].category).toBe('idiomas');
    expect((await r.tasks.list())[0].category).toBe('idiomas');
    expect((await r.habits.list())[0].category).toBe('arte'); // la elegida no se toca
  });
});

describe('adaptador local: replace', () => {
  const row = (attribute: XpEvent['attribute'], amount: number, id = `${attribute}-${amount}`): XpEvent => ({ id, date: '2026-09-16', attribute, amount, source: 'habit', sourceId: 'h1', label: '' });

  it('es idempotente y conserva el id de la fila que ya existía', async () => {
    const r = createLocalRepository(new MemoryStorage());
    await r.xpEvents.replace({ source: 'habit', sourceId: 'h1', date: '2026-09-16' }, [row('fue', 10, 'first')]);
    await r.xpEvents.replace({ source: 'habit', sourceId: 'h1', date: '2026-09-16' }, [row('fue', 14, 'other'), row('vit', 6)]);
    await r.xpEvents.replace({ source: 'habit', sourceId: 'h1', date: '2026-09-16' }, [row('fue', 14, 'other'), row('vit', 6)]);
    const list = await r.xpEvents.list();
    expect(list.map((e) => [e.id, e.attribute, e.amount])).toEqual([['first', 'fue', 14], ['vit-6', 'vit', 6]]);
  });

  it('con filas vacías revierte solo lo de ese origen (y ese día, si se indica)', async () => {
    const r = createLocalRepository(new MemoryStorage());
    await r.xpEvents.createMany([row('fue', 10), { ...row('fue', 8, 'ayer'), date: '2026-09-15' }, { ...row('int', 5, 'otro'), sourceId: 'h2' }]);
    await r.xpEvents.replace({ source: 'habit', sourceId: 'h1', date: '2026-09-16' }, []);
    expect((await r.xpEvents.list()).map((e) => e.id).sort()).toEqual(['ayer', 'otro']);
    await r.xpEvents.replace({ source: 'habit', sourceId: 'h1' }, []);
    expect((await r.xpEvents.list()).map((e) => e.id)).toEqual(['otro']);
  });
});

describe('identidad del personaje', () => {
  const seed = (rows: [XpEvent['attribute'], number][]) =>
    store.setState({ xpEvents: rows.map(([attribute, amount], i) => ({ id: `s${i}`, date: '2026-01-01', attribute, amount, source: 'bonus' as const, sourceId: `seed${i}`, label: '' })) });

  it('al llegar al nivel 5 de un atributo se entrega su insignia, con aviso, y no se pierde al deshacer', () => {
    seed([['fue', xpToReach(5) - 5]]);
    store.getState().createTask(draft());
    const id = store.getState().tasks[0].id;
    store.getState().setTaskStatus(id, 'done');
    expect(store.getState().profile.inventory).toContain('badge-attr-fue');
    // La cola de avisos solo guarda los últimos; la notificación queda.
    expect(store.getState().notifications.some((n) => n.title === 'Desbloqueaste «Sello del Músculo»')).toBe(true);
    store.getState().setTaskStatus(id, 'todo');
    expect(store.getState().profile.inventory).toContain('badge-attr-fue');
  });

  it('cuando dos atributos toman la delantera se anuncia la clase y se guarda', () => {
    seed([['vit', 200]]);
    store.getState().createTask(draft());
    store.getState().setTaskStatus(store.getState().tasks[0].id, 'done');
    expect(store.getState().profile.characterClass).toBe('guerrero');
    expect(useUi.getState().toasts.some((t) => t.title === '¡Ahora eres Guerrero!')).toBe(true);
  });

  it('lo que se gana con un atributo no se puede comprar', () => {
    store.getState().updateProfile({ credits: 99999 });
    store.getState().buy('frame-attr-int');
    store.getState().createHero('mario', 'Lía');
    store.getState().buyHeroItem('hero-s-attr-int');
    expect(store.getState().profile.inventory).not.toContain('frame-attr-int');
    expect(store.getState().profile.inventory).not.toContain('hero-s-attr-int');
  });

  it('al cargar, lo ya alcanzado se pone al día sin avisos en pantalla', async () => {
    const r = createLocalRepository(new MemoryStorage());
    await r.xpEvents.createMany([{ id: 'x', date: '2026-09-01', attribute: 'int', amount: xpToReach(10), source: 'bonus', sourceId: 'x', label: '' }, { id: 'y', date: '2026-09-01', attribute: 'dis', amount: 200, source: 'bonus', sourceId: 'y', label: '' }]);
    const s = createDataStore(r);
    useUi.setState({ toasts: [] });
    await s.getState().load('u1');
    expect(s.getState().profile.inventory).toEqual(expect.arrayContaining(['badge-attr-int', 'frame-attr-int']));
    expect(s.getState().profile.characterClass).toBe('erudito');
    expect(useUi.getState().toasts.filter((t) => t.kind === 'unlock')).toEqual([]);
  });
});

describe('congeladores de racha', () => {
  const day = (date: string, i: number): XpEvent => ({ id: `d${i}`, date, attribute: 'esp', amount: 10, source: 'bonus', sourceId: `d${i}`, label: '' });
  /** Abre la app (hoy es miércoles 16) con XP en esos días y esos congeladores. */
  const open = async (dates: string[], freezes: number) => {
    const r = createLocalRepository(new MemoryStorage());
    await r.xpEvents.createMany(dates.map(day));
    await r.profile.save({ ...defaultProfile('u1'), streakFreezes: freezes });
    const s = createDataStore(r);
    await s.getState().load('u1');
    return { s, r };
  };

  it('si ayer se pasó sin XP, se usa un congelador solo y la racha sigue', async () => {
    const { s, r } = await open(['2026-09-12', '2026-09-13', '2026-09-14'], 1);
    expect(s.getState().profile.frozenDates).toEqual(['2026-09-15']);
    expect(s.getState().profile.streakFreezes).toBe(0);
    await flush();
    expect((await r.profile.get())?.frozenDates).toEqual(['2026-09-15']);
  });

  it('si no alcanzan para cubrir el hueco, no se gasta ninguno', async () => {
    const { s } = await open(['2026-09-12', '2026-09-13'], 1);
    expect(s.getState().profile.frozenDates).toEqual([]);
    expect(s.getState().profile.streakFreezes).toBe(1);
  });

  it('siete días seguidos dan un congelador, una sola vez', async () => {
    const week = ['2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14', '2026-09-15'];
    const { s, r } = await open(week, 0);
    expect(s.getState().profile.streakFreezes).toBe(1);
    await flush();
    const again = createDataStore(r);
    await again.getState().load('u1');
    expect(again.getState().profile.streakFreezes).toBe(1);
  });
});
