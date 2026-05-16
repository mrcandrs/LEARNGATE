-- Enable Supabase Realtime on tasks (required for in-app child task alerts).
-- Run once in SQL Editor.

begin;

do $$
begin
  alter publication supabase_realtime add table public.tasks;
exception
  when duplicate_object then
    null;
end $$;

commit;
