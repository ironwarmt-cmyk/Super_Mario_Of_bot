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
  billing_mode text not null default 'one_time'
    check (billing_mode in ('one_time','monthly')),
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
  is_recurring boolean not null default false,
  telegram_subscription_charge_id text,
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
  is_recurring boolean not null default false,
  is_first_recurring boolean not null default false,
  subscription_expiration_date timestamptz,
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

create table if not exists platform_config (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_plans_creator on plans(creator_id);
create index if not exists idx_subscriptions_user on subscriptions(telegram_user_id);
create index if not exists idx_subscriptions_plan on subscriptions(plan_id);
create unique index if not exists uq_subscriptions_user_plan on subscriptions(telegram_user_id, plan_id);
create index if not exists idx_subscriptions_status_ends on subscriptions(status, ends_at);
create index if not exists idx_payments_creator on payments(creator_id);
create index if not exists idx_payments_user on payments(telegram_user_id);
create index if not exists idx_payments_plan on payments(plan_id);
create index if not exists idx_payments_product on payments(product_id);
create index if not exists idx_plan_communities_community on plan_communities(community_id);
create index if not exists idx_products_creator on products(creator_id);
create index if not exists idx_referrals_creator on referrals(creator_id);
create index if not exists idx_referrals_owner on referrals(owner_telegram_user_id);

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
alter table platform_config enable row level security;

revoke all on table telegram_users, creators, plans, communities, plan_communities, products, subscriptions, payments, referrals, bot_sessions, platform_config from anon, authenticated;
grant select, insert, update, delete on table telegram_users, creators, plans, communities, plan_communities, products, subscriptions, payments, referrals, bot_sessions, platform_config to service_role;

create policy deny_anon_auth_telegram_users on telegram_users
  for all to anon, authenticated using (false) with check (false);
create policy deny_anon_auth_creators on creators
  for all to anon, authenticated using (false) with check (false);
create policy deny_anon_auth_plans on plans
  for all to anon, authenticated using (false) with check (false);
create policy deny_anon_auth_communities on communities
  for all to anon, authenticated using (false) with check (false);
create policy deny_anon_auth_plan_communities on plan_communities
  for all to anon, authenticated using (false) with check (false);
create policy deny_anon_auth_products on products
  for all to anon, authenticated using (false) with check (false);
create policy deny_anon_auth_subscriptions on subscriptions
  for all to anon, authenticated using (false) with check (false);
create policy deny_anon_auth_payments on payments
  for all to anon, authenticated using (false) with check (false);
create policy deny_anon_auth_referrals on referrals
  for all to anon, authenticated using (false) with check (false);
create policy deny_anon_auth_bot_sessions on bot_sessions
  for all to anon, authenticated using (false) with check (false);
create policy deny_anon_auth_platform_config on platform_config
  for all to anon, authenticated using (false) with check (false);

-- Database writes happen only through the server-side Supabase Edge Function.
-- Do not expose service-role / secret keys in the repository or client code.
