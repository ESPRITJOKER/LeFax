-- 0008: Lesson image uploads — bind a real image to each [[IMG:]] placeholder.
--
-- Lesson bodies (lessons.content_fr / content_en) contain captioned image
-- placeholders rendered by src/lib/lessonContent.tsx. This migration lets an
-- admin/teacher upload the actual illustration for each placeholder, addressed
-- by its slot number (the 1-based order of the [[IMG:]] in the lesson — the
-- same in FR and EN, so an image is bound once and shows in both languages).
--
--   1. media_library.image_slot — which placeholder (per lesson) this file fills.
--   2. unique(lesson_id, image_slot) — one image per slot; enables client upsert.
--   3. students (authenticated) can READ media_library so lesson images render
--      (the 0001 read policy was owner/teacher/admin only — students saw nothing).
--   4. a public `lesson-media` Storage bucket + RLS (public read, staff write),
--      mirroring the `avatars` bucket from 0005.

alter table public.media_library
  add column if not exists image_slot integer;

-- One media row per (lesson, slot). Rows with a null lesson_id or slot (generic
-- library uploads) are unaffected — NULLs are treated as distinct.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'media_library_lesson_slot_key'
  ) then
    alter table public.media_library
      add constraint media_library_lesson_slot_key unique (lesson_id, image_slot);
  end if;
end $$;

-- Let any authenticated user (i.e. students) read lesson media. Multiple
-- permissive SELECT policies are OR'd, so this widens read without dropping the
-- existing owner/teacher/admin policy.
drop policy if exists media_library_read_authenticated on public.media_library;
create policy media_library_read_authenticated on public.media_library
  for select using (auth.role() = 'authenticated');

-- Public bucket for lesson illustrations.
insert into storage.buckets (id, name, public)
values ('lesson-media', 'lesson-media', true)
on conflict (id) do nothing;

drop policy if exists lesson_media_public_read on storage.objects;
create policy lesson_media_public_read on storage.objects for select
  using (bucket_id = 'lesson-media');

drop policy if exists lesson_media_staff_write on storage.objects;
create policy lesson_media_staff_write on storage.objects for insert
  with check (bucket_id = 'lesson-media' and public.is_teacher());

drop policy if exists lesson_media_staff_update on storage.objects;
create policy lesson_media_staff_update on storage.objects for update
  using (bucket_id = 'lesson-media' and public.is_teacher());

drop policy if exists lesson_media_staff_delete on storage.objects;
create policy lesson_media_staff_delete on storage.objects for delete
  using (bucket_id = 'lesson-media' and public.is_teacher());
