import type { ISODate } from './domain';

const pad = (n: number) => String(n).padStart(2, '0');

export const toISODate = (d: Date): ISODate => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromISODate = (s: ISODate): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const today = (): ISODate => toISODate(new Date());
export const addDays = (s: ISODate, n: number): ISODate => {
  const d = fromISODate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
};
/** Suma meses conservando el día; si el mes destino es más corto, cae en su último día (31 ene + 1 mes = 28/29 feb). */
export const addMonths = (s: ISODate, n: number): ISODate => {
  const d = fromISODate(s);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return toISODate(d);
};
export const diffDays = (a: ISODate, b: ISODate): number =>
  Math.round((fromISODate(a).getTime() - fromISODate(b).getTime()) / 86_400_000);

/** 0 = lunes … 6 = domingo. */
export const weekdayIndex = (s: ISODate): number => (fromISODate(s).getDay() + 6) % 7;
export const isWeekend = (s: ISODate): boolean => weekdayIndex(s) >= 5;
export const weekStart = (s: ISODate): ISODate => addDays(s, -weekdayIndex(s));
export const monthKey = (s: ISODate): string => s.slice(0, 7);
export const isoNow = (): string => new Date().toISOString();

export const WEEKDAYS_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;
const WEEKDAYS_ABBR = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DAYS_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export const monthName = (m: number) => MONTHS_LONG[m];
export const weekdayAbbr = (i: number) => WEEKDAYS_ABBR[i];
export const longDate = (s: ISODate): string => {
  const d = fromISODate(s);
  return `${DAYS_LONG[d.getDay()]} ${d.getDate()} de ${MONTHS_LONG[d.getMonth()]}`;
};

/** "Hoy", "Mañana", "Vie 22" … para chips de fecha límite. */
export const dueLabel = (due: ISODate | null, now: ISODate = today()): string => {
  if (!due) return 'Sin fecha';
  const diff = diffDays(due, now);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff === -1) return 'Ayer';
  const d = fromISODate(due);
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()}`;
};
export const shortDate = (s: ISODate): string => {
  const d = fromISODate(s);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

export const agoLabel = (iso: string, now: number = Date.now()): string => {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `hace ${Math.max(1, mins)} min`;
  const h = Math.round(mins / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
};

export const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 3) | 8).toString(16);
      });

export const agoDays = (d: ISODate, now: ISODate = today()): string => {
  const n = diffDays(now, d);
  if (n <= 0) return 'hoy';
  return n === 1 ? 'ayer' : `hace ${n} días`;
};
