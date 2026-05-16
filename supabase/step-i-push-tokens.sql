-- LEARNGATE Step I: Push notification tokens
-- Run once in Supabase SQL Editor.

begin;

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique,
  platform text null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.push_tokens enable row level security;

drop policy if exists "push_tokens_select_own" on public.push_tokens;
create policy "push_tokens_select_own"
on public.push_tokens
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "push_tokens_upsert_own" on public.push_tokens;
create policy "push_tokens_upsert_own"
on public.push_tokens
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "push_tokens_update_own" on public.push_tokens;
create policy "push_tokens_update_own"
on public.push_tokens
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Upsert from the app must use this RPC (see step-i-push-tokens-fix-rls.sql) so a device token
-- can move from parent → child without violating RLS on conflict.

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

  delete from public.push_tokens where token = p_token;

  insert into public.push_tokens (user_id, token, platform, updated_at)
  values (uid, p_token, p_platform, now());
end;
$$;

revoke all on function public.upsert_push_token(text, text) from public;
grant execute on function public.upsert_push_token(text, text) to authenticated;

commit;

