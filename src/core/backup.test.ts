import { describe, expect, it } from 'vitest';
import { BACKUP_VERSION, buildBackup, parseBackup, summarize } from './backup';
import { buildDemo } from './seed';
import { defaultProfile } from './game';
import { today } from './dates';

const demo = () => buildDemo(defaultProfile('u1'), today());
const roundtrip = (data = demo()) => parseBackup(JSON.stringify(buildBackup(data)), 'u2');

describe('copia de seguridad', () => {
  it('exportar → importar conserva todo el contenido', () => {
    const original = demo();
    const res = roundtrip(original);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.warnings).toEqual([]);
    expect(summarize(res.snapshot)).toEqual(summarize(original));
    expect(res.snapshot.profile.xp).toBe(original.profile.xp);
    expect(res.snapshot.profile.credits).toBe(original.profile.credits);
    expect(res.snapshot.tasks.map((t) => t.id)).toEqual(original.tasks.map((t) => t.id));
    expect(res.snapshot.courses[0].modules[4].topics[2].review).toBe(true);
    expect(res.snapshot.habits[0].frequency).toEqual(original.habits[0].frequency);
    expect(res.snapshot.habitLogs).toHaveLength(original.habitLogs.length);
    expect(res.snapshot.profile.achievements.length).toBe(original.profile.achievements.length);
  });

  it('el héroe 3D viaja en la copia con sus objetos', () => {
    const original = demo();
    const res = roundtrip(original);
    expect(res.ok && res.snapshot.profile.hero).toEqual(original.profile.hero);
  });

  it('un héroe manipulado no puede llevar objetos que no compró', () => {
    const data = demo();
    data.profile.hero = { race: 'terran', name: 'Rex', stage: 9, weapon: 'hero-w-lanza', power: 'hero-p-chispas', skin: 'hero-s-cosmos' };
    const res = roundtrip(data);
    expect(res.ok && res.snapshot.profile.hero).toEqual({ race: 'terran', name: 'Rex', stage: 3, weapon: null, power: 'hero-p-chispas', skin: null });
  });

  it('el id de perfil lo pone quien importa, no el archivo', () => {
    const res = roundtrip();
    expect(res.ok && res.snapshot.profile.id).toBe('u2');
  });

  it('conserva el intervalo de repetición del recordatorio (y descarta valores absurdos)', () => {
    const file = buildBackup(demo());
    file.data.habits[0].reminder = '19:00';
    file.data.habits[0].reminderRepeatMin = 15;
    file.data.habits[1].reminderRepeatMin = 99999;
    const res = parseBackup(JSON.stringify(file));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.snapshot.habits[0].reminderRepeatMin).toBe(15);
    expect(res.snapshot.habits[1].reminderRepeatMin).toBeUndefined();
  });

  it('rechaza lo que no es una copia de StudyQuest', () => {
    expect(parseBackup('no es json').ok).toBe(false);
    expect(parseBackup('{"hola":1}').ok).toBe(false);
    expect(parseBackup(JSON.stringify({ app: 'otra', version: 1, data: {} })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ app: 'studyquest', version: 1 })).ok).toBe(false);
  });

  it('rechaza copias de una versión más nueva', () => {
    const res = parseBackup(JSON.stringify({ app: 'studyquest', version: BACKUP_VERSION + 1, data: {} }));
    expect(res.ok).toBe(false);
  });

  it('descarta elementos inválidos y avisa', () => {
    const file = buildBackup(demo());
    (file.data.tasks as unknown[]).push({ id: 'x' }, 'basura', null);
    (file.data.sessions as unknown[]).push({ id: 's', date: 'ayer', minutes: 10 });
    const res = parseBackup(JSON.stringify(file));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.snapshot.tasks).toHaveLength(demo().tasks.length);
    expect(res.warnings.join(' ')).toMatch(/tareas descartados/);
    expect(res.warnings.join(' ')).toMatch(/sesiones de estudio descartados/);
  });

  it('descarta registros de hábitos huérfanos y desvincula sesiones de cursos que no existen', () => {
    const file = buildBackup(demo());
    file.data.habitLogs.push({ id: crypto.randomUUID(), habitId: crypto.randomUUID(), date: '2026-09-01', value: 1, stepsDone: [] });
    file.data.sessions[0].courseId = crypto.randomUUID();
    const res = parseBackup(JSON.stringify(file));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.snapshot.habitLogs).toHaveLength(demo().habitLogs.length);
    expect(res.snapshot.sessions[0].courseId).toBeNull();
  });

  it('las certificaciones viajan en la copia, con su enlace y su vínculo al curso', () => {
    const file = buildBackup(demo());
    expect(file.data.certifications.length).toBeGreaterThan(0);
    const res = parseBackup(JSON.stringify(file));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.snapshot.certifications).toHaveLength(demo().certifications.length);
    const conCurso = res.snapshot.certifications.find((c) => c.courseId);
    expect(conCurso?.url).toMatch(/^https:\/\//);
    expect(res.snapshot.courses.some((c) => c.id === conCurso?.courseId)).toBe(true);
  });

  it('una copia manipulada no puede colar un enlace «javascript:» ni un curso inexistente', () => {
    const file = buildBackup(demo());
    file.data.certifications[0].url = 'javascript:alert(document.cookie)';
    file.data.certifications[1].courseId = crypto.randomUUID();
    const res = parseBackup(JSON.stringify(file));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.snapshot.certifications[0].url).toBe('');
    expect(res.snapshot.certifications[1].courseId).toBeNull();
  });

  it('un apunte con enlace externo (Notion, Obsidian…) viaja en la copia, incluso sin título ni cuerpo', () => {
    const file = buildBackup(demo());
    const conEnlace = demo().notes.find((n) => n.link);
    expect(conEnlace).toBeTruthy();
    const res = parseBackup(JSON.stringify(file));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.snapshot.notes.some((n) => n.link === conEnlace!.link)).toBe(true);
  });

  it('una copia manipulada no puede colar un enlace «javascript:» en un apunte, pero uno solo con enlace sigue siendo válido', () => {
    const file = buildBackup(demo());
    const idx = file.data.notes.findIndex((n) => n.link);
    file.data.notes[idx].link = 'javascript:alert(1)';
    file.data.notes[idx].title = '';
    file.data.notes[idx].body = '';
    const res = parseBackup(JSON.stringify(file));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const restaurado = res.snapshot.notes[idx];
    expect(restaurado.link).toBeNull();
  });

  it('convierte ids que no son UUID y reescribe las referencias', () => {
    const file = {
      app: 'studyquest', version: 1, exportedAt: '',
      data: {
        profile: { displayName: 'Ana', xp: 10 },
        courses: [{ id: 'curso-1', title: 'Álgebra', modules: [] }],
        tasks: [{ id: 't-1', title: 'Ejercicios', courseId: 'curso-1' }],
        habits: [{ id: 'h-1', title: 'Leer', frequency: { type: 'daily' }, target: 20 }],
        habitLogs: [{ id: 'l-1', habitId: 'h-1', date: '2026-09-20', value: 20 }],
      },
    };
    const res = parseBackup(JSON.stringify(file));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const uuid = /^[0-9a-f-]{36}$/;
    const [course] = res.snapshot.courses;
    expect(course.id).toMatch(uuid);
    expect(res.snapshot.tasks[0].id).toMatch(uuid);
    expect(res.snapshot.tasks[0].courseId).toBe(course.id);
    expect(res.snapshot.habitLogs[0].habitId).toBe(res.snapshot.habits[0].id);
    expect(res.snapshot.profile.displayName).toBe('Ana');
    expect(res.warnings.join(' ')).toMatch(/identificadores/);
  });

  it('elementos sin id reciben ids distintos entre sí', () => {
    const file = { app: 'studyquest', version: 1, data: { tasks: [{ title: 'A' }, { title: 'B' }] } };
    const res = parseBackup(JSON.stringify(file));
    expect(res.ok && new Set(res.snapshot.tasks.map((t) => t.id)).size).toBe(2);
  });

  it('una copia mínima (solo perfil) es válida', () => {
    const res = parseBackup(JSON.stringify({ app: 'studyquest', version: 1, data: { profile: {} } }));
    expect(res.ok && res.snapshot.tasks).toEqual([]);
  });
});
