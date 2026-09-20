-- StudyQuest · esquema inicial
-- Ejecútalo en Supabase → SQL Editor (o con `supabase db push`).
--
-- Diseño: las entidades con estructura anidada (cursos → módulos → temas, tareas → subtareas,
-- metas → hitos, proyectos → checkpoints) se guardan como documentos jsonb; los registros de
-- actividad (logs, sesiones, XP, notificaciones) son tablas relacionales porque se agregan por fecha.
-- Todas las filas pertenecen a un usuario y Row Level Security garantiza que solo él las ve.

create extension if not exists "pgcrypto";

-- Trigger genérico para mantener updated_at
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- Perfil (una fila por usuario) ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- Documentos jsonb ----------
do $$
declare t text;
begin
  foreach t in array array['tasks','habits','courses','goals','projects','personal_rewards'] loop
    execute format($f$
      create table if not exists public.%I (
        id          uuid primary key,
        user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
        data        jsonb not null,
        created_at  timestamptz not null default now(),
        updated_at  timestamptz not null default now()
      )$f$, t);
    execute format('create index if not exists %I on public.%I (user_id)', t || '_user_idx', t);
  end loop;
end $$;

-- ---------- Registros relacionales ----------
create table if not exists public.habit_logs (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id    uuid not null references public.habits (id) on delete cascade,
  day         date not null,
  value       numeric not null default 0,
  steps_done  jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  unique (user_id, habit_id, day)
);

create table if not exists public.study_sessions (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day         date not null,
  minutes     integer not null check (minutes > 0),
  course_id   uuid references public.courses (id) on delete set null,
  label       text not null default '',
  created_at  timestamptz not null default now()
);

create table if not exists public.xp_events (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day         date not null,
  amount      integer not null,
  source      text not null,
  label       text not null default '',
  created_at  timestamptz not null default now()
);

create table if not exists public.notifications (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category    text not null,
  title       text not null,
  body        text not null default '',
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------- Índices ----------
create index if not exists habit_logs_user_day_idx  on public.habit_logs (user_id, day desc);
create index if not exists study_sessions_user_day_idx on public.study_sessions (user_id, day desc);
create index if not exists xp_events_user_day_idx   on public.xp_events (user_id, day desc);
create index if not exists notifications_user_idx   on public.notifications (user_id, created_at desc);

-- ---------- updated_at ----------
do $$
declare t text;
begin
  foreach t in array array['profiles','tasks','habits','courses','goals','projects','personal_rewards'] loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s', t);
    execute format('create trigger touch_%1$s before update on public.%1$s for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ---------- Row Level Security ----------
do $$
declare t text;
begin
  foreach t in array array['tasks','habits','courses','goals','projects','personal_rewards','habit_logs','study_sessions','xp_events','notifications'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "owner all" on public.%I', t);
    execute format('create policy "owner all" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

alter table public.profiles enable row level security;
drop policy if exists "owner all" on public.profiles;
create policy "owner all" on public.profiles for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
