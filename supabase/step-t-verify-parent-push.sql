-- LEARNGATE Step T: Diagnose parent vs child push tokens
-- Run in Supabase SQL Editor (read-only checks).

-- 1) Tokens per account (parent should have a row; child should have a row on another device)
select
  p.role,
  pt.user_id,
  left(pt.token, 28) || '…' as token_prefix,
  pt.platform,
  pt.updated_at
from public.push_tokens pt
join public.profiles p on p.id = pt.user_id
order by pt.updated_at desc;

-- 2) Recent parent-targeted outbox rows
select id, event_type, payload->>'child_id' as child_id, created_at, processed_at
from public.notification_outbox
where event_type in ('task_completed', 'task_submitted', 'parent_insight', 'child_app_uninstalled')
order by id desc
limit 15;

-- If task_completed rows exist with processed_at set but parent got nothing,
-- parent_token_count was likely 0 in the edge function response — re-enable push on the parent device.

-- 3) For each recent task_completed: does the child's parent have a push token?
-- parent_has_token MUST be true for the parent device to receive the alert.
select
  o.id as outbox_id,
  o.event_type,
  o.payload->>'title' as task_title,
  ch.name as child_name,
  ch.parent_id,
  parent_p.role as parent_account_role,
  parent_pt.token is not null as parent_has_token,
  left(parent_pt.token, 32) || '…' as parent_token_prefix,
  child_p.role as child_account_role,
  child_pt.token is not null as child_has_token
from public.notification_outbox o
join public.children ch on ch.id = (o.payload->>'child_id')::uuid
join public.profiles parent_p on parent_p.id = ch.parent_id
left join public.push_tokens parent_pt on parent_pt.user_id = ch.parent_id
left join public.profiles child_p on child_p.id = ch.child_user_id
left join public.push_tokens child_pt on child_pt.user_id = ch.child_user_id
where o.event_type = 'task_completed'
order by o.id desc
limit 10;
