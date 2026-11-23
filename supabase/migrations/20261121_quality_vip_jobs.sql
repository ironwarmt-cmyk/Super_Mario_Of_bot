-- Kolejka zadań VIP dla Bielika (agent na telefonie): dokumenty dedykowane i odpowiedzi Quality Copilota.
-- Zadanie czeka w kolejce, Bielik je wykonuje, a gdy przekroczy limit czasu liczony z historii, przejmuje AI w chmurze. Autor: MT

create table if not exists public.quality_jobs (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null,
  kind text not null check (kind in ('document', 'answer')),
  status text not null default 'queued' check (status in ('queued', 'working', 'done', 'failed')),
  title text not null default '',
  input jsonb not null default '{}'::jsonb,
  state jsonb not null default '{}'::jsonb,
  result jsonb,
  engine text check (engine in ('bielik', 'cloud')),
  attempts integer not null default 0,
  limit_seconds integer,
  error text,
  locked_until timestamptz,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists idx_quality_jobs_user on public.quality_jobs (telegram_user_id, created_at desc);
create index if not exists idx_quality_jobs_open on public.quality_jobs (created_at) where status in ('queued', 'working');
create index if not exists idx_quality_jobs_stats on public.quality_jobs (kind, finished_at desc) where status = 'done' and engine = 'bielik';

alter table public.quality_jobs enable row level security;
revoke all on table public.quality_jobs from anon, authenticated;
grant select, insert, update, delete on table public.quality_jobs to service_role;

-- Dokumenty dedykowane tylko w VIP. BASIC i PRO korzystają z gotowych wzorów z biblioteki.
update public.quality_plans set included_custom_docs = 0, updated_at = now() where slug in ('basic', 'pro');
update public.quality_plans
set description_pl = replace(description_pl, ' oraz do 5 dedykowanych dokumentów miesięcznie', ' z gotowymi wzorami dokumentów do pobrania'),
    updated_at = now()
where slug = 'pro';
update public.quality_plans
set description_pl = replace(description_pl, 'do 30 dedykowanych dokumentów miesięcznie', 'do 30 dokumentów miesięcznie przygotowanych przez Quality Copilota pod Twoją firmę'),
    updated_at = now()
where slug = 'vip';

-- Co minutę: przetwarzanie kolejki (Vercel, /api/quality-assistant, action=process_jobs).
select cron.unschedule('quality_jobs_every_minute') where exists (select 1 from cron.job where jobname = 'quality_jobs_every_minute');
select cron.schedule('quality_jobs_every_minute', '* * * * *', $$
  select net.http_post(
    url := 'https://supermarioofbot-iron-war.vercel.app/api/quality-assistant',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-bot-secret', (select value->>'secret_hash' from public.platform_config where key = 'bot_auth')
    ),
    body := jsonb_build_object('action', 'process_jobs', 'source', 'supabase-cron'),
    timeout_milliseconds := 65000
  );
$$);
