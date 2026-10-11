// Edge Function: envía por Web Push los recordatorios de hábitos, el aviso de hora límite de tareas y el resumen semanal.
//
// La invoca pg_cron cada minuto (ver supabase/cron.sql.example). Para cada usuario con dispositivos suscritos:
//   1. calcula su fecha y hora local (zona horaria guardada en la suscripción),
//   2. le pide al planificador (`_shared/reminders.ts`, el mismo código que usa la web) qué avisos tocan ahora:
//      primer aviso a la hora del hábito y repeticiones cada N minutos mientras siga sin hacerse,
//   3. hace lo mismo con las tareas que vencen hoy a una hora (`_shared/taskReminders.ts`): un aviso una hora antes,
//   4. el domingo desde las 19:00 envía el resumen de la semana (`_shared/weekly.ts`), salvo que se haya desactivado,
//   5. reserva cada aviso en su registro (`reminder_log`, `task_reminder_log`, `weekly_digest_log`) de forma atómica
//      (así nunca se envía dos veces aunque la función se ejecute a la vez dos veces) y lo envía a todos sus dispositivos.
//
// Variables (supabase secrets set …): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:tu@correo), CRON_SECRET.
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY las inyecta Supabase.
// Despliegue: supabase functions deploy send-reminders --no-verify-jwt   (la protege CRON_SECRET, no un JWT)

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { addDays, localParts, type LogLike } from '../_shared/due.ts';
import { planReminders, type HabitRow, type SentState } from '../_shared/reminders.ts';
import { planTaskReminders, type TaskRow } from '../_shared/taskReminders.ts';
import { digestMessage, isDigestTime, weeklyDigest } from '../_shared/weekly.ts';

interface Sub {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  timezone: string;
  updated_at: string;
}

Deno.serve(async (req) => {
  if (!Deno.env.get('CRON_SECRET') || req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) {
    return new Response('unauthorized', { status: 401 });
  }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')!, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);

  const { data: subs, error } = await db.from('push_subscriptions').select('user_id,endpoint,p256dh,auth,timezone,updated_at');
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  const byUser = new Map<string, Sub[]>();
  for (const s of (subs ?? []) as Sub[]) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);

  const now = new Date();
  const nowIso = now.toISOString();
  let sent = 0;
  let removed = 0;

  /** Envía un aviso a todos los dispositivos del usuario y borra los que el navegador ya no acepta. */
  const sendToDevices = async (userId: string, devices: Sub[], payload: string) => {
    for (const d of devices) {
      try {
        await webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, payload, { TTL: 1800 });
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', d.endpoint);
          removed++;
        } else {
          console.error('push falló', status, (e as Error).message);
        }
      }
    }
  };

  for (const [userId, devices] of byUser) {
    // La zona horaria del dispositivo usado más recientemente manda.
    const timeZone = [...devices].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0].timezone;
    const { date, minutes } = localParts(now, timeZone);

    // ---------- 1. Hábitos ----------
    const { data: habits } = await db.from('habits').select('id,data').eq('user_id', userId);
    const withReminder = ((habits ?? []) as HabitRow[]).filter((h) => h.data?.reminder);
    if (withReminder.length) {
      // 31 días bastan para las reglas semanales, mensuales y "N veces por semana/mes".
      const { data: logRows } = await db.from('habit_logs').select('habit_id,day,value').eq('user_id', userId).gte('day', addDays(date, -31));
      const logs: LogLike[] = (logRows ?? []).map((r) => ({ habitId: r.habit_id, date: r.day, value: Number(r.value) }));

      // Avisos ya enviados HOY (fecha local del usuario).
      const { data: sentRows } = await db.from('reminder_log').select('habit_id,count,last_sent_at').eq('user_id', userId).eq('day', date);
      const alreadySent: Record<string, SentState> = {};
      for (const r of sentRows ?? []) alreadySent[r.habit_id] = { count: r.count, lastSentAt: Date.parse(r.last_sent_at) };

      for (const p of planReminders({ habits: withReminder, logs, sent: alreadySent, now, timeZone })) {
        // Reserva atómica: solo el que consigue escribir la fila envía el aviso.
        let claimed = false;
        if (p.kind === 'first') {
          const { data } = await db
            .from('reminder_log')
            .upsert({ user_id: userId, habit_id: p.habitId, day: date, count: 1, last_sent_at: nowIso }, { onConflict: 'user_id,habit_id,day', ignoreDuplicates: true })
            .select();
          claimed = !!data?.length;
        } else {
          const { data } = await db
            .from('reminder_log')
            .update({ count: p.count, last_sent_at: nowIso })
            .eq('user_id', userId)
            .eq('habit_id', p.habitId)
            .eq('day', date)
            .eq('count', p.count - 1)
            .select();
          claimed = !!data?.length;
        }
        if (!claimed) continue;
        await sendToDevices(userId, devices, JSON.stringify({ title: p.title, body: p.body, url: p.url, tag: p.tag, key: p.habitId, habitId: p.habitId, count: p.count }));
      }
    }

    // ---------- 2. Tareas que vencen hoy a una hora ----------
    const { data: dueToday } = await db.from('tasks').select('id,data').eq('user_id', userId).eq('data->>dueDate', date).not('data->>dueTime', 'is', null);
    if (dueToday?.length) {
      const { data: taskSent } = await db.from('task_reminder_log').select('task_id').eq('user_id', userId).eq('day', date);
      const sentIds = new Set((taskSent ?? []).map((r) => r.task_id as string));
      for (const p of planTaskReminders({ tasks: dueToday as TaskRow[], sent: sentIds, now, timeZone })) {
        const { data } = await db
          .from('task_reminder_log')
          .upsert({ user_id: userId, task_id: p.taskId, day: date, sent_at: nowIso }, { onConflict: 'user_id,task_id,day', ignoreDuplicates: true })
          .select();
        if (!data?.length) continue;
        await sendToDevices(userId, devices, JSON.stringify({ title: p.title, body: p.body, url: p.url, tag: p.tag, key: p.key }));
      }
    }

    // ---------- 3. Resumen semanal (domingo por la tarde) ----------
    if (isDigestTime(date, minutes)) {
      const { data: done } = await db.from('weekly_digest_log').select('week').eq('user_id', userId).eq('week', date).maybeSingle();
      const { data: profile } = done ? { data: null } : await db.from('profiles').select('data').eq('id', userId).maybeSingle();
      // Se puede apagar desde Perfil (`weeklyDigest: false`); por defecto está activado.
      if (!done && (profile?.data as { weeklyDigest?: boolean } | undefined)?.weeklyDigest !== false) {
        const { data: claim } = await db
          .from('weekly_digest_log')
          .upsert({ user_id: userId, week: date, sent_at: nowIso }, { onConflict: 'user_id,week', ignoreDuplicates: true })
          .select();
        if (claim?.length) {
          const { data: events } = await db.from('xp_events').select('day,amount').eq('user_id', userId).gte('day', addDays(date, -6));
          const { data: openTasks } = await db.from('tasks').select('id,data').eq('user_id', userId).neq('data->>status', 'done');
          const digest = weeklyDigest((events ?? []).map((e) => ({ day: e.day, amount: Number(e.amount) })), (openTasks ?? []) as TaskRow[], date);
          const msg = digestMessage(digest);
          await sendToDevices(userId, devices, JSON.stringify({ ...msg, url: '/progreso', tag: 'weekly-digest' }));
        }
      }
    }
  }

  // Limpieza barata de los registros de avisos (más de 30 días).
  const old = addDays(localParts(now, 'UTC').date, -30);
  await db.from('reminder_log').delete().lt('day', old);
  await db.from('task_reminder_log').delete().lt('day', old);
  await db.from('weekly_digest_log').delete().lt('week', addDays(old, -60));

  return Response.json({ ok: true, users: byUser.size, sent, removed });
});
