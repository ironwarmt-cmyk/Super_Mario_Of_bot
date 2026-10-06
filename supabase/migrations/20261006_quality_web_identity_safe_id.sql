-- Keep synthetic web identities inside JavaScript's safe-integer range.
-- Existing unsafe negative identities are migrated atomically together with every FK/reference.
do $$
declare
  old_id bigint;
  new_id bigint;
  auth_id uuid;
  h bytea;
  rec record;
begin
  for old_id, auth_id in
    select w.telegram_user_id, w.auth_user_id
    from public.quality_web_identities w
    where abs(w.telegram_user_id) > 9007199254740991
    order by w.linked_at
  loop
    h := digest(auth_id::text, 'sha256');
    new_id := -(
      1000000000000000::bigint
      + get_byte(h,0)::bigint * 1099511627776
      + get_byte(h,1)::bigint * 4294967296
      + get_byte(h,2)::bigint * 16777216
      + get_byte(h,3)::bigint * 65536
      + get_byte(h,4)::bigint * 256
      + get_byte(h,5)::bigint
    );

    if abs(new_id) > 9007199254740991 then
      raise exception 'Generated web identity is not JS-safe';
    end if;
    if exists(select 1 from public.telegram_users where telegram_user_id=new_id) then
      raise exception 'Generated web identity collision';
    end if;

    insert into public.telegram_users(
      telegram_user_id,username,first_name,last_name,language_code,created_at,updated_at,locale
    )
    select new_id,username,first_name,last_name,language_code,created_at,now(),locale
    from public.telegram_users where telegram_user_id=old_id;

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
      where not (x.schema_name='public' and x.table_name='telegram_users')
    loop
      execute format(
        'update %I.%I set %I=$1 where %I=$2',
        rec.schema_name,rec.table_name,rec.column_name,rec.column_name
      ) using new_id,old_id;
    end loop;

    delete from public.telegram_users where telegram_user_id=old_id;
  end loop;
end
$$;
