-- LEARNGATE Step E: Add "exercise" task category
-- Run once in Supabase SQL Editor for existing projects.

begin;

alter table public.tasks
  drop constraint if exists tasks_category_check;

alter table public.tasks
  add constraint tasks_category_check
  check (category in ('learning', 'exercise', 'chore'));

commit;

