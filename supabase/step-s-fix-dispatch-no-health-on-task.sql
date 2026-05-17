-- LEARNGATE Step S: Stop running child token health check on every task notification
-- Run if you already applied step-l with body '{"check_child_tokens":true}'.
-- Replace YOUR_PROJECT_REF and YOUR_CRON_SECRET (same as step-l).

begin;

create or replace function public.fn_dispatch_push_notifications()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  project_ref text := 'YOUR_PROJECT_REF';
  cron_secret text := 'YOUR_CRON_SECRET';
  request_id bigint;
begin
  select net.http_post(
    url := format('https://%s.supabase.co/functions/v1/send-push-notifications', project_ref),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', cron_secret
    ),
    body := '{}'::jsonb
  ) into request_id;

  return new;
end;
$$;

commit;

-- After this + redeploying send-push-notifications, assigning a task should NOT ping the child
-- with "Checking device connection". Uninstall checks still run via step-q cron and step-r RPC.
