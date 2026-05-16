-- LEARNGATE Step N (cron): superseded by step-o-offline-presence-cron.sql (every 1 min, 3 min stale)
-- LEARNGATE Step N (cron): Periodically detect stale child check-ins and enqueue offline alerts
-- Run in Supabase SQL Editor AFTER step-n-parent-notifications.sql and step-l-notification-auto-dispatch.sql
--
-- Why this is needed:
--   fn_enqueue_child_offline_alerts() only runs inside send-push-notifications.
--   If no task/outbox activity happens, the edge function never runs and parents never get
--   "device quiet" (B) alerts. This job enqueues rows every 5 minutes; the existing
--   trg_notification_outbox_dispatch trigger then invokes the edge function.
--
-- Requires: pg_cron (Supabase Dashboard → Database → Extensions → pg_cron)
-- If pg_cron is unavailable on your plan, use Dashboard → Edge Functions →
--   send-push-notifications → Schedules → */5 * * * * with header x-cron-secret.

begin;

create extension if not exists pg_cron with schema pg_catalog;

-- Remove previous job if re-running this script (ignore if missing)
do $$
declare
  jid int;
begin
  select jobid into jid from cron.job where jobname = 'learngate-child-offline-check' limit 1;
  if jid is not null then
    perform cron.unschedule(jid);
  end if;
end $$;

select cron.schedule(
  'learngate-child-offline-check',
  '*/5 * * * *',
  $$ select public.fn_enqueue_child_offline_alerts(15); $$
);

commit;

-- Quick test (SQL Editor): stop child app / force-stop, wait >15 min since last heartbeat, then:
--   select public.fn_enqueue_child_offline_alerts(5);
-- A new notification_outbox row with event_type child_device_offline should appear and auto-dispatch.
