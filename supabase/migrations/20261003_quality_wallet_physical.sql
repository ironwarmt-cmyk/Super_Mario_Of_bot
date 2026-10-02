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

create table if not exists quality_token_transactions (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null references telegram_users(telegram_user_id) on delete cascade,
  pack_id uuid references quality_token_packs(id) on delete set null,
  delta integer not null,
  reason text not null,
  telegram_payment_charge_id text unique,
  created_at timestamptz not null default now()
);

create table if not exists quality_physical_products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_pl text not null,
  name_en text not null,
  description_pl text not null,
  description_en text not null,
  price_pln numeric(10,2) not null check (price_pln > 0),
  shipping_pln numeric(10,2) not null default 0 check (shipping_pln >= 0),
  stock integer check (stock is null or stock >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists quality_physical_orders (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint references telegram_users(telegram_user_id) on delete set null,
  product_id uuid not null references quality_physical_products(id) on delete restrict,
  quantity integer not null default 1 check (quantity > 0),
  amount_pln numeric(10,2) not null check (amount_pln > 0),
  shipping_pln numeric(10,2) not null default 0,
  status text not null default 'pending'
    check (status in ('pending','paid','processing','shipped','cancelled','refunded')),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  customer_email text,
  customer_name text,
  customer_phone text,
  shipping_details jsonb,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_quality_token_transactions_user
  on quality_token_transactions(telegram_user_id, created_at desc);
create index if not exists idx_quality_physical_orders_user
  on quality_physical_orders(telegram_user_id, created_at desc);
create index if not exists idx_quality_physical_orders_status
  on quality_physical_orders(status, created_at desc);

insert into quality_physical_products(
  slug, name_pl, name_en, description_pl, description_en,
  price_pln, shipping_pln, stock, active
) values (
  'qa-master-binder',
  'Fizyczny Segregator Quality Assurance — Master Edition',
  'Physical Quality Assurance Binder — Master Edition',
  'Drukowany, oprawiony zestaw dokumentacji wdrożeniowej Quality Assurance Support. Produkt fizyczny wysyłany na adres kupującego.',
  'Printed and bound Quality Assurance Support implementation documentation shipped to the buyer.',
  1499.00, 0.00, 25, true
)
on conflict (slug) do update set
  price_pln = excluded.price_pln,
  stock = excluded.stock,
  active = excluded.active,
  updated_at = now();

create or replace function public.credit_quality_token_pack(
  p_telegram_user_id bigint,
  p_pack_id uuid,
  p_charge_id text,
  p_paid_stars integer
)
returns table(token_balance integer, credited_tokens integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tokens integer;
  v_price integer;
  v_inserted uuid;
  v_balance integer;
begin
  select qtp.tokens, qtp.price_stars into v_tokens, v_price
  from quality_token_packs qtp
  where qtp.id = p_pack_id and qtp.active = true;

  if v_tokens is null then raise exception 'Token pack not found'; end if;
  if v_price <> p_paid_stars then raise exception 'Token pack price mismatch'; end if;

  insert into quality_token_transactions(
    telegram_user_id, pack_id, delta, reason, telegram_payment_charge_id
  ) values (
    p_telegram_user_id, p_pack_id, v_tokens, 'stars_purchase', p_charge_id
  )
  on conflict (telegram_payment_charge_id) do nothing
  returning id into v_inserted;

  insert into quality_wallets(telegram_user_id, token_balance, updated_at)
  values(p_telegram_user_id, 0, now())
  on conflict (telegram_user_id) do nothing;

  if v_inserted is not null then
    update quality_wallets qw
    set token_balance = qw.token_balance + v_tokens, updated_at = now()
    where qw.telegram_user_id = p_telegram_user_id;
  end if;

  select qw.token_balance into v_balance
  from quality_wallets qw
  where qw.telegram_user_id = p_telegram_user_id;

  return query select v_balance, case when v_inserted is null then 0 else v_tokens end;
end;
$$;
