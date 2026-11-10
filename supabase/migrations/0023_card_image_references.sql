-- 0023: image references for story-card images (Correction N9 — "Il n'est pas
-- possible de mettre la source de l'image sur les cartes").
--
-- 0021 deliberately left card images schema-less, on the theory that a card's
-- source could be written inline via a [[IMG: … | credit=… | source=…]] token.
-- In practice the authors upload the card image through the picker
-- (image_fr / image_en) and had nowhere to record where it came from. These
-- columns give the picker a place to store it, right next to the URL they
-- annotate — the same shape media_library already uses for lesson-body images
-- (0021): a credit string and an optional source link, per language.
--
-- Deliberately narrow, exactly like 0021:
--   * four nullable text columns on the existing lesson_cards row — nothing to
--     backfill, every existing card stays valid, and `select *` keeps working;
--   * NO new policy: lesson_cards' owner / teacher / admin writes (0011) already
--     govern exactly these columns.

alter table public.lesson_cards
  add column if not exists image_credit_fr     text,
  add column if not exists image_credit_en     text,
  add column if not exists image_credit_url_fr text,
  add column if not exists image_credit_url_en text;

comment on column public.lesson_cards.image_credit_fr     is 'Source / rights holder of image_fr, e.g. "OMS, 2024".';
comment on column public.lesson_cards.image_credit_en     is 'Source / rights holder of image_en.';
comment on column public.lesson_cards.image_credit_url_fr is 'Link to the source of image_fr. Rendered only for http(s) URLs.';
comment on column public.lesson_cards.image_credit_url_en is 'Link to the source of image_en.';
