-- 0021: image references (Correction N6 — "on verra comment ajouter les
-- références de ces images").
--
-- The lightbox (src/components/ImageLightbox.tsx) already renders a caption /
-- credit / author / source-link bar for any image that has one. This migration
-- gives the lesson-body images somewhere to STORE that, next to the file they
-- describe, instead of inventing a second table for a handful of optional
-- strings.
--
-- Deliberately narrow:
--   * four nullable text columns on the existing media_library row — nothing to
--     backfill, every existing row stays valid, and `select *` keeps working;
--   * NO new policies: media_library already has read-for-authenticated (0008)
--     and owner/teacher/admin write (0001), which is exactly the authority an
--     image reference needs;
--   * NO new table, because an image reference has no life of its own — it dies
--     with the file it annotates.
--
-- Card images (lesson_cards.image_fr / image_en) carry their references inline
-- in the [[IMG: … | credit=… | source=…]] token instead, parsed by
-- parseImageSpec(), so they need no schema at all.

alter table public.media_library
  add column if not exists alt_text   text,
  add column if not exists caption    text,
  add column if not exists credit     text,
  add column if not exists credit_url text;

comment on column public.media_library.alt_text   is 'Screen-reader description; falls back to the [[IMG:]] caption.';
comment on column public.media_library.caption    is 'Figure caption shown under the image and in the fullscreen viewer.';
comment on column public.media_library.credit     is 'Source / rights holder, e.g. "OMS, 2024".';
comment on column public.media_library.credit_url is 'Link to the source. Rendered only for http(s) URLs.';
