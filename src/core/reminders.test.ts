import { describe, expect, it } from 'vitest';
import { DEFAULT_REPEAT_MIN, MAX_REMINDERS_PER_DAY, planReminders, reminderDecision, type HabitRow, type SentState } from '../../supabase/functions/_shared/reminders';

// 2026-09-21 00:00Z = domingo 20 de septiembre a las 19:00 en Lima (UTC-5)
const T19 = Date.UTC(2026, 8, 21, 0, 0, 0);
const at = (minAfter: number) => new Date(T19 + minAfter * 60_000);
const TZ = 'America/Lima';

const habit = (over: Partial<HabitRow['data']> = {}, id = 'h1'): HabitRow => ({
  id,
  data: { title: 'Estudiar Python', reminder: '19:00', frequency: { type: 'daily' }, target: 30, startDate: '2026-01-01', xp: 30, ...over },
});
const plan = (habits: HabitRow[], minAfter: number, sent: Record<string, SentState> = {}, logs: { habitId: string; date: string; value: number }[] = []) =>
  planReminders({ habits, logs, sent, now: at(minAfter), timeZone: TZ });
const sentAt = (count: number, minAfter: number): SentState => ({ count, lastSentAt: T19 + minAfter * 60_000 });

describe('reminderDecision', () => {
  const base = { repeatMin: 30, state: null, nowMs: 0 };
  it('el primer aviso sale a la hora y hasta 10 minutos después', () => {
    expect(reminderDecision({ ...base, sinceMin: 0 })).toBe('first');
    expect(reminderDecision({ ...base, sinceMin: 9 })).toBe('first');
    expect(reminderDecision({ ...base, sinceMin: 10 })).toBe('wait');
  });
  it('antes de la hora no se avisa', () => {
    expect(reminderDecision({ ...base, sinceMin: -1 })).toBe('wait');
    expect(reminderDecision({ ...base, sinceMin: null })).toBe('wait');
  });
  it('se repite pasados N minutos desde el último aviso, no antes', () => {
    const state = { count: 1, lastSentAt: 0 };
    expect(reminderDecision({ sinceMin: 20, repeatMin: 30, state, nowMs: 29 * 60_000 })).toBe('wait');
    expect(reminderDecision({ sinceMin: 30, repeatMin: 30, state, nowMs: 30 * 60_000 })).toBe('repeat');
  });
  it('tolera medio minuto de desfase del cron', () => {
    const state = { count: 1, lastSentAt: 0 };
    expect(reminderDecision({ sinceMin: 30, repeatMin: 30, state, nowMs: 29.6 * 60_000 })).toBe('repeat');
  });
  it('repeatMin = 0 desactiva la repetición', () => {
    expect(reminderDecision({ sinceMin: 200, repeatMin: 0, state: { count: 1, lastSentAt: 0 }, nowMs: 200 * 60_000 })).toBe('wait');
  });
  it('sin repeatMin usa el valor por defecto', () => {
    const state = { count: 1, lastSentAt: 0 };
    expect(reminderDecision({ sinceMin: 40, repeatMin: undefined, state, nowMs: DEFAULT_REPEAT_MIN * 60_000 })).toBe('repeat');
  });
  it('hay un máximo de avisos por día', () => {
    const state = { count: MAX_REMINDERS_PER_DAY, lastSentAt: 0 };
    expect(reminderDecision({ sinceMin: 500, repeatMin: 15, state, nowMs: 500 * 60_000 })).toBe('wait');
  });
});

describe('planReminders', () => {
  it('a la hora del recordatorio avisa una vez', () => {
    const [p] = plan([habit()], 0);
    expect(p).toMatchObject({ habitId: 'h1', kind: 'first', count: 1, title: '🔥 Estudiar Python', url: '/habitos/h1', tag: 'habit-h1' });
    expect(p.body).toContain('19:00');
  });
  it('un minuto antes no avisa', () => expect(plan([habit()], -1)).toEqual([]));
  it('pasado el margen de 10 min sin haber avisado, ese día no avisa', () => expect(plan([habit()], 11)).toEqual([]));

  it('repite a los 30 min con el contador subiendo', () => {
    const sent = { h1: sentAt(1, 0) };
    expect(plan([habit()], 29, sent)).toEqual([]);
    const [p] = plan([habit()], 30, sent);
    expect(p).toMatchObject({ kind: 'repeat', count: 2 });
    expect(p.body).toContain('Sigue pendiente');
  });
  it('respeta el intervalo elegido por hábito (15 min)', () => {
    const sent = { h1: sentAt(1, 0) };
    expect(plan([habit({ reminderRepeatMin: 15 })], 15, sent)).toHaveLength(1);
    expect(plan([habit({ reminderRepeatMin: 60 })], 15, sent)).toHaveLength(0);
    expect(plan([habit({ reminderRepeatMin: 0 })], 300, sent)).toHaveLength(0);
  });
  it('una cadena completa: 6 avisos y se acabó', () => {
    let sent: Record<string, SentState> = {};
    let total = 0;
    for (let m = 0; m <= 8 * 60; m++) {
      for (const p of plan([habit({ reminderRepeatMin: 30 })], m, sent)) {
        total++;
        sent = { h1: sentAt(p.count, m) };
      }
    }
    expect(total).toBe(MAX_REMINDERS_PER_DAY); // 19:00, 19:30, 20:00, 20:30, 21:00, 21:30
  });
  it('deja de avisar en cuanto el hábito se marca como hecho', () => {
    const sent = { h1: sentAt(1, 0) };
    const done = [{ habitId: 'h1', date: '2026-09-20', value: 30 }];
    expect(plan([habit()], 30, sent, done)).toEqual([]);
  });
  it('un progreso a medias (no llega al objetivo) sigue avisando', () => {
    const sent = { h1: sentAt(1, 0) };
    expect(plan([habit()], 30, sent, [{ habitId: 'h1', date: '2026-09-20', value: 10 }])).toHaveLength(1);
  });
  it('no avisa si hoy no toca (domingo y el hábito es de L-X-V)', () => {
    expect(plan([habit({ frequency: { type: 'days', days: [0, 2, 4] } })], 0)).toEqual([]);
    expect(plan([habit({ frequency: { type: 'days', days: [6] } })], 0)).toHaveLength(1); // domingo = 6
  });
  it('los hábitos sin recordatorio se ignoran', () => {
    expect(plan([habit({ reminder: null }), habit({ reminder: undefined }, 'h2')], 0)).toEqual([]);
  });
  it('avisa a cada hábito con su propia hora', () => {
    const list = plan([habit({ reminder: '19:00' }), habit({ reminder: '19:05', title: 'Leer' }, 'h2'), habit({ reminder: '21:00' }, 'h3')], 6);
    expect(list.map((p) => p.habitId).sort()).toEqual(['h1', 'h2']);
  });
  it('la hora se evalúa en la zona horaria del usuario, no en UTC', () => {
    // A las 00:00 UTC del 21, en Madrid (UTC+2) son las 02:00 y en Lima las 19:00 del 20.
    const h = habit({ reminder: '19:00' });
    expect(planReminders({ habits: [h], logs: [], sent: {}, now: at(0), timeZone: 'America/Lima' })).toHaveLength(1);
    expect(planReminders({ habits: [h], logs: [], sent: {}, now: at(0), timeZone: 'Europe/Madrid' })).toHaveLength(0);
  });
  it('nunca cruza la medianoche: a las 00:05 no repite el aviso de las 23:50', () => {
    const late = habit({ reminder: '23:50' });
    const sent = { h1: { count: 1, lastSentAt: T19 + 290 * 60_000 } }; // 23:50 Lima
    const after = new Date(T19 + 310 * 60_000); // 00:10 del día siguiente
    expect(planReminders({ habits: [late], logs: [], sent, now: after, timeZone: TZ })).toEqual([]);
  });
});
