-- LEARNGATE Step C: Initial Supabase schema + RLS
-- Run this entire script in Supabase SQL Editor.

begin;

-- 1) Profiles table (linked to auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role text not null check (role in ('parent', 'child')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Children managed by a parent
create table if not exists public.children (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles (id) on delete cascade,
  child_user_id uuid unique references public.profiles (id) on delete set null,
  name text not null,
  age int not null check (age > 0 and age < 18),
  avatar_url text,
  difficulty_level int not null default 1 check (difficulty_level between 1 and 10),
  daily_limit_minutes int not null default 120 check (daily_limit_minutes between 15 and 1440),
  bedtime_start time not null default '20:00',
  bedtime_end time not null default '07:00',
  stars int not null default 0 check (stars >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) Tasks assigned to child
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  category text not null check (category in ('learning', 'chore')),
  title text not null,
  description text,
  xp_reward int not null default 0 check (xp_reward >= 0),
  requires_camera boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'submitted', 'approved', 'rejected', 'completed')),
  due_at timestamptz,
  completed_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4) Submission evidence for tasks (camera or manual proof)
create table if not exists public.task_submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  image_url text,
  notes text,
  status text not null default 'submitted' check (status in ('submitted', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5) Screen control settings per child
create table if not exists public.screen_rules (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null unique references public.children (id) on delete cascade,
  blocked_apps_json jsonb not null default '[]'::jsonb,
  unlock_after_task_count int not null default 3 check (unlock_after_task_count >= 0),
  reward_multiplier numeric(4,2) not null default 1.00 check (reward_multiplier between 0.10 and 10.00),
  daily_report_enabled boolean not null default true,
  task_reminders_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6) Activity trail for analytics/dashboard feed
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  actor_profile_id uuid references public.profiles (id),
  type text not null,
  points int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 7) Helpful indexes
create index if not exists idx_children_parent_id on public.children(parent_id);
create index if not exists idx_tasks_child_id on public.tasks(child_id);
create index if not exists idx_tasks_status on public.tasks(status);
create index if not exists idx_tasks_due_at on public.tasks(due_at);
create index if not exists idx_task_submissions_task_id on public.task_submissions(task_id);
create index if not exists idx_task_submissions_child_id on public.task_submissions(child_id);
create index if not exists idx_activity_logs_child_id on public.activity_logs(child_id);
create index if not exists idx_activity_logs_created_at on public.activity_logs(created_at desc);

-- 8) updated_at trigger helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_children_updated_at on public.children;
create trigger trg_children_updated_at
before update on public.children
for each row execute function public.set_updated_at();

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

drop trigger if exists trg_task_submissions_updated_at on public.task_submissions;
create trigger trg_task_submissions_updated_at
before update on public.task_submissions
for each row execute function public.set_updated_at();

drop trigger if exists trg_screen_rules_updated_at on public.screen_rules;
create trigger trg_screen_rules_updated_at
before update on public.screen_rules
for each row execute function public.set_updated_at();

-- 9) Auto-create parent profile on signup (safe default; can be changed later)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'parent'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 10) RLS ON
alter table public.profiles enable row level security;
alter table public.children enable row level security;
alter table public.tasks enable row level security;
alter table public.task_submissions enable row level security;
alter table public.screen_rules enable row level security;
alter table public.activity_logs enable row level security;

-- 11) RLS policies: profiles
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- 12) RLS policies: children
drop policy if exists "children_parent_select" on public.children;
create policy "children_parent_select"
on public.children
for select
to authenticated
using (parent_id = auth.uid());

drop policy if exists "children_parent_insert" on public.children;
create policy "children_parent_insert"
on public.children
for insert
to authenticated
with check (parent_id = auth.uid());

drop policy if exists "children_parent_update" on public.children;
create policy "children_parent_update"
on public.children
for update
to authenticated
using (parent_id = auth.uid())
with check (parent_id = auth.uid());

drop policy if exists "children_parent_delete" on public.children;
create policy "children_parent_delete"
on public.children
for delete
to authenticated
using (parent_id = auth.uid());

-- Child can view own child row when linked by child_user_id
drop policy if exists "children_child_select_own" on public.children;
create policy "children_child_select_own"
on public.children
for select
to authenticated
using (
  child_user_id = auth.uid()
);

-- 13) RLS policies: tasks
drop policy if exists "tasks_parent_full_access" on public.tasks;
create policy "tasks_parent_full_access"
on public.tasks
for all
to authenticated
using (
  exists (
    select 1 from public.children c
    where c.id = tasks.child_id
      and c.parent_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.children c
    where c.id = tasks.child_id
      and c.parent_id = auth.uid()
  )
);

drop policy if exists "tasks_child_select_own" on public.tasks;
create policy "tasks_child_select_own"
on public.tasks
for select
to authenticated
using (
  exists (
    select 1 from public.children c
    where c.id = tasks.child_id
      and c.child_user_id = auth.uid()
  )
);

drop policy if exists "tasks_child_update_limited" on public.tasks;
create policy "tasks_child_update_limited"
on public.tasks
for update
to authenticated
using (
  exists (
    select 1 from public.children c
    where c.id = tasks.child_id
      and c.child_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.children c
    where c.id = tasks.child_id
      and c.child_user_id = auth.uid()
  )
);

-- 14) RLS policies: task_submissions
drop policy if exists "submissions_parent_full_access" on public.task_submissions;
create policy "submissions_parent_full_access"
on public.task_submissions
for all
to authenticated
using (
  exists (
    select 1
    from public.children c
    where c.id = task_submissions.child_id
      and c.parent_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.children c
    where c.id = task_submissions.child_id
      and c.parent_id = auth.uid()
  )
);

drop policy if exists "submissions_child_own" on public.task_submissions;
create policy "submissions_child_own"
on public.task_submissions
for all
to authenticated
using (
  exists (
    select 1 from public.children c
    where c.id = task_submissions.child_id
      and c.child_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.children c
    where c.id = task_submissions.child_id
      and c.child_user_id = auth.uid()
  )
);

-- 15) RLS policies: screen_rules
drop policy if exists "screen_rules_parent_full_access" on public.screen_rules;
create policy "screen_rules_parent_full_access"
on public.screen_rules
for all
to authenticated
using (
  exists (
    select 1
    from public.children c
    where c.id = screen_rules.child_id
      and c.parent_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.children c
    where c.id = screen_rules.child_id
      and c.parent_id = auth.uid()
  )
);

drop policy if exists "screen_rules_child_select_own" on public.screen_rules;
create policy "screen_rules_child_select_own"
on public.screen_rules
for select
to authenticated
using (
  exists (
    select 1 from public.children c
    where c.id = screen_rules.child_id
      and c.child_user_id = auth.uid()
  )
);

-- 16) RLS policies: activity_logs
drop policy if exists "activity_parent_full_access" on public.activity_logs;
create policy "activity_parent_full_access"
on public.activity_logs
for all
to authenticated
using (
  exists (
    select 1
    from public.children c
    where c.id = activity_logs.child_id
      and c.parent_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.children c
    where c.id = activity_logs.child_id
      and c.parent_id = auth.uid()
  )
);

drop policy if exists "activity_child_select_own" on public.activity_logs;
create policy "activity_child_select_own"
on public.activity_logs
for select
to authenticated
using (
  exists (
    select 1 from public.children c
    where c.id = activity_logs.child_id
      and c.child_user_id = auth.uid()
  )
);

commit;
