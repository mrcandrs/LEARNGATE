-- LEARNGATE Step AN: Remove the 2-per-week unlock request cap.
-- Run after step-am-app-unlock-start-on-open.sql
--
-- Rationale: the parent already approves or denies every request, so a hard weekly cap is
-- unnecessary friction. We keep the "only one pending request per app at a time" guard so a child
-- can't spam duplicate pending requests, and the star cost still naturally limits abuse.

begin;

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
