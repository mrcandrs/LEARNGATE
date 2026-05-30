-- LEARNGATE Step V: In-app notification inbox (bell) + optional push drain fallback
-- Run AFTER step-k-notification-outbox.sql
-- Replace YOUR_PROJECT_REF and YOUR_CRON_SECRET (same as step-l / step-r).

begin;

create table if not exists public.user_notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_notifications_user_created_idx
  on public.user_notifications (user_id, created_at desc);

alter table public.user_notifications enable row level security;

drop policy if exists "Users read own notifications" on public.user_notifications;
create policy "Users read own notifications"
  on public.user_notifications for select
  using (auth.uid() = user_id);

drop policy if exists "Users mark own notifications read" on public.user_notifications;
create policy "Users mark own notifications read"
  on public.user_notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

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

drop trigger if exists trg_mirror_outbox_to_in_app on public.notification_outbox;
create trigger trg_mirror_outbox_to_in_app
after insert on public.notification_outbox
for each row
execute function public.fn_mirror_outbox_to_in_app();

-- Fallback when step-l auto-dispatch is not configured: app can nudge the edge function.
create extension if not exists pg_net with schema extensions;

create or replace function public.request_notification_dispatch()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  project_ref text := 'YOUR_PROJECT_REF';
  cron_secret text := 'YOUR_CRON_SECRET';
  request_id bigint;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select net.http_post(
    url := format('https://%s.supabase.co/functions/v1/send-push-notifications', project_ref),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', cron_secret
    ),
    body := '{}'::jsonb
  ) into request_id;
end;
$$;

revoke all on function public.request_notification_dispatch() from public;
grant execute on function public.request_notification_dispatch() to authenticated;

commit;

-- After running: new outbox rows also appear in user_notifications for the target account.
-- Parent/child apps call request_notification_dispatch() on foreground to drain pending pushes.
