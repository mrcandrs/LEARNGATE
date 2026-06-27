-- LEARNGATE Step Y: Screen limit / bedtime toggles + notification retention (30 days)

begin;

alter table public.children
  add column if not exists screen_limit_enabled boolean not null default true,
  add column if not exists bedtime_enabled boolean not null default true;

-- Remove notifications older than 30 days for the signed-in user (called from app on bell open).
create or replace function public.prune_my_notifications()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  removed int;
begin
  delete from public.user_notifications
  where user_id = auth.uid()
    and created_at < now() - interval '30 days';
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.prune_my_notifications() from public;
grant execute on function public.prune_my_notifications() to authenticated;

-- Allow users to delete their own old notifications (used by prune + optional manual cleanup).
drop policy if exists "Users delete own notifications" on public.user_notifications;
create policy "Users delete own notifications"
  on public.user_notifications for delete
  using (auth.uid() = user_id);

commit;
