-- LEARNGATE Step AE: Child birthday (Manila calendar) drives exact age
-- Run after step-c-init.sql
--
-- Parents set birthday; age is synced automatically using Asia/Manila "today".

begin;

alter table public.children
  add column if not exists birthday date;

-- Approximate backfill from legacy age (same month/day as migration day in Manila).
update public.children c
set birthday = (
  (timezone('Asia/Manila', now()))::date - (c.age || ' years')::interval
)::date
where c.birthday is null
  and c.age is not null;

create or replace function public.child_age_in_manila(p_birthday date)
returns integer
language sql
stable
set search_path = public
as $$
  select extract(
    year from age((timezone('Asia/Manila', now()))::date, p_birthday)
  )::int;
$$;

create or replace function public.sync_child_age_from_birthday()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.birthday is not null then
    new.age := public.child_age_in_manila(new.birthday);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_children_sync_age_from_birthday on public.children;
create trigger trg_children_sync_age_from_birthday
  before insert or update of birthday on public.children
  for each row
  execute function public.sync_child_age_from_birthday();

-- Sync age for backfilled birthdays
update public.children c
set age = public.child_age_in_manila(c.birthday)
where c.birthday is not null;

commit;
