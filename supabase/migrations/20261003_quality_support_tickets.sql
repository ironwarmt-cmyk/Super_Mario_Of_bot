create table if not exists quality_support_tickets (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null references telegram_users(telegram_user_id) on delete cascade,
  category text not null check (category in ('technical','payment','content','idea','other')),
  subject text,
  message text not null,
  contact_email text,
  status text not null default 'new' check (status in ('new','in_progress','resolved','closed')),
  source text not null default 'telegram_webapp',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_quality_support_tickets_user_created
  on quality_support_tickets(telegram_user_id, created_at desc);

create index if not exists idx_quality_support_tickets_status_created
  on quality_support_tickets(status, created_at asc);

alter table quality_support_tickets enable row level security;
revoke all on table quality_support_tickets from anon, authenticated;
grant select, insert, update, delete on table quality_support_tickets to service_role;
