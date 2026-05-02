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

commit;

