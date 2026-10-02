alter table quality_token_packs
  add column if not exists price_stars integer;

update quality_token_packs
set price_stars = tokens
where price_stars is null;

alter table quality_token_packs
  alter column price_stars set not null;

create table if not exists quality_wallets (
  telegram_user_id bigint primary key references telegram_users(telegram_user_id) on delete cascade,
  token_balance integer not null default 0 check (token_balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists quality_token_purchases (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null references telegram_users(telegram_user_id) on delete cascade,
  tokens integer not null check (tokens > 0),
  stars_paid integer not null check (stars_paid > 0),
  telegram_payment_charge_id text not null unique,
  created_at timestamptz not null default now()
);

alter table quality_wallets enable row level security;
alter table quality_token_purchases enable row level security;

revoke all on table quality_wallets, quality_token_purchases from anon, authenticated;
grant select, insert, update, delete on table quality_wallets, quality_token_purchases to service_role;

create policy deny_public_quality_wallets on quality_wallets
  for all to anon, authenticated using (false) with check (false);
create policy deny_public_quality_token_purchases on quality_token_purchases
  for all to anon, authenticated using (false) with check (false);


create or replace function credit_quality_tokens(p_user bigint, p_tokens integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance integer;
begin
  if p_tokens <= 0 then
    raise exception 'p_tokens must be positive';
  end if;

  insert into quality_wallets (telegram_user_id, token_balance, updated_at)
  values (p_user, p_tokens, now())
  on conflict (telegram_user_id)
  do update set
    token_balance = quality_wallets.token_balance + excluded.token_balance,
    updated_at = now()
  returning token_balance into new_balance;

  return new_balance;
end;
$$;

revoke all on function credit_quality_tokens(bigint, integer) from public, anon, authenticated;
grant execute on function credit_quality_tokens(bigint, integer) to service_role;
