import { describe, expect, it } from 'vitest';
import type { Course, Goal, Habit, Note, Project, Task } from './domain';
import { matchesQuery, searchAll, type SearchSource } from './search';

const task = (id: string, title: string, status: Task['status'] = 'todo'): Task => ({ id, title, courseId: null, priority: 'mid', status, dueDate: null, estimateMin: 0, xp: 10, subtasks: [], tags: [], createdAt: '', completedAt: null });
const note = (id: string, title: string, body = ''): Note => ({ id, title, body, courseId: null, topicId: null, tags: [], pinned: false, link: null, createdAt: '', updatedAt: '' });

const src = (s: Partial<SearchSource> = {}): SearchSource => ({ courses: [], tasks: [], habits: [], notes: [], goals: [], projects: [], ...s });

describe('búsqueda global', () => {
  it('con menos de dos letras no busca', () => {
    expect(searchAll(src({ tasks: [task('a', 'SQL')] }), 's')).toEqual([]);
    expect(searchAll(src({ tasks: [task('a', 'SQL')] }), '   ')).toEqual([]);
  });

  it('ignora tildes y mayúsculas', () => {
    const r = searchAll(src({ tasks: [task('a', 'Repaso de Álgebra')] }), 'algebra');
    expect(r.map((h) => h.label)).toEqual(['Repaso de Álgebra']);
  });

  it('cada resultado lleva a su destino exacto', () => {
    const s = src({
      courses: [{ id: 'c1', title: 'SQL básico' } as Course],
      tasks: [task('t1', 'Ejercicios SQL')],
      habits: [{ id: 'h1', title: 'Practicar SQL' } as Habit],
      notes: [note('n1', 'Joins', 'Un JOIN de SQL une tablas')],
      goals: [{ id: 'g1', title: 'Dominar SQL' } as Goal],
      projects: [{ id: 'p1', title: 'Panel SQL' } as Project],
    });
    expect(searchAll(s, 'sql').map((h) => `${h.kind} ${h.to}`)).toEqual([
      'Curso /cursos/c1',
      'Tarea /tareas?tarea=t1',
      'Hábito /habitos/h1',
      'Apunte /apuntes?nota=n1',
      'Meta /metas?meta=g1',
      'Proyecto /proyectos',
    ]);
  });

  it('las tareas pendientes salen antes que las terminadas', () => {
    const r = searchAll(src({ tasks: [task('a', 'Leer cap 1', 'done'), task('b', 'Leer cap 2')] }), 'leer');
    expect(r.map((h) => h.key)).toEqual(['t:b', 't:a']);
  });

  it('respeta el límite', () => {
    const tasks = Array.from({ length: 20 }, (_, i) => task(`t${i}`, `Tarea ${i}`));
    expect(searchAll(src({ tasks }), 'tarea')).toHaveLength(8);
  });
});

describe('filtro de listas', () => {
  it('con el campo vacío todo coincide', () => {
    expect(matchesQuery(['Leer'], '')).toBe(true);
    expect(matchesQuery(['Leer'], '   ')).toBe(true);
  });

  it('ignora tildes y mayúsculas, y basta una letra', () => {
    expect(matchesQuery(['Repaso de Álgebra'], 'ALGEBRA')).toBe(true);
    expect(matchesQuery(['Leer'], 'l')).toBe(true);
    expect(matchesQuery(['Leer'], 'z')).toBe(false);
  });

  it('exige todas las palabras, en cualquier orden y repartidas entre los textos', () => {
    expect(matchesQuery(['Ejercicios', 'SQL básico'], 'sql ejercicios')).toBe(true);
    expect(matchesQuery(['Ejercicios', 'SQL básico'], 'sql python')).toBe(false);
  });

  it('ignora textos vacíos o ausentes', () => {
    expect(matchesQuery([undefined, null, '', 'Correr'], 'correr')).toBe(true);
  });
});
