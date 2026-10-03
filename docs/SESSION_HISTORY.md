# Lefax — Session history / handoff

A running log so work can continue across sessions. Newest entry on top.
Live Supabase project ref: `kjlgrgdryimazczrcvgx` ("Lefax MVP", eu-west-1).

---

## 2026-10-02 — Feedback round N6: lesson body, editor toolbar, highlight, video, zoom, perf

Source: `Correction N6.docx` (4 screenshots + 7 remarks, FR), plus the "modèle originel"
screenshot re-sent as `~/Downloads/images/1000085939.jpg` with *"i want exactly an editor like
this with all functionalities"*.

### 1. "je l'ai rempli mais elle ne s'affiche nulle part" — the lesson body was dead code
`LessonDetail.tsx` returned `<LessonCardDeck/>` as soon as a lesson had **one** card, and every
real lesson has cards. So `content_fr/en`, `objectives_*`, `summary_*`, `key_points_*` **and every
`[[IMG:]]` upload** were written by the editor and never read back by anything. The field was not
useless — it was unreachable.

New `src/pages/student/LessonReader.tsx` at `/lesson/:id/cours` renders exactly that content
(body + objectives + summary + key points + media), with loading / empty / error states through
the existing `StateNotice`. Reached from a "Cours complet" button in the card-deck header, a
secondary button on the deck's last slot, and a corner button on each `ChapterStories` tile —
each shown **only when `content_fr` is non-empty**, so a card-only lesson gains no dead control.
The deck remains the default; this is the second view, not a replacement.

### 2. "il y a ici un petit décalage" — `ImagePicker` overflow
`LessonCardsPanel`'s image picker was `flex gap-3` with a fixed `w-[110px]` thumbnail and a
non-shrinking button column, inside a `md:grid-cols-2` grid: under ~420 px of column the
"Téléverser" button escaped the card and overlapped its neighbour. Now `flex-wrap` + `min-w-0` +
`max-w-full` on the thumbnail + `flex-1 basis-[120px]` on the buttons.

### 3. "Jaune qui rend invisible les écritures" — highlight contrast
`<mark style={{background:"#fff2a8", color:"inherit"}}>`. The story-card front is
`bg-ink-900 text-white/70` **in both themes**, so the inherited near-white sat on a pale yellow
fill. A theme token cannot fix a surface that is dark in light mode too, so both halves of the
pair are now pinned: `#1e2a3a` ink on one of four fills, selectable from the toolbar
(`==vert|texte==`). **Measured: 1.13:1 → 12.07:1**; all four fills are AAA.

### 4. "le modèle originel … c'est un peu compliqué" — the editor
The screen was one 820 px column of raw monospace textareas: FR and EN bodies stacked, preview
behind a toggle, cards and quiz dumped below in the same scroll. Rebuilt to the reference:
sticky back/breadcrumb/Enregistrer header, Cours | Cartes | QCM tabs, a FR/EN two-button switch
instead of two stacked bodies, the formatting bar over the editor, and a permanent live phone
preview beside it at `xl` (stacked below it under `xl`).

New `src/components/editor/MarkupToolbar.tsx` + `MarkupField.tsx`: undo/redo (ours — a
programmatic `setValue` destroys the textarea's native history), B / I / U, X² / X₂, highlight +
colour picker, bullet and numbered lists, indent/outdent, clear formatting, link, image, video,
∑ maths, H₂O chemistry, and a source toggle. Ctrl+B/I/U/K/Z/Y as well.

It writes the project's existing mini-markup rather than introducing a rich-text library: the
same markup is parsed by the student renderers, the AI pipeline and every row already in the
database, so nothing needed migrating and the preview is literally the student renderer. The
card editor uses the same field with `toolbarOnFocus`, so its fourteen fields show one bar at a
time instead of fourteen. Its phone preview now renders through `inline()` / `RichCardText` on
the real dark card surface — the old one printed raw markup on white, which is how an unreadable
`==surligné==` could ship without anyone seeing it.

`lessonContent.tsx` gained the rules the toolbar needs: `^sup^`, `~sub~`, numbered lists, one
level of list nesting, `[texte](url)`, `[[VIDEO: url]]`, and `credit=` / `source=` / `alt=` on
`[[IMG:]]`.

### 5. "les liens des vidéos hypertexte ne se connectaient pas"
There was **no video support at all** — no column, no markup rule, and `markup()` had no link
rule either, so a pasted URL rendered as inert text. Probing the live DB, no published lesson
body contains any `http` link: nothing ever persisted it, which is why the course "containing
the YouTube link" could not be found.

Now `[texte](url)` renders a real `<a target="_blank" rel="noopener noreferrer">` behind an
http/https/mailto allowlist (a `javascript:` URL keeps its label and loses its href), and
`[[VIDEO: url]]` renders a responsive 16:9 `youtube-nocookie.com` / `player.vimeo.com` iframe with
the id parsed out of the URL — `watch?v=`, `youtu.be/`, `/shorts/`, `/embed/`, `/live/`,
playlists — and a clickable card for any other URL. Nothing hardcoded, so future videos work by
themselves. Works in lesson bodies **and** card fields.

### 6. Fullscreen + zoom + image references
New `src/components/ImageLightbox.tsx`: wheel and +/− zoom, pinch-to-zoom, drag to pan, double
tap/click to toggle fit ↔ 2×, Esc / ✕ / backdrop to close, `object-contain` so the aspect ratio
is never distorted, and the body locked while open so closing returns to the same scroll offset.
`ZoomableImage` wraps it, and every content image now goes through it — lesson body, **both**
card faces (only the back one was even clickable before, and it merely opened the raw file in a
new tab), and the editor's slot previews.

Its optional `meta` prop (caption / credit / author / source link) is the extension point for
"on verra comment ajouter les références". Lesson-body images store theirs in
**`0021_media_metadata.sql`** — four nullable columns on `media_library`, no new table, no policy
change; card images carry theirs inline in the `[[IMG: … | credit=… | source=…]]` token.

### 7. "1 à 2 secondes" — measured, then fixed
| | before | after |
|---|---|---|
| JS on first paint | **1,035 kB / 286 kB gzip**, one chunk | 121 + 165 + 216 kB / **146 kB gzip** |
| CSS on first paint | 72 kB / 17.0 gzip | 44 kB / **9.1 gzip** |
| `lefax-mark.png` (every screen, drawn at 26–30 px) | 740×740, **662 kB** | 96×96, **18 kB** |
| `lefax-logo.png` | 1108×1088, 1039 kB | 360×354, 139 kB |
| favicon | 256×256, 100 kB | 64×64, 9 kB |
| `/lesson/:id` round trips | 6 sequential | 1 + 5 parallel |

Causes, in order of size:
- **No code splitting at all.** Every student downloaded the admin back-office and the teacher
  panel. `React.lazy` on both subtrees plus the heavy runners; `manualChunks` pins react /
  supabase / katex so a content deploy no longer invalidates 250 kB of vendor code in every cache.
- **KaTeX loaded everywhere.** Its CSS moved from `main.tsx` into `lib/math.tsx` and
  `LessonDetail` became lazy — it was the only early screen pulling it. 78 kB gzip of maths now
  loads on a lesson, not on the dashboard.
- **Brand PNGs 50× larger than their display size.** `scripts/optimize-brand-assets.mjs`
  (System.Drawing via PowerShell, no new dependency) resizes them; originals kept as
  `src/assets/*.source.png` — under `src`, never `public`, which Vite ships whole.
- **A refetch storm.** 20 `useEffect`s list the whole `profile` object, while `auth.tsx` re-read
  the row and called `setProfile(newObject)` on *every* auth event, including the hourly
  `TOKEN_REFRESHED` and the `SIGNED_IN` fired when a tab regains focus. Every mounted screen then
  refetched everything. `loadProfile` now keeps the previous object when `updated_at` is
  unchanged, `TOKEN_REFRESHED` skips the read entirely, and `session` keeps its identity across a
  token rotation. One central fix instead of editing 20 files.
- **Sequential queries and oversized payloads.** `LessonDetail`'s five independent reads now run
  in one `Promise.all`, its `lesson_progress` upsert moved off the critical path, and the sibling
  / stories queries stopped pulling whole `content_fr`+`content_en` bodies to render a title.

### Teacher vs user platforms — one application, deliberately
The client asked whether splitting them would help. It would not: the 286 kB was a bundling
fault, not an architecture fault. Teacher, admin and student already share auth, the Supabase
client, i18n, the design tokens, `LessonEditorCore`, `lessonContent.tsx` and the RLS policies; a
second frontend would duplicate all of it, double the deployments and let the two drift. Route
splitting gets the same bytes off the student's phone in one file, with none of that cost.

### Verified / not verified
- `npx tsc --noEmit` clean · `npm run build` green · `npx eslint .` **0 errors**, 27
  react-refresh warnings (23 before — the 4 new ones are the same category, from the exported
  helpers `safeUrl`, `parseVideo`, `wrapSelection`, `mapSelectedLines`).
- **Renderer**, server-rendered in Node through `react-dom/server`: bold, italic, highlight with
  the pinned ink, nested bullets, numbered lists, sup/sub, a real link, a YouTube iframe, the
  non-embeddable fallback card, the image figure with its credit link, and a `javascript:` URL
  correctly stripped of its href.
- **Editor commands**, 21 assertions: wrap / unwrap toggling, caret placement, list toggling and
  renumbering, indent/outdent, clear formatting, snippet insertion. One real bug found and fixed
  — the list button wrote the indent twice on an unindented line.
- **Component smoke tests**, server-rendered: toolbar roles and `aria-label`s, the compact
  variant hiding its bar until focus, disabled propagation, the zoomable image being keyboard
  reachable, and no raw i18n key leaking into the markup.
- **Contrast**: the four highlight pairs, and `scripts/check_contrast.mjs` unchanged at 6
  pre-existing light-mode brand failures (documented in the N5 entry).
- **i18n**: all 414 referenced keys exist in both locales; fr and en both 535 keys.
- **Not verified in a browser.** The Claude-in-Chrome extension was not connected in this
  session, so no gesture (pinch-zoom, swipe, drag-pan), no real save round-trip and no visual
  check at 320/375/768/1024/1440 px was exercised against the running app.
- **Migration `0021` APPLIED to live 2026-10-03** (project `kjlgrgdryimazczrcvgx`), through the
  Management API SQL endpoint with `SUPABASE_SQL_TOKEN`: `SUPABASE_ACCESS_TOKEN` lacks
  `database_read`/`database_write`, so `supabase db push` and `migration list` both 403 with
  `LegacyDbConfigLoginRoleStatusError`. The history row was then inserted into
  `supabase_migrations.schema_migrations` by hand so a later push does not re-run it. Verified
  after: the four columns exist and are nullable, the three `media_library` policies are
  unchanged, and both the explicit-column read and the app’s `select("*")` read return 200
  through the anon client. The readers keep `select("*")` anyway — it costs nothing and keeps
  the code working against any database where 0021 has not been run.
- **Known, pre-existing and left alone**: `_italic_` still matches across words
  (`a_b c_d` italicises `b c`). The toolbar never writes that form, but changing the rule could
  silently un-italicise existing authored content, so it is reported rather than altered.

### Files touched
- add `src/components/ImageLightbox.tsx`, `src/components/editor/MarkupToolbar.tsx`,
  `src/components/editor/MarkupField.tsx`, `src/pages/student/LessonReader.tsx`,
  `supabase/migrations/0021_media_metadata.sql`, `scripts/optimize-brand-assets.mjs`
- rewrite `src/components/content/LessonEditorCore.tsx`, `src/lib/lessonContent.tsx`, `src/App.tsx`
- edit `src/components/content/LessonCardsPanel.tsx`, `src/components/LessonCardDeck.tsx`,
  `src/components/FormulaTool.tsx`, `src/lib/auth.tsx`, `src/lib/math.tsx`, `src/lib/i18n.tsx`,
  `src/lib/database.types.ts`, `src/main.tsx`, `src/pages/student/LessonDetail.tsx`,
  `src/pages/student/ChapterStories.tsx`, `vite.config.ts`, the three brand PNGs

---


## 2026-08-23 — Past-paper ("sujet") feature: buy + replay an exam paper

### What it is
A **sujet** is a standalone exam paper a student buys once in the Boutique, then replays freely
as personal practice — distinct from the graded per-lesson `Quiz.tsx` and the Concours-blanc
mock exams. First paper seeded: **BIOLOGIE 2015 (50 QCM)**.

### What was built (all in this commit)
1. **`src/pages/student/PaperQuiz.tsx`** + route `/paper/:quizId` in `App.tsx` (student-only).
   The player: serves the FULL question set reshuffled each attempt (`selectWithNoRepeat` with
   `sessionSize = pool.length`, `record:false` so it doesn't burn exposure), **free navigation**
   (Précédent/Suivant + jump grid), **no hearts / no per-question reveal**. Grades via the
   existing `quiz-submit` edge fn → reuses `/quiz/:quizId/result` → `/quiz/:quizId/correction`;
   offline fallback grades client-side off `choices.is_correct` if the fn errors.
2. **`src/components/QuestionNavigator.tsx`** — "Voir toutes les questions" jump-anywhere number
   grid; marks answered questions.
3. **`src/pages/student/Shop.tsx`** — an *owned* `past_paper` whose `reference_id` points at a
   quiz now shows a **"Jouer/Play"** button → `/paper/:reference_id` (was just an "unlocked" pill).
4. **`scripts/parse_paper_docx.mjs`** — parses a paper `.docx` → JSON + `--emit-migration`.
   FR-only source, so **EN columns mirror FR** (platform is FR-first).
5. **`scripts/qcm_source/biologie_2015.json`** — 50 Q, validated exactly 1 correct/question,
   5 options each (A–E), FR explanations.
6. **`supabase/migrations/0017_seed_paper_biologie_2015.sql`** — relaxes `quizzes_target_check`
   to allow a **free-standing quiz** (both `lesson_id` and `mock_exam_id` null; keeps the
   mutual-exclusion guard), then seeds the quiz + questions + choices + a `past_paper` shop item
   pointing at it via `reference_id`. Idempotent (fixed quiz id + shop key).

### Verified
- `npx tsc --noEmit` ✅ and `npx vite build` ✅ (137 modules, clean; only the pre-existing
  >500 kB chunk-size warning).

### Still open
- **Migration 0017 NOT applied to live** — it alters the `quizzes_target_check` constraint;
  review + `supabase db push` when ready (needs a fresh `SUPABASE_ACCESS_TOKEN`).
- **Not browser-verified.** After applying 0017: buy "BIOLOGIE 2015" in the Boutique → "Jouer"
  → navigate/answer/finish → result + correction screens.

---

## 2026-08-22 — Ingest curated QCM from source docs + Niv display fix

### Trigger (user)
"Dans chaque chapitre il y a au moins 45 QCM. Mais je ne les vois pas (ni dans les quiz après
les leçons, ni dans les QCM Niveau 1/2/3)… il y a très peu de QCMs." → the real ~45-per-chapter
QCM live in Word/ODT files under **`C:\Users\AvenirTech\Desktop\lefax artifacts`**, not yet ingested.

### Diagnosis
- The questions built on 2026-08-21 were ~4–6 per lesson (≈12–31/chapter), never 45/chapter.
- Two display effects made it look emptier: the **post-lesson quiz** shows only that one lesson's
  questions; **Niv 1/2/3** filters by difficulty and runs 10-question rounds, so a thin tier (e.g.
  1 hard) looked empty.

### QCM source docs (in `lefax artifacts`)
`QCM DE CYTOLOGIE I.docx`, `QCM CYTO II.docx`, `QCM.docx`, `QCMs.docx`, `Sujet complet 2025.docx`,
`QCM BIOLOGIE 2015 ok.odt`, `QCM DIGESTIF.odt`, `QCM système digestif 2.odt`, `QCM.odt`, plus the
lesson docs. **Two answer-marking styles:**
- **Bold-marked correct option** (Set A) — only `QCM DE CYTOLOGIE I.docx` (332 bold runs). Fully,
  reliably parseable. Organised by NIVEAU 1/2/3 = easy/medium/hard.
- **Answer only implied by the "Explication"** (no bold, no key) — `QCM CYTO II.docx` (83 Q!),
  `QCM.docx`, genetics/metabolism docs. **Cannot be auto-extracted without guessing the correct
  option** → NOT ingested (won't inject unverified answers into an exam app).

### What was done
1. **Parser** `scripts/parse_qcm.mjs` — extracts Set A from a .docx: `QCM N:` prompt, A/B/C/D
   options (bold = correct), `Explication:`, difficulty from the nearest NIVEAU header. Prints
   stats; `--out` writes JSON.
2. **Parsed & committed** `scripts/qcm_source/cytologie_i.json` — **45 QCM, exactly 15 easy /
   15 medium / 15 hard**, all 4-option/1-correct; spot-checked answers vs explanations = accurate.
3. **Ingest** `scripts/ingest_qcm_docs.mjs` (`--check` / `--apply`) attaches a parsed bank to a
   target lesson's quiz (find-or-create), idempotent by `text_fr`, `ai_generated=false`. Source is
   FR-only so **EN columns mirror FR** (platform is FR-first). **APPLIED**: 45 → `cytologie-i /
   introduction-organisation`. `cytologie-i` now has **76 QCM (18/40/18)**.
4. **Niv display fix** `src/pages/student/ChapterPractice.tsx`: a level now prefers its difficulty
   tier, but if that tier has `< SESSION_SIZE (10)` it draws from the **whole chapter bank**, so no
   level is ever near-empty and every QCM is reachable (removed the old thirds-slice fallback +
   unused `slice` field). tsc ✅.

### Still open (the rest of the ≥45/chapter goal) — NEEDS A DECISION
Only `cytologie-i` is filled from source. The other chapters' QCM docs don't mark the answer, so to
ingest them (CYTO II = 83 Q → division-cellulaire; QCM.docx, genetics, digestive, etc.) I need to
**derive the correct option per question** — either (a) hand-verify each answer from its explanation
(accurate, heavy), or (b) an explanation-matching heuristic + a verification pass. Also need to map
each doc → chapter/holder-lesson (ODT parsing not built yet — ODT bold lives in named styles, not
inline). Ask the user which docs/chapters to prioritise and which method.

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

---

## 2026-09-27 — Teacher dashboard: subject-based access control + content governance

Full audit and rebuild of the teacher panel. Details in `docs/TEACHER_DASHBOARD.md`.

**Security (migration `0018_teacher_subjects_and_content_governance.sql` — NOT YET APPLIED):**
- new `teacher_subjects` grant table (super_admin only) + `teaches_subject()` /
  `lesson_is_teacher_editable()` helpers; teachers are scoped to assigned subjects.
- replaced the `lessons` / `quizzes` / `questions` / `choices` / `lesson_cards`
  `FOR ALL` policies (a teacher could `update lessons set published = true` and could
  write question banks directly, bypassing approval) with per-command policies plus
  `guard_lesson_teacher_fields` / `guard_content_approval_fields` triggers.
- `lessons.review_status` workflow (draft/submitted/under_review/approved/rejected)
  alongside the admin-only `published` flag; `chapters.created_by`; `content_approval.kind`.
- created the missing private `lesson-sources` bucket; scoped `lesson-media` writes to
  the lesson's owner; drafts no longer world-readable; assignment changes audited.

**Backend:** `teacher` fn gained `my_subjects` / `dashboard_summary` / `submit_lesson`;
`admin` fn gained `list_teachers` / `assign_subject` / `revoke_subject` / `set_role` /
`review_lesson` (the only path that sets `published`); `ai-content` gained subject
gating, source-text extraction, topic/level/objectives/type params and payload validation.

**Frontend:** teacher panel now Dashboard / Subjects / Content / AI / Question bank /
Performance / Notifications / Account, with sign-out. Lesson editor extracted to
`components/content/LessonEditorCore.tsx` and shared with the admin panel. KaTeX +
mhchem notation (`$…$`, `$$…$$`, `\ce{…}`) everywhere content renders, with an insert
palette and live preview. `[[IMG: caption | w=60 | align=right]]` layout options.
New super-admin page `/admin/teachers`; lesson review queue on `/admin/ai-review`.

**Verified:** `npm run build` (tsc + vite) green, `npx eslint .` 0 errors.
**Not verified:** the SQL has never been executed — no Postgres available here.

---

## 2026-09-28 — Dark mode applied app-wide; app shell no longer scrolls with the page

**Theme plumbing.** `profiles.dark_mode` was only applied by an effect inside the Profile
screen, so the choice was lost on every reload (light app until /profile was reopened) and
sign-out left the previous user's theme painted. Now:
- `src/lib/theme.ts` — `applyTheme()` / `readStoredTheme()`, the single place that writes
  `data-theme` on `<html>`, with a localStorage mirror (`lefax.theme`) used as a cache of the
  server value, never the source of truth.
- `src/components/ThemeSync.tsx` — mounted once in `main.tsx` inside `AuthProvider`, above the
  router; applies the profile value once auth resolves, resets to light on sign-out, and holds
  the pre-painted theme while auth is in flight (flipping mid-load is a visible flash).
- `main.tsx` pre-paints from localStorage before React mounts → no white flash for dark users.
- `Profile.tsx` keeps an `applyTheme()` call, now only as a live preview of the unsaved toggle.

**Dark palette completed.** The old `:root[data-theme="dark"]` block redefined only
surface/card/border/muted/text, but the app writes most colours with the `ink` scale
(`text-ink-900` alone is in 40+ files), which kept its light values — dark navy headings on a
dark card ("Biologie" / "La cellule" unreadable). `index.css` now inverts the whole ink ramp
(950…600 = progressively lighter text; 100/50 = dark elevated fills), lightens brand and the
status tints, maps the ~119 legacy `bg-white` call sites and the hardcoded `#eef3f9`/`#e2e8f0`
family to tokens, and themes `input`/`select`/`textarea`/`option`.

**Shell scroll fix.** The shell mixed `min-h-screen`/`100vh` with `100dvh`, and the initial
containing block is the *large* viewport regardless, so the document scrolled behind the shell
and carried TopBar + the absolutely-pinned BottomTabs with it (the "footer with Cours/Perfs
moves while I scroll" bug). All heights are `100dvh` now, and `PhoneFrame` sets
`data-app-shell` on `<html>` while `nav="app"` is mounted; `index.css` pins
`html`/`body` (`height:100%; overflow:hidden; overscroll-behavior:none`) behind that attribute.
Deliberately **not** set for `nav="auth"`/`"focus"` — those centre a fixed 860px card that a
short desktop window genuinely needs to scroll to — nor for the landing page / admin, which
scroll the document normally.

**Verified:** `npm run build` green, `npx eslint .` 0 errors (23 pre-existing react-refresh
warnings). **Not verified:** no browser run here — the dark palette and the scroll lock have
not been eyeballed on a real device.

### Files touched
- add `src/lib/theme.ts`, `src/components/ThemeSync.tsx`
- edit `src/index.css`, `src/main.tsx`, `src/components/PhoneFrame.tsx`,
  `src/pages/student/Profile.tsx`

---

## 2026-09-28 — Feedback round N5: audit page, settings centre, card editor, dark mode

Source: `feed backs.docx` (9 screenshots from `le-fax.vercel.app`, mobile, 20:28–20:31).
Five complaints, decoded below with the root cause found for each.

### 1. "the audit should be fixed" — `src/pages/admin/Logs.tsx`
The screenshot showed **"Une erreur est survenue"**. The page ran
`const { data } = await supabase.from("admin_logs")…`, discarded `error`, and rendered
`t("common_error")` on the *empty* branch — so "no activity yet", "request failed" and
"RLS refused you" were one message, and the likeliest of the three was reported as a crash.
The backend was never broken: `admin_logs` exists (`0001_init.sql:344`), `admin_logs_read`
is `using (public.is_admin())` (`0001:617`), and five server-side writers feed it.

Rewritten: `StateNotice` separates empty / filtered-empty / failed, a 42501 or PGRST301 is
named as a permission problem, actor names are resolved from `profiles` (second query, not a
PostgREST embed — the hand-written `Database` types carry no relationship metadata), plus
search, action/table/date filters, server-side pagination (`range` + exact count), locale
timestamps, expandable `metadata`, a desktop table and a mobile card list. Read-only by
construction: no policy grants update or delete on `admin_logs` to anyone.

### 2. "settings … too minimalist" — `src/pages/admin/Settings.tsx` (was 60 lines)
Was a flat dump of `settings` rows as raw-JSON inputs, with the same `common_error`-as-empty
bug. Now four tabs:
- **General** — the same key/value store, typed: known keys get text / number / boolean /
  language widgets and are validated before the write; unknown keys keep a JSON editor so a
  key added server-side stays editable. Writes `.select()` and report an RLS 0-row result as
  refused instead of confirming a save that did not happen.
- **Year and terms** — new `academic_terms` table, see below.
- **My profile** — first/last name through `profiles_update_own`; `phone` (the login
  identifier) and `role` are read-only, since `0003_guard_role_column` refuses self-escalation.
- **Account and security** — session facts, sign-out with confirmation, and a password change
  through `functions/profile` `change_password` (it touches `auth.users` and writes an audit row).

### 3. Admin header title — `src/pages/admin/AdminLayout.tsx`
Hardcoded `t("admin_overview")`, so every admin page was titled "Vue d'ensemble" — visible in
two feedback screenshots while the user was on Paramètres and on the Journal d'audit. Now
derived from the route (longest match wins, so `/admin/lesson/:id` still reads "Contenus").

### 4. "footer … going up and down" — fixed in `1930c83` (previous round)
The shell mixed `min-h-screen`/`100vh` with `100dvh` and the initial containing block is the
large viewport either way, so the *document* scrolled behind the shell and carried TopBar and
the pinned BottomTabs with it. All heights are `100dvh`; `PhoneFrame` pins the document with
`data-app-shell` on `<html>` while `nav="app"` is mounted.

### 5. "this dark mode is nonsense" — palette completed
`1930c83` inverted the `ink` ramp (the cause of "Biology"/"The Cell" rendering dark navy on a
dark card). This round finishes it: the admin shell (`bg-surface`, `bg-card`, `currentColor`
hamburger), the permanently-dark admin rail whose labels were `text-ink-100/80` — a near-white
tint in light mode but a *dark fill* in dark mode, i.e. the same dark-on-dark defect — now
`text-white/75`; table header bands; and the remaining hardcoded literals
(`#f8fafc`, `#dde4ec`, `#c3cbd6`, `#94a3b8`, `#fff8e5`).

**Contrast, measured.** `scripts/check_contrast.mjs` (new) audits every token pair straight out
of `index.css`. Dark: **22/22 pass** WCAG AA. Two fixes it forced:
- light `--color-muted` #94a3b8 → **#5d6b80** (was 2.56:1 on a card and 2.30:1 on the page —
  under AA for the hint text it carries; now 5.41 / 4.85);
- dark primary-button surface: one token cannot be both the accent *text* colour (wants to be
  light on a dark card) and the button *surface* (wants to carry white text), so
  `.bg-brand-600` is overridden to `#1668c9` in dark only — white on it is 5.44:1, while
  `text-brand-600` stays the light accent at 6.49:1.

**Known light-mode failures, left alone on purpose** (they are the LeFax identity, which this
round was explicitly told to preserve): white on `brand-600` 2.97:1, `text-brand-600` as body
text 2.97:1, `brand-700` 4.14:1, `success-700` 3.30:1, and the near-white `border` token.
Raising any of them repaints every button in the app — worth doing, but as a decision, not a
side effect.

### 6. "the first design of lefax … I wanted to keep it" — `LessonCardsPanel.tsx`
The reference screenshot is the original card editor: a numbered card rail on the left, one
card's fields in the middle, a live phone preview on the right. The current build stacked every
card's full form vertically, losing both the deck overview and the student's-eye view. Layout
restored (rail / editor / preview, stacking below `xl`, preview at `xl` and up). Presentation
only — create, reorder, delete, per-card save, the dirty-tracking imperative handle and the
dual-language image uploads are untouched.

### Backend — migration `0020_academic_terms.sql` (NOT YET APPLIED)
No table in `0001`..`0019` models a school year or a term, so "changing term" could not be one
more untyped `settings` row. New `academic_terms`: one row per term grouped by
`academic_year`; **at most one active term, enforced by a partial unique index**, not by
application code; archive (`archived_at`) instead of delete — there is deliberately no delete
policy; `set_active_academic_term()` does the swap in one transaction (two client writes would
trip the index); an `academic_terms_audit` trigger mirrors every write into `admin_logs`, so
term changes show up in the journal without the UI having to remember; RLS = read for any
authenticated user, write for `is_admin()`. Also seeds `platform_name`, `default_language`,
`support_phone` into `settings` (`on conflict do nothing`).

Live-schema probe (REST, read-only): `teacher_subjects` → 200, so **0018 IS applied in
production** (the previous entry's "NOT YET APPLIED" note is stale). `academic_terms` → 404,
so **0020 still needs to be run**; until it is, the Settings → Terms tab will show the real
Postgres error rather than a term list.

### Verified / not verified
- `npx tsc --noEmit` clean; `npm run build` green; `npx eslint .` 0 errors (23 pre-existing
  react-refresh warnings, unchanged count).
- `node scripts/check_contrast.mjs` — dark theme fully AA; light failures listed above.
- **Not verified in a browser.** The Claude-in-Chrome extension was not connected in this
  session, so no screen was visually confirmed and no interaction (tab switching, term
  creation, audit filtering) was exercised against real data.

### Files touched
- add `supabase/migrations/0020_academic_terms.sql`, `scripts/check_contrast.mjs`
- rewrite `src/pages/admin/Logs.tsx`, `src/pages/admin/Settings.tsx`
- edit `src/pages/admin/AdminLayout.tsx`, `src/components/content/LessonCardsPanel.tsx`,
  `src/index.css`, `src/lib/i18n.tsx`, `src/lib/database.types.ts`
