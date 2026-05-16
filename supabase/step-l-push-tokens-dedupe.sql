-- Keep only the newest push token per user (removes stale emulator tokens).
-- Run in SQL Editor, then have child sign in again on the child MuMu.

begin;

delete from public.push_tokens pt
using (
  select id,
    row_number() over (partition by user_id order by updated_at desc nulls last) as rn
  from public.push_tokens
) ranked
where pt.id = ranked.id
  and ranked.rn > 1;

commit;
