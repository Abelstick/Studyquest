/**
 * Apuntes: lo que escribes mientras estudias.
 *
 * El cuerpo es texto plano con un formato mínimo, pensado para escribir rápido:
 *   # Título        → encabezado
 *   - punto         → lista
 *   1. punto        → lista numerada
 *   **negrita**     → negrita
 *   `código`        → código
 *
 * Se analiza a una estructura de datos y la pantalla la pinta con elementos de React.
 * Nunca se convierte a HTML: así lo que escribas no puede inyectar nada en la app.
 *
 * Lógica pura, sin React ni base de datos.
 */
import type { ID, Note } from './domain';

/** Cuántos apuntes puede tener un tema antes de que deje de ser cómodo. */
export const MAX_TITLE = 120;

export type Inline = { kind: 'text'; text: string } | { kind: 'bold'; text: string } | { kind: 'code'; text: string };

export type Block =
  | { kind: 'heading'; level: 1 | 2; parts: Inline[] }
  | { kind: 'bullet'; items: Inline[][] }
  | { kind: 'numbered'; items: Inline[][] }
  | { kind: 'paragraph'; parts: Inline[] };

/** Parte una línea en trozos normales, en negrita y en código. */
export function parseInline(line: string): Inline[] {
  const out: Inline[] = [];
  // Se recorre buscando **negrita** o `código`; lo de en medio es texto tal cual.
  const re = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m.index > last) out.push({ kind: 'text', text: line.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ kind: 'bold', text: m[1] });
    else out.push({ kind: 'code', text: m[2] });
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push({ kind: 'text', text: line.slice(last) });
  return out.length ? out : [{ kind: 'text', text: '' }];
}

/** Convierte el cuerpo del apunte en bloques listos para pintar. */
export function parseNote(body: string): Block[] {
  const blocks: Block[] = [];
  const lines = body.replace(/\r\n?/g, '\n').split('\n');
  let i = 0;

  const collect = (test: (l: string) => RegExpMatchArray | null) => {
    const items: Inline[][] = [];
    while (i < lines.length) {
      const m = test(lines[i]);
      if (!m) break;
      items.push(parseInline(m[1].trim()));
      i++;
    }
    return items;
  };

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const head = /^(#{1,2})\s+(.*)$/.exec(line);
    if (head) {
      blocks.push({ kind: 'heading', level: head[1].length === 1 ? 1 : 2, parts: parseInline(head[2].trim()) });
      i++;
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      blocks.push({ kind: 'bullet', items: collect((l) => /^[-*]\s+(.*)$/.exec(l)) });
      continue;
    }
    if (/^\d+[.)]\s+/.test(line)) {
      blocks.push({ kind: 'numbered', items: collect((l) => /^\d+[.)]\s+(.*)$/.exec(l)) });
      continue;
    }
    // Párrafo: junta las líneas seguidas que no son de otro tipo.
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,2}\s|[-*]\s|\d+[.)]\s)/.test(lines[i])) {
      buf.push(lines[i].trim());
      i++;
    }
    blocks.push({ kind: 'paragraph', parts: parseInline(buf.join(' ')) });
  }
  return blocks;
}

/** Texto llano del apunte, sin marcas: para buscar y para el resumen de la lista. */
export const plainText = (body: string): string =>
  body
    .replace(/\r\n?/g, '\n')
    .replace(/^#{1,2}\s+/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/^\d+[.)]\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

/** Primeras palabras, para enseñar de qué va sin abrirlo. */
export const excerpt = (body: string, max = 140): string => {
  const t = plainText(body);
  return t.length <= max ? t : `${t.slice(0, max).trimEnd()}…`;
};

/** Cuántas palabras tiene (motiva ver que el apunte crece). */
export const wordCount = (body: string): number => {
  const t = plainText(body);
  return t ? t.split(/\s+/).length : 0;
};

/** Minutos aproximados de lectura, a 200 palabras por minuto. */
export const readingMinutes = (body: string): number => Math.max(1, Math.round(wordCount(body) / 200));

/** Los fijados primero y, dentro de cada grupo, el más reciente arriba. */
export const sortNotes = (list: Note[]): Note[] =>
  [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title));

/** Busca en título, cuerpo y etiquetas, sin distinguir mayúsculas ni tildes. */
export function searchNotes(list: Note[], query: string): Note[] {
  const needle = fold(query);
  if (!needle) return list;
  return list.filter((n) => fold(`${n.title} ${plainText(n.body)} ${n.tags.join(' ')}`).includes(needle));
}

/** Quita tildes y pasa a minúsculas, para que «examen» encuentre «Examen» y «exámen». */
export const fold = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** Apuntes de un tema concreto. */
export const notesOfTopic = (list: Note[], topicId: ID): Note[] => list.filter((n) => n.topicId === topicId);

/** Apuntes de un curso (incluidos los de sus temas). */
export const notesOfCourse = (list: Note[], courseId: ID): Note[] => list.filter((n) => n.courseId === courseId);

/** Todas las etiquetas usadas, ordenadas y sin repetir. */
export const allTags = (list: Note[]): string[] =>
  [...new Set(list.flatMap((n) => n.tags).map((t) => t.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));

/** Un apunte recién creado. */
export const blankNote = (over: Partial<Note> = {}): Omit<Note, 'id' | 'createdAt' | 'updatedAt'> => ({
  title: '',
  body: '',
  courseId: null,
  topicId: null,
  tags: [],
  pinned: false,
  link: null,
  ...over,
});

/** Todo el cuaderno en un archivo Markdown, para llevártelo a Obsidian o a donde quieras. */
export function toMarkdown(list: Note[], courseName: (id: ID) => string | undefined): string {
  return sortNotes(list)
    .map((n) => {
      const meta = [n.courseId ? courseName(n.courseId) : null, n.tags.length ? n.tags.map((t) => `#${t.replace(/\s+/g, '-')}`).join(' ') : null]
        .filter(Boolean)
        .join(' · ');
      const link = n.link ? `[Abrir enlace](${n.link})\n\n` : '';
      return `# ${n.title || 'Sin título'}\n${meta ? `\n*${meta}*\n` : ''}\n${link}${n.body.trim()}\n`;
    })
    .join('\n---\n\n');
}
