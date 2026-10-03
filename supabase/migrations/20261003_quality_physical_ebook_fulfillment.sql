create table if not exists quality_physical_fulfillments (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null references telegram_users(telegram_user_id) on delete cascade,
  plan_id uuid not null references quality_plans(id) on delete restrict,
  membership_period_end timestamptz,
  ebook_slug text not null,
  recipient_name text not null,
  company_name text,
  street_line_1 text not null,
  street_line_2 text,
  postal_code text not null,
  city text not null,
  country_code text not null default 'PL',
  phone text,
  status text not null default 'new'
    check (status in ('new','preparing','shipped','delivered','cancelled')),
  tracking_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (telegram_user_id, plan_id, membership_period_end)
);

create index if not exists idx_quality_physical_fulfillments_status
  on quality_physical_fulfillments(status, created_at);

alter table quality_physical_fulfillments enable row level security;
revoke all on table quality_physical_fulfillments from anon, authenticated;
grant select, insert, update, delete on table quality_physical_fulfillments to service_role;
