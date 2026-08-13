-- 0014_seed_question_difficulty — promote genuinely hard questions.
--
-- Most seeded questions defaulted to 'medium' (older batches carried no
-- per-question difficulty), so the chapter Exercice Niveau 3 (hard) tier had no
-- real content and fell back to a slice of the bank. This seeds a real 'hard'
-- tier in the two larger chapters that lacked one, based on the questions'
-- actual cognitive demand (LLM-judged, 2026-08-13):
--   - "classification exacte, de la plus petite à la plus grande" — full
--     ordering of the organization levels (multi-step).
--   - "quelle affirmation est FAUSSE" over the physiological functions — a
--     negation that requires evaluating several facts at once.
--   - "quel appareil ne participe PAS directement au maintien immédiat de
--     l'homéostasie" — a fine distinction.
--   - "Dans la codominance, comme pour le groupe sanguin AB" — applying the
--     codominance concept to an example.
-- Going forward, new questions are born tagged (the ai-content generate/approve
-- path now carries `difficulty`, set in the AI-Review UI). Chapters with too
-- few questions to span three tiers keep the runtime thirds-fallback in
-- ChapterPractice. Idempotent.

update public.questions
set difficulty = 'hard'
where id in (
  '16a0f35e-5cc0-5b23-9b69-bf1865acbc95', -- Génétique — codominance / groupe AB
  '2d91df0b-a116-469f-a995-a2596240f5e1', -- Organisation — classification exacte des niveaux
  '301e46d5-e203-4446-b5b5-5c16c2f1e1f0', -- Organisation — affirmation FAUSSE (fonctions physiologiques)
  '340bcc89-290f-4c9b-9445-f604bc7c1831'  -- Organisation — appareil ne participant PAS à l'homéostasie
);
