-- LEARNGATE Step AG: Star-based app unlock requests (child asks, parent approves, temp allow)
-- Run in Supabase SQL Editor after step-af-screen-limit-set-at.sql
--
-- Flow:
--   Child spends stars (escrow) → parent notified → approve creates temp unlock / deny refunds stars
--   Weekly star reset expires pending requests, refunds escrow, clears temp unlocks
--
-- Manual tests:
--   select public.fn_get_unlock_quote('<child_id>', 'com.google.android.youtube', '30m');
--   select public.fn_request_app_unlock('<child_id>', 'com.google.android.youtube', 'YouTube', '30m', null);
--   select public.fn_resolve_app_unlock('<request_id>', 'approve');
--   select public.fn_get_child_temp_unlocks('<child_id>');

begin;

-- Parent controls: per-app pricing overrides + master toggle
alter table public.screen_rules
  add column if not exists app_unlock_enabled boolean not null default true;

alter table public.screen_rules
  add column if not exists unlock_pricing_json jsonb not null default '{}'::jsonb;

comment on column public.screen_rules.unlock_pricing_json is
  'Keys: block group slug or package name. Values: {"mode":"suggested"|"fixed"|"disabled","fixed_stars":15}';

-- Unlock requests (stars held in escrow until approve/deny/expire)
create table if not exists public.child_app_unlock_requests (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  package_name text not null,
  app_label text,
  duration text not null check (duration in ('30m', 'rest_of_day', 'week')),
  stars_escrowed int not null check (stars_escrowed > 0),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'denied', 'expired', 'cancelled')),
  child_message text,
  unlock_until timestamptz,
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_unlock_requests_child_status
  on public.child_app_unlock_requests (child_id, status, created_at desc);

create index if not exists idx_unlock_requests_pending
  on public.child_app_unlock_requests (child_id, package_name)
  where status = 'pending';

-- Active temporary allows (device syncs these; packages still "blocked" in screen_rules)
create table if not exists public.child_app_temp_unlocks (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  package_name text not null,
  unlock_until timestamptz not null,
  request_id uuid references public.child_app_unlock_requests (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (child_id, package_name)
);

create index if not exists idx_temp_unlocks_child_until
  on public.child_app_temp_unlocks (child_id, unlock_until);

drop trigger if exists trg_unlock_requests_updated_at on public.child_app_unlock_requests;
create trigger trg_unlock_requests_updated_at
  before update on public.child_app_unlock_requests
  for each row execute function public.set_updated_at();

alter table public.child_app_unlock_requests enable row level security;
alter table public.child_app_temp_unlocks enable row level security;

drop policy if exists "unlock_requests_parent_select" on public.child_app_unlock_requests;
create policy "unlock_requests_parent_select"
  on public.child_app_unlock_requests for select
  using (
    exists (
      select 1 from public.children c
      where c.id = child_app_unlock_requests.child_id
        and c.parent_id = auth.uid()
    )
  );

drop policy if exists "unlock_requests_child_select" on public.child_app_unlock_requests;
create policy "unlock_requests_child_select"
  on public.child_app_unlock_requests for select
  using (
    exists (
      select 1 from public.children c
      where c.id = child_app_unlock_requests.child_id
        and c.child_user_id = auth.uid()
    )
  );

drop policy if exists "temp_unlocks_parent_select" on public.child_app_temp_unlocks;
create policy "temp_unlocks_parent_select"
  on public.child_app_temp_unlocks for select
  using (
    exists (
      select 1 from public.children c
      where c.id = child_app_temp_unlocks.child_id
        and c.parent_id = auth.uid()
    )
  );

drop policy if exists "temp_unlocks_child_select" on public.child_app_temp_unlocks;
create policy "temp_unlocks_child_select"
  on public.child_app_temp_unlocks for select
  using (
    exists (
      select 1 from public.children c
      where c.id = child_app_temp_unlocks.child_id
        and c.child_user_id = auth.uid()
    )
  );

-- ─── Helpers ───────────────────────────────────────────────────────────────

create or replace function public.fn_child_access_role(p_child_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  select case
    when c.parent_id = auth.uid() then 'parent'
    when c.child_user_id = auth.uid() then 'child'
    else null
  end
  into v_role
  from public.children c
  where c.id = p_child_id;

  return v_role;
end;
$$;

revoke all on function public.fn_child_access_role(uuid) from public;
grant execute on function public.fn_child_access_role(uuid) to authenticated;

create or replace function public.fn_manila_now()
returns timestamptz
language sql
stable
set search_path = public
as $$
  select timezone('Asia/Manila', now());
$$;

create or replace function public.fn_manila_week_start(d timestamptz default null)
returns timestamptz
language sql
stable
set search_path = public
as $$
  select date_trunc('week', timezone('Asia/Manila', coalesce(d, now())))::timestamp at time zone 'Asia/Manila';
$$;

create or replace function public.fn_unlock_duration_multiplier(p_duration text)
returns numeric
language sql
immutable
as $$
  select case p_duration
    when '30m' then 0.45
    when 'rest_of_day' then 0.75
    when 'week' then 1.0
    else 1.0
  end;
$$;

create or replace function public.fn_unlock_until_for_duration(p_duration text)
returns timestamptz
language plpgsql
stable
set search_path = public
as $$
declare
  v_manila timestamptz := public.fn_manila_now();
  v_local date := (v_manila at time zone 'Asia/Manila')::date;
begin
  return case p_duration
    when '30m' then v_manila + interval '30 minutes'
    when 'rest_of_day' then ((v_local + 1)::timestamp at time zone 'Asia/Manila')
    when 'week' then public.fn_manila_week_start(v_manila) + interval '7 days'
    else v_manila + interval '30 minutes'
  end;
end;
$$;

-- Known package → pricing key (slug) + category bonus
create or replace function public.fn_unlock_pricing_key(p_package text)
returns text
language sql
immutable
as $$
  select case
    when p_package in ('com.facebook.katana', 'com.facebook.lite') then 'facebook'
    when p_package in ('com.zhiliaoapp.musically', 'com.ss.android.ugc.trill', 'com.zhiliaoapp.musically.go') then 'tiktok'
    when p_package in ('com.instagram.android', 'com.instagram.lite') then 'instagram'
    when p_package = 'com.google.android.youtube' then 'youtube'
    when p_package = 'com.snapchat.android' then 'snapchat'
    when p_package in ('com.whatsapp', 'com.whatsapp.w4b') then 'whatsapp'
    when p_package in ('com.facebook.orca', 'com.facebook.mlite') then 'messenger'
    when p_package = 'com.twitter.android' then 'twitter'
    when p_package = 'com.discord' then 'discord'
    when p_package = 'com.roblox.client' then 'roblox'
    when p_package = 'com.mojang.minecraftpe' then 'minecraft'
    when p_package = 'com.spotify.music' then 'spotify'
    when p_package = 'com.netflix.mediaclient' then 'netflix'
    when p_package = 'com.android.chrome' then 'chrome'
    else p_package
  end;
$$;

create or replace function public.fn_unlock_category_bonus(p_pricing_key text)
returns int
language sql
immutable
as $$
  select case p_pricing_key
    when 'tiktok' then 8
    when 'youtube' then 6
    when 'instagram' then 6
    when 'snapchat' then 5
    when 'facebook' then 5
    when 'messenger' then 4
    when 'twitter' then 4
    when 'discord' then 4
    when 'roblox' then 7
    when 'minecraft' then 5
    when 'netflix' then 5
    when 'spotify' then 3
    when 'chrome' then 8
    when 'whatsapp' then 2
    else 3
  end;
$$;

create or replace function public.fn_packages_for_unlock_key(p_key text)
returns text[]
language sql
immutable
as $$
  select case p_key
    when 'facebook' then array['com.facebook.katana', 'com.facebook.lite']
    when 'tiktok' then array['com.zhiliaoapp.musically', 'com.ss.android.ugc.trill', 'com.zhiliaoapp.musically.go']
    when 'instagram' then array['com.instagram.android', 'com.instagram.lite']
    when 'youtube' then array['com.google.android.youtube']
    when 'snapchat' then array['com.snapchat.android']
    when 'whatsapp' then array['com.whatsapp', 'com.whatsapp.w4b']
    when 'messenger' then array['com.facebook.orca', 'com.facebook.mlite']
    when 'twitter' then array['com.twitter.android']
    when 'discord' then array['com.discord']
    when 'roblox' then array['com.roblox.client']
    when 'minecraft' then array['com.mojang.minecraftpe']
    when 'spotify' then array['com.spotify.music']
    when 'netflix' then array['com.netflix.mediaclient']
    when 'chrome' then array['com.android.chrome']
    else array[p_key]
  end;
$$;

create or replace function public.fn_suggest_unlock_base_stars(p_child_id uuid, p_package_name text)
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_key text := public.fn_unlock_pricing_key(p_package_name);
  v_packages text[] := public.fn_packages_for_unlock_key(v_key);
  v_usage_seconds int := 0;
  v_usage_minutes int;
  v_bonus int := public.fn_unlock_category_bonus(v_key);
  v_base int;
  v_min int := 5;
  v_max int := 50;
begin
  select coalesce(sum(cue.duration_seconds), 0)::int
  into v_usage_seconds
  from public.child_app_usage_events cue
  where cue.child_id = p_child_id
    and cue.package_name = any (v_packages)
    and cue.event_type = 'foreground'
    and cue.event_at >= (public.fn_manila_now() - interval '7 days');

  v_usage_minutes := floor(v_usage_seconds / 60.0)::int;
  v_base := 5 + floor(v_usage_minutes / 10.0)::int + v_bonus;

  return greatest(v_min, least(v_max, v_base));
end;
$$;

revoke all on function public.fn_suggest_unlock_base_stars(uuid, text) from public;
grant execute on function public.fn_suggest_unlock_base_stars(uuid, text) to authenticated;

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
    v_base := v_fixed;
  else
    v_base := public.fn_suggest_unlock_base_stars(p_child_id, p_package_name);
  end if;

  v_stars := greatest(
    3,
    ceil(v_base * public.fn_unlock_duration_multiplier(p_duration))::int
  );

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

create or replace function public.fn_get_unlock_quote(
  p_child_id uuid,
  p_package_name text,
  p_duration text default '30m'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_child record;
  v_quote jsonb;
begin
  v_role := public.fn_child_access_role(p_child_id);
  if v_role is null then
    return jsonb_build_object('ok', false, 'reason', 'Not allowed.');
  end if;

  select id, stars, name into v_child from public.children where id = p_child_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'Child not found.');
  end if;

  v_quote := public.fn_resolve_unlock_star_cost(p_child_id, p_package_name, p_duration);

  return v_quote || jsonb_build_object(
    'child_stars', coalesce(v_child.stars, 0),
    'can_afford', coalesce(v_child.stars, 0) >= coalesce((v_quote ->> 'stars')::int, 999999)
  );
end;
$$;

revoke all on function public.fn_get_unlock_quote(uuid, text, text) from public;
grant execute on function public.fn_get_unlock_quote(uuid, text, text) to authenticated;

-- ─── Request / resolve ─────────────────────────────────────────────────────

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
  v_denied_at timestamptz;
  v_week_requests int;
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

  select r.resolved_at into v_denied_at
  from public.child_app_unlock_requests r
  where r.child_id = p_child_id
    and r.package_name = p_package_name
    and r.status = 'denied'
  order by r.resolved_at desc nulls last
  limit 1;

  if v_denied_at is not null and v_denied_at > now() - interval '24 hours' then
    return jsonb_build_object('ok', false, 'reason', 'Please wait before asking again for this app.');
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
    nullif(trim(p_message), '')
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
      'stars_escrowed', v_stars
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
      'stars', v_stars
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

  v_until := public.fn_unlock_until_for_duration(v_req.duration);
  v_packages := public.fn_packages_for_unlock_key(public.fn_unlock_pricing_key(v_req.package_name));

  foreach v_pkg in array v_packages loop
    insert into public.child_app_temp_unlocks (child_id, package_name, unlock_until, request_id)
    values (v_req.child_id, v_pkg, v_until, p_request_id)
    on conflict (child_id, package_name) do update
      set unlock_until = excluded.unlock_until,
          request_id = excluded.request_id,
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
      'app_label', coalesce(v_req.app_label, v_req.package_name),
      'duration', v_req.duration,
      'unlock_until', v_until
    )
  );

  return jsonb_build_object(
    'ok', true,
    'status', 'approved',
    'unlock_until', v_until,
    'packages', to_jsonb(v_packages)
  );
end;
$$;

revoke all on function public.fn_resolve_app_unlock(uuid, text) from public;
grant execute on function public.fn_resolve_app_unlock(uuid, text) to authenticated;

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

  -- Drop expired rows opportunistically
  delete from public.child_app_temp_unlocks
  where child_id = p_child_id
    and unlock_until <= now();

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'package_name', t.package_name,
          'unlock_until', t.unlock_until
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

revoke all on function public.fn_get_child_temp_unlocks(uuid) from public;
grant execute on function public.fn_get_child_temp_unlocks(uuid) to authenticated;

-- Expire pending + refund; clear temp unlocks (called from weekly reset)
create or replace function public.fn_cleanup_app_unlocks_for_child(p_child_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req record;
begin
  for v_req in
    select id, stars_escrowed
    from public.child_app_unlock_requests
    where child_id = p_child_id
      and status = 'pending'
    for update
  loop
    update public.children
    set stars = stars + v_req.stars_escrowed
    where id = p_child_id;

    update public.child_app_unlock_requests
    set status = 'expired', resolved_at = now()
    where id = v_req.id;
  end loop;

  delete from public.child_app_temp_unlocks where child_id = p_child_id;
end;
$$;

revoke all on function public.fn_cleanup_app_unlocks_for_child(uuid) from public;
grant execute on function public.fn_cleanup_app_unlocks_for_child(uuid) to service_role;

-- Patch weekly reset to clean unlock state before zeroing stars
create or replace function public.fn_weekly_star_reset(p_week_start date default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week_start date;
  v_week_end date;
  v_week_start_ts timestamptz;
  v_week_end_ts timestamptz;
  v_child record;
  v_points int;
  v_tasks int;
  v_learning int;
  v_exercise int;
  v_chore int;
  v_app_seconds int;
  v_stars int;
  v_processed int := 0;
  v_inserted int;
begin
  v_week_start := coalesce(
    p_week_start,
    (date_trunc('week', timezone('Asia/Manila', now()))::date - 7)
  );
  v_week_end := v_week_start + 6;
  v_week_start_ts := (v_week_start::timestamp at time zone 'Asia/Manila');
  v_week_end_ts := ((v_week_end + 1)::timestamp at time zone 'Asia/Manila');

  for v_child in
    select id, parent_id, stars
    from public.children
  loop
    perform public.fn_cleanup_app_unlocks_for_child(v_child.id);

    select coalesce(sum(al.points), 0)::int into v_points
    from public.activity_logs al
    where al.child_id = v_child.id
      and al.created_at >= v_week_start_ts
      and al.created_at < v_week_end_ts
      and al.type <> 'weekly_star_reset';

    select count(*)::int into v_tasks
    from public.tasks t
    where t.child_id = v_child.id
      and t.status = 'completed'
      and t.completed_at >= v_week_start_ts
      and t.completed_at < v_week_end_ts;

    select count(*)::int into v_learning
    from public.tasks t
    where t.child_id = v_child.id
      and t.status = 'completed'
      and t.category = 'learning'
      and t.completed_at >= v_week_start_ts
      and t.completed_at < v_week_end_ts;

    select count(*)::int into v_exercise
    from public.tasks t
    where t.child_id = v_child.id
      and t.status = 'completed'
      and t.category = 'exercise'
      and t.completed_at >= v_week_start_ts
      and t.completed_at < v_week_end_ts;

    select count(*)::int into v_chore
    from public.tasks t
    where t.child_id = v_child.id
      and t.status = 'completed'
      and t.category = 'chore'
      and t.completed_at >= v_week_start_ts
      and t.completed_at < v_week_end_ts;

    select coalesce(sum(cue.duration_seconds), 0)::int into v_app_seconds
    from public.child_app_usage_events cue
    where cue.child_id = v_child.id
      and cue.event_type = 'foreground'
      and cue.event_at >= v_week_start_ts
      and cue.event_at < v_week_end_ts;

    v_stars := coalesce(v_child.stars, 0);

    insert into public.child_weekly_star_snapshots (
      child_id,
      parent_id,
      week_start,
      week_end,
      stars_at_reset,
      points_earned,
      tasks_completed,
      completions_by_category,
      app_time_seconds
    )
    values (
      v_child.id,
      v_child.parent_id,
      v_week_start,
      v_week_end,
      v_stars,
      v_points,
      v_tasks,
      jsonb_build_object('learning', v_learning, 'exercise', v_exercise, 'chore', v_chore),
      v_app_seconds
    )
    on conflict (child_id, week_start) do nothing;

    get diagnostics v_inserted = row_count;

    if v_inserted > 0 then
      update public.children
      set stars = 0
      where id = v_child.id
        and stars > 0;

      insert into public.activity_logs (child_id, actor_profile_id, type, points, metadata)
      values (
        v_child.id,
        null,
        'weekly_star_reset',
        0,
        jsonb_build_object(
          'week_start', v_week_start,
          'week_end', v_week_end,
          'stars_at_reset', v_stars,
          'points_earned', v_points
        )
      );

      v_processed := v_processed + 1;
    end if;
  end loop;

  return v_processed;
end;
$$;

-- In-app notification mirror for unlock events
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
  elsif new.event_type = 'app_unlock_approved' and child_user_id is not null then
    recipient := child_user_id;
    notif_title := 'Unlock approved';
    notif_body := 'Your parent approved ' || app_lbl || '. You can open it now!';
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
