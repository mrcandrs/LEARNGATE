-- Phase 5: Storage bucket + RLS policies for chore photo evidence
-- Run in Supabase SQL Editor AFTER creating bucket (or let INSERT below create metadata).

-- Bucket: private (recommended for child photos)
insert into storage.buckets (id, name, public)
values ('task-evidence', 'task-evidence', false)
on conflict (id) do update set public = excluded.public;

-- Path convention (app uploads to this shape):
--   {child_id}/{task_id}/{unix_ms}.jpg
-- First folder MUST match public.children.id so we can enforce family access.

-- Child: upload only into folders for their own child row (first path segment = children.id)
drop policy if exists "task_evidence_insert_child" on storage.objects;
create policy "task_evidence_insert_child"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'task-evidence'
  and split_part(name, '/', 1) in (
    select id::text from public.children where child_user_id = auth.uid()
  )
);

-- Parent: upload on behalf of a child they manage (optional; app usually uses child account for verify)
drop policy if exists "task_evidence_insert_parent" on storage.objects;
create policy "task_evidence_insert_parent"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'task-evidence'
  and split_part(name, '/', 1) in (
    select id::text from public.children where parent_id = auth.uid()
  )
);

-- Child: read own uploads
drop policy if exists "task_evidence_select_child" on storage.objects;
create policy "task_evidence_select_child"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'task-evidence'
  and split_part(name, '/', 1) in (
    select id::text from public.children where child_user_id = auth.uid()
  )
);

-- Parent: read evidence for their children
drop policy if exists "task_evidence_select_parent" on storage.objects;
create policy "task_evidence_select_parent"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'task-evidence'
  and split_part(name, '/', 1) in (
    select id::text from public.children where parent_id = auth.uid()
  )
);

-- Optional: allow update/delete only for service role or omit for stricter buckets
