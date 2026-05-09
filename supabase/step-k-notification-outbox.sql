-- LEARNGATE Step K: Server-side push notification queue (tasks + chore flow)
-- Run in Supabase SQL Editor after prior steps.
--
-- 1) Deploy Edge Function: supabase/functions/send-push-notifications
-- 2) Set Edge secret CRON_SECRET (any random string) and note EXPO access is outbound-only.
-- 3) Schedule invocations (pick one):
--    - Supabase Dashboard → Edge Functions → your function → Schedules (e.g. every minute), OR
--    - pg_cron + pg_net http_post to .../functions/v1/send-push-notifications with header x-cron-secret
--
-- Note: Android/iOS cannot send a push when the app is uninstalled. "Uninstall detection" is not
--       reliable; use child heartbeat / last_seen in the app for "device went quiet" instead.

begin;

create table if not exists public.notification_outbox (
  id bigint generated always as identity primary key,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists idx_notification_outbox_unprocessed
  on public.notification_outbox (created_at asc)
  where processed_at is null;

alter table public.notification_outbox enable row level security;
-- Intentionally no policies: clients cannot read/write; service role (Edge Function) bypasses RLS.

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
      end if;
    end if;

    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tasks_push_notify on public.tasks;
create trigger trg_tasks_push_notify
after insert or update on public.tasks
for each row execute function public.fn_tasks_push_notify();

-- Optional: parent "insight" when the child finishes a learning game not tied to a formal task row
-- (still logged to activity_logs). Comment out if this feels too chatty.
create or replace function public.fn_activity_logs_parent_insight()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only standalone games (not learning tasks that also complete a task row — parent already gets task_completed).
  if new.type = 'game_completed'
     and coalesce(new.points, 0) > 0
     and (new.metadata->>'task_id') is null then
    insert into public.notification_outbox (event_type, payload)
    values (
      'child_game_milestone',
      jsonb_build_object(
        'child_id', new.child_id,
        'points', new.points,
        'metadata', coalesce(new.metadata, '{}'::jsonb)
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_activity_logs_parent_insight on public.activity_logs;
create trigger trg_activity_logs_parent_insight
after insert on public.activity_logs
for each row execute function public.fn_activity_logs_parent_insight();

commit;
