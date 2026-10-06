-- Emergency Audit Support paid package: 199 PLN / 7 days, 20 PLN internal AI budget.
create table if not exists public.quality_emergency_entitlements (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null references public.telegram_users(telegram_user_id) on delete cascade,
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text,
  stripe_customer_id text,
  amount_paid_grosz integer not null check (amount_paid_grosz >= 0),
  currency text not null default 'pln',
  status text not null default 'active' check (status in ('active','expired','cancelled','refunded')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ai_budget_grosz integer not null default 2000 check (ai_budget_grosz >= 0),
  ai_reserved_grosz integer not null default 0 check (ai_reserved_grosz >= 0),
  ai_spent_grosz integer not null default 0 check (ai_spent_grosz >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.quality_emergency_entitlements enable row level security;
revoke all on public.quality_emergency_entitlements from anon, authenticated;
grant all on public.quality_emergency_entitlements to service_role;
create index if not exists quality_emergency_entitlements_user_idx
  on public.quality_emergency_entitlements(telegram_user_id, expires_at desc);

create table if not exists public.quality_emergency_ai_usage (
  id uuid primary key default gen_random_uuid(),
  entitlement_id uuid not null references public.quality_emergency_entitlements(id) on delete cascade,
  telegram_user_id bigint not null references public.telegram_users(telegram_user_id) on delete cascade,
  request_kind text not null check (request_kind in ('text','screen','document')),
  model text,
  reserved_grosz integer not null check (reserved_grosz >= 0),
  estimated_provider_cost_grosz integer,
  input_tokens integer,
  output_tokens integer,
  status text not null default 'reserved' check (status in ('reserved','settled','released','failed')),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
alter table public.quality_emergency_ai_usage enable row level security;
revoke all on public.quality_emergency_ai_usage from anon, authenticated;
grant all on public.quality_emergency_ai_usage to service_role;
create index if not exists quality_emergency_ai_usage_user_idx
  on public.quality_emergency_ai_usage(telegram_user_id, created_at desc);

alter table public.quality_stripe_checkout_intents
  drop constraint if exists quality_stripe_checkout_intents_purchase_kind_check;
alter table public.quality_stripe_checkout_intents
  add constraint quality_stripe_checkout_intents_purchase_kind_check
  check (purchase_kind in ('plan','product','emergency'));

create or replace function public.reserve_quality_emergency_ai(
  p_telegram_user_id bigint,
  p_request_kind text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public
as $$
declare
  ent public.quality_emergency_entitlements%rowtype;
  reserve_grosz integer;
  usage_id uuid;
  remaining integer;
begin
  if p_request_kind='text' then reserve_grosz:=200;
  elsif p_request_kind='screen' then reserve_grosz:=200;
  elsif p_request_kind='document' then reserve_grosz:=500;
  else raise exception 'Invalid AI request kind';
  end if;

  select * into ent
  from public.quality_emergency_entitlements
  where telegram_user_id=p_telegram_user_id
    and status='active'
    and starts_at<=now()
    and expires_at>now()
  order by expires_at desc
  limit 1
  for update;

  if not found then raise exception 'Emergency package required'; end if;
  remaining:=ent.ai_budget_grosz-ent.ai_reserved_grosz-ent.ai_spent_grosz;
  if remaining<reserve_grosz then raise exception 'Emergency AI budget exhausted'; end if;

  insert into public.quality_emergency_ai_usage(
    entitlement_id,telegram_user_id,request_kind,reserved_grosz,status
  )
  values(ent.id,p_telegram_user_id,p_request_kind,reserve_grosz,'reserved')
  returning id into usage_id;

  update public.quality_emergency_entitlements
  set ai_reserved_grosz=ai_reserved_grosz+reserve_grosz,updated_at=now()
  where id=ent.id;

  return jsonb_build_object(
    'usage_id',usage_id,
    'entitlement_id',ent.id,
    'reserved_grosz',reserve_grosz,
    'remaining_after_reserve_grosz',remaining-reserve_grosz,
    'expires_at',ent.expires_at
  );
end
$$;
revoke all on function public.reserve_quality_emergency_ai(bigint,text) from public,anon,authenticated;
grant execute on function public.reserve_quality_emergency_ai(bigint,text) to service_role;

create or replace function public.settle_quality_emergency_ai(
  p_usage_id uuid,
  p_model text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_estimated_provider_cost_grosz integer,
  p_success boolean
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public
as $$
declare
  u public.quality_emergency_ai_usage%rowtype;
  ent public.quality_emergency_entitlements%rowtype;
  charge_grosz integer;
begin
  select * into u from public.quality_emergency_ai_usage where id=p_usage_id for update;
  if not found then raise exception 'AI usage reservation not found'; end if;

  if u.status<>'reserved' then
    select * into ent from public.quality_emergency_entitlements where id=u.entitlement_id;
    return jsonb_build_object(
      'ok',true,'already_settled',true,
      'ai_budget_grosz',coalesce(ent.ai_budget_grosz,0),
      'ai_spent_grosz',coalesce(ent.ai_spent_grosz,0),
      'ai_remaining_grosz',greatest(0,coalesce(ent.ai_budget_grosz,0)-coalesce(ent.ai_reserved_grosz,0)-coalesce(ent.ai_spent_grosz,0))
    );
  end if;

  select * into ent from public.quality_emergency_entitlements where id=u.entitlement_id for update;

  if p_success then
    charge_grosz:=least(u.reserved_grosz,greatest(5,coalesce(p_estimated_provider_cost_grosz,0)));

    update public.quality_emergency_entitlements
    set ai_reserved_grosz=greatest(0,ai_reserved_grosz-u.reserved_grosz),
        ai_spent_grosz=least(ai_budget_grosz,ai_spent_grosz+charge_grosz),
        updated_at=now()
    where id=ent.id
    returning * into ent;

    update public.quality_emergency_ai_usage
    set status='settled',model=p_model,
        input_tokens=greatest(0,coalesce(p_input_tokens,0)),
        output_tokens=greatest(0,coalesce(p_output_tokens,0)),
        estimated_provider_cost_grosz=charge_grosz,
        settled_at=now()
    where id=u.id;
  else
    update public.quality_emergency_entitlements
    set ai_reserved_grosz=greatest(0,ai_reserved_grosz-u.reserved_grosz),updated_at=now()
    where id=ent.id
    returning * into ent;

    update public.quality_emergency_ai_usage
    set status='failed',model=p_model,
        input_tokens=greatest(0,coalesce(p_input_tokens,0)),
        output_tokens=greatest(0,coalesce(p_output_tokens,0)),
        estimated_provider_cost_grosz=0,
        settled_at=now()
    where id=u.id;
  end if;

  return jsonb_build_object(
    'ok',true,
    'charged_grosz',case when p_success then charge_grosz else 0 end,
    'ai_budget_grosz',ent.ai_budget_grosz,
    'ai_spent_grosz',ent.ai_spent_grosz,
    'ai_reserved_grosz',ent.ai_reserved_grosz,
    'ai_remaining_grosz',greatest(0,ent.ai_budget_grosz-ent.ai_reserved_grosz-ent.ai_spent_grosz)
  );
end
$$;
revoke all on function public.settle_quality_emergency_ai(uuid,text,integer,integer,integer,boolean) from public,anon,authenticated;
grant execute on function public.settle_quality_emergency_ai(uuid,text,integer,integer,integer,boolean) to service_role;
