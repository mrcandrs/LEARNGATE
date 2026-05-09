-- LEARNGATE Step J: Child audio guide settings
-- Run once in Supabase SQL Editor.

begin;

alter table public.children
  add column if not exists audio_guide_enabled boolean not null default true,
  add column if not exists audio_guide_rate real not null default 0.92;

alter table public.children
  drop constraint if exists children_audio_guide_rate_check;

alter table public.children
  add constraint children_audio_guide_rate_check check (audio_guide_rate >= 0.5 and audio_guide_rate <= 1.5);

commit;

