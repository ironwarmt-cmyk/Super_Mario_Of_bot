alter table quality_plans
  add column if not exists price_stars integer;

update quality_plans set price_stars = case slug
  when 'basic' then 175
  when 'pro' then 525
  when 'vip' then 1400
  else price_stars
end
where slug in ('basic','pro','vip');

update quality_plans
set checkout_enabled = true,
    updated_at = now()
where slug in ('basic','pro','vip');

alter table quality_memberships
  add column if not exists assistant_seconds_used bigint not null default 0,
  add column if not exists telegram_subscription_charge_id text,
  add column if not exists auto_renew boolean not null default true;

create table if not exists quality_assistant_sessions (
  telegram_user_id bigint primary key references telegram_users(telegram_user_id) on delete cascade,
  specialist text not null check (specialist in ('brc','ifs','haccp','complaints','capa','other')),
  status text not null default 'stopped' check (status in ('active','stopped')),
  last_heartbeat_at timestamptz,
  started_at timestamptz,
  session_seconds bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists quality_assistant_messages (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null references telegram_users(telegram_user_id) on delete cascade,
  specialist text not null check (specialist in ('brc','ifs','haccp','complaints','capa','other')),
  role text not null check (role in ('user','assistant')),
  content text not null,
  source_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_quality_assistant_messages_user_specialist
  on quality_assistant_messages(telegram_user_id, specialist, created_at desc);

alter table quality_assistant_sessions enable row level security;
alter table quality_assistant_messages enable row level security;

revoke all on table quality_assistant_sessions, quality_assistant_messages from anon, authenticated;
grant select, insert, update, delete on table quality_assistant_sessions, quality_assistant_messages to service_role;


create table if not exists quality_plan_payments (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null references telegram_users(telegram_user_id) on delete cascade,
  plan_id uuid not null references quality_plans(id) on delete restrict,
  stars_paid integer not null check (stars_paid > 0),
  telegram_payment_charge_id text not null unique,
  telegram_subscription_charge_id text,
  created_at timestamptz not null default now()
);

alter table quality_plan_payments enable row level security;
revoke all on table quality_plan_payments from anon, authenticated;
grant select, insert, update, delete on table quality_plan_payments to service_role;
