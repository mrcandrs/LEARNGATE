-- LEARNGATE Step W: Child app usage events (Android Usage Stats sync)
-- Run in Supabase SQL Editor after step-c-init.sql

begin;

create table if not exists public.child_app_usage_events (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  package_name text not null,
  app_label text,
  event_type text not null check (event_type in ('foreground', 'background')),
  event_at timestamptz not null,
  duration_seconds int check (duration_seconds is null or duration_seconds >= 0),
  created_at timestamptz not null default now()
);

create unique index if not exists idx_child_app_usage_dedupe
  on public.child_app_usage_events (child_id, package_name, event_at, event_type);

create index if not exists idx_child_app_usage_child_event_at
  on public.child_app_usage_events (child_id, event_at desc);

alter table public.child_app_usage_events enable row level security;

drop policy if exists "child_app_usage_parent_select" on public.child_app_usage_events;
create policy "child_app_usage_parent_select"
on public.child_app_usage_events
for select
to authenticated
using (
  exists (
    select 1
    from public.children c
    where c.id = child_app_usage_events.child_id
      and c.parent_id = auth.uid()
  )
);

drop policy if exists "child_app_usage_child_select_own" on public.child_app_usage_events;
create policy "child_app_usage_child_select_own"
on public.child_app_usage_events
for select
to authenticated
using (
  exists (
    select 1
    from public.children c
    where c.id = child_app_usage_events.child_id
      and c.child_user_id = auth.uid()
  )
);

drop policy if exists "child_app_usage_child_insert_own" on public.child_app_usage_events;
create policy "child_app_usage_child_insert_own"
on public.child_app_usage_events
for insert
to authenticated
with check (
  exists (
    select 1
    from public.children c
    where c.id = child_app_usage_events.child_id
      and c.child_user_id = auth.uid()
  )
);

commit;
