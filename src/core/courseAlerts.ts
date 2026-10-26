/**
 * Avisos por curso dentro de la app: llevas días sin tocarlo o su plazo se acerca. Funciones puras; quien las
 * llama decide cuándo mirar y evita repetir el mismo aviso el mismo día.
 */
import type { AppNotification, Course, ISODate, StudySession, Task } from './domain';
import { courseDeadline } from './courseDeadline';
import { courseWeek } from './courseCadence';
import { diffDays, toISODate, today } from './dates';

/** Días sin estudiar a partir de los cuales se avisa. */
export const IDLE_DAYS = 3;
/** Días al plazo a partir de los cuales se avisa, si aún quedan temas. */
export const DEADLINE_ALERT_DAYS = 3;
/** Tras avisar de que un curso está parado, no se repite el aviso durante estos días. */
export const IDLE_SILENCE_DAYS = 3;

export interface CourseAlert {
  title: string;
  body: string;
  /** Días que se calla el mismo aviso tras darlo: el de plazo se repite a diario; el de inactividad, no. */
  silenceDays: number;
}

export function courseAlerts(courses: Course[], sessions: StudySession[], tasks: Task[], now: ISODate = today()): CourseAlert[] {
  const out: CourseAlert[] = [];
  for (const c of courses) {
    const d = courseDeadline(c, tasks, now);
    if (d.state === 'done') continue;
    const w = courseWeek(c, sessions, now);

    if (d.daysLeft !== null && d.daysLeft >= 0 && d.daysLeft <= DEADLINE_ALERT_DAYS) {
      const when = d.daysLeft === 0 ? 'hoy' : d.daysLeft === 1 ? 'mañana' : `en ${d.daysLeft} días`;
      out.push({ title: `${c.title} termina ${when}`, body: `Te ${d.topicsLeft === 1 ? 'queda 1 tema' : `quedan ${d.topicsLeft} temas`}. Si no llegas, ajusta el plazo desde la ficha del curso.`, silenceDays: 1 });
    } else if (d.state === 'late') {
      out.push({ title: `${c.title} venció sin terminar`, body: 'Abre el curso: puedes mover el plazo o repartir los temas que faltan en tareas.', silenceDays: 1 });
    }

    // Sin estudiar hace días: solo si lo habías empezado a estudiar (un curso nuevo sin sesiones no se reclama).
    if (w.daysSince !== null && w.daysSince >= IDLE_DAYS) {
      out.push({ title: `${c.title} lleva días sin tocarse`, body: `Van ${w.daysSince} días desde la última sesión. 15 minutos bastan para mantener el ritmo.`, silenceDays: IDLE_SILENCE_DAYS });
    }
  }
  return out;
}

/** Los avisos que aún no se han dado: el mismo título notificado dentro de su `silenceDays` (día local) no se repite. */
export function newAlerts(alerts: CourseAlert[], existing: Pick<AppNotification, 'title' | 'createdAt'>[], now: ISODate = today()): CourseAlert[] {
  return alerts.filter((a) => !existing.some((n) => n.title === a.title && diffDays(now, toISODate(new Date(n.createdAt))) < a.silenceDays));
}
