import { describe, expect, it } from 'vitest';
import type { Note } from './domain';
import { agoDays, toISODate } from './dates';
import { allTags, excerpt, fold, notesOfCourse, notesOfTopic, parseInline, parseNote, plainText, readingMinutes, searchNotes, sortNotes, toMarkdown, wordCount } from './notes';

const note = (over: Partial<Note> = {}): Note => ({
  id: 'n1', title: 'Apunte', body: '', courseId: null, topicId: null, tags: [], pinned: false,
  createdAt: '2026-09-01T10:00:00.000Z', updatedAt: '2026-09-01T10:00:00.000Z', ...over,
});

describe('formato del apunte', () => {
  it('reconoce encabezados de dos niveles', () => {
    expect(parseNote('# Grande\n## Pequeño')).toEqual([
      { kind: 'heading', level: 1, parts: [{ kind: 'text', text: 'Grande' }] },
      { kind: 'heading', level: 2, parts: [{ kind: 'text', text: 'Pequeño' }] },
    ]);
  });

  it('agrupa las líneas de una lista en un solo bloque', () => {
    const [b] = parseNote('- uno\n- dos\n- tres');
    expect(b.kind).toBe('bullet');
    expect(b.kind === 'bullet' && b.items).toHaveLength(3);
  });

  it('distingue lista numerada de lista normal', () => {
    expect(parseNote('1. uno\n2. dos')[0].kind).toBe('numbered');
    expect(parseNote('- uno')[0].kind).toBe('bullet');
  });

  it('junta líneas seguidas en un párrafo', () => {
    const b = parseNote('una línea\ny otra');
    expect(b).toHaveLength(1);
    expect(b[0]).toEqual({ kind: 'paragraph', parts: [{ kind: 'text', text: 'una línea y otra' }] });
  });

  it('separa negrita y código dentro de la línea', () => {
    expect(parseInline('esto es **fuerte** y esto `codigo`')).toEqual([
      { kind: 'text', text: 'esto es ' },
      { kind: 'bold', text: 'fuerte' },
      { kind: 'text', text: ' y esto ' },
      { kind: 'code', text: 'codigo' },
    ]);
  });

  it('el texto se devuelve como DATOS, nunca como HTML: no se puede inyectar nada', () => {
    const malo = '# <script>alert(1)</script>\n- <img src=x onerror=alert(1)>';
    const bloques = parseNote(malo);
    // las etiquetas viajan como texto plano dentro de los trozos, sin interpretarse
    expect(bloques[0]).toEqual({ kind: 'heading', level: 1, parts: [{ kind: 'text', text: '<script>alert(1)</script>' }] });
    expect(JSON.stringify(bloques)).not.toContain('dangerous');
  });

  it('las líneas en blanco no generan bloques vacíos', () => {
    expect(parseNote('\n\nhola\n\n\nadiós\n\n')).toHaveLength(2);
  });

  it('un cuerpo vacío no da bloques', () => {
    expect(parseNote('')).toEqual([]);
  });
});

describe('resumen y medidas', () => {
  const body = '# Título\n\n- **uno** con `código`\n- dos\n\nUn párrafo final.';

  it('el texto llano quita todas las marcas', () => {
    expect(plainText(body)).toBe('Título uno con código dos Un párrafo final.');
  });

  it('cuenta palabras y estima la lectura', () => {
    expect(wordCount(body)).toBe(8);
    expect(readingMinutes(body)).toBe(1); // siempre al menos 1 minuto
    expect(readingMinutes('palabra '.repeat(600))).toBe(3);
  });

  it('el resumen se corta con puntos suspensivos', () => {
    expect(excerpt('hola', 10)).toBe('hola');
    expect(excerpt('a'.repeat(200), 10)).toBe(`${'a'.repeat(10)}…`);
  });

  it('un apunte vacío no cuenta palabras', () => {
    expect(wordCount('')).toBe(0);
  });
});

describe('lista de apuntes', () => {
  it('los fijados van arriba y, dentro, el más reciente primero', () => {
    const list = [
      note({ id: 'viejo', updatedAt: '2026-01-01T00:00:00.000Z' }),
      note({ id: 'fijado', pinned: true, updatedAt: '2025-01-01T00:00:00.000Z' }),
      note({ id: 'nuevo', updatedAt: '2026-09-20T00:00:00.000Z' }),
    ];
    expect(sortNotes(list).map((n) => n.id)).toEqual(['fijado', 'nuevo', 'viejo']);
  });

  it('busca sin distinguir mayúsculas ni tildes', () => {
    const list = [note({ id: 'a', title: 'Exámen de SQL' }), note({ id: 'b', body: 'repasar JOINs' }), note({ id: 'c', tags: ['Álgebra'] })];
    expect(searchNotes(list, 'examen').map((n) => n.id)).toEqual(['a']);
    expect(searchNotes(list, 'joins').map((n) => n.id)).toEqual(['b']);
    expect(searchNotes(list, 'algebra').map((n) => n.id)).toEqual(['c']);
    expect(searchNotes(list, '').map((n) => n.id)).toEqual(['a', 'b', 'c']);
  });

  it('busca también dentro del cuerpo con formato', () => {
    const list = [note({ body: '- **importante**: la clave foránea' })];
    expect(searchNotes(list, 'clave foranea')).toHaveLength(1);
  });

  it('fold quita tildes y mayúsculas', () => {
    expect(fold('  ÁÉÍÓÚñ  ')).toBe('aeioun');
  });

  it('filtra por curso y por tema', () => {
    const list = [note({ id: 'a', courseId: 'c1', topicId: 't1' }), note({ id: 'b', courseId: 'c1' }), note({ id: 'c', courseId: 'c2' })];
    expect(notesOfCourse(list, 'c1').map((n) => n.id)).toEqual(['a', 'b']);
    expect(notesOfTopic(list, 't1').map((n) => n.id)).toEqual(['a']);
  });

  it('reúne las etiquetas sin repetir y ordenadas', () => {
    const list = [note({ tags: ['sql', 'examen'] }), note({ tags: ['examen', ' '] }), note({ tags: ['python'] })];
    expect(allTags(list)).toEqual(['examen', 'python', 'sql']);
  });
});

describe('exportar a Markdown', () => {
  it('escribe un documento con título, curso, etiquetas y cuerpo', () => {
    const list = [note({ title: 'JOINs', body: '- inner\n- left', courseId: 'c1', tags: ['sql', 'base de datos'] })];
    const md = toMarkdown(list, () => 'Análisis de Datos');
    expect(md).toContain('# JOINs');
    expect(md).toContain('Análisis de Datos');
    expect(md).toContain('#sql');
    expect(md).toContain('#base-de-datos'); // las etiquetas con espacios se unen con guiones
    expect(md).toContain('- inner');
  });

  it('separa los apuntes y no deja títulos vacíos', () => {
    const md = toMarkdown([note({ id: 'a', title: '' }), note({ id: 'b', title: 'Dos', updatedAt: '2026-09-02T00:00:00.000Z' })], () => undefined);
    expect(md).toContain('# Sin título');
    expect(md).toContain('\n---\n');
  });
});

describe('fechas con hora', () => {
  it('«hace X días» entiende una marca de tiempo completa, no solo una fecha suelta', () => {
    // Los apuntes guardan fecha Y hora; antes esto daba «hace NaN días» en pantalla.
    const hoy = new Date(2026, 8, 20, 12);
    const haceTres = new Date(2026, 8, 17, 9, 30).toISOString();
    expect(agoDays(haceTres, toISODate(hoy))).toBe('hace 3 días');
    expect(agoDays(new Date(2026, 8, 20, 8).toISOString(), toISODate(hoy))).toBe('hoy');
    expect(agoDays(new Date(2026, 8, 19, 23).toISOString(), toISODate(hoy))).toBe('ayer');
  });

  it('y sigue funcionando con una fecha suelta', () => {
    expect(agoDays('2026-09-18', '2026-09-20')).toBe('hace 2 días');
  });
});
