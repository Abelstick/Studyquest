// Edge Function: envía los recordatorios de hábitos por Web Push.
//
// La invoca pg_cron cada minuto (ver supabase/cron.sql.example). Para cada usuario con dispositivos suscritos:
//   1. calcula su fecha y hora local (zona horaria guardada en la suscripción),
//   2. le pide al planificador (`_shared/reminders.ts`, el mismo código que usa la web) qué avisos tocan ahora:
//      primer aviso a la hora del hábito y repeticiones cada N minutos mientras siga sin hacerse,
//   3. reserva cada aviso en `reminder_log` de forma atómica (así nunca se envía dos veces aunque la función
//      se ejecute a la vez dos veces) y lo envía a todos sus dispositivos.
//
// Variables (supabase secrets set …): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:tu@correo), CRON_SECRET.
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY las inyecta Supabase.
// Despliegue: supabase functions deploy send-reminders --no-verify-jwt   (la protege CRON_SECRET, no un JWT)

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { addDays, localParts, type LogLike } from '../_shared/due.ts';
import { planReminders, type HabitRow, type SentState } from '../_shared/reminders.ts';

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

  for (const [userId, devices] of byUser) {
    // La zona horaria del dispositivo usado más recientemente manda.
    const timeZone = [...devices].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0].timezone;
    const { date } = localParts(now, timeZone);

    const { data: habits } = await db.from('habits').select('id,data').eq('user_id', userId);
    const withReminder = ((habits ?? []) as HabitRow[]).filter((h) => h.data?.reminder);
    if (!withReminder.length) continue;

    // 31 días bastan para las reglas semanales, mensuales y "N veces por semana/mes".
    const { data: logRows } = await db.from('habit_logs').select('habit_id,day,value').eq('user_id', userId).gte('day', addDays(date, -31));
    const logs: LogLike[] = (logRows ?? []).map((r) => ({ habitId: r.habit_id, date: r.day, value: Number(r.value) }));

    // Avisos ya enviados HOY (fecha local del usuario).
    const { data: sentRows } = await db.from('reminder_log').select('habit_id,count,last_sent_at').eq('user_id', userId).eq('day', date);
    const alreadySent: Record<string, SentState> = {};
    for (const r of sentRows ?? []) alreadySent[r.habit_id] = { count: r.count, lastSentAt: Date.parse(r.last_sent_at) };

    const plan = planReminders({ habits: withReminder, logs, sent: alreadySent, now, timeZone });

    for (const p of plan) {
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

      const payload = JSON.stringify({ title: p.title, body: p.body, url: p.url, tag: p.tag, habitId: p.habitId, count: p.count });

      for (const d of devices) {
        try {
          await webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, payload, { TTL: 1800 });
          sent++;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            // El navegador ya no acepta ese dispositivo: se borra para no reintentarlo.
            await db.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', d.endpoint);
            removed++;
          } else {
            console.error('push falló', status, (e as Error).message);
          }
        }
      }
    }
  }

  // Limpieza barata del registro de avisos (más de 30 días).
  await db.from('reminder_log').delete().lt('day', addDays(localParts(now, 'UTC').date, -30));

  return Response.json({ ok: true, users: byUser.size, sent, removed });
});
