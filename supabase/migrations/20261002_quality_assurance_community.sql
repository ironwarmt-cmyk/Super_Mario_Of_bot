-- Applied in Supabase as quality_assurance_community_catalog.
-- This migration adds the bilingual Quality Assurance Support catalogue and usage model.

alter table telegram_users
  add column if not exists locale text
    check (locale in ('pl','en'));

create table if not exists platform_admins (
  telegram_user_id bigint primary key references telegram_users(telegram_user_id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists quality_plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  tier_rank integer not null unique check (tier_rank between 1 and 3),
  name_pl text not null,
  name_en text not null,
  tagline_pl text not null,
  tagline_en text not null,
  description_pl text not null,
  description_en text not null,
  display_price_pln numeric(10,2),
  billing_period text not null default 'monthly',
  included_custom_docs integer not null default 0,
  included_chat_minutes integer not null default 0,
  included_training_choices integer not null default 0,
  checkout_enabled boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists quality_products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  category text not null,
  product_type text not null,
  name_pl text not null,
  name_en text not null,
  short_description_pl text not null,
  short_description_en text not null,
  minimum_tier_rank integer not null default 1 check (minimum_tier_rank between 1 and 3),
  token_cost integer not null default 0 check (token_cost >= 0),
  asset_path_pl text,
  asset_path_en text,
  choice_group text,
  choice_limit integer,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists quality_token_packs (
  id uuid primary key default gen_random_uuid(),
  tokens integer not null unique check (tokens > 0),
  reference_price_pln numeric(10,2) not null check (reference_price_pln > 0),
  active boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists quality_memberships (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null references telegram_users(telegram_user_id) on delete cascade,
  plan_id uuid not null references quality_plans(id) on delete restrict,
  status text not null default 'active' check (status in ('active','expired','cancelled','trial')),
  period_start timestamptz not null default now(),
  period_end timestamptz not null,
  custom_docs_used integer not null default 0,
  chat_minutes_used integer not null default 0,
  token_balance integer not null default 0,
  selected_training_product_id uuid references quality_products(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (telegram_user_id)
);

create table if not exists quality_usage_events (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null references telegram_users(telegram_user_id) on delete cascade,
  membership_id uuid references quality_memberships(id) on delete set null,
  event_type text not null,
  quantity integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_quality_products_tier on quality_products(minimum_tier_rank, sort_order);
create index if not exists idx_quality_memberships_user on quality_memberships(telegram_user_id);
create index if not exists idx_quality_usage_user on quality_usage_events(telegram_user_id, created_at desc);

alter table platform_admins enable row level security;
alter table quality_plans enable row level security;
alter table quality_products enable row level security;
alter table quality_token_packs enable row level security;
alter table quality_memberships enable row level security;
alter table quality_usage_events enable row level security;

revoke all on table platform_admins, quality_plans, quality_products, quality_token_packs, quality_memberships, quality_usage_events from anon, authenticated;
grant select, insert, update, delete on table platform_admins, quality_plans, quality_products, quality_token_packs, quality_memberships, quality_usage_events to service_role;
