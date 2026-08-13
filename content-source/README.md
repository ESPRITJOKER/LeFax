# content-source/

Drop zone for **raw** course material that the content pipeline turns into
published lessons, cards, images and question banks. Nothing here is served to
students directly — an admin ingests it (via the admin content screens) into
Supabase (`lessons`, `lesson_cards`, `questions`/`choices`, `media_library`).

## Layout

```
content-source/<subject>/<chapter>/
  notes/       source lesson notes (docx / odt / md / txt) → lesson cards
  mcq/         MCQ documents (docx / odt) → the MCQ bank (questions + choices)
  images/
    fr/        illustrations chosen for FRENCH-language cards
    en/        illustrations chosen for ENGLISH-language cards
```

Images are split by language on purpose: a card can show a **different** image
to FR vs EN students (`lesson_cards.image_fr` / `image_en`). Put the French
diagram under `images/fr/`, the English one under `images/en/`. If a single
image serves both, drop the same file in both folders (or assign it to both
slots in the admin card editor).

## MVP scope (current)

Only the first chapters below have folders. The rest of the 26-item Biologie
curriculum will be added when we build past the MVP.

- `chapitre-00-introduction`
- `chapitre-01-cytologie-1`
- `chapitre-02-division-cellulaire`
- `chapitre-03-replication-adn`
- `chapitre-04-genetique`
- `chapitre-05-bioenergetique-metabolisme`

## How each folder maps to the data model

| folder      | becomes                                                        |
|-------------|---------------------------------------------------------------|
| `notes/`    | `lesson_cards` rows — one card per key concept, each with an explanation, a structural question + expected answer, tips, and traps |
| `mcq/`      | `questions` + `choices` rows attached to the lesson's quiz (the MCQ **bank**, larger than one session) |
| `images/fr` | candidate images assigned to `lesson_cards.image_fr`          |
| `images/en` | candidate images assigned to `lesson_cards.image_en`          |

## Known limitation — structural-question grading

Structural (free-response) answers are graded by **direct match**: the student's
answer is normalized (lowercased, whitespace-collapsed, accents stripped) and
compared to the stored expected answer. A correct answer phrased differently
than the expected one will be marked wrong. This is an accepted MVP trade-off;
revisit with AI-assisted grading if it becomes a real problem in practice. When
authoring `structural_answer_*`, keep the expected answer short and canonical.

## Content pipeline (manifest → DB)

Each chapter folder's `manifest.json` (see `MANIFEST-SCHEMA.md`) is the reviewable
source of truth. Two scripts turn it into content:

| step | command | output |
|------|---------|--------|
| 1. build migration | `node scripts/build-ingest.mjs` | `supabase/migrations/0012_ingest_content.sql` |
| 2. upload images | `node scripts/upload-images.mjs` | `lesson-media` Storage (needs service-role key) |
| 3. apply | `supabase db push` (after `supabase login`) | live DB rows |

Image URLs are **deterministic**:
`https://<project>.supabase.co/storage/v1/object/public/lesson-media/biologie/<chapter>/<file>`,
so the migration can embed them before the upload even runs — upload first anyway
so the files exist when the app renders.

Auth note: `.env.local` has an empty `SUPABASE_SERVICE_ROLE_KEY`. Running
`upload-images.mjs` requires filling it (Dashboard → Project Settings → API →
`service_role`). Applying `0012` requires `supabase login` (the stored CLI token
is currently stale/unauthorized). Both are manual, credential-bound steps.
