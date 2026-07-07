-- LEARNGATE Step AM: Start fixed-length unlocks (1m/5m/30m) when the child OPENS the app.
-- Run after step-al-app-unlock-short-durations.sql
--
-- Problem this fixes: a "1 minute" pass previously started counting at parent APPROVAL. By the
-- time the push arrived and the child opened the app, the minute was already gone, so the device
-- wrote no temp-allow and bounced the child straight back to LearnGate.
--
-- New model:
--   * Fixed durations (1m/5m/30m): approval only GRANTS the pass (started_at / activated_at NULL,
--     with a 30-minute window to open it). The clock starts on first open via fn_activate_app_unlock.
--   * rest_of_day / week: unchanged — anchored durations that are active immediately on approval.

begin;

-- Track when a pass was actually started (first open). NULL = granted but not started yet.
alter table public.child_app_temp_unlocks
  add column if not exists activated_at timestamptz;

-- Existing rows were all start-on-approval; keep them active so nothing breaks on migration.
update public.child_app_temp_unlocks
set activated_at = coalesce(started_at, created_at)
where activated_at is null;

-- Approval: grant the pass. Fixed durations wait for the child to open; anchored ones start now.
create or replace function public.fn_resolve_app_unlock(
  p_request_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req record;
  v_role text;
  v_now timestamptz := now();
  v_is_fixed boolean;
  v_started timestamptz;
  v_activated timestamptz;
  v_until timestamptz;
  v_pkg text;
  v_packages text[];
  v_child_name text;
begin
  select * into v_req
  from public.child_app_unlock_requests
  where id = p_request_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'Request not found.');
  end if;

  v_role := public.fn_child_access_role(v_req.child_id);
  if v_role is distinct from 'parent' then
    return jsonb_build_object('ok', false, 'reason', 'Only a parent can approve or deny unlock requests.');
  end if;

  if v_req.status <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', 'This request was already handled.');
  end if;

  if p_action = 'deny' then
    update public.children
    set stars = stars + v_req.stars_escrowed
    where id = v_req.child_id;

    update public.child_app_unlock_requests
    set status = 'denied', resolved_at = now(), resolved_by = auth.uid()
    where id = p_request_id;

    insert into public.activity_logs (child_id, actor_profile_id, type, points, metadata)
    values (
      v_req.child_id,
      auth.uid(),
      'app_unlock_denied',
      0,
      jsonb_build_object(
        'request_id', p_request_id,
        'package_name', v_req.package_name,
        'stars_refunded', v_req.stars_escrowed
      )
    );

    select name into v_child_name from public.children where id = v_req.child_id;

    insert into public.notification_outbox (event_type, payload)
    values (
      'app_unlock_denied',
      jsonb_build_object(
        'child_id', v_req.child_id,
        'child_name', v_child_name,
        'request_id', p_request_id,
        'app_label', coalesce(v_req.app_label, v_req.package_name),
        'stars_refunded', v_req.stars_escrowed
      )
    );

    return jsonb_build_object('ok', true, 'status', 'denied', 'stars_refunded', v_req.stars_escrowed);
  end if;

  if p_action <> 'approve' then
    return jsonb_build_object('ok', false, 'reason', 'Action must be approve or deny.');
  end if;

  v_is_fixed := v_req.duration in ('1m', '5m', '30m');

  if v_is_fixed then
    -- Granted, not started. Give a 30-minute window to open; the clock starts on first open.
    v_started := null;
    v_activated := null;
    v_until := v_now + interval '30 minutes';
  else
    v_started := v_now;
    v_activated := v_now;
    v_until := public.fn_unlock_until_for_duration(v_req.duration, v_now);
  end if;

  v_packages := public.fn_packages_for_unlock_key(public.fn_unlock_pricing_key(v_req.package_name));

  foreach v_pkg in array v_packages loop
    insert into public.child_app_temp_unlocks (
      child_id, package_name, unlock_until, request_id, duration, started_at, activated_at
    )
    values (
      v_req.child_id, v_pkg, v_until, p_request_id, v_req.duration, v_started, v_activated
    )
    on conflict (child_id, package_name) do update
      set unlock_until = excluded.unlock_until,
          request_id = excluded.request_id,
          duration = excluded.duration,
          started_at = excluded.started_at,
          activated_at = excluded.activated_at,
          created_at = now();
  end loop;

  update public.child_app_unlock_requests
  set status = 'approved', unlock_until = v_until, resolved_at = now(), resolved_by = auth.uid()
  where id = p_request_id;

  insert into public.activity_logs (child_id, actor_profile_id, type, points, metadata)
  values (
    v_req.child_id,
    auth.uid(),
    'app_unlock_approved',
    0,
    jsonb_build_object(
      'request_id', p_request_id,
      'package_name', v_req.package_name,
      'duration', v_req.duration,
      'unlock_until', v_until,
      'started_at', v_started,
      'stars_spent', v_req.stars_escrowed
    )
  );

  select name into v_child_name from public.children where id = v_req.child_id;

  insert into public.notification_outbox (event_type, payload)
  values (
    'app_unlock_approved',
    jsonb_build_object(
      'child_id', v_req.child_id,
      'child_name', v_child_name,
      'request_id', p_request_id,
      'package_name', v_req.package_name,
      'app_label', coalesce(v_req.app_label, v_req.package_name),
      'duration', v_req.duration,
      'unlock_until', v_until,
      'started_at', v_started
    )
  );

  return jsonb_build_object(
    'ok', true,
    'status', 'approved',
    'duration', v_req.duration,
    'started_at', v_started,
    'unlock_until', v_until,
    'packages', to_jsonb(v_packages)
  );
end;
$$;

-- Start the clock on first open. Idempotent: only the first call for a granted fixed pass starts it.
create or replace function public.fn_activate_app_unlock(
  p_child_id uuid,
  p_package_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_key text := public.fn_unlock_pricing_key(p_package_name);
  v_packages text[] := public.fn_packages_for_unlock_key(v_key);
  v_duration text;
  v_now timestamptz := now();
  v_until timestamptz;
begin
  v_role := public.fn_child_access_role(p_child_id);
  if v_role is null then
    return jsonb_build_object('ok', false, 'reason', 'No access to this child.');
  end if;

  -- Find a granted-but-not-started fixed pass for this app group.
  select t.duration
  into v_duration
  from public.child_app_temp_unlocks t
  where t.child_id = p_child_id
    and t.package_name = any (v_packages)
    and t.duration in ('1m', '5m', '30m')
    and t.activated_at is null
    and t.unlock_until > v_now
  limit 1;

  if v_duration is null then
    -- Already started, expired, or an anchored pass — nothing to do.
    return jsonb_build_object('ok', true, 'activated', false);
  end if;

  v_until := v_now + case v_duration
    when '1m' then interval '1 minute'
    when '5m' then interval '5 minutes'
    when '30m' then interval '30 minutes'
    else interval '30 minutes'
  end;

  update public.child_app_temp_unlocks
  set started_at = v_now,
      activated_at = v_now,
      unlock_until = v_until
  where child_id = p_child_id
    and package_name = any (v_packages)
    and duration in ('1m', '5m', '30m')
    and activated_at is null
    and unlock_until > v_now;

  return jsonb_build_object(
    'ok', true,
    'activated', true,
    'duration', v_duration,
    'unlock_until', v_until
  );
end;
$$;

revoke all on function public.fn_activate_app_unlock(uuid, text) from public;
grant execute on function public.fn_activate_app_unlock(uuid, text) to authenticated;

-- Expose activated_at so the device knows whether a pass has started.
create or replace function public.fn_get_child_temp_unlocks(p_child_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  v_role := public.fn_child_access_role(p_child_id);
  if v_role is null then
    return '[]'::jsonb;
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'package_name', t.package_name,
          'unlock_until', t.unlock_until,
          'duration', t.duration,
          'started_at', t.started_at,
          'activated_at', t.activated_at
        )
        order by t.unlock_until desc
      )
      from public.child_app_temp_unlocks t
      where t.child_id = p_child_id
        and t.unlock_until > now()
    ),
    '[]'::jsonb
  );
end;
$$;

commit;
