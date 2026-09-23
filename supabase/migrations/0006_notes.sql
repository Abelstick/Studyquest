-- StudyQuest · apuntes
-- Ejecútalo en Supabase → SQL Editor (o con `supabase db push`) si ya tenías la base creada.
--
-- Un apunte es un documento jsonb, como los cursos o las certificaciones: título, cuerpo,
-- etiquetas y (opcional) el curso y el tema con el que se relaciona.
--
-- Va en su propia tabla, y no dentro del documento del curso, a propósito: los cursos se
-- reescriben enteros cada vez que marcas un tema, y arrastrar todos los apuntes en cada
-- marca sería tirar ancho de banda a la basura.

create table if not exists public.notes (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists notes_user_idx on public.notes (user_id);

drop trigger if exists touch_notes on public.notes;
create trigger touch_notes before update on public.notes
  for each row execute function public.touch_updated_at();

-- Row Level Security: cada quien ve y edita solo los suyos (igual que el resto de tablas).
alter table public.notes enable row level security;
drop policy if exists "owner all" on public.notes;
create policy "owner all" on public.notes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
