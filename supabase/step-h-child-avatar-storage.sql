-- LEARNGATE Step H: Child avatar storage
-- Run once in Supabase SQL Editor.

begin;

insert into storage.buckets (id, name, public)
values ('child-avatars', 'child-avatars', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "child_avatars_insert_own_child" on storage.objects;
create policy "child_avatars_insert_own_child"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'child-avatars'
  and split_part(name, '/', 1) in (
    select id::text from public.children where child_user_id = auth.uid()
  )
);

drop policy if exists "child_avatars_insert_parent" on storage.objects;
create policy "child_avatars_insert_parent"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'child-avatars'
  and split_part(name, '/', 1) in (
    select id::text from public.children where parent_id = auth.uid()
  )
);

drop policy if exists "child_avatars_update_own_child" on public.children;
create policy "child_avatars_update_own_child"
on public.children
for update
to authenticated
using (child_user_id = auth.uid())
with check (child_user_id = auth.uid());

commit;
