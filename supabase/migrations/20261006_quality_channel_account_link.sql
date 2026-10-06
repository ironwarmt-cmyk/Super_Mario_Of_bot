create table if not exists public.quality_channel_link_intents (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  telegram_user_id bigint not null references public.telegram_users(telegram_user_id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  consumed_at timestamptz
);
alter table public.quality_channel_link_intents enable row level security;
revoke all on public.quality_channel_link_intents from anon, authenticated;
grant all on public.quality_channel_link_intents to service_role;
create index if not exists quality_channel_link_intents_user_idx
  on public.quality_channel_link_intents(telegram_user_id);
create index if not exists quality_channel_link_intents_expiry_idx
  on public.quality_channel_link_intents(expires_at);

create or replace function public.complete_quality_channel_link(
  p_token text,
  p_web_user_id bigint,
  p_auth_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  link_row public.quality_channel_link_intents%rowtype;
  target_id bigint;
  rec record;
begin
  select * into link_row
  from public.quality_channel_link_intents
  where token=p_token and consumed_at is null and expires_at>now()
  for update;
  if not found then raise exception 'Link request is invalid or expired'; end if;

  target_id:=link_row.telegram_user_id;
  if target_id is null or target_id<=0 then raise exception 'Target channel identity is invalid'; end if;

  perform 1 from public.quality_web_identities
  where auth_user_id=p_auth_user_id and telegram_user_id=p_web_user_id
  for update;
  if not found then raise exception 'Authenticated web identity does not match link request'; end if;

  if exists(
    select 1 from public.quality_web_identities
    where telegram_user_id=target_id and auth_user_id<>p_auth_user_id
  ) then raise exception 'Target channel is already linked to another web account'; end if;

  if not exists(select 1 from public.telegram_users where telegram_user_id=target_id)
  then raise exception 'Target channel user does not exist'; end if;

  if p_web_user_id<>target_id then
    begin
      for rec in
        select distinct x.schema_name,x.table_name,x.column_name
        from (
          select n.nspname::text schema_name,cls.relname::text table_name,a.attname::text column_name
          from pg_constraint c
          join pg_class cls on cls.oid=c.conrelid
          join pg_namespace n on n.oid=cls.relnamespace
          join lateral unnest(c.conkey) ck(attnum) on true
          join pg_attribute a on a.attrelid=c.conrelid and a.attnum=ck.attnum
          where c.contype='f' and c.confrelid='public.telegram_users'::regclass
          union
          select table_schema::text,table_name::text,column_name::text
          from information_schema.columns
          where table_schema='public' and column_name='telegram_user_id' and table_name<>'telegram_users'
        ) x
        where not (x.schema_name='public' and x.table_name in ('telegram_users','quality_web_identities'))
      loop
        execute format(
          'update %I.%I set %I=$1 where %I=$2',
          rec.schema_name,rec.table_name,rec.column_name,rec.column_name
        ) using target_id,p_web_user_id;
      end loop;

      update public.quality_web_identities
      set telegram_user_id=target_id,last_seen_at=now()
      where auth_user_id=p_auth_user_id and telegram_user_id=p_web_user_id;

      delete from public.telegram_users where telegram_user_id=p_web_user_id;
    exception when unique_violation then
      raise exception 'Account merge conflict; existing entitlements require reconciliation';
    end;
  end if;

  update public.quality_channel_link_intents set consumed_at=now() where id=link_row.id;
  return jsonb_build_object('linked',true,'channel_user_id',target_id);
end
$$;
revoke all on function public.complete_quality_channel_link(text,bigint,uuid) from public, anon, authenticated;
grant execute on function public.complete_quality_channel_link(text,bigint,uuid) to service_role;
