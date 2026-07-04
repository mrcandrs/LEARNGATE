-- LEARNGATE Step AF: Track when parent last changed screen-time limit
-- Child devices reset today's local usage when this timestamp changes.
-- Run after step-y-screen-toggles-notifications.sql

begin;

alter table public.children
  add column if not exists screen_limit_set_at timestamptz;

create or replace function public.sync_screen_limit_set_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.screen_limit_set_at := coalesce(new.screen_limit_set_at, now());
  elsif tg_op = 'UPDATE' then
    if new.daily_limit_minutes is distinct from old.daily_limit_minutes
       or new.screen_limit_enabled is distinct from old.screen_limit_enabled then
      new.screen_limit_set_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_children_sync_screen_limit_set_at on public.children;
create trigger trg_children_sync_screen_limit_set_at
  before insert or update on public.children
  for each row
  execute function public.sync_screen_limit_set_at();

-- Existing rows: leave null until parent saves screen limits (child won't count time until then).

-- One-time: if you already saved limits before this column existed, run once per child after deploy:
-- update public.children set screen_limit_set_at = now() where screen_limit_set_at is null;

commit;
