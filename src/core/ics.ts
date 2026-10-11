/**
 * Exporta las tareas con fecha a un calendario iCalendar (.ics, RFC 5545) para importarlo en
 * Google Calendar, Outlook o Calendario de Apple. Función pura: la pantalla solo descarga el texto.
 *
 * - Una tarea sin hora límite es un evento de día completo en su fecha.
 * - Con hora límite, es un evento de 30 minutos que TERMINA a esa hora, con una alarma una hora antes.
 * - Las horas van en hora local "flotante" (sin zona): cada calendario las coloca en la zona del usuario.
 * - El UID es el id de la tarea, así que importar de nuevo actualiza los eventos en vez de duplicarlos.
 */
import type { Course, Task } from './domain';
import { addDays, clockToMinutes } from './dates';
import { dueTimeOf } from './tasks';

const EVENT_MIN = 30;

const pad = (n: number) => String(n).padStart(2, '0');
const icsDate = (d: string) => d.replaceAll('-', '');
const icsLocal = (d: string, minutes: number) => `${icsDate(d)}T${pad(Math.floor(minutes / 60))}${pad(minutes % 60)}00`;
const icsUtc = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

/** Escapa texto según RFC 5545: barra invertida, punto y coma, coma y saltos de línea. */
export const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Pliega una línea a 75 octetos como pide el estándar, sin partir un carácter UTF-8 por la mitad. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    // La primera línea admite 75 octetos; las de continuación, 74 más el espacio inicial.
    if (bytes + n > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

/** Tareas que van al calendario: abiertas y con fecha. */
export const exportableTasks = (tasks: Task[]): Task[] => tasks.filter((t) => t.status !== 'done' && !!t.dueDate);

export function buildIcs(tasks: Task[], courses: Pick<Course, 'id' | 'title'>[], stamp: Date = new Date()): string {
  const courseName = (id: string | null) => courses.find((c) => c.id === id)?.title ?? 'Side quest';
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//StudyQuest//Tareas//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:StudyQuest · Tareas'];

  for (const t of exportableTasks(tasks)) {
    const due = t.dueDate as string;
    const time = dueTimeOf(t);
    const desc = [`${courseName(t.courseId)} · +${t.xp} XP`, ...t.subtasks.filter((s) => !s.done).map((s) => `- ${s.title}`)].join('\n');
    lines.push('BEGIN:VEVENT', `UID:${t.id}@studyquest`, `DTSTAMP:${icsUtc(stamp)}`);
    if (time) {
      const end = clockToMinutes(time);
      lines.push(`DTSTART:${icsLocal(due, Math.max(0, end - EVENT_MIN))}`, `DTEND:${icsLocal(due, end)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${icsDate(due)}`, `DTEND;VALUE=DATE:${icsDate(addDays(due, 1))}`);
    }
    lines.push(`SUMMARY:${icsText(`${time ? '⏰' : '📌'} ${t.title}`)}`, `DESCRIPTION:${icsText(desc)}`, 'TRANSP:TRANSPARENT');
    if (t.tags.length) lines.push(`CATEGORIES:${t.tags.map(icsText).join(',')}`);
    if (time) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(t.title)}`, 'TRIGGER;RELATED=END:-PT1H', 'END:VALARM');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
