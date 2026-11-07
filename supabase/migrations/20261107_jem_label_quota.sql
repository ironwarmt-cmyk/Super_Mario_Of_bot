-- Limity analiz etykiet: gość = 1 analiza na skrót adresu IP (na zawsze), konto = limit miesięczny wg pakietu.
create table if not exists public.jem_label_quota (
  subject text not null,          -- 'ip:<sha256>' albo 'user:<web_user_id>'
  period  text not null,          -- 'all' dla gościa, 'RRRR-MM' dla konta
  used    integer not null default 0 check (used >= 0),
  updated_at timestamptz not null default now(),
  primary key (subject, period)
);
alter table public.jem_label_quota enable row level security;
