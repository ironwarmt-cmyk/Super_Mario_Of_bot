create extension if not exists pgcrypto;

create table if not exists telegram_users (
  telegram_user_id bigint primary key,
  username text,
  first_name text,
  last_name text,
  language_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists creators (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null unique references telegram_users(telegram_user_id) on delete cascade,
  display_name text not null,
  status text not null default 'active' check (status in ('active','paused','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  price_stars integer not null check (price_stars > 0),
  duration_days integer not null check (duration_days between 1 and 3650),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists communities (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  telegram_chat_id bigint not null,
  title text not null,
  chat_type text not null check (chat_type in ('channel','group','supergroup')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (creator_id, telegram_chat_id)
);

create table if not exists plan_communities (
  plan_id uuid not null references plans(id) on delete cascade,
  community_id uuid not null references communities(id) on delete cascade,
  primary key (plan_id, community_id)
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  name text not null,
  description text,
  price_stars integer not null check (price_stars > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null references telegram_users(telegram_user_id) on delete cascade,
  plan_id uuid not null references plans(id) on delete cascade,
  status text not null default 'active' check (status in ('active','expired','cancelled','refunded')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null references telegram_users(telegram_user_id) on delete cascade,
  creator_id uuid not null references creators(id) on delete cascade,
  plan_id uuid references plans(id) on delete set null,
  product_id uuid references products(id) on delete set null,
  amount integer not null check (amount > 0),
  currency text not null default 'XTR',
  telegram_payment_charge_id text unique,
  provider_payment_charge_id text,
  status text not null default 'paid' check (status in ('pending','paid','refunded','failed')),
  created_at timestamptz not null default now()
);

create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  code text not null unique,
  owner_telegram_user_id bigint not null references telegram_users(telegram_user_id) on delete cascade,
  commission_percent numeric(5,2) not null default 0 check (commission_percent between 0 and 100),
  created_at timestamptz not null default now()
);

create table if not exists bot_sessions (
  telegram_user_id bigint primary key references telegram_users(telegram_user_id) on delete cascade,
  state text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_plans_creator on plans(creator_id);
create index if not exists idx_subscriptions_user on subscriptions(telegram_user_id);
create index if not exists idx_subscriptions_plan on subscriptions(plan_id);
create index if not exists idx_payments_creator on payments(creator_id);
create index if not exists idx_payments_user on payments(telegram_user_id);

alter table telegram_users enable row level security;
alter table creators enable row level security;
alter table plans enable row level security;
alter table communities enable row level security;
alter table plan_communities enable row level security;
alter table products enable row level security;
alter table subscriptions enable row level security;
alter table payments enable row level security;
alter table referrals enable row level security;
alter table bot_sessions enable row level security;

-- Backend uses SUPABASE_SERVICE_ROLE_KEY on the server.
-- Do not expose that key in Telegram, browser code or public repositories.
