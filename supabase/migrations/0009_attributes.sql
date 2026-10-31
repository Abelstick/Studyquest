-- StudyQuest · atributos del personaje y ledger de XP por atributo
-- Ejecútalo en Supabase → SQL Editor (o con `supabase db push`). Se puede ejecutar más de una vez.
--
-- El XP deja de ser un contador del perfil: la ÚNICA fuente de verdad es el ledger `xp_events`, con una
-- fila por atributo y acción. El XP total, el nivel del personaje, el de cada atributo, la Forma y la racha
-- se derivan de él. Los niveles y la Forma se calculan en la app (core/progression/config.ts) para poder
-- balancear el juego sin migraciones; aquí solo se guarda lo que no depende del balance.
--
-- ⚠ La primera vez reemplaza el `xp_events` antiguo (sin atributos): ese historial de XP se pierde a propósito.

-- ---------- Catálogo de atributos (solo lectura) ----------
-- Nombres, íconos y colores viven en el código; esta tabla existe para la integridad referencial del ledger.
create table if not exists public.attributes (
  id          text primary key,
  name        text not null,
  sort        smallint not null
);

insert into public.attributes (id, name, sort) values
  ('fue', 'Fuerza', 1),
  ('vit', 'Vitalidad', 2),
  ('int', 'Intelecto', 3),
  ('dis', 'Disciplina', 4),
  ('esp', 'Espíritu', 5),
  ('cre', 'Creatividad', 6)
on conflict (id) do update set name = excluded.name, sort = excluded.sort;

alter table public.attributes enable row level security;
drop policy if exists "read all" on public.attributes;
create policy "read all" on public.attributes for select to authenticated using (true);

-- ---------- Ledger: reemplaza el xp_events antiguo una sola vez ----------
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'xp_events')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'xp_events' and column_name = 'attribute_id') then
    drop table public.xp_events;
  end if;
end $$;

create table if not exists public.xp_events (
  id            uuid primary key,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day           date not null,
  attribute_id  text not null references public.attributes (id),
  amount        integer not null check (amount >= 0),
  source        text not null,
  -- Texto y no uuid: los bonos usan claves fijas («combo», «chest») y así cabe cualquier origen futuro.
  source_id     text not null,
  label         text not null default '',
  multipliers   jsonb,
  created_at    timestamptz not null default now(),
  -- Idempotencia: lo mismo no se otorga dos veces.
  unique (user_id, source, source_id, day, attribute_id)
);

create index if not exists xp_events_user_day_idx on public.xp_events (user_id, day desc);
create index if not exists xp_events_user_source_idx on public.xp_events (user_id, source, source_id);

alter table public.xp_events enable row level security;
drop policy if exists "owner all" on public.xp_events;
create policy "owner all" on public.xp_events for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------- Resumen por atributo (caché del ledger) ----------
-- Se mantiene sola con `replace_xp`. Sirve para leer rápido el estado (servidor, push, futura IA) sin sumar el ledger.
create table if not exists public.user_attributes (
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  attribute_id   text not null references public.attributes (id),
  xp_total       integer not null default 0,
  last_activity  date,
  updated_at     timestamptz not null default now(),
  primary key (user_id, attribute_id)
);

alter table public.user_attributes enable row level security;
drop policy if exists "owner all" on public.user_attributes;
create policy "owner all" on public.user_attributes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Recalcula el resumen del usuario de la sesión desde el ledger.
create or replace function public.refresh_user_attributes() returns void
language sql security invoker set search_path = public as $$
  insert into public.user_attributes (user_id, attribute_id, xp_total, last_activity, updated_at)
  select auth.uid(), a.id, coalesce(sum(e.amount), 0), max(e.day) filter (where e.amount > 0), now()
  from public.attributes a
  left join public.xp_events e on e.attribute_id = a.id and e.user_id = auth.uid()
  group by a.id
  on conflict (user_id, attribute_id) do update
    set xp_total = excluded.xp_total, last_activity = excluded.last_activity, updated_at = excluded.updated_at;
$$;

-- ---------- Otorgar y revertir XP (idempotente) ----------
-- Deja las filas de (source, source_id[, day]) exactamente como `p_rows`:
--   · borra las que ya no vienen (deshacer = p_rows vacío),
--   · inserta o actualiza las que vienen (repetir la llamada no duplica nada).
-- `p_rows` es un arreglo jsonb de { id, day, attribute_id, amount, label, multipliers }. El origen sale
-- de los parámetros, no de las filas, así que una llamada nunca toca filas de otro origen.
create or replace function public.replace_xp(p_source text, p_source_id text, p_day date, p_rows jsonb)
returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'No hay sesión iniciada';
  end if;

  delete from public.xp_events e
  where e.user_id = v_user and e.source = p_source and e.source_id = p_source_id
    and (p_day is null or e.day = p_day)
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
      where (r->>'day')::date = e.day and r->>'attribute_id' = e.attribute_id
    );

  insert into public.xp_events (id, user_id, day, attribute_id, amount, source, source_id, label, multipliers)
  select (r->>'id')::uuid, v_user, (r->>'day')::date, r->>'attribute_id', (r->>'amount')::integer,
         p_source, p_source_id, coalesce(r->>'label', ''), r->'multipliers'
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
  where p_day is null or (r->>'day')::date = p_day
  on conflict (user_id, source, source_id, day, attribute_id) do update
    set amount = excluded.amount, label = excluded.label, multipliers = excluded.multipliers;

  perform public.refresh_user_attributes();
end $$;

grant execute on function public.replace_xp(text, text, date, jsonb) to authenticated;
grant execute on function public.refresh_user_attributes() to authenticated;
