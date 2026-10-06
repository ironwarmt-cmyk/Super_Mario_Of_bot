create table if not exists public.quality_emergency_audits (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null references public.telegram_users(telegram_user_id) on delete cascade,
  standard_key text not null,
  standard_version text not null,
  audit_date date not null,
  status text not null default 'active' check (status in ('active','completed','archived')),
  readiness_score integer not null default 0 check (readiness_score between 0 and 100),
  task_state jsonb not null default '{}'::jsonb,
  evidence_log jsonb not null default '[]'::jsonb,
  notes jsonb not null default '{}'::jsonb,
  reminders_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.quality_emergency_audits enable row level security;
revoke all on public.quality_emergency_audits from anon, authenticated;
grant all on public.quality_emergency_audits to service_role;
create index if not exists quality_emergency_audits_user_updated_idx
  on public.quality_emergency_audits(telegram_user_id, updated_at desc);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'quality-emergency-evidence',
  'quality-emergency-evidence',
  false,
  15728640,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "quality emergency upload own folder" on storage.objects;
create policy "quality emergency upload own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id='quality-emergency-evidence'
  and (storage.foldername(name))[1]=auth.uid()::text
);

drop policy if exists "quality emergency read own folder" on storage.objects;
create policy "quality emergency read own folder"
on storage.objects for select to authenticated
using (
  bucket_id='quality-emergency-evidence'
  and (storage.foldername(name))[1]=auth.uid()::text
);

drop policy if exists "quality emergency delete own folder" on storage.objects;
create policy "quality emergency delete own folder"
on storage.objects for delete to authenticated
using (
  bucket_id='quality-emergency-evidence'
  and (storage.foldername(name))[1]=auth.uid()::text
);
