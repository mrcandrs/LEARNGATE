-- LEARNGATE Step AC: Switch weekly star reset from UTC to Asia/Manila
-- Run ONLY if you already applied step-ab-weekly-star-reset.sql with UTC timing.

begin;

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
          'points_earned', v_points,
          'timezone', 'Asia/Manila'
        )
      );

      v_processed := v_processed + 1;
    end if;
  end loop;

  return v_processed;
end;
$$;

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
