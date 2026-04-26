-- LEARNGATE Step D: Parent-created child accounts + child PIN verification support
-- Run once in Supabase SQL Editor for existing projects.

begin;

alter table public.children
  add column if not exists auth_pin text not null default '000000';

alter table public.children
  add column if not exists login_email text;

alter table public.children
  add column if not exists login_secret text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'children_login_email_key'
  ) then
    alter table public.children add constraint children_login_email_key unique (login_email);
  end if;
end $$;

alter table public.children
  drop constraint if exists children_auth_pin_format;

alter table public.children
  add constraint children_auth_pin_format
  check (auth_pin ~ '^[0-9]{6}$');

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    case
      when coalesce(new.raw_user_meta_data->>'role', 'parent') = 'child' then 'child'
      else 'parent'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.get_child_login_credentials(p_child_name text, p_pin text)
returns table (login_email text, login_secret text)
language sql
security definer
set search_path = public
as $$
  select c.login_email, c.login_secret
  from public.children c
  where lower(c.name) = lower(trim(p_child_name))
    and c.auth_pin = trim(p_pin)
    and c.child_user_id is not null
    and c.login_email is not null
    and c.login_secret is not null
  limit 1;
$$;

revoke all on function public.get_child_login_credentials(text, text) from public;
grant execute on function public.get_child_login_credentials(text, text) to anon, authenticated;

create or replace function public.award_child_points(
  p_child_id uuid,
  p_points int,
  p_event_type text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  is_allowed boolean;
  safe_points int := greatest(0, coalesce(p_points, 0));
begin
  select exists (
    select 1
    from public.children c
    where c.id = p_child_id
      and (c.child_user_id = auth.uid() or c.parent_id = auth.uid())
  )
  into is_allowed;

  if not is_allowed then
    raise exception 'Not allowed to award points for this child.';
  end if;

  update public.children
  set stars = stars + safe_points
  where id = p_child_id;

  insert into public.activity_logs (child_id, actor_profile_id, type, points, metadata)
  values (p_child_id, auth.uid(), p_event_type, safe_points, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

revoke all on function public.award_child_points(uuid, int, text, jsonb) from public;
grant execute on function public.award_child_points(uuid, int, text, jsonb) to authenticated;

commit;
