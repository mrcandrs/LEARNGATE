-- LEARNGATE Step AD: Let children read their own weekly star snapshot history
-- Run after step-ab-weekly-star-reset.sql

begin;

drop policy if exists "Children read own weekly snapshots" on public.child_weekly_star_snapshots;
create policy "Children read own weekly snapshots"
  on public.child_weekly_star_snapshots for select
  to authenticated
  using (
    exists (
      select 1
      from public.children c
      where c.id = child_weekly_star_snapshots.child_id
        and c.child_user_id = auth.uid()
    )
  );

commit;
