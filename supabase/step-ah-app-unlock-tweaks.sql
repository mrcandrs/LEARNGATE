-- LEARNGATE Step AH: App unlock tweaks (parent note in alerts, fixed = rest-of-day price, no deny cooldown)
-- Run after step-ag-app-unlock-requests.sql

begin;

-- Fixed stars = rest-of-today price; 30m / week scale from that anchor.
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

-- Remove 24h cooldown after denial; include child note in parent alerts + activity log.
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

  if p_duration not in ('30m', 'rest_of_day', 'week') then
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

-- Parent in-app notifications: include child's note + unlock end time on approve.
create or replace function public.fn_mirror_outbox_to_in_app()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
  cname text;
  parent_id uuid;
  child_user_id uuid;
  task_title text;
  insight_body text;
  pts int;
  notif_title text;
  notif_body text;
  recipient uuid;
  app_lbl text;
  unlock_stars int;
  child_note text;
  unlock_until_ts timestamptz;
  unlock_until_label text;
begin
  cid := (new.payload->>'child_id')::uuid;
  if cid is null then
    return new;
  end if;

  select c.name, c.parent_id, c.child_user_id
    into cname, parent_id, child_user_id
  from public.children c
  where c.id = cid;

  if not found then
    return new;
  end if;

  cname := coalesce(cname, 'Your child');
  task_title := coalesce(nullif(new.payload->>'title', ''), '');
  app_lbl := coalesce(nullif(new.payload->>'app_label', ''), 'an app');
  unlock_stars := coalesce((new.payload->>'stars')::int, 0);
  child_note := nullif(new.payload->>'child_message', '');

  if new.event_type = 'task_assigned' and child_user_id is not null then
    recipient := child_user_id;
    notif_title := 'New task';
    notif_body := coalesce(nullif(task_title, ''), 'A new task') || ' was added for you.';
  elsif new.event_type = 'task_submitted' then
    recipient := parent_id;
    notif_title := 'Submission to review';
    notif_body := cname || ' submitted “' || coalesce(nullif(task_title, ''), 'a chore') || '” for review.';
  elsif new.event_type = 'task_completed' then
    recipient := parent_id;
    notif_title := 'Task completed';
    notif_body := cname || ' completed “' || coalesce(nullif(task_title, ''), 'a task') || '”.';
  elsif new.event_type = 'chore_approved' and child_user_id is not null then
    recipient := child_user_id;
    notif_title := 'Chore approved';
    notif_body := 'Great job! “' || coalesce(nullif(task_title, ''), 'Your chore') || '” was approved.';
  elsif new.event_type = 'child_game_milestone' then
    recipient := parent_id;
    pts := coalesce((new.payload->>'points')::int, 0);
    notif_title := 'Learning update';
    notif_body := cname || ' earned ' || pts || ' stars from a learning game.';
  elsif new.event_type = 'child_app_uninstalled' then
    recipient := parent_id;
    notif_title := 'App may be uninstalled';
    notif_body := 'LEARNGATE on ' || cname || '''s device may have been uninstalled or had its data cleared. Open the child app again to restore monitoring.';
  elsif new.event_type = 'child_device_offline' then
    recipient := parent_id;
    notif_title := 'Device quiet';
    notif_body := cname || '''s device has not checked in recently. They may have closed the app or lost connection.';
  elsif new.event_type = 'parent_insight' then
    recipient := parent_id;
    insight_body := coalesce(
      nullif(new.payload->>'body', ''),
      cname || ' may need a small schedule tweak this week.'
    );
    notif_title := 'Insight for you';
    notif_body := insight_body;
  elsif new.event_type = 'app_unlock_requested' then
    recipient := parent_id;
    notif_title := 'Unlock request';
    notif_body := cname || ' wants to unlock ' || app_lbl || ' (' || unlock_stars || ' stars).';
    if child_note is not null then
      notif_body := notif_body || ' Note: “' || child_note || '”.';
    end if;
  elsif new.event_type = 'app_unlock_approved' and child_user_id is not null then
    recipient := child_user_id;
    unlock_until_ts := nullif(new.payload->>'unlock_until', '')::timestamptz;
    if unlock_until_ts is not null then
      unlock_until_label := to_char(timezone('Asia/Manila', unlock_until_ts), 'Mon DD, HH12:MI AM');
      notif_title := 'Unlock approved';
      notif_body := 'Your parent approved ' || app_lbl || '. You can use it until ' || unlock_until_label || ' (Manila time).';
    else
      notif_title := 'Unlock approved';
      notif_body := 'Your parent approved ' || app_lbl || '. You can open it now!';
    end if;
  elsif new.event_type = 'app_unlock_denied' and child_user_id is not null then
    recipient := child_user_id;
    notif_title := 'Unlock denied';
    notif_body := 'Your parent declined the unlock for ' || app_lbl || '. Your stars were returned.';
  else
    return new;
  end if;

  if recipient is null then
    return new;
  end if;

  insert into public.user_notifications (user_id, kind, title, body, data)
  values (
    recipient,
    new.event_type,
    notif_title,
    notif_body,
    coalesce(new.payload, '{}'::jsonb)
  );

  return new;
end;
$$;

commit;
