-- LEARNGATE Step V: Allow 1–1440 min daily limit (matches app validation for testing / short limits)
-- Run in Supabase SQL Editor.

begin;

alter table public.children
  drop constraint if exists children_daily_limit_minutes_check;

alter table public.children
  add constraint children_daily_limit_minutes_check
  check (daily_limit_minutes between 1 and 1440);

commit;
