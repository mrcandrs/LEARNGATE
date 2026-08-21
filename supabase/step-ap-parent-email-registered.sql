-- LearnGate: check whether an email belongs to a registered parent before password reset.
-- Run in Supabase SQL Editor.
-- Used by the app via: supabase.rpc('parent_email_is_registered', { p_email: '...' })

create or replace function public.parent_email_is_registered(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized text := lower(trim(coalesce(p_email, '')));
  uid uuid;
  profile_role text;
  meta_role text;
begin
  if normalized = '' then
    return false;
  end if;

  select u.id, coalesce(u.raw_user_meta_data->>'role', '')
    into uid, meta_role
  from auth.users u
  where lower(u.email) = normalized
  limit 1;

  if uid is null then
    return false;
  end if;

  select p.role into profile_role
  from public.profiles p
  where p.id = uid;

  return profile_role = 'parent' or meta_role = 'parent';
end;
$$;

revoke all on function public.parent_email_is_registered(text) from public;
grant execute on function public.parent_email_is_registered(text) to anon, authenticated;
