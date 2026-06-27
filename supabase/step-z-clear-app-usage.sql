-- LEARNGATE Step Z: Allow a parent to clear a child's recorded app usage history.
-- Run in Supabase SQL Editor after step-w-child-app-usage.sql

begin;

drop policy if exists "child_app_usage_parent_delete" on public.child_app_usage_events;
create policy "child_app_usage_parent_delete"
on public.child_app_usage_events
for delete
to authenticated
using (
  exists (
    select 1
    from public.children c
    where c.id = child_app_usage_events.child_id
      and c.parent_id = auth.uid()
  )
);

commit;

-- After running: a parent can delete child_app_usage_events rows for their own children
-- (used by the "Clear recorded app history" action in Manage Children).
