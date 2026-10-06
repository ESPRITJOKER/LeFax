-- 0022: stable image keys — let an author insert, move or delete a lesson image
-- without re-binding every picture below it.
--
-- Until now a lesson-body image was addressed by its POSITION: parse() counted
-- the [[IMG:]] placeholders and the Nth one became `image_slot = N`, stored at
-- `lesson-media/<lesson_id>/<N>`. That is correct only as long as nobody ever
-- inserts a placeholder in the middle — do that and every image below shifts up
-- one slot, so each figure silently acquires the picture of the next one. The
-- Word-style toolbar exists precisely so authors DO insert images anywhere, so
-- the positional binding had to go.
--
-- Now the token carries its own identity:
--
--   [[IMG: caption | key=k7f3a2m1 | w=60 | align=right]]
--
-- and the file lives at `lesson-media/<lesson_id>/k7f3a2m1`. Moving the line
-- moves the key with it, so the binding survives any edit.
--
-- Deliberately additive:
--   * image_slot and its unique constraint STAY. Every lesson written before
--     this migration has keyless tokens, and the renderer still resolves those
--     by position (key first, slot second). Nothing is backfilled, because a
--     backfill would mean rewriting content_fr/content_en for every lesson to
--     inject keys — a content migration to fix an authoring convenience. Legacy
--     rows simply keep working, and a lesson picks up keys the first time
--     someone uploads through the new image dialog.
--   * NO new policies: media_library already has read-for-authenticated (0008)
--     and owner/teacher/admin write (0001), which is the authority an image
--     binding needs. The `lesson-media` bucket policies are path-independent
--     (bucket_id + is_teacher()), so a key-shaped path needs no storage change.

alter table public.media_library
  add column if not exists image_key text;

comment on column public.media_library.image_key is
  'Stable per-lesson id for a body image, carried in the [[IMG: … | key=…]] token. Takes precedence over the positional image_slot.';

-- One media row per (lesson, key), so the client can upsert on it exactly as it
-- already does on (lesson_id, image_slot). NULLs are distinct, so the rows that
-- predate this migration — and the generic library uploads with no lesson at
-- all — are unaffected.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'media_library_lesson_key_key'
  ) then
    alter table public.media_library
      add constraint media_library_lesson_key_key unique (lesson_id, image_key);
  end if;
end $$;

-- The editor and both student readers fetch every image of one lesson at once
-- (`where lesson_id = … and (image_key is not null or image_slot is not null)`),
-- so the lesson_id prefix of the unique index above already serves those reads.
-- No extra index.
