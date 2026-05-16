-- LEARNGATE Step L: Auto-run send-push-notifications when a row hits notification_outbox
-- Run once in Supabase SQL Editor AFTER:
--   - step-k-notification-outbox.sql
--   - Edge function send-push-notifications deployed
--   - Edge secret CRON_SECRET set (same value you use in Test / Invoke)
--
-- BEFORE RUNNING: replace the two placeholders below.

begin;

create extension if not exists pg_net with schema extensions;

create or replace function public.fn_dispatch_push_notifications()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  project_ref text := 'YOUR_PROJECT_REF';  -- e.g. jfofydeteirofxptvinf (from Supabase URL)
  cron_secret text := 'YOUR_CRON_SECRET';  -- same as Edge Functions secret CRON_SECRET
  request_id bigint;
begin
  select net.http_post(
    url := format('https://%s.supabase.co/functions/v1/send-push-notifications', project_ref),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', cron_secret
    ),
    body := '{"check_child_tokens":true}'::jsonb
  ) into request_id;

  return new;
end;
$$;

drop trigger if exists trg_notification_outbox_dispatch on public.notification_outbox;
create trigger trg_notification_outbox_dispatch
after insert on public.notification_outbox
for each row
execute function public.fn_dispatch_push_notifications();

commit;

-- After this runs: create a task from parent → processed_at should fill within a few seconds
-- without clicking Test on the edge function.
--
-- To drain old rows that still have processed_at NULL, run Test once on the edge function,
-- or insert a dummy row / re-save a task to fire the trigger.
