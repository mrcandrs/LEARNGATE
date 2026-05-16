-- LEARNGATE Step P: Parent alert only when child app is uninstalled (push token revoked)
-- Run after step-o-faster-offline-alerts.sql
--
-- Removes background / stale "device quiet" alerts. Uninstall is detected when Expo returns
-- DeviceNotRegistered on the child's push token (edge function enqueues this event).

begin;

drop function if exists public.report_child_went_background();

-- Disable periodic stale check-ins (alt-tab / force-stop must not notify).
create or replace function public.fn_enqueue_child_offline_alerts(p_stale_minutes int default 3)
returns int
language plpgsql
security definer
set search_path = public
as $$
begin
  return 0;
end;
$$;

revoke all on function public.fn_enqueue_child_offline_alerts(int) from public;
grant execute on function public.fn_enqueue_child_offline_alerts(int) to service_role;

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

-- Alias for edge function versions that still call the old name.
create or replace function public.fn_enqueue_child_offline_for_push_token(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.fn_enqueue_child_app_uninstalled(p_token);
end;
$$;

revoke all on function public.fn_enqueue_child_offline_for_push_token(text) from public;
grant execute on function public.fn_enqueue_child_offline_for_push_token(text) to service_role;

commit;

-- Unschedule stale-only cron if you added step-o-offline-presence-cron.sql:
--   select cron.unschedule(jobid) from cron.job where jobname = 'learngate-child-offline-check';
--
-- Token health cron (detect uninstall every few hours): step-q-child-token-health-cron.sql
