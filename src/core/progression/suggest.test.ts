import { describe, expect, it } from 'vitest';
import type { Course, Habit, Task } from '../domain';
import { CATEGORIES } from './categories';
import { mappingOf, normalize, suggestMapping, SUGGEST_MAPPING_TOOL } from './suggest';
import { cleanProgressable, habitMapping, taskMapping, withMissingCategories } from './sources';

describe('suggestMapping', () => {
  it.each([
    ['Gimnasio', 'gimnasio', 'fue', 'vit'],
    ['Ir al gym', 'gimnasio', 'fue', 'vit'],
    ['Estudiar SQL', 'estudio', 'int', 'dis'],
    ['Tomar 8 vasos de agua', 'hidratacion', 'vit', 'dis'],
    ['Dormir 8 horas', 'sueno', 'vit', 'esp'],
    ['Meditar 10 minutos', 'meditacion', 'esp', 'vit'],
    ['Leer una novela', 'lectura', 'esp', 'int'],
    ['Practicar guitarra', 'arte', 'cre', 'esp'],
    ['Resolver un ejercicio de LeetCode', 'codigo', 'int', 'cre'],
    ['Enviar el informe al cliente', 'trabajo', 'dis', 'int'],
    ['Escribir en mi diario', 'journaling', 'esp', 'cre'],
    ['Inglés con Duolingo', 'idiomas', 'int', 'dis'],
    ['Salir a correr', 'deporte', 'fue', 'dis'],
  ])('«%s» → %s (%s 70 %% / %s 30 %%)', (title, category, primary, secondary) => {
    const s = suggestMapping(title);
    expect(s.category).toBe(category);
    expect(s.mapping).toEqual({ primary, secondary });
    expect(s.matched.length).toBeGreaterThan(0);
  });

  it('ignora mayúsculas y tildes', () => {
    expect(normalize('  Meditación ÁGIL ')).toBe(' meditacion agil ');
    expect(suggestMapping('MEDITACIÓN').category).toBe('meditacion');
  });

  it('las palabras cortas solo cuentan enteras («git» no está en «digital»)', () => {
    expect(suggestMapping('Marketing digital').category).not.toBe('codigo');
  });

  it('sin pistas usa el tipo, luego el área y si no, General (→ Disciplina)', () => {
    expect(suggestMapping('Zzz', { kind: 'course' })).toMatchObject({ category: 'curso', confidence: 'low' });
    expect(suggestMapping('Zzz', { kind: 'project' }).category).toBe('proyecto');
    expect(suggestMapping('Zzz', { area: 'money' }).category).toBe('finanzas');
    expect(suggestMapping('Zzz')).toMatchObject({ category: 'general', mapping: { primary: 'dis', secondary: null }, confidence: 'low' });
  });

  it('una pista débil no gana a la categoría heredada del curso', () => {
    expect(suggestMapping('Repasar', { inherit: 'idiomas' }).category).toBe('idiomas');
    // Una pista clara sí manda.
    expect(suggestMapping('Ir al gimnasio', { inherit: 'idiomas' }).category).toBe('gimnasio');
  });

  it('varias pistas fuertes dan confianza alta', () => {
    expect(suggestMapping('Gimnasio: pesas y sentadillas').confidence).toBe('high');
  });

  it('el reparto elegido a mano manda sobre la categoría', () => {
    expect(mappingOf({ title: 'Gimnasio', category: 'gimnasio', attributes: { primary: 'dis', secondary: 'esp' } })).toEqual({ primary: 'dis', secondary: 'esp' });
    expect(mappingOf({ title: 'Lo que sea', category: 'arte' })).toEqual({ primary: 'cre', secondary: 'esp' });
    expect(mappingOf({ title: 'Ir al gym' })).toEqual({ primary: 'fue', secondary: 'vit' });
  });

  it('todas las categorías del catálogo tienen un reparto válido y distinto entre primario y secundario', () => {
    for (const c of CATEGORIES) expect(c.mapping.secondary).not.toBe(c.mapping.primary);
  });

  it('expone la herramienta para la IA con el título obligatorio', () => {
    expect(SUGGEST_MAPPING_TOOL.parameters.required).toEqual(['title']);
  });
});

describe('fuentes y categorías existentes', () => {
  const course = { id: 'c1', title: 'Inglés B1', field: 'Idiomas', modules: [], mentor: null, professor: '', createdAt: '' } as Course;
  const task = { id: 't1', title: 'Repasar capítulo 3', courseId: 'c1', tags: [] as string[] } as Task;
  const habit = { id: 'h1', title: 'Tomar agua', courseId: undefined } as Habit;

  it('una tarea de un curso hereda su categoría si el título no dice nada claro', () => {
    expect(taskMapping(task, [course])).toEqual({ primary: 'int', secondary: 'dis' });
    expect(habitMapping(habit, [course])).toEqual({ primary: 'vit', secondary: 'dis' });
  });

  it('asigna categoría solo a lo que no la tiene, cursos primero', () => {
    const fixed = withMissingCategories({ courses: [course], tasks: [task, { ...task, id: 't2', category: 'arte' }], habits: [habit], goals: [], projects: [] });
    expect(fixed.courses.map((c) => c.category)).toEqual(['idiomas']);
    expect(fixed.tasks.map((t) => [t.id, t.category])).toEqual([['t1', 'idiomas']]);
    expect(fixed.habits[0].category).toBe('hidratacion');
  });

  it('limpia categoría y reparto venidos de fuera', () => {
    expect(cleanProgressable({ category: 'arte', attributes: { primary: 'cre', secondary: 'cre' } })).toEqual({ category: 'arte', attributes: { primary: 'cre', secondary: null } });
    expect(cleanProgressable({ category: 'nope', attributes: { primary: 'xxx' } })).toEqual({});
  });
});
