import { describe, expect, it } from 'vitest';
import { buildPackEntities, packPrompt, parsePack } from './pack';

const sample = {
  studyquest: 'pack', version: 1,
  courses: [{ title: 'SQL', link: 'udemy.com/course/sql', modules: [{ title: 'Básico', topics: ['SELECT', { title: 'JOIN' }] }] }],
  goals: [{ title: 'Ser analista', milestones: [{ title: 'SQL', skills: ['SELECT'] }] }],
  projects: [{ title: 'Dashboard', checkpoints: ['Datos', { title: 'Gráficos', xp: 200 }] }],
  habits: [{ title: 'Estudiar', frequency: { type: 'days', days: [0, 2, 9] }, measure: 'minutes', target: 30, reminder: '19:00' }],
  tasks: [{ title: 'Instalar', course: 'sql', dueInDays: 3, priority: 'high', subtasks: ['a'] }, { title: '' }],
};

describe('pack de aprendizaje', () => {
  it('lee JSON envuelto en texto y vallas de código', () => {
    const r = parsePack('Aquí tienes:\n```json\n' + JSON.stringify(sample) + '\n```\n¡Suerte!');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.pack.courses[0].modules[0].topics.map((t) => t.title)).toEqual(['SELECT', 'JOIN']);
      expect(r.pack.habits[0].frequency).toEqual({ type: 'days', days: [0, 2] });
      expect(r.pack.tasks).toHaveLength(1);
      expect(r.warnings.join()).toContain('descartaron');
    }
  });

  it('rechaza texto sin JSON, JSON vacío y versiones futuras', () => {
    expect(parsePack('hola').ok).toBe(false);
    expect(parsePack('{}').ok).toBe(false);
    expect(parsePack('{"version":99,"tasks":[{"title":"x"}]}').ok).toBe(false);
  });

  it('convierte a entidades con ids nuevos, fechas desde hoy y tareas ligadas al curso', () => {
    const r = parsePack(JSON.stringify(sample));
    if (!r.ok) throw new Error(r.error);
    const e = buildPackEntities(r.pack, [], '2026-10-01');
    expect(e.courses[0].link).toBe('https://udemy.com/course/sql');
    expect(e.tasks[0].courseId).toBe(e.courses[0].id);
    expect(e.tasks[0].dueDate).toBe('2026-10-04');
    expect(e.tasks[0].xp).toBe(50);
    expect(e.habits[0].startDate).toBe('2026-10-01');
    const ids = [e.courses[0].id, e.courses[0].modules[0].id, e.courses[0].modules[0].topics[0].id, e.goals[0].milestones[0].skills[0].id];
    expect(new Set(ids).size).toBe(4);
    expect(ids.every(Boolean)).toBe(true);
  });

  it('vincula tareas a un curso que ya existe en la app', () => {
    const r = parsePack('{"tasks":[{"title":"x","course":"Mi Curso"}]}');
    if (!r.ok) throw new Error(r.error);
    expect(buildPackEntities(r.pack, [{ id: 'c1', title: 'mi curso' }]).tasks[0].courseId).toBe('c1');
  });

  it('el JSON de ejemplo del prompt es aceptado por el propio parser', () => {
    const prompt = packPrompt('SQL');
    expect(prompt).toContain('SQL');
    const r = parsePack(prompt.slice(prompt.indexOf('{'), prompt.indexOf('Reglas del formato')));
    expect(r.ok).toBe(true);
  });
});

describe('enlace del curso', () => {
  it('descarta enlaces peligrosos o inválidos', () => {
    const r = parsePack('{"courses":[{"title":"A","link":"javascript:alert(1)"},{"title":"B","link":"no es url"}]}');
    if (!r.ok) throw new Error(r.error);
    expect(r.pack.courses.map((c) => c.link)).toEqual([undefined, undefined]);
  });
});
