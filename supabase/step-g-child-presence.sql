-- LEARNGATE Step G: Child presence (online/offline) for safety map
-- Run once in Supabase SQL Editor for existing projects.

begin;

alter table public.children
  add column if not exists is_online boolean not null default false;

alter table public.children
  add column if not exists last_seen_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'children'
  ) then
    alter publication supabase_realtime add table public.children;
  end if;
end $$;

create or replace function public.set_child_online_status(p_is_online boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.children
  set is_online = coalesce(p_is_online, false),
      last_seen_at = now()
  where child_user_id = auth.uid();
end;
$$;

revoke all on function public.set_child_online_status(boolean) from public;
grant execute on function public.set_child_online_status(boolean) to authenticated;

commit;
