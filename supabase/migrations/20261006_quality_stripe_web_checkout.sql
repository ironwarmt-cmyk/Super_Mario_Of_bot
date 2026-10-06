-- Quality web checkout: Stripe records kept separate from legacy Stars/XTR payments.
create table if not exists public.quality_stripe_plan_payments (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null references public.telegram_users(telegram_user_id) on delete cascade,
  plan_id uuid not null references public.quality_plans(id) on delete restrict,
  stripe_checkout_session_id text unique,
  stripe_invoice_id text,
  stripe_subscription_id text,
  stripe_customer_id text,
  amount_paid_grosz bigint not null check (amount_paid_grosz >= 0),
  currency text not null,
  status text not null default 'paid' check (status in ('paid','refunded','failed')),
  event_kind text,
  period_start timestamptz,
  period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.quality_stripe_plan_payments enable row level security;
revoke all on public.quality_stripe_plan_payments from anon, authenticated;
grant all on public.quality_stripe_plan_payments to service_role;
create unique index if not exists quality_stripe_plan_payments_invoice_uidx
  on public.quality_stripe_plan_payments(stripe_invoice_id) where stripe_invoice_id is not null;
create index if not exists quality_stripe_plan_payments_subscription_idx
  on public.quality_stripe_plan_payments(stripe_subscription_id);
create index if not exists quality_stripe_plan_payments_user_idx
  on public.quality_stripe_plan_payments(telegram_user_id);

create table if not exists public.quality_stripe_product_purchases (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null references public.telegram_users(telegram_user_id) on delete cascade,
  product_id uuid not null references public.quality_products(id) on delete restrict,
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text,
  stripe_customer_id text,
  amount_paid_grosz bigint not null check (amount_paid_grosz >= 0),
  currency text not null,
  status text not null default 'paid' check (status in ('paid','refunded','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(telegram_user_id, product_id)
);
alter table public.quality_stripe_product_purchases enable row level security;
revoke all on public.quality_stripe_product_purchases from anon, authenticated;
grant all on public.quality_stripe_product_purchases to service_role;
create index if not exists quality_stripe_product_purchases_user_idx
  on public.quality_stripe_product_purchases(telegram_user_id);

alter table public.quality_memberships
  add column if not exists payment_provider text,
  add column if not exists provider_subscription_id text,
  add column if not exists provider_customer_id text;
create unique index if not exists quality_memberships_provider_subscription_uidx
  on public.quality_memberships(provider_subscription_id) where provider_subscription_id is not null;

create table if not exists public.quality_stripe_checkout_intents (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  telegram_user_id bigint not null references public.telegram_users(telegram_user_id) on delete cascade,
  purchase_kind text not null check (purchase_kind in ('plan','product')),
  purchase_reference text not null,
  stripe_checkout_session_id text unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 hours'),
  consumed_at timestamptz
);
alter table public.quality_stripe_checkout_intents enable row level security;
revoke all on public.quality_stripe_checkout_intents from anon, authenticated;
grant all on public.quality_stripe_checkout_intents to service_role;
create index if not exists quality_stripe_checkout_intents_user_idx
  on public.quality_stripe_checkout_intents(telegram_user_id);
create index if not exists quality_stripe_checkout_intents_expiry_idx
  on public.quality_stripe_checkout_intents(expires_at);
