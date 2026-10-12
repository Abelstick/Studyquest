-- StudyQuest · actividades del calendario (agenda por horas)
-- Ejecútalo en Supabase → SQL Editor (o con `supabase db push`). Se puede ejecutar más de una vez.
--
-- Una fila por actividad o por SERIE de actividades, nunca una por repetición: la regla de
-- repetición, sus excepciones (ocurrencias movidas, canceladas o quitadas) y el vínculo opcional con
-- un hábito o una tarea van dentro del documento jsonb, igual que en tareas y hábitos.
--
-- El documento también reserva `external` para una futura sincronización con Google Calendar
-- (id del evento remoto, etag y fecha de sincronización), sin necesidad de otra migración.

create table if not exists public.calendar_events (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists calendar_events_user_idx on public.calendar_events (user_id);

drop trigger if exists touch_calendar_events on public.calendar_events;
create trigger touch_calendar_events before update on public.calendar_events
  for each row execute function public.touch_updated_at();

-- Row Level Security: cada quien ve y edita solo las suyas (igual que el resto de tablas).
alter table public.calendar_events enable row level security;
drop policy if exists "owner all" on public.calendar_events;
create policy "owner all" on public.calendar_events for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
