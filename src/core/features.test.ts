import { describe, expect, it } from 'vitest';
import { addMonths } from './dates';
import type { Course, Habit, Task, Topic } from './domain';
import { REVIEW_INTERVALS, cardsFor, cardsToText, dueReviews, gradeReview, parseCards, reviewDueDate, startReview } from './review';
import { BOSS_BONUS_XP, bossHp, nextOccurrence, projectOccurrences, recurrenceLabel, spawnNext, taskReward } from './tasks';
import { COMBO_CAP, activeEvents, chestReward, comboBonus, freshDayBonus, habitBonus, weekendBonus } from './events';
import { calendarDays, monthGrid } from './calendar';
import { DEFAULT_POMODORO, formatClock, nextPhase, sanitizeConfig } from './pomodoro';
import { ACHIEVEMENTS } from './achievements';
import { SHOP } from './catalog';
import { SPRITE_NAMES } from '@/ui/sprites';
import { TRACKS, midiToFreq } from '@/audio/music';
import { buildBackup, parseBackup } from './backup';
import { buildDemo } from './seed';
import { defaultProfile } from './game';
import { CONCEPTS, CONCEPT_ORDER, EXAMPLE_CHAINS, FAQ, QUIZ } from './concepts';

const NOW = '2026-09-16'; // miércoles

const topic = (over: Partial<Topic> = {}): Topic => ({ id: 't', title: 'Tema', status: 'done', review: true, markedAt: '2026-09-15', ...over });
const course = (topics: Topic[]): Course => ({ id: 'c', title: 'Curso', professor: '', field: '', mentor: null, createdAt: '', modules: [{ id: 'm', title: 'M', summary: '', xp: 100, topics }] });
const task = (over: Partial<Task> = {}): Task => ({
  id: 'x', title: 'T', courseId: null, priority: 'mid', status: 'todo', dueDate: NOW, estimateMin: 0, xp: 20, subtasks: [], tags: [], createdAt: '', completedAt: null, ...over,
});
const habit = (id: string, xp = 20): Habit => ({ id, title: id, frequency: { type: 'daily' }, measure: 'boolean', target: 1, xp, reminder: null, steps: [], startDate: '2026-01-01', createdAt: '' });

describe('repaso espaciado', () => {
  it('los intervalos son 1, 3, 7 y 14 días', () => {
    expect([...REVIEW_INTERVALS]).toEqual([1, 3, 7, 14]);
  });

  it('un tema marcado hoy toca mañana', () => {
    expect(startReview(NOW)).toEqual({ review: true, markedAt: NOW, reviewStage: 0, nextReview: '2026-09-17' });
  });

  it('un tema antiguo sin agenda cuenta desde el día siguiente a marcarlo', () => {
    expect(reviewDueDate(topic({ markedAt: '2026-09-10' }), NOW)).toBe('2026-09-11');
    expect(reviewDueDate(topic({ review: false }), NOW)).toBeNull();
    expect(reviewDueDate(topic({ markedAt: null }), NOW)).toBe(NOW);
  });

  it('good sube un escalón, easy salta uno, again reinicia', () => {
    expect(gradeReview(topic({ reviewStage: 0 }), 'good', NOW).patch).toMatchObject({ reviewStage: 1, nextReview: '2026-09-19' });
    expect(gradeReview(topic({ reviewStage: 0 }), 'easy', NOW).patch).toMatchObject({ reviewStage: 2, nextReview: '2026-09-23' });
    expect(gradeReview(topic({ reviewStage: 2 }), 'again', NOW).patch).toMatchObject({ reviewStage: 0, nextReview: '2026-09-17' });
  });

  it('el último escalón (o un «fácil» que lo sobrepasa) domina el tema', () => {
    const last = gradeReview(topic({ reviewStage: 3 }), 'good', NOW);
    expect(last).toMatchObject({ mastered: true, nextInDays: null, xp: 50 });
    expect(last.patch.review).toBe(false);
    expect(gradeReview(topic({ reviewStage: 2 }), 'easy', NOW).mastered).toBe(true);
  });

  it('solo tocan los repasos de hoy o atrasados, los más atrasados primero', () => {
    const c = course([
      topic({ id: 'a', nextReview: '2026-09-16' }),
      topic({ id: 'b', nextReview: '2026-09-12' }),
      topic({ id: 'c', nextReview: '2026-09-20' }),
      topic({ id: 'd', review: false }),
    ]);
    const due = dueReviews({ courses: [c] }, NOW);
    expect(due.map((d) => d.topicId)).toEqual(['b', 'a']);
    expect(due[0].late).toBe(4);
  });

  it('sin tarjetas propias se pregunta por el tema', () => {
    expect(cardsFor({ title: 'JOINs' })[0].q).toContain('JOINs');
    expect(cardsFor({ title: 'x', cards: [{ id: '1', q: 'p', a: 'r' }] })).toHaveLength(1);
  });

  it('las tarjetas van y vienen como texto «pregunta :: respuesta» conservando los ids', () => {
    const cards = parseCards('¿A? :: Uno\n\n¿B? :: Dos :: con más\nSolo pregunta');
    expect(cards.map((c) => [c.q, c.a])).toEqual([['¿A?', 'Uno'], ['¿B?', 'Dos :: con más'], ['Solo pregunta', '']]);
    const again = parseCards(cardsToText(cards), cards);
    expect(again.map((c) => c.id)).toEqual(cards.map((c) => c.id));
  });
});

describe('tareas recurrentes', () => {
  it('avanza según su unidad', () => {
    expect(nextOccurrence(task({ recurrence: { unit: 'day', interval: 1 } }), NOW)).toBe('2026-09-17');
    expect(nextOccurrence(task({ recurrence: { unit: 'week', interval: 2 } }), NOW)).toBe('2026-09-30');
    expect(nextOccurrence(task({ recurrence: { unit: 'month', interval: 1 } }), NOW)).toBe('2026-10-16');
  });

  it('completarla tarde no crea una cola de días atrasados', () => {
    expect(nextOccurrence(task({ dueDate: '2026-09-01', recurrence: { unit: 'day', interval: 1 } }), NOW)).toBe('2026-09-17');
    expect(nextOccurrence(task({ dueDate: '2026-09-01', recurrence: { unit: 'week', interval: 1 } }), NOW)).toBe('2026-09-22'); // sigue su calendario semanal
  });

  it('sin fecha límite cuenta desde hoy; sin repetición no hay siguiente', () => {
    expect(nextOccurrence(task({ dueDate: null, recurrence: { unit: 'day', interval: 3 } }), NOW)).toBe('2026-09-19');
    expect(nextOccurrence(task(), NOW)).toBeNull();
  });

  it('los meses cortos se ajustan al último día', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-12-15', 2)).toBe('2027-02-15');
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
  });

  it('spawnNext reinicia el avance', () => {
    const t = task({ status: 'done', completedAt: NOW, recurrence: { unit: 'day', interval: 1 }, subtasks: [{ id: 's', title: 'a', done: true }], spawnedId: 'zzz' });
    const n = spawnNext(t, () => 'new-id', NOW);
    expect(n).toMatchObject({ id: 'new-id', status: 'todo', dueDate: '2026-09-17', completedAt: null, spawnedId: undefined });
    expect(n.subtasks[0].done).toBe(false);
  });

  it('proyecta las repeticiones futuras en un rango, sin pasar del final', () => {
    const t = task({ recurrence: { unit: 'week', interval: 1 } });
    expect(projectOccurrences(t, '2026-09-17', '2026-10-10', NOW)).toEqual(['2026-09-23', '2026-09-30', '2026-10-07']);
    expect(projectOccurrences({ ...t, status: 'done' }, '2026-09-17', '2026-10-10', NOW)).toEqual([]);
  });

  it('etiquetas legibles', () => {
    expect(recurrenceLabel({ unit: 'day', interval: 1 })).toBe('Cada día');
    expect(recurrenceLabel({ unit: 'week', interval: 2 })).toBe('Cada 2 semanas');
    expect(recurrenceLabel({ unit: 'month', interval: 1 })).toBe('Cada mes');
  });
});

describe('jefes finales', () => {
  it('su vida son las subtareas sin hacer', () => {
    const subtasks = [true, false, false].map((done, i) => ({ id: String(i), title: 'x', done }));
    expect(bossHp({ subtasks, status: 'doing' })).toEqual({ hp: 2, max: 3, pct: 67 });
    expect(bossHp({ subtasks, status: 'done' }).hp).toBe(0);
    expect(bossHp({ subtasks: [], status: 'todo' })).toEqual({ hp: 1, max: 1, pct: 100 });
  });

  it('el botín extra solo lo dan los jefes', () => {
    expect(taskReward({ priority: 'boss', xp: 120 })).toBe(120 + BOSS_BONUS_XP);
    expect(taskReward({ priority: 'high', xp: 50 })).toBe(50);
  });
});

describe('eventos de racha', () => {
  it('el combo duplica el XP de los hábitos de hoy, con tope', () => {
    expect(comboBonus([20, 20, 20])).toBe(60);
    expect(comboBonus([100, 100, 100])).toBe(COMBO_CAP);
  });

  it('el bonus de finde es +50% (mínimo 1)', () => {
    expect(weekendBonus(20)).toBe(10);
    expect(weekendBonus(1)).toBe(1);
  });

  it('habitBonus combina finde y combo y anota lo cobrado', () => {
    const hs = [habit('a'), habit('b'), habit('c')];
    const sat = '2026-09-19';
    const b = habitBonus(hs[2], hs, freshDayBonus(sat), sat);
    expect(b).toMatchObject({ weekend: 10, combo: 60, xp: 70 });
    expect(b.next).toEqual({ date: sat, weekend: ['c'], combo: true });
    // ya cobrado: no repite
    expect(habitBonus(hs[2], hs, b.next, sat).xp).toBe(0);
    // entre semana solo hay combo
    expect(habitBonus(hs[2], hs, freshDayBonus(NOW), NOW)).toMatchObject({ weekend: 0, combo: 60 });
    // con 2 hábitos no hay combo
    expect(habitBonus(hs[1], hs.slice(0, 2), freshDayBonus(NOW), NOW).xp).toBe(0);
  });

  it('Inicio muestra el progreso del combo y el evento de fin de semana', () => {
    const hs = [habit('a'), habit('b'), habit('c')];
    const log = { id: '1', habitId: 'a', date: NOW, value: 1, stepsDone: [] };
    const weekday = activeEvents(hs, [log], {}, NOW);
    expect(weekday.map((e) => e.id)).toEqual(['combo']);
    expect(weekday[0]).toMatchObject({ pct: 33, active: false });
    expect(activeEvents(hs, [], {}, '2026-09-20').map((e) => e.id)).toEqual(['weekend', 'combo']);
    expect(activeEvents(hs, [], { dayBonus: { date: NOW, weekend: [], combo: true } }, NOW)[0]).toMatchObject({ id: 'combo', active: true, pct: 100 });
    expect(activeEvents([habit('a')], [], {}, NOW)).toEqual([]); // con menos de 3 hábitos no hay combo posible
  });

  it('el cofre es el mismo todo el día y mejora con la racha', () => {
    expect(chestReward(NOW, 0)).toEqual(chestReward(NOW, 0));
    const base = chestReward(NOW, 0).coins;
    expect(base).toBeGreaterThanOrEqual(20);
    expect(base).toBeLessThanOrEqual(60);
    expect(chestReward(NOW, 10).coins).toBe(base + 20);
    expect(chestReward(NOW, 999).coins).toBe(base + 60);
  });
});

describe('calendario', () => {
  it('la cuadrícula tiene 6 semanas y empieza en lunes', () => {
    const g = monthGrid(2026, 8); // septiembre 2026 empieza en martes
    expect(g).toHaveLength(42);
    expect(g[0]).toBe('2026-08-31');
    expect(g[41]).toBe('2026-10-11');
  });

  it('agrupa tareas, repeticiones futuras y repasos por día (los atrasados salen hoy)', () => {
    const tasks = [task({ id: 'a', dueDate: '2026-09-18' }), task({ id: 'b', dueDate: '2026-09-18' }), task({ id: 'r', dueDate: '2026-09-16', recurrence: { unit: 'week', interval: 1 } }), task({ id: 'n', dueDate: null })];
    const c = course([topic({ id: 'x', nextReview: '2026-09-10' }), topic({ id: 'y', nextReview: '2026-09-25' })]);
    const days = calendarDays({ tasks, courses: [c] }, '2026-08-31', '2026-10-11', NOW);
    expect(days.get('2026-09-18')?.tasks.map((t) => t.id)).toEqual(['a', 'b']);
    expect(days.get('2026-09-23')?.upcoming.map((t) => t.id)).toEqual(['r']);
    expect(days.get('2026-09-16')?.reviews.map((r) => r.topicId)).toEqual(['x']);
    expect(days.get('2026-09-25')?.reviews.map((r) => r.topicId)).toEqual(['y']);
    expect([...days.values()].flatMap((d) => d.tasks).some((t) => t.id === 'n')).toBe(false);
  });
});

describe('pomodoro', () => {
  it('cada N enfoques toca descanso largo; tras un descanso, enfoque', () => {
    expect(nextPhase('focus', 1, 4)).toBe('short');
    expect(nextPhase('focus', 4, 4)).toBe('long');
    expect(nextPhase('short', 1, 4)).toBe('focus');
    expect(nextPhase('long', 0, 4)).toBe('focus');
  });

  it('limita valores absurdos y rellena los que faltan', () => {
    expect(sanitizeConfig({ focus: 9999, short: -3, long: NaN })).toEqual({ focus: 120, short: 1, long: DEFAULT_POMODORO.long, every: DEFAULT_POMODORO.every });
    expect(sanitizeConfig(null)).toEqual(DEFAULT_POMODORO);
  });

  it('formatea el reloj redondeando hacia arriba', () => {
    expect(formatClock(25 * 60_000)).toBe('25:00');
    expect(formatClock(59_001)).toBe('01:00');
    expect(formatClock(-5)).toBe('00:00');
  });
});

describe('música 8-bit', () => {
  it.each(Object.entries(TRACKS))('%s: las notas son MIDI válidas y las partes encajan', (_, t) => {
    for (const n of [...t.lead, ...t.bass]) expect(n === 0 || (n >= 24 && n <= 108)).toBe(true);
    expect(t.lead.length % 8).toBe(0);
    expect(t.bass.length % 8).toBe(0);
    expect(t.lead.length % t.bass.length === 0 || t.bass.length % t.lead.length === 0).toBe(true);
    expect(t.bpm).toBeGreaterThan(40);
  });

  it('La4 son 440 Hz', () => {
    expect(midiToFreq(69)).toBe(440);
    expect(midiToFreq(81)).toBe(880);
  });
});

describe('catálogo y logros', () => {
  it('los ids son únicos y los sprites existen', () => {
    const shopIds = SHOP.map((i) => i.id);
    expect(new Set(shopIds).size).toBe(shopIds.length);
    const achIds = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(achIds).size).toBe(achIds.length);
    for (const i of SHOP) expect(SPRITE_NAMES, i.id).toContain(i.sprite);
    for (const a of ACHIEVEMENTS) expect(SPRITE_NAMES, a.id).toContain(a.sprite);
  });

  it('hay 6 mundos y todos tienen estilos (el logro «todos los mundos» pide 6)', () => {
    expect(SHOP.filter((i) => i.kind === 'world')).toHaveLength(6);
  });
});

describe('copias de seguridad con lo nuevo', () => {
  it('conservan tarjetas, agenda de repaso, repetición y bonos del perfil', () => {
    const data = buildDemo(defaultProfile('u1'), NOW);
    data.profile.dayBonus = { date: NOW, weekend: [data.habits[0].id], combo: true };
    data.profile.lastChest = NOW;
    data.profile.chests = 3;
    const res = parseBackup(JSON.stringify(buildBackup(data)), 'u2');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const withCards = res.snapshot.courses[0].modules.flatMap((m) => m.topics).find((t) => t.cards?.length);
    expect(withCards?.cards?.length).toBe(3);
    expect(withCards?.reviewStage).toBe(1);
    expect(withCards?.nextReview).toBe('2026-09-15');
    expect(res.snapshot.tasks.find((t) => t.recurrence)?.recurrence).toEqual({ unit: 'week', interval: 1 });
    expect(res.snapshot.profile).toMatchObject({ lastChest: NOW, chests: 3, dayBonus: { date: NOW, combo: true } });
    expect(res.snapshot.profile.dayBonus?.weekend).toEqual([data.habits[0].id]);
  });

  it('descarta repeticiones y agendas inválidas', () => {
    const file = buildBackup(buildDemo(defaultProfile('u1'), NOW));
    (file.data.tasks[0] as unknown as Record<string, unknown>).recurrence = { unit: 'siglo', interval: 1 };
    (file.data.tasks[1] as unknown as Record<string, unknown>).spawnedId = 'no-existe';
    const topics = file.data.courses[0].modules.flatMap((m) => m.topics);
    (topics[0] as unknown as Record<string, unknown>).reviewStage = 99;
    const res = parseBackup(JSON.stringify(file));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.snapshot.tasks[0].recurrence).toBeUndefined();
    expect(res.snapshot.tasks[1].spawnedId).toBeUndefined();
    expect(res.snapshot.courses[0].modules.flatMap((m) => m.topics)[0].reviewStage).toBeUndefined();
  });

  it('la tarea siguiente de una recurrente se enlaza aunque los ids no fueran UUID', () => {
    const file = {
      app: 'studyquest', version: 1,
      data: { tasks: [{ id: 'uno', title: 'A', spawnedId: 'dos', recurrence: { unit: 'day', interval: 2 } }, { id: 'dos', title: 'A' }] },
    };
    const res = parseBackup(JSON.stringify(file));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.snapshot.tasks[0].spawnedId).toBe(res.snapshot.tasks[1].id);
    expect(res.snapshot.tasks[0].recurrence).toEqual({ unit: 'day', interval: 2 });
  });
});

describe('guía de conceptos (tareas, hábitos, metas y proyectos)', () => {
  it('cada concepto tiene explicación, pregunta para elegirlo, varios ejemplos y una pista para su pantalla', () => {
    expect(CONCEPT_ORDER).toEqual(['tarea', 'habito', 'meta', 'proyecto']);
    for (const id of CONCEPT_ORDER) {
      const c = CONCEPTS[id];
      expect(c.name.length).toBeGreaterThan(3);
      for (const field of [c.what, c.question, c.how, c.hint]) expect(field.length, id).toBeGreaterThan(20);
      expect(c.examples.length, `${id}: varios ejemplos`).toBeGreaterThanOrEqual(5);
      expect(new Set(c.examples).size).toBe(c.examples.length);
      expect(c.id).toBe(id);
    }
    expect(new Set(CONCEPT_ORDER.map((id) => CONCEPTS[id].sprite)).size).toBe(4);
  });

  it('las pistas distinguen unos de otros (tarea = una vez, hábito = se repite, meta = largo plazo, proyecto = se construye)', () => {
    expect(CONCEPTS.tarea.what).toMatch(/una vez/);
    expect(CONCEPTS.habito.what).toMatch(/repites/);
    expect(CONCEPTS.meta.what).toMatch(/largo plazo/);
    expect(CONCEPTS.proyecto.what).toMatch(/construyes/);
  });

  it('cada concepto explica qué NO es y a qué concepto pertenece en realidad', () => {
    for (const id of CONCEPT_ORDER) {
      const { notThis } = CONCEPTS[id];
      expect(notThis.length, id).toBeGreaterThanOrEqual(2);
      for (const n of notThis) {
        expect(n.instead, `«${n.text}» debe apuntar a OTRO concepto`).not.toBe(id);
        expect(CONCEPT_ORDER).toContain(n.instead);
        expect(n.why.length).toBeGreaterThan(15);
      }
    }
  });

  it('hay varios ejemplos completos que cubren los cuatro conceptos', () => {
    expect(EXAMPLE_CHAINS.length).toBeGreaterThanOrEqual(3);
    for (const c of EXAMPLE_CHAINS) {
      expect(c.label && c.ambition).toBeTruthy();
      expect(c.meta).toMatch(/^Meta:/);
      expect(c.habito).toMatch(/^Hábito:/);
      expect(c.tarea).toMatch(/^Tarea:/);
      expect(c.proyecto).toMatch(/^Proyecto:/);
    }
    expect(new Set(EXAMPLE_CHAINS.map((c) => c.label)).size).toBe(EXAMPLE_CHAINS.length);
  });

  it('el mini test tiene respuestas correctas repartidas entre los cuatro conceptos, cada una explicada', () => {
    expect(QUIZ.length).toBeGreaterThanOrEqual(8);
    for (const id of CONCEPT_ORDER) expect(QUIZ.filter((q) => q.answer === id).length, id).toBeGreaterThanOrEqual(2);
    expect(QUIZ.every((q) => q.why.length > 15)).toBe(true);
    expect(new Set(QUIZ.map((q) => q.text)).size).toBe(QUIZ.length);
  });

  it('las dudas frecuentes cubren los casos que confunden', () => {
    const qs = FAQ.map((f) => f.q).join(' ');
    expect(qs).toMatch(/repite/);
    expect(qs).toMatch(/Meta o proyecto/);
    expect(FAQ.every((f) => f.a.length > 20)).toBe(true);
  });
});
