-- 0019: Re-seed the five non-Biologie subjects of the medicine track.
--
-- Migration 0009 removed every subject that had no chapters left after the
-- content-less placeholder lessons were purged, which took Chimie, Physique,
-- Mathématiques, Français and Culture générale with it. That was right about
-- *lessons* — students should never open a lesson with no notes — but it also
-- deleted the authoring targets:
--
--   * the super admin cannot create a Chimie chapter when no Chimie row exists;
--   * since 0018, a teacher cannot be assigned Chimie either, because
--     teacher_subjects.subject_id needs a real subject to point at.
--
-- So the subjects come back, empty, and the curriculum gets built inside them
-- from the admin/teacher Content tree. The old placeholder *chapters*
-- (structure-atomique, mecanique, analyse, …) are deliberately NOT restored:
-- that would put empty chapters in front of students again, which is exactly
-- what 0009 set out to stop.
--
-- Slugs, names and positions are the ones from the initial commit, because
-- src/lib/icons.tsx keys each subject's icon, accent colour and emoji by slug
-- (biologie→dna/🧬, chimie→flask/🧪, physique→atom/⚛️, mathematiques→ruler/📐,
-- francais→quill/📖, culture-generale→globe/🌍). A different slug would silently
-- fall back to the generic book/📘.
--
-- Idempotent: `on conflict (slug) do nothing` leaves the live biologie row
-- (position 1, with all its content) untouched.

insert into public.subjects (slug, name_fr, name_en, track, position) values
  ('chimie',           'Chimie',           'Chemistry',         'medicine', 2),
  ('physique',         'Physique',         'Physics',           'medicine', 3),
  ('mathematiques',    'Mathématiques',    'Mathematics',       'medicine', 4),
  ('francais',         'Français',         'French',            'medicine', 5),
  ('culture-generale', 'Culture générale', 'General Knowledge', 'medicine', 6)
on conflict (slug) do nothing;
