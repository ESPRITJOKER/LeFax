# Lefax — Session history / handoff

A running log so work can continue across sessions. Newest entry on top.
Live Supabase project ref: `kjlgrgdryimazczrcvgx` ("Lefax MVP", eu-west-1).

---

## 2026-08-21 — Quizzes built for every chapter + admin Quiz Editor

### Goal (from the user)
- "Ouvre les chapitres déjà disponibles" and "rediriger les QCM vers les chapitres que j'ai créés" so the user can evaluate them.
- Check the lessons + cards the admin added, then **build a quiz for each**.
- **Let the admin create/edit any quiz** he wants.
- Grant access to the other lessons.
- Store history in a file (this file).

### Starting live state (audited via service_role REST)
- Subject: **Biologie** only.
- 6 chapters (the admin has been authoring in-app; `chapter-<timestamp>` slugs are admin-created):
  - `la-cellule` — "Organisation générale de l'être humain" (3 lessons)
  - `cytologie-i` — "Cytologie — La cellule et ses composantes" (3 lessons, already had 31 Q)
  - `division-cellulaire` — "Cytologie — Division cellulaire" (4 lessons; only *la-mitose* had 4 Q)
  - `chapter-1787301040934` — "Cytologie — Réplication de l'ADN et synthèse des protéines" (3 lessons)
  - `chapter-1787314470022` — "Généralité sur la Génétique" (6 lessons)
  - `chapter-1787332749371` — "Métabolisme cellulaire et bioénergétique" (2 lessons; appeared mid-session)
- **16 lessons had 0 questions.** 1 draft lesson (`la-cellule / Niveau d'organisation`).
- Content lived mostly in **story cards**, not in `lessons.content_fr`.

### What was done
1. **Authored a bilingual (FR/EN) MCQ bank** from each lesson's cards/content:
   `scripts/quiz_bank_admin_content.json` — **68 questions / 272 choices** across 16 lessons,
   4 options each, exactly 1 correct, with `explanation_fr/en` and per-question `difficulty`
   (easy/medium/hard so the chapter Niv. 1/2/3 tiers fill).
2. **Builder script** `scripts/build_admin_quizzes.mjs`:
   - `--check` validates the JSON (4 opts / 1 correct / EN present / valid difficulty).
   - `--apply` inserts into the live DB via service_role REST. **Idempotent**: per lesson it
     find-or-creates the quiz, then inserts only questions whose `text_fr` isn't already there.
   - `--emit-migration` regenerates `supabase/migrations/0016_build_admin_quizzes.sql`
     (a `do $$` block over an embedded jsonb array, keyed by lesson id; no-ops on a fresh
     `db reset` where these in-app lessons don't exist; same idempotency by `text_fr`).
   - **APPLIED to live** on 2026-08-21 (66 then +2 = 68 inserted). Questions are `ai_generated=false`.
3. **Published the draft lesson** `la-cellule / Niveau d'organisation` (`4fda8065-…`). **0 drafts remain.**
4. **Admin Quiz Editor built** — new `src/pages/admin/LessonQuizPanel.tsx`, rendered at the
   bottom of `LessonEditor.tsx` (route `/admin/content/lesson/:lessonId`, below the cards panel).
   - Per lesson: add / reorder / delete questions; edit bilingual prompt + explanation;
     pick difficulty; add/remove answer choices; radio enforces **exactly one correct**.
   - The lesson's `quizzes` row is created lazily on the first question.
   - Honest writes (`.select("id")`, 0-row = permission failure → `admin_saveBlocked`), same as
     the cards panel. Validates ≥2 choices and exactly 1 correct before writing.
   - Choice edits diff by id (update / insert / delete); deletes rely on
     `student_answers.choice_id ON DELETE SET NULL` so answer history is preserved, not broken.
   - New i18n keys `admin_quiz*`, `admin_question*`, `admin_choice*`, `admin_difficulty/easy/medium/hard`
     in `src/lib/i18n.tsx` (FR + EN).
5. **RLS confirmed**: `quizzes_write` / `questions_write` / `choices_write` all allow
   `public.is_admin()`, so the super_admin edits quizzes straight from the client.

### Result (live, verified)
Every content chapter now has questions: la-cellule 12, cytologie-i 31, division-cellulaire 18,
Réplication 14, Génétique 26, Métabolisme 2 → **~103 questions live**. They surface in each
chapter's **Niv. 1/2/3** practice automatically (`ChapterPractice` aggregates
lessons → quizzes → questions across a chapter's published lessons — no per-question routing needed).

### Verification / build
- `npx tsc --noEmit` ✅ and `npx vite build` ✅.
- **NOT yet browser-verified** with the admin login (register/login → open a chapter → Niv 1/2/3;
  admin → Content → a lesson → Quiz panel add/edit). Worth a manual pass.

### For the user to do (the evaluation loop you asked for)
- Open each chapter's **Niv. 1/2/3** on the student side and review the QCM; note anything to fix.
- Use **Admin → Contenu → (chapter) → (lesson) → Quiz (QCM)** to edit/add/delete questions yourself.

### Known content issues
- **Caryotype ♀/♂ swap — FIXED (2026-08-21).** `Génétique / V. Anomalies chromosomiques`
  (`lessons.content_fr`, lid `40b9d479-…`) read "♀ : 46, XY ; ♂ : 46, XX"; corrected live to
  "♀ : 46, XX ; ♂ : 46, XY". The quiz question's explanation (bank JSON + live) was also updated to
  drop the now-stale "the course card swaps this" note. The Trisomy/Turner/Klinefelter card was
  already correct.
- `chapter-1787332749371 / "I. Les quatre formes d'échanges énergétiques"` lesson is an **empty stub**
  (one blank card, no content) → intentionally **no quiz** (nothing to test honestly). Add content, then
  build its quiz (add rows to `quiz_bank_admin_content.json` + re-run `--apply`, or use the admin editor).
- Organisation chapter still has the **duplicate questions** noted in earlier rounds (pre-existing).

### How to reproduce / extend the quiz bank next time
```
# needs .env.local: VITE_SUPABASE_URL, SUPABASE_ACCESS_TOKEN (sbp_…)
# fetch service_role key: supabase projects api-keys --project-ref kjlgrgdryimazczrcvgx  (role=service_role)
export SUPABASE_SERVICE_ROLE_KEY=<service_role jwt>
node scripts/build_admin_quizzes.mjs --check          # validate
node scripts/build_admin_quizzes.mjs --apply          # push to live (idempotent)
node scripts/build_admin_quizzes.mjs --emit-migration # refresh 0016
```
Add a new lesson block to `scripts/quiz_bank_admin_content.json` (key by lesson `id`) and re-run.

### Files touched
- add `scripts/quiz_bank_admin_content.json`, `scripts/build_admin_quizzes.mjs`
- add `supabase/migrations/0016_build_admin_quizzes.sql`
- add `src/pages/admin/LessonQuizPanel.tsx`
- edit `src/pages/admin/LessonEditor.tsx` (render quiz panel), `src/lib/i18n.tsx` (quiz i18n keys)
- add `docs/SESSION_HISTORY.md` (this file)
