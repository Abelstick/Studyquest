-- StudyQuest · aviso de hora límite de tareas y resumen semanal por push
-- Ejecútalo en Supabase → SQL Editor (o con `supabase db push`). Se puede ejecutar más de una vez.
--
-- Igual que `reminder_log`, son registros de envío: garantizan UN aviso aunque la función se ejecute
-- dos veces a la vez. Sin políticas RLS a propósito: solo la Edge Function (service_role) los usa.

-- Un aviso por tarea y día (una hora antes de su hora límite).
create table if not exists public.task_reminder_log (
  user_id   uuid not null references auth.users (id) on delete cascade,
  task_id   uuid not null references public.tasks (id) on delete cascade,
  day       date not null,
  sent_at   timestamptz not null default now(),
  primary key (user_id, task_id, day)
);
alter table public.task_reminder_log enable row level security;
create index if not exists task_reminder_log_day_idx on public.task_reminder_log (day);

-- Un resumen por usuario y semana (`week` = el domingo en que se envió, día local).
create table if not exists public.weekly_digest_log (
  user_id   uuid not null references auth.users (id) on delete cascade,
  week      date not null,
  sent_at   timestamptz not null default now(),
  primary key (user_id, week)
);
alter table public.weekly_digest_log enable row level security;
