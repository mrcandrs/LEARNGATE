-- LEARNGATE Step R: Let the parent app trigger child token health checks (detect uninstall)
-- Run AFTER step-l (pg_net) and send-push-notifications deployed.
-- Replace YOUR_PROJECT_REF and YOUR_CRON_SECRET (same as step-l).

begin;

create extension if not exists pg_net with schema extensions;

create or replace function public.request_child_push_health_check()
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

  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'parent'
  ) then
    raise exception 'Only parent accounts can run push health checks';
  end if;

  select net.http_post(
    url := format('https://%s.supabase.co/functions/v1/send-push-notifications', project_ref),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', cron_secret
    ),
    body := '{"check_child_tokens":true}'::jsonb
  ) into request_id;
end;
$$;

revoke all on function public.request_child_push_health_check() from public;
grant execute on function public.request_child_push_health_check() to authenticated;

commit;

-- Parent app calls: supabase.rpc('request_child_push_health_check') every few minutes while open.
