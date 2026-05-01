-- LEARNGATE Step F: Child location tracking + RLS for parent monitoring
-- Run once in Supabase SQL Editor for existing projects.

begin;

create table if not exists public.child_locations (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy_m double precision,
  speed_mps double precision,
  heading_deg double precision,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_child_locations_child_id on public.child_locations(child_id);
create index if not exists idx_child_locations_captured_at on public.child_locations(captured_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'child_locations'
  ) then
    alter publication supabase_realtime add table public.child_locations;
  end if;
end $$;

alter table public.child_locations enable row level security;

drop policy if exists "child_locations_parent_select" on public.child_locations;
create policy "child_locations_parent_select"
on public.child_locations
for select
to authenticated
using (
  exists (
    select 1
    from public.children c
    where c.id = child_locations.child_id
      and c.parent_id = auth.uid()
  )
);

drop policy if exists "child_locations_child_select_own" on public.child_locations;
create policy "child_locations_child_select_own"
on public.child_locations
for select
to authenticated
using (
  exists (
    select 1
    from public.children c
    where c.id = child_locations.child_id
      and c.child_user_id = auth.uid()
  )
);

drop policy if exists "child_locations_child_insert_own" on public.child_locations;
create policy "child_locations_child_insert_own"
on public.child_locations
for insert
to authenticated
with check (
  exists (
    select 1
    from public.children c
    where c.id = child_locations.child_id
      and c.child_user_id = auth.uid()
  )
);

drop policy if exists "child_locations_parent_delete_own" on public.child_locations;
create policy "child_locations_parent_delete_own"
on public.child_locations
for delete
to authenticated
using (
  exists (
    select 1
    from public.children c
    where c.id = child_locations.child_id
      and c.parent_id = auth.uid()
  )
);

commit;

