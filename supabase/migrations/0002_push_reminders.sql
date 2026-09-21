-- StudyQuest · recordatorios de hábitos con Web Push
-- Dispositivos suscritos a notificaciones. Un usuario puede tener varios (móvil, PC…).
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  -- Zona horaria IANA del dispositivo ("America/Lima"): "a las 19:00" se evalúa con ella.
  timezone    text not null default 'UTC',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, endpoint)
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
drop policy if exists "owner all" on public.push_subscriptions;
create policy "owner all" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Registro de avisos ya enviados: garantiza UN aviso por hábito y día aunque la función se ejecute dos veces.
-- Sin políticas RLS a propósito: solo la Edge Function (service_role) lo usa.
create table if not exists public.reminder_log (
  user_id   uuid not null references auth.users (id) on delete cascade,
  habit_id  uuid not null references public.habits (id) on delete cascade,
  day       date not null,
  sent_at   timestamptz not null default now(),
  primary key (user_id, habit_id, day)
);
alter table public.reminder_log enable row level security;

create index if not exists reminder_log_day_idx on public.reminder_log (day);
