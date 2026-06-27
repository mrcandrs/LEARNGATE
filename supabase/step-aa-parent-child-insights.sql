-- LEARNGATE Step AA: AI-generated parent child insights (stored + edge function)
-- Run in Supabase SQL Editor after step-c-init.sql
--
-- Then deploy the edge function and set secrets (free Google Gemini API):
--   npx supabase functions deploy generate-parent-insight
--   npx supabase secrets set GEMINI_API_KEY=your-key-from-aistudio.google.com
--
-- The app calls generate-parent-insight when a parent opens "View More" on AI insights
-- (or when the cached insight is older than 24 hours).

begin;

create table if not exists public.parent_child_insights (
  child_id uuid primary key references public.children (id) on delete cascade,
  parent_id uuid not null references auth.users (id) on delete cascade,
  summary text not null,
  latest_task_line text not null,
  focus_areas text not null,
  recommendation text not null,
  next_best_step text not null,
  context_snapshot jsonb,
  model text,
  generated_at timestamptz not null default now()
);

create index if not exists parent_child_insights_parent_idx
  on public.parent_child_insights (parent_id, generated_at desc);

alter table public.parent_child_insights enable row level security;

drop policy if exists "Parents read own child insights" on public.parent_child_insights;
create policy "Parents read own child insights"
  on public.parent_child_insights for select
  to authenticated
  using (parent_id = auth.uid());

-- Writes happen only from the edge function (service role).

commit;
