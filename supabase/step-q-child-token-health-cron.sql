-- LEARNGATE Step Q: Periodic child push-token health check (detect uninstall without waiting for a task)
-- Run AFTER step-p-uninstall-only-parent-alerts.sql and step-l-notification-auto-dispatch.sql
--
-- Replace YOUR_PROJECT_REF and YOUR_CRON_SECRET before running.
-- Schedule: every 4 hours (change cron expression if you want daily only: 0 9 * * *)

begin;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
declare
  r record;
begin
  for r in
    select jobid from cron.job where jobname = 'learngate-child-token-health'
  loop
    perform cron.unschedule(r.jobid);
  end loop;
end $$;

select cron.schedule(
  'learngate-child-token-health',
  '0 */4 * * *',
  $$
  select net.http_post(
    url := format('https://%s.supabase.co/functions/v1/send-push-notifications', 'YOUR_PROJECT_REF'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'YOUR_CRON_SECRET'
    ),
    body := '{"check_child_tokens":true}'::jsonb
  );
  $$
);

commit;

-- Manual test (Edge Functions → Test):
--   Body: { "check_child_tokens": true }
--   Header: x-cron-secret = your CRON_SECRET
--
-- Without pg_cron: Dashboard → Edge Functions → send-push-notifications → Schedules
--   Cron: 0 */4 * * *
--   Body: {"check_child_tokens":true}
