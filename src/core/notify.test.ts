import { describe, expect, it } from 'vitest';
import { planTaskReminders, TASK_LEAD_MIN, type TaskRow } from '../../supabase/functions/_shared/taskReminders';
import { digestMessage, isDigestTime, weeklyDigest } from '../../supabase/functions/_shared/weekly';

// 2026-09-21 00:00Z = domingo 20 de septiembre a las 19:00 en Lima (UTC-5)
const T19 = Date.UTC(2026, 8, 21, 0, 0, 0);
const at = (minAfter: number) => new Date(T19 + minAfter * 60_000);
const TZ = 'America/Lima';
const DAY = '2026-09-20';

const row = (data: TaskRow['data'], id = 't1'): TaskRow => ({ id, data: { title: 'Informe', status: 'todo', dueDate: DAY, dueTime: '20:00', xp: 30, ...data } });
const plan = (tasks: TaskRow[], minAfter: number, sent: string[] = []) => planTaskReminders({ tasks, sent: new Set(sent), now: at(minAfter), timeZone: TZ });

describe('aviso de hora límite de tareas', () => {
  it('avisa en la última hora antes de que venza, no antes', () => {
    expect(plan([row({})], -1)).toEqual([]); // 18:59 → faltan 61 min
    const [r] = plan([row({})], 0); // 19:00 → faltan 60
    expect(r.taskId).toBe('t1');
    expect(r.key).toBe('task:t1');
    expect(r.body).toBe(`Vence a las 20:00 (en ${TASK_LEAD_MIN} min). Complétala y suma 30 XP.`);
  });

  it('una vez vencida ya no avisa', () => {
    expect(plan([row({})], 60)).toEqual([]);
  });

  it('avisa una sola vez por tarea y día', () => {
    expect(plan([row({})], 30, ['t1'])).toEqual([]);
  });

  it('ignora tareas hechas, sin hora o de otro día', () => {
    expect(plan([row({ status: 'done' }), row({ dueTime: undefined }, 't2'), row({ dueDate: '2026-09-21' }, 't3')], 30)).toEqual([]);
  });

  it('usa la fecha local del usuario, no la UTC', () => {
    // En UTC ya es día 21, pero en Lima sigue siendo el 20.
    expect(plan([row({})], 30)).toHaveLength(1);
  });
});

describe('resumen semanal', () => {
  it('sale el domingo desde las 19:00', () => {
    expect(isDigestTime(DAY, 19 * 60)).toBe(true);
    expect(isDigestTime(DAY, 18 * 60 + 59)).toBe(false);
    expect(isDigestTime('2026-09-19', 20 * 60)).toBe(false); // sábado
  });

  it('suma el XP de los últimos 7 días y cuenta los días con saldo positivo', () => {
    const events = [
      { day: '2026-09-13', amount: 500 }, // fuera: hace 7 días
      { day: '2026-09-14', amount: 100 },
      { day: '2026-09-15', amount: 50 },
      { day: '2026-09-15', amount: -50 }, // día con saldo 0: no cuenta como activo
      { day: '2026-09-20', amount: 40 },
    ];
    const d = weeklyDigest(events, [], DAY);
    expect(d.xp).toBe(140);
    expect(d.activeDays).toBe(2);
  });

  it('cuenta tareas vencidas (nombrando la más antigua) y las de la próxima semana', () => {
    const tasks = [row({ title: 'Reciente', dueDate: '2026-09-18' }, 'a'), row({ title: 'Antigua', dueDate: '2026-09-02' }, 'b'), row({ dueDate: '2026-09-25' }, 'c'), row({ dueDate: '2026-10-30' }, 'd'), row({ status: 'done', dueDate: '2026-09-01' }, 'e')];
    const d = weeklyDigest([], tasks, DAY);
    expect(d).toMatchObject({ overdue: 2, oldestOverdue: 'Antigua', dueNextWeek: 1 });
  });

  it('arma un mensaje legible', () => {
    expect(digestMessage({ xp: 140, activeDays: 2, overdue: 1, oldestOverdue: 'Antigua', dueNextWeek: 3 }).body).toBe(
      '+140 XP en 2 días activos de 7. 1 tarea vencida (empieza por «Antigua»). 3 tareas vencen esta semana.',
    );
    expect(digestMessage({ xp: 0, activeDays: 0, overdue: 0, oldestOverdue: null, dueNextWeek: 0 }).body).toBe('Esta semana no sumaste XP. ¡Mañana es buen día para volver!');
  });
});
