-- 0009: Remove placeholder content that has no real notes (product decision,
-- 2026-07-27) so the student platform only surfaces lessons that were actually
-- written. Cascade: drop note-less lessons, then any chapter left with no
-- lessons, then any subject left with no chapters.
--
-- Effect on the live DB at time of writing: removes the 4 filler lessons in
-- Biologie / "La cellule" (membrane-plasmique, noyau-et-organites,
-- division-cellulaire, transport-cellulaire — each just "Cette leçon couvre …"),
-- the 13 empty chapters (biologie/genetique, biologie/physiologie-humaine, and
-- every chapter of chimie/physique/mathematiques/francais/culture-generale),
-- and the 5 now-empty subjects. Biologie remains with: La cellule
-- (structure-de-la-cellule), Cytologie I (6 lessons), Organisation générale de
-- l'être humain (3 lessons) — all of which have real notes.
--
-- Idempotent: once clean, each statement deletes nothing.

-- 1. Lessons with no body, or the seed's "Cette leçon couvre : …" stub.
delete from public.lessons
where btrim(coalesce(content_fr, '')) = ''
   or content_fr ilike 'Cette le%couvre%';

-- 2. Chapters that no longer have any lessons.
delete from public.chapters c
where not exists (select 1 from public.lessons l where l.chapter_id = c.id);

-- 3. Subjects that no longer have any chapters.
delete from public.subjects s
where not exists (select 1 from public.chapters c where c.subject_id = s.id);
