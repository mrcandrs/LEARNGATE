-- LEARNGATE Step AJ: Backfill temp-unlock timer fields for rows approved before step-ai
-- Run after step-ai-app-unlock-timer-fix.sql

begin;

update public.child_app_temp_unlocks t
set
  duration = coalesce(t.duration, r.duration),
  started_at = coalesce(t.started_at, r.resolved_at)
from public.child_app_unlock_requests r
where t.request_id = r.id
  and (t.duration is null or t.started_at is null);

-- 30m passes should never show rest-of-day expiry
update public.child_app_temp_unlocks t
set unlock_until = t.started_at + interval '30 minutes'
where t.duration = '30m'
  and t.started_at is not null
  and t.unlock_until > t.started_at + interval '35 minutes';

commit;
