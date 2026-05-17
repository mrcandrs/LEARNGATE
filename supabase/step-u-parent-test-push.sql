-- LEARNGATE Step U: Parent in-app "Send test push" (queues task_completed for your child)
-- Run once in Supabase SQL Editor.

begin;

create or replace function public.enqueue_parent_test_push()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cid uuid;
  tid uuid;
  oid bigint;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.profiles p where p.id = uid and p.role = 'parent'
  ) then
    raise exception 'Only parent accounts can request a parent test push';
  end if;

  select c.id into cid
  from public.children c
  where c.parent_id = uid
  order by c.created_at asc
  limit 1;

  if cid is null then
    raise exception 'No child linked to this parent account';
  end if;

  select t.id into tid
  from public.tasks t
  where t.child_id = cid
  order by t.created_at desc
  limit 1;

  insert into public.notification_outbox (event_type, payload)
  values (
    'task_completed',
    jsonb_build_object(
      'child_id', cid,
      'task_id', coalesce(tid, cid),
      'title', 'Test push from parent settings'
    )
  )
  returning id into oid;

  return oid;
end;
$$;

revoke all on function public.enqueue_parent_test_push() from public;
grant execute on function public.enqueue_parent_test_push() to authenticated;

commit;

-- Requires step-l auto-dispatch trigger. After running, use Parent Settings → "Send server test push".
