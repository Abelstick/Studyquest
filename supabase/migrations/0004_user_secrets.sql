-- StudyQuest · secretos del usuario (clave de Gemini guardada en la cuenta, opcional)
-- Una fila por usuario. `data` guarda la clave CIFRADA con una frase que solo conoce el usuario
-- ({"mode":"encrypted",...}) o, si el usuario lo eligió, en claro ({"mode":"plain",...}).
-- Vive en una tabla aparte del perfil a propósito: así nunca entra en las copias de seguridad ni en la caché del navegador.
create table if not exists public.user_secrets (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table public.user_secrets enable row level security;
drop policy if exists "owner all" on public.user_secrets;
create policy "owner all" on public.user_secrets for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
