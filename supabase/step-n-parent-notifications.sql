-- LEARNGATE Step N: Parent push events (task done, device quiet, learning insights)
-- Run in Supabase SQL Editor after step-k-notification-outbox.sql
--
-- Parent notifications already from step K:
--   task_submitted, task_completed, child_game_milestone
--
-- This step adds:
--   child_device_offline  — child app stopped checking in (proxy for uninstall / force-stop)
--   parent_insight        — weekly-style coaching nudge (debounced per child)

begin;

create table if not exists public.parent_notification_state (
  child_id uuid primary key references public.children(id) on delete cascade,
  last_insight_at timestamptz,
  last_offline_alert_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.parent_notification_state enable row level security;
-- No client policies; only security definer functions touch this table.

-- Call from pg_cron every 5–15 min, or invoke check-child-presence edge function on a schedule.
create or replace function public.fn_enqueue_child_offline_alerts(p_stale_minutes int default 15)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  n int := 0;
begin
  for rec in
    select c.id as child_id, c.name, c.parent_id, c.last_seen_at
    from public.children c
    where c.last_seen_at is not null
      and c.last_seen_at < now() - make_interval(mins => greatest(p_stale_minutes, 5))
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
        'last_seen_at', rec.last_seen_at
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

-- After a task is completed, optionally nudge parent with an insight (max once per 24h per child).
create or replace function public.fn_maybe_enqueue_parent_insight(p_child_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  completed_7d int;
  learning_7d int;
  exercise_7d int;
  chore_7d int;
  active_count int;
  insight_body text;
  last_insight timestamptz;
begin
  select id, name, parent_id into c from public.children where id = p_child_id;
  if not found then
    return;
  end if;

  select last_insight_at into last_insight
  from public.parent_notification_state
  where child_id = p_child_id;

  if last_insight is not null and last_insight > now() - interval '24 hours' then
    return;
  end if;

  select count(*)::int into completed_7d
  from public.tasks t
  where t.child_id = p_child_id
    and t.status = 'completed'
    and t.completed_at is not null
    and t.completed_at > now() - interval '7 days';

  select count(*)::int into learning_7d
  from public.tasks t
  where t.child_id = p_child_id
    and t.status = 'completed'
    and t.category = 'learning'
    and t.completed_at > now() - interval '7 days';

  select count(*)::int into exercise_7d
  from public.tasks t
  where t.child_id = p_child_id
    and t.status = 'completed'
    and t.category = 'exercise'
    and t.completed_at > now() - interval '7 days';

  select count(*)::int into chore_7d
  from public.tasks t
  where t.child_id = p_child_id
    and t.status = 'completed'
    and t.category = 'chore'
    and t.completed_at > now() - interval '7 days';

  select count(*)::int into active_count
  from public.tasks t
  where t.child_id = p_child_id
    and t.status in ('pending', 'in_progress', 'submitted');

  if completed_7d = 0 then
    insight_body := format('%s has no completed tasks this week. Consider one easy win tomorrow.', c.name);
  elsif exercise_7d = 0 and completed_7d > 0 then
    insight_body := format('%s is skipping exercise tasks this week. A short daily movement task may help.', c.name);
  elsif learning_7d = 0 and completed_7d > 0 then
    insight_body := format('%s has low learning activity this week. Try a short math or reading game.', c.name);
  elsif active_count >= 6 then
    insight_body := format('%s has many active tasks (%s). Fewer, smaller tasks may improve completion.', c.name, active_count);
  else
    return;
  end if;

  insert into public.notification_outbox (event_type, payload)
  values (
    'parent_insight',
    jsonb_build_object(
      'child_id', p_child_id,
      'child_name', c.name,
      'body', insight_body
    )
  );

  insert into public.parent_notification_state (child_id, last_insight_at, updated_at)
  values (p_child_id, now(), now())
  on conflict (child_id) do update
    set last_insight_at = now(), updated_at = now();
end;
$$;

-- Extend task trigger: parent insight after completion (task_completed row already inserted in step K).
create or replace function public.fn_tasks_push_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  reminders boolean;
begin
  if tg_op = 'INSERT' then
    select coalesce(sr.task_reminders_enabled, true)
      into reminders
    from public.screen_rules sr
    where sr.child_id = new.child_id;

    if reminders is null then
      reminders := true;
    end if;

    if reminders then
      insert into public.notification_outbox (event_type, payload)
      values (
        'task_assigned',
        jsonb_build_object(
          'child_id', new.child_id,
          'task_id', new.id,
          'title', new.title,
          'category', new.category
        )
      );
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.status = 'submitted' and old.status is distinct from new.status then
      insert into public.notification_outbox (event_type, payload)
      values (
        'task_submitted',
        jsonb_build_object(
          'child_id', new.child_id,
          'task_id', new.id,
          'title', new.title
        )
      );
    end if;

    if new.status = 'completed' and old.status is distinct from new.status then
      if old.status = 'submitted' then
        insert into public.notification_outbox (event_type, payload)
        values (
          'chore_approved',
          jsonb_build_object(
            'child_id', new.child_id,
            'task_id', new.id,
            'title', new.title
          )
        );
      elsif old.status in ('pending', 'in_progress') then
        insert into public.notification_outbox (event_type, payload)
        values (
          'task_completed',
          jsonb_build_object(
            'child_id', new.child_id,
            'task_id', new.id,
            'title', new.title,
            'category', new.category
          )
        );
        perform public.fn_maybe_enqueue_parent_insight(new.child_id);
      end if;
    end if;

    return new;
  end if;

  return new;
end;
$$;

-- Reset offline alert when child opens the app again (so the next gap can notify).
create or replace function public.set_child_online_status(p_is_online boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
begin
  update public.children
  set is_online = coalesce(p_is_online, false),
      last_seen_at = now()
  where child_user_id = auth.uid()
  returning id into cid;

  if p_is_online and cid is not null then
    update public.parent_notification_state
    set last_offline_alert_at = null, updated_at = now()
    where child_id = cid;
  end if;
end;
$$;

revoke all on function public.set_child_online_status(boolean) from public;
grant execute on function public.set_child_online_status(boolean) to authenticated;

commit;

-- Manual test offline alerts: select public.fn_enqueue_child_offline_alerts(15);
-- Then run send-push-notifications (or wait for auto-dispatch).
-- Production schedule: run step-n-offline-presence-cron.sql (pg_cron every 5 min).
