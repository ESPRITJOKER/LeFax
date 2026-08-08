# content manifest schema

Each chapter folder holds a `manifest.json` that the pipeline
(`scripts/build-ingest.mjs`) turns into `supabase/migrations/0012_ingest_content.sql`
and `scripts/upload-images.mjs` turns into `lesson-media` Storage uploads.

- **Language of authoring**: FRENCH is the source of truth; ENGLISH is a faithful
  translation. Both fields must always be filled.
- **JSON**: strict JSON (RFC 8259). No trailing commas, no comments. Must parse
  with `JSON.parse`. `null` is allowed for image slots only.
- **Images**: referenced by the exact artifact filename listed in each chapter's
  image list. The same file is normally used for `image_fr` and `image_en`
  (a bilingual diagram). Only set an image when the filename clearly matches the
  card's topic; otherwise use `null`.

## top level

| field            | type    | notes                                                        |
|------------------|---------|--------------------------------------------------------------|
| `schema_version` | int     | `1`                                                          |
| `subject_slug`   | string  | always `"biologie"`                                          |
| `chapter_slug`   | string  | DB slug, see below                                           |
| `chapter_name_fr`| string  | display name FR                                              |
| `chapter_name_en`| string  | display name EN                                              |
| `chapter_position`| int    | 1..6                                                         |
| `chapter_new`    | boolean | `true` = create the chapter; `false` = attach to existing    |
| `lessons`        | array   | see Lesson                                                   |
| `quiz`           | object? | optional single-chapter catch-all quiz (unused for now)      |

DB slugs (existing chapters MUST use these exact slugs):

| folder | chapter_slug | chapter_new |
|--------|--------------|-------------|
| chapitre-00-introduction | `organisation-etre-humain` | false |
| chapitre-01-cytologie-1  | `cytologie-i`             | false |
| chapitre-02-division-cellulaire | `division-cellulaire`     | true  |
| chapitre-03-replication-adn | `replication-adn`       | true  |
| chapitre-04-genetique    | `genetique`               | true  |
| chapitre-05-bioenergetique-metabolisme | `bioenergetique-metabolisme` | true |

## Lesson

For **existing** chapters (`chapter_new: false`) a lesson entry only needs
`slug`, `position` and `cards` (the lesson row already exists in 0007 — slugs
must match exactly; see below). No body fields.

For **new** chapters every field below is required.

| field | type | notes |
|-------|------|-------|
| `slug` | string | kebab-case, unique within chapter |
| `title_fr` / `title_en` | string | |
| `objectives_fr` / `objectives_en` | array<string> | 2-3 items |
| `content_fr` / `content_en` | string | lesson body using the mini-markup below |
| `summary_fr` / `summary_en` | string | 1 sentence |
| `key_points_fr` / `key_points_en` | array<string> | 3 items |
| `duration_minutes` | int | 8-14 |
| `difficulty` | string | `easy` \| `medium` \| `hard` |
| `position` | int | 1..n |
| `published` | boolean | `true` |
| `cards` | array | see Card |

### mini-markup (lesson bodies only)

`## Heading`, `- list item`, `[[IMG: <caption>]]` image placeholder, `[!INFO]`,
`[!PIEGE]`, `[!APP] question ||| answer`.

### existing-lesson slugs (chapters 00 and 01)

- `organisation-etre-humain` (00): `niveaux-organisation`,
  `tissus-organes-appareils`, `homeostasie-fonctions`
- `cytologie-i` (01): `introduction-organisation`, `membrane-plasmique`,
  `transports-membranaires`, `noyau-cytoplasme`, `organites`, `acides-nucleiques`

## Card

| field | type | notes |
|-------|------|-------|
| `position` | int | 1..n |
| `point_fr` / `point_en` | string | front headline, ≤ 12 words |
| `sub_fr` / `sub_en` | string | front one-liner, ≤ 25 words |
| `image_fr` / `image_en` | string\|null | exact artifact filename |
| `explanation_fr` / `explanation_en` | string | back block 1, 2-4 sentences |
| `structural_question_fr` / `_en` | string | back block 2 question |
| `structural_answer_fr` / `_en` | string | back block 2 expected answer — SHORT and canonical (direct-match grading) |
| `tips_fr` / `tips_en` | string | back block 3, 1-2 sentences |
| `traps_fr` / `traps_en` | string | back block 4, classic mistake, 1-2 sentences |

## Quiz (per-lesson)

Optional `quiz` object inside a Lesson (one quiz per lesson — the client
resolves it by lesson_id):

| field | type | notes |
|-------|------|-------|
| `session_size` | int | number of MCQs drawn per session (≤ question count) |
| `title_fr` / `title_en` | string | e.g. `Quiz — <lesson title>` |
| `difficulty` | string | `easy` \| `medium` \| `hard` |
| `passing_score` | int | `50` |
| `questions` | array | see Question |

## Question

| field | type | notes |
|-------|------|-------|
| `text_fr` / `text_en` | string | stem |
| `explanation_fr` / `explanation_en` | string | correction |
| `difficulty` | string | `easy` \| `medium` \| `hard` |
| `choices` | array | exactly 4, exactly one `is_correct: true` |

Each choice: `text_fr`, `text_en`, `is_correct`.
