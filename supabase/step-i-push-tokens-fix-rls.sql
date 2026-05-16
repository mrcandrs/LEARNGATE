-- LEARNGATE Step I fix: push_tokens upsert across accounts on the same device
-- Run in Supabase SQL Editor if upsert fails with RLS (USING expression) on login.
--
-- Cause: Expo push token is unique per device. Upsert on conflict tries UPDATE on a row
-- owned by another user (e.g. parent logged in first), which RLS blocks.

begin;

create or replace function public.upsert_push_token(p_token text, p_platform text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_token is null or length(trim(p_token)) = 0 then
    raise exception 'Token is required';
  end if;

  -- One device token → one row; reassign to the current signed-in user.
  delete from public.push_tokens where token = p_token;

  insert into public.push_tokens (user_id, token, platform, updated_at)
  values (uid, p_token, p_platform, now());
end;
$$;

revoke all on function public.upsert_push_token(text, text) from public;
grant execute on function public.upsert_push_token(text, text) to authenticated;

commit;
