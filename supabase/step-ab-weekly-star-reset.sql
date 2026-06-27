-- LEARNGATE Step AB: Weekly star reset + historical snapshots for insights
-- Run in Supabase SQL Editor after step-c-init.sql (and step-w for app usage).
--
-- What this does:
--   • children.stars          → current week balance (resets to 0 every Monday 00:00 Asia/Manila)
--   • children.stars_lifetime → never reset; used for achievements
--   • child_weekly_star_snapshots → closed-week metrics for parent insights / history
--
-- Cron (included below): Monday 00:00 Asia/Manila (= Sunday 16:00 UTC) — snapshot last week, then zero stars.
-- Manual test: select public.fn_weekly_star_reset();
--
-- Confirm reset:
--   select id, name, stars, stars_lifetime from public.children;
--   select * from public.child_weekly_star_snapshots order by week_start desc limit 5;
--   select type, metadata, created_at from public.activity_logs where type = 'weekly_star_reset' order by created_at desc limit 5;

begin;

-- Lifetime total (achievements, all-time progress)
alter table public.children
  add column if not exists stars_lifetime int not null default 0;

update public.children c
set stars_lifetime = greatest(
  c.stars,
  coalesce((
    select sum(al.points)::int
    from public.activity_logs al
    where al.child_id = c.id
      and al.type <> 'weekly_star_reset'
  ), 0)
)
where stars_lifetime = 0;

-- Closed-week snapshots (one row per child per calendar week, Monday-based UTC)
create table if not exists public.child_weekly_star_snapshots (
  child_id uuid not null references public.children (id) on delete cascade,
  parent_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  week_end date not null,
  stars_at_reset int not null default 0,
  points_earned int not null default 0,
  tasks_completed int not null default 0,
  completions_by_category jsonb not null default '{"learning":0,"exercise":0,"chore":0}'::jsonb,
  app_time_seconds int not null default 0,
  snapshot_at timestamptz not null default now(),
  primary key (child_id, week_start)
);

create index if not exists child_weekly_star_snapshots_parent_idx
  on public.child_weekly_star_snapshots (parent_id, week_start desc);

alter table public.child_weekly_star_snapshots enable row level security;

drop policy if exists "Parents read own child weekly snapshots" on public.child_weekly_star_snapshots;
create policy "Parents read own child weekly snapshots"
  on public.child_weekly_star_snapshots for select
  to authenticated
  using (parent_id = auth.uid());

-- Award points to weekly balance AND lifetime total
create or replace function public.award_child_points(
  p_child_id uuid,
  p_points int,
  p_event_type text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  is_allowed boolean;
  safe_points int := greatest(0, coalesce(p_points, 0));
begin
  select exists (
    select 1
    from public.children c
    where c.id = p_child_id
      and (c.child_user_id = auth.uid() or c.parent_id = auth.uid())
  )
  into is_allowed;

  if not is_allowed then
    raise exception 'Not allowed to award points for this child.';
  end if;

  update public.children
  set
    stars = stars + safe_points,
    stars_lifetime = stars_lifetime + safe_points
  where id = p_child_id;

  insert into public.activity_logs (child_id, actor_profile_id, type, points, metadata)
  values (p_child_id, auth.uid(), p_event_type, safe_points, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

revoke all on function public.award_child_points(uuid, int, text, jsonb) from public;
grant execute on function public.award_child_points(uuid, int, text, jsonb) to authenticated;

-- Snapshot the week that just ended and reset weekly stars to 0.
-- p_week_start: Monday of the week to close (defaults to previous ISO week).
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

revoke all on function public.fn_weekly_star_reset(date) from public;
grant execute on function public.fn_weekly_star_reset(date) to service_role;

-- pg_cron: every Monday 00:00 Asia/Manila (Sunday 16:00 UTC)
create extension if not exists pg_cron with schema pg_catalog;

do $$
declare
  r record;
begin
  for r in
    select jobid from cron.job where jobname = 'learngate-weekly-star-reset'
  loop
    perform cron.unschedule(r.jobid);
  end loop;
end $$;

select cron.schedule(
  'learngate-weekly-star-reset',
  '0 16 * * 0',
  $$ select public.fn_weekly_star_reset(); $$
);

commit;

-- Without pg_cron: run manually each Monday after midnight Manila time:
--   select public.fn_weekly_star_reset();
-- Or schedule via Supabase Dashboard → Database → Cron / Edge Functions.
