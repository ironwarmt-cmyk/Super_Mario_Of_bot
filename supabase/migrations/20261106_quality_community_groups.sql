-- Społeczność QASUPPORT na Telegramie (@MT_Social_Control_bot)
-- Grupy per pakiet, członkowie z nickiem i tagiem, jednorazowe tokeny dołączenia.
-- Dostęp wyłącznie po stronie serwera (edge function quality-community-db).
create table if not exists public.quality_community_groups (
  tier text primary key check (tier in ('regular','basic','pro','vip')),
  telegram_chat_id bigint unique,
  title text,
  topics jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.quality_community_members (
  telegram_user_id bigint primary key,
  web_user_id bigint not null,
  nickname text,
  tier text not null default 'regular' check (tier in ('regular','basic','pro','vip')),
  state text not null default 'new',
  joined_chats jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_checked_at timestamptz
);
create index if not exists quality_community_members_web_idx on public.quality_community_members(web_user_id);
create unique index if not exists quality_community_members_nick_idx on public.quality_community_members(lower(nickname)) where nickname is not null;
create table if not exists public.quality_community_link_tokens (
  token text primary key,
  web_user_id bigint not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 minutes',
  consumed_at timestamptz,
  consumed_by bigint
);
alter table public.quality_community_groups enable row level security;
alter table public.quality_community_members enable row level security;
alter table public.quality_community_link_tokens enable row level security;
revoke all on public.quality_community_groups, public.quality_community_members, public.quality_community_link_tokens from anon, authenticated;
comment on table public.quality_community_members is 'Telegram community members managed by @MT_Social_Control_bot. Server/service role only.';
