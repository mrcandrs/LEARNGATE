-- LEARNGATE Step O (cron): Run push drain + stale check every minute
-- Run AFTER step-o-faster-offline-alerts.sql and step-l-notification-auto-dispatch.sql
-- Replace YOUR_PROJECT_REF and YOUR_CRON_SECRET before running.

begin;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
declare
  r record;
begin
  for r in
    select jobid from cron.job
    where jobname in ('learngate-child-offline-check', 'learngate-push-presence-drain')
  loop
    perform cron.unschedule(r.jobid);
  end loop;
end $$;

-- Stale check-in fallback (force-stop with no background event): ~3 min after last heartbeat
select cron.schedule(
  'learngate-child-offline-check',
  '* * * * *',
  $$ select public.fn_enqueue_child_offline_alerts(3); $$
);

-- Drain outbox + run stale enqueue inside edge function (requires step-l trigger OR this POST)
select cron.schedule(
  'learngate-push-presence-drain',
  '* * * * *',
  $$
  select net.http_post(
    url := format('https://%s.supabase.co/functions/v1/send-push-notifications', 'YOUR_PROJECT_REF'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'YOUR_CRON_SECRET'
    ),
    body := '{}'::jsonb
  );
  $$
);

commit;

-- Without pg_cron: Edge Functions → send-push-notifications → Schedule → * * * * *
