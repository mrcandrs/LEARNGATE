-- LEARNGATE Step AL: Add short unlock durations (1m, 5m) for quick breaks + testing
-- Run after step-ak-app-unlock-expired.sql

begin;

-- 1) Allow the new durations on both tables.
alter table public.child_app_unlock_requests
  drop constraint if exists child_app_unlock_requests_duration_check;
alter table public.child_app_unlock_requests
  add constraint child_app_unlock_requests_duration_check
  check (duration in ('1m', '5m', '30m', 'rest_of_day', 'week'));

alter table public.child_app_temp_unlocks
  drop constraint if exists child_app_temp_unlocks_duration_check;
alter table public.child_app_temp_unlocks
  add constraint child_app_temp_unlocks_duration_check
  check (duration is null or duration in ('1m', '5m', '30m', 'rest_of_day', 'week'));

-- 2) Suggested-mode multiplier (min 3 stars floor still applies downstream).
create or replace function public.fn_unlock_duration_multiplier(p_duration text)
returns numeric
language sql
immutable
as $$
  select case p_duration
    when '1m' then 0.1
    when '5m' then 0.2
    when '30m' then 0.45
    when 'rest_of_day' then 0.75
    when 'week' then 1.0
    else 1.0
  end;
$$;

-- 3) End time for a duration (two-arg version used by fn_resolve_app_unlock).
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
    when '1m' then p_from + interval '1 minute'
    when '5m' then p_from + interval '5 minutes'
    when '30m' then p_from + interval '30 minutes'
    when 'rest_of_day' then ((v_local + 1)::timestamp at time zone 'Asia/Manila')
    when 'week' then public.fn_manila_week_start(p_from) + interval '7 days'
    else p_from + interval '30 minutes'
  end;
end;
$$;

-- 4) Star cost — add short-duration cases to the fixed branch.
create or replace function public.fn_resolve_unlock_star_cost(
  p_child_id uuid,
  p_package_name text,
  p_duration text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_key text := public.fn_unlock_pricing_key(p_package_name);
  v_rules record;
  v_cfg jsonb;
  v_mode text;
  v_fixed int;
  v_base int;
  v_stars int;
  v_enabled boolean;
  v_rest_mult numeric := 0.75;
  v_short_mult numeric := 0.45;
begin
  select sr.app_unlock_enabled, sr.unlock_pricing_json, sr.blocked_apps_json
  into v_rules
  from public.screen_rules sr
  where sr.child_id = p_child_id;

  if not found then
    return jsonb_build_object('ok', false, 'disabled', true, 'reason', 'No screen rules for this child.');
  end if;

  v_enabled := coalesce(v_rules.app_unlock_enabled, true);
  if not v_enabled then
    return jsonb_build_object('ok', false, 'disabled', true, 'reason', 'Star unlocks are turned off.');
  end if;

  if not exists (
    select 1
    from jsonb_array_elements_text(v_rules.blocked_apps_json) blk(pkg)
    where blk.pkg = p_package_name
       or blk.pkg = any (public.fn_packages_for_unlock_key(v_key))
  ) then
    return jsonb_build_object('ok', false, 'disabled', true, 'reason', 'This app is not blocked.');
  end if;

  v_cfg := coalesce(v_rules.unlock_pricing_json -> v_key, '{}'::jsonb);
  v_mode := coalesce(v_cfg ->> 'mode', 'suggested');

  if v_mode = 'disabled' then
    return jsonb_build_object('ok', false, 'disabled', true, 'reason', 'Your parent disabled star unlocks for this app.');
  end if;

  if v_mode = 'fixed' then
    v_fixed := greatest(3, least(100, coalesce((v_cfg ->> 'fixed_stars')::int, 15)));
    v_stars := case p_duration
      when '1m' then 3
      when '5m' then greatest(3, ceil(v_fixed * 0.2 / v_rest_mult)::int)
      when '30m' then greatest(3, ceil(v_fixed * v_short_mult / v_rest_mult)::int)
      when 'rest_of_day' then v_fixed
      when 'week' then greatest(3, ceil(v_fixed / v_rest_mult)::int)
      else v_fixed
    end;
    v_base := v_fixed;
  else
    v_base := public.fn_suggest_unlock_base_stars(p_child_id, p_package_name);
    v_stars := greatest(
      3,
      ceil(v_base * public.fn_unlock_duration_multiplier(p_duration))::int
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'disabled', false,
    'pricing_key', v_key,
    'mode', v_mode,
    'base_stars', v_base,
    'stars', v_stars,
    'duration', p_duration
  );
end;
$$;

revoke all on function public.fn_resolve_unlock_star_cost(uuid, text, text) from public;
grant execute on function public.fn_resolve_unlock_star_cost(uuid, text, text) to authenticated;

-- 5) Accept the new durations in the request guard (keeps everything else from step-ah).
create or replace function public.fn_request_app_unlock(
  p_child_id uuid,
  p_package_name text,
  p_app_label text default null,
  p_duration text default '30m',
  p_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_quote jsonb;
  v_stars int;
  v_request_id uuid;
  v_child_name text;
  v_week_start timestamptz := public.fn_manila_week_start();
  v_week_requests int;
  v_child_msg text := nullif(trim(p_message), '');
begin
  v_role := public.fn_child_access_role(p_child_id);
  if v_role is distinct from 'child' then
    return jsonb_build_object('ok', false, 'reason', 'Only the child account can request an unlock.');
  end if;

  if p_duration not in ('1m', '5m', '30m', 'rest_of_day', 'week') then
    return jsonb_build_object('ok', false, 'reason', 'Invalid unlock duration.');
  end if;

  v_quote := public.fn_resolve_unlock_star_cost(p_child_id, p_package_name, p_duration);
  if coalesce((v_quote ->> 'ok')::boolean, false) = false then
    return v_quote || jsonb_build_object('ok', false);
  end if;

  v_stars := (v_quote ->> 'stars')::int;

  if exists (
    select 1 from public.child_app_unlock_requests r
    where r.child_id = p_child_id
      and r.package_name = p_package_name
      and r.status = 'pending'
  ) then
    return jsonb_build_object('ok', false, 'reason', 'You already have a pending request for this app.');
  end if;

  select count(*)::int into v_week_requests
  from public.child_app_unlock_requests r
  where r.child_id = p_child_id
    and r.package_name = p_package_name
    and r.created_at >= v_week_start
    and r.status in ('pending', 'approved', 'denied');

  if v_week_requests >= 2 then
    return jsonb_build_object('ok', false, 'reason', 'Maximum unlock requests for this app this week.');
  end if;

  update public.children
  set stars = stars - v_stars
  where id = p_child_id
    and stars >= v_stars;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'Not enough stars this week.');
  end if;

  insert into public.child_app_unlock_requests (
    child_id, package_name, app_label, duration, stars_escrowed, status, child_message
  )
  values (
    p_child_id,
    p_package_name,
    nullif(trim(p_app_label), ''),
    p_duration,
    v_stars,
    'pending',
    v_child_msg
  )
  returning id into v_request_id;

  insert into public.activity_logs (child_id, actor_profile_id, type, points, metadata)
  values (
    p_child_id,
    auth.uid(),
    'app_unlock_requested',
    0,
    jsonb_build_object(
      'request_id', v_request_id,
      'package_name', p_package_name,
      'app_label', p_app_label,
      'duration', p_duration,
      'stars_escrowed', v_stars,
      'child_message', v_child_msg
    )
  );

  select name into v_child_name from public.children where id = p_child_id;

  insert into public.notification_outbox (event_type, payload)
  values (
    'app_unlock_requested',
    jsonb_build_object(
      'child_id', p_child_id,
      'child_name', v_child_name,
      'request_id', v_request_id,
      'package_name', p_package_name,
      'app_label', coalesce(nullif(trim(p_app_label), ''), p_package_name),
      'duration', p_duration,
      'stars', v_stars,
      'child_message', v_child_msg
    )
  );

  return jsonb_build_object(
    'ok', true,
    'request_id', v_request_id,
    'stars_escrowed', v_stars,
    'duration', p_duration
  );
end;
$$;

revoke all on function public.fn_request_app_unlock(uuid, text, text, text, text) from public;
grant execute on function public.fn_request_app_unlock(uuid, text, text, text, text) to authenticated;

commit;
