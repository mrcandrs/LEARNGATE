-- LEARNGATE Step AI: Accurate unlock timers + started_at on temp unlocks
-- Run after step-ah-app-unlock-tweaks.sql

begin;

alter table public.child_app_temp_unlocks
  add column if not exists duration text check (duration is null or duration in ('30m', 'rest_of_day', 'week'));

alter table public.child_app_temp_unlocks
  add column if not exists started_at timestamptz;

create or replace function public.fn_unlock_until_for_duration(
  p_duration text,
  p_from timestamptz default now()
)
returns timestamptz
language plpgsql
stable
set search_path = public
as $$
declare
  v_local date := (timezone('Asia/Manila', p_from) at time zone 'Asia/Manila')::date;
begin
  return case p_duration
    when '30m' then p_from + interval '30 minutes'
    when 'rest_of_day' then ((v_local + 1)::timestamp at time zone 'Asia/Manila')
    when 'week' then public.fn_manila_week_start(p_from) + interval '7 days'
    else p_from + interval '30 minutes'
  end;
end;
$$;

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
  v_started timestamptz := now();
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

  v_until := public.fn_unlock_until_for_duration(v_req.duration, v_started);
  v_packages := public.fn_packages_for_unlock_key(public.fn_unlock_pricing_key(v_req.package_name));

  foreach v_pkg in array v_packages loop
    insert into public.child_app_temp_unlocks (
      child_id, package_name, unlock_until, request_id, duration, started_at
    )
    values (
      v_req.child_id, v_pkg, v_until, p_request_id, v_req.duration, v_started
    )
    on conflict (child_id, package_name) do update
      set unlock_until = excluded.unlock_until,
          request_id = excluded.request_id,
          duration = excluded.duration,
          started_at = excluded.started_at,
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

  delete from public.child_app_temp_unlocks
  where child_id = p_child_id
    and unlock_until <= now();

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'package_name', t.package_name,
          'unlock_until', t.unlock_until,
          'duration', t.duration,
          'started_at', t.started_at
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
