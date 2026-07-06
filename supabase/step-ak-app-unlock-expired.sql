-- LEARNGATE Step AK: Notify child when a star unlock expires + periodic purge
-- Run after step-aj-app-unlock-backfill.sql

begin;

-- Remove expired rows and enqueue child notifications (call from cron every minute).
create or replace function public.fn_purge_expired_app_unlocks()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_count int := 0;
  v_child_name text;
begin
  for v_row in
    select
      t.child_id,
      t.package_name,
      t.duration,
      coalesce(r.app_label, t.package_name) as app_label
    from public.child_app_temp_unlocks t
    left join public.child_app_unlock_requests r on r.id = t.request_id
    where t.unlock_until <= now()
  loop
    select name into v_child_name from public.children where id = v_row.child_id;

    insert into public.notification_outbox (event_type, payload)
    values (
      'app_unlock_expired',
      jsonb_build_object(
        'child_id', v_row.child_id,
        'child_name', v_child_name,
        'package_name', v_row.package_name,
        'app_label', v_row.app_label,
        'duration', v_row.duration
      )
    );

    delete from public.child_app_temp_unlocks
    where child_id = v_row.child_id
      and package_name = v_row.package_name;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.fn_purge_expired_app_unlocks() from public;
grant execute on function public.fn_purge_expired_app_unlocks() to service_role;

-- Patch in-app mirror (extends step-ag / step-ah mirror with expiry event).
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
  unlock_stars int;
  app_lbl text;
  notif_title text;
  notif_body text;
  recipient uuid;
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
  app_lbl := coalesce(nullif(new.payload->>'app_label', ''), 'the app');
  unlock_stars := coalesce((new.payload->>'stars')::int, (new.payload->>'stars_escrowed')::int, 0);

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
  elsif new.event_type = 'app_unlock_expired' and child_user_id is not null then
    recipient := child_user_id;
    notif_title := 'Unlock ended';
    notif_body := 'Your time on ' || app_lbl || ' is over. The app is blocked again.';
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

-- Optional: run purge every minute (replace YOUR_PROJECT_REF / YOUR_CRON_SECRET like step-q).
create extension if not exists pg_cron with schema pg_catalog;

do $$
declare
  r record;
begin
  for r in
    select jobid from cron.job where jobname = 'learngate-purge-expired-unlocks'
  loop
    perform cron.unschedule(r.jobid);
  end loop;
end $$;

select cron.schedule(
  'learngate-purge-expired-unlocks',
  '* * * * *',
  $$select public.fn_purge_expired_app_unlocks();$$
);

-- Stop silent deletes on profile fetch; let purge + notifications own expiry.
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
