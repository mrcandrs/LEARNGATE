-- LEARNGATE Step O: Faster parent "device quiet" alerts (~1–3 min, background ≈ immediate)
-- Run in Supabase SQL Editor after step-n-parent-notifications.sql
--
-- Fixes:
--   1. last_seen_at was refreshed on offline calls — stale timer never started
--   2. Minimum stale window was 5 minutes (greatest(..., 5))
--   3. No alert when child backgrounds (only after long stale + cron)
--   4. Uninstall only detected on next push to child token

begin;

-- Only refresh "last seen" on heartbeats (online), not when marking offline.
create or replace function public.set_child_online_status(p_is_online boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
begin
  if coalesce(p_is_online, false) then
    update public.children
    set is_online = true,
        last_seen_at = now()
    where child_user_id = auth.uid()
    returning id into cid;

    if cid is not null then
      update public.parent_notification_state
      set last_offline_alert_at = null, updated_at = now()
      where child_id = cid;
    end if;
  else
    update public.children
    set is_online = false
    where child_user_id = auth.uid();
  end if;
end;
$$;

revoke all on function public.set_child_online_status(boolean) from public;
grant execute on function public.set_child_online_status(boolean) to authenticated;

-- Child app calls this when going to background (switching away / home button).
create or replace function public.report_child_went_background()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
  cname text;
  seen_at timestamptz;
  last_alert timestamptz;
begin
  select c.id, c.name, c.last_seen_at
  into cid, cname, seen_at
  from public.children c
  where c.child_user_id = auth.uid();

  if cid is null then
    return;
  end if;

  update public.children set is_online = false where id = cid;

  select pns.last_offline_alert_at into last_alert
  from public.parent_notification_state pns
  where pns.child_id = cid;

  if last_alert is not null and last_alert > now() - interval '10 minutes' then
    return;
  end if;

  insert into public.notification_outbox (event_type, payload)
  values (
    'child_device_offline',
    jsonb_build_object(
      'child_id', cid,
      'child_name', cname,
      'last_seen_at', coalesce(seen_at, now()),
      'reason', 'backgrounded'
    )
  );

  insert into public.parent_notification_state (child_id, last_offline_alert_at, updated_at)
  values (cid, now(), now())
  on conflict (child_id) do update
    set last_offline_alert_at = now(), updated_at = now();
end;
$$;

revoke all on function public.report_child_went_background() from public;
grant execute on function public.report_child_went_background() to authenticated;

-- Edge function / cron: shorter stale window (default 3 min, floor 2 min).
create or replace function public.fn_enqueue_child_offline_alerts(p_stale_minutes int default 3)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  n int := 0;
  mins int := greatest(coalesce(p_stale_minutes, 3), 2);
begin
  for rec in
    select c.id as child_id, c.name, c.parent_id, c.last_seen_at
    from public.children c
    where c.last_seen_at is not null
      and c.last_seen_at < now() - make_interval(mins => mins)
      and (
        not exists (
          select 1 from public.parent_notification_state pns
          where pns.child_id = c.id
            and pns.last_offline_alert_at is not null
            and pns.last_offline_alert_at >= c.last_seen_at
        )
      )
  loop
    insert into public.notification_outbox (event_type, payload)
    values (
      'child_device_offline',
      jsonb_build_object(
        'child_id', rec.child_id,
        'child_name', rec.name,
        'last_seen_at', rec.last_seen_at,
        'reason', 'stale_check_in'
      )
    );

    insert into public.parent_notification_state (child_id, last_offline_alert_at, updated_at)
    values (rec.child_id, now(), now())
    on conflict (child_id) do update
      set last_offline_alert_at = now(), updated_at = now();

    n := n + 1;
  end loop;

  return n;
end;
$$;

revoke all on function public.fn_enqueue_child_offline_alerts(int) from public;
grant execute on function public.fn_enqueue_child_offline_alerts(int) to service_role;

-- Called from edge function when Expo returns DeviceNotRegistered (uninstall / cleared data).
create or replace function public.fn_enqueue_child_offline_for_push_token(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  cid uuid;
  cname text;
  seen_at timestamptz;
  last_alert timestamptz;
begin
  select user_id into uid from public.push_tokens where token = p_token limit 1;
  if uid is null then
    return false;
  end if;

  select c.id, c.name, c.last_seen_at
  into cid, cname, seen_at
  from public.children c
  where c.child_user_id = uid;

  if cid is null then
    return false;
  end if;

  select pns.last_offline_alert_at into last_alert
  from public.parent_notification_state pns
  where pns.child_id = cid;

  if last_alert is not null and last_alert > now() - interval '10 minutes' then
    return false;
  end if;

  insert into public.notification_outbox (event_type, payload)
  values (
    'child_device_offline',
    jsonb_build_object(
      'child_id', cid,
      'child_name', cname,
      'last_seen_at', coalesce(seen_at, now()),
      'reason', 'push_token_revoked'
    )
  );

  insert into public.parent_notification_state (child_id, last_offline_alert_at, updated_at)
  values (cid, now(), now())
  on conflict (child_id) do update
    set last_offline_alert_at = now(), updated_at = now();

  return true;
end;
$$;

revoke all on function public.fn_enqueue_child_offline_for_push_token(text) from public;
grant execute on function public.fn_enqueue_child_offline_for_push_token(text) to service_role;

commit;
