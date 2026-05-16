-- LEARNGATE Step P fix: Uninstall alerts were blocked by last_offline_alert_at (e.g. old "device quiet" tests)
-- Run in Supabase SQL Editor after step-p-uninstall-only-parent-alerts.sql

begin;

create or replace function public.fn_enqueue_child_app_uninstalled(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  cid uuid;
  cname text;
begin
  select user_id into uid from public.push_tokens where token = p_token limit 1;
  if uid is null then
    return false;
  end if;

  select c.id, c.name
  into cid, cname
  from public.children c
  where c.child_user_id = uid;

  if cid is null then
    return false;
  end if;

  -- Debounce duplicate uninstall alerts only (not old offline-alert timestamps).
  if exists (
    select 1
    from public.notification_outbox o
    where o.event_type = 'child_app_uninstalled'
      and o.payload->>'child_id' = cid::text
      and o.created_at > now() - interval '30 minutes'
  ) then
    return false;
  end if;

  insert into public.notification_outbox (event_type, payload)
  values (
    'child_app_uninstalled',
    jsonb_build_object(
      'child_id', cid,
      'child_name', cname
    )
  );

  return true;
end;
$$;

revoke all on function public.fn_enqueue_child_app_uninstalled(text) from public;
grant execute on function public.fn_enqueue_child_app_uninstalled(text) to service_role;

commit;
