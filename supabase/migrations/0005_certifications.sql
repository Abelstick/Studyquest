-- StudyQuest · certificaciones
-- Ejecútalo en Supabase → SQL Editor (o con `supabase db push`) si ya tenías la base creada.
--
-- Una certificación es un documento jsonb, como los cursos o las metas: título, emisor, fecha,
-- enlace al certificado, id de credencial, caducidad y (opcional) el curso con el que se relaciona.
-- El enlace se guarda tal cual; la app solo abre enlaces http(s).

create table if not exists public.certifications (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists certifications_user_idx on public.certifications (user_id);

drop trigger if exists touch_certifications on public.certifications;
create trigger touch_certifications before update on public.certifications
  for each row execute function public.touch_updated_at();

-- Row Level Security: cada quien ve y edita solo las suyas (igual que el resto de tablas).
alter table public.certifications enable row level security;
drop policy if exists "owner all" on public.certifications;
create policy "owner all" on public.certifications for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
