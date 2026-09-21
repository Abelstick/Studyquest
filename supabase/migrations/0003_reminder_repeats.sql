alter table public.reminder_log add column if not exists count int not null default 1;
alter table public.reminder_log add column if not exists last_sent_at timestamptz not null default now();

update public.reminder_log set last_sent_at = sent_at;
