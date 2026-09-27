# Teacher dashboard — functional & non-functional specification

Status: implemented on branch work of 2026-09-27. Database migration
`0018_teacher_subjects_and_content_governance.sql` **has not been applied to any
environment yet** — see [Deployment](#deployment). Everything below describes
code that exists in the repo; anything not implemented is called out explicitly
under [Gaps and limitations](#gaps-and-limitations).

---

## 1. Route tree

| Route | Component | Who |
| --- | --- | --- |
| `/teacher` → `dashboard` | `pages/teacher/TeacherLayout.tsx` | `teacher`, `admin`, `super_admin` |
| `/teacher/dashboard` | `TeacherDashboard.tsx` | own work overview |
| `/teacher/subjects` | `TeacherSubjects.tsx` | assigned-subject workspaces |
| `/teacher/content` | `TeacherContent.tsx` | chapter/lesson tree, one subject at a time |
| `/teacher/content/lesson/:lessonId` | `TeacherLessonEditor.tsx` | lesson editor + submit |
| `/teacher/ai-assist` | `TeacherAiAssist.tsx` | generation + MCQ review desk |
| `/teacher/question-bank` | `TeacherQuestionBank.tsx` | quizzes/questions per lesson |
| `/teacher/performance` | `TeacherPerformance.tsx` | attempts/averages on own content |
| `/teacher/notifications` | `TeacherNotifications.tsx` | approvals, feedback, assignments |
| `/teacher/account` | `TeacherAccount.tsx` | profile, subjects, language, sign-out |

Admin side added for this work:

| Route | Component | Who |
| --- | --- | --- |
| `/admin/teachers` | `pages/admin/Teachers.tsx` | read: any admin · write: `super_admin` |
| `/admin/ai-review` | `pages/admin/AiReview.tsx` + `LessonReviewQueue.tsx` | lesson verdicts + AI question queue |

Route guard: `components/ProtectedRoute.tsx` (`roles` list per route, redirect via
`homeForRole`). It is a convenience only — authorization is enforced in the
database and in the Edge Functions.

## 2. Permission model

`super_admin` and `admin` have unrestricted content access across every subject
and every teacher's work. The teacher role is bounded by explicit grants.

| Action | super_admin | admin | assigned teacher |
| --- | --- | --- | --- |
| Assign / revoke a subject | ✅ | ❌ | ❌ |
| Change a user's role | ✅ | ❌ | ❌ |
| Suspend / reactivate an account | ✅ | ✅ (not admins) | ❌ |
| Create a chapter | ✅ | ✅ | ✅ in assigned subjects |
| Rename / delete a chapter | ✅ | ✅ | only ones they created, holding only their own untouched drafts |
| Create a lesson | ✅ | ✅ | ✅ in assigned subjects (always a draft) |
| Edit own draft / returned lesson | ✅ | ✅ | ✅ |
| Edit a submitted / approved / published lesson | ✅ | ✅ | ❌ |
| Edit another teacher's lesson | ✅ | ✅ | ❌ |
| Create / edit quizzes, questions, choices, story cards | ✅ | ✅ | only inside their own still-editable draft lesson |
| Upload lesson illustrations | ✅ | ✅ | only for their own editable lessons |
| Upload AI source documents | ✅ | ✅ | only under `teacher/<own uid>/` |
| Generate with AI | ✅ | ✅ | only against their own lesson in an assigned subject |
| Review / edit / accept / reject generated MCQs | ✅ | ✅ | ✅ (their own generation) |
| Submit content for approval | ✅ | ✅ | ✅ |
| Approve / reject a submission | ✅ | ✅ | ❌ |
| Publish / unpublish | ✅ | ✅ | ❌ (FR-10) |
| Delete approved or published content | ✅ | ✅ | ❌ |
| See platform-wide performance | ✅ | ✅ | ❌ |
| See own content's performance | ✅ | ✅ | ✅ |

## 3. Subject assignment model

`public.teacher_subjects` (migration 0018):

| Column | Meaning |
| --- | --- |
| `teacher_id` → `profiles.id` | who |
| `subject_id` → `subjects.id` | what they may author |
| `assigned_by` → `profiles.id` | which super_admin granted it |
| `status` | `active` \| `revoked` |
| `created_at` / `updated_at` / `revoked_at` | when |

`unique (teacher_id, subject_id)`: re-granting flips an existing row back to
`active` instead of accumulating rows. Indexed on `(teacher_id, status)` and
`(subject_id, status)`.

A teacher may hold any number of grants (one or two initially, as specified;
nothing in the model caps it). `status = 'revoked'` keeps the history and the
teacher's existing content, but immediately removes their write access.

Every insert/update/delete writes an `admin_logs` row through the
`teacher_subjects_audit` trigger — including grants made directly in SQL.

Authorization helpers (all `security definer`, so they are callable from RLS):
`is_super_admin()`, `teaches_subject(subject)`, `subject_of_chapter(chapter)`,
`subject_of_lesson(lesson)`, `lesson_is_teacher_editable(lesson)`.

## 4. Functional actions — action → code path → data written

### Dashboard
| Action | Code path | Data |
| --- | --- | --- |
| See assigned-subject count, lesson counts by review state, published count, quizzes, questions, pending MCQs, pending tasks, recent activity | `useTeacherSummary()` → `functions/teacher` `dashboard_summary` | read-only |
| No grant yet | same | renders the "no subject assigned" explainer instead of zeroes |

### My subjects
| Action | Code path | Data |
| --- | --- | --- |
| List workspaces with per-subject draft/submitted/approved/rejected counts and grant date | `useMySubjects()` → `functions/teacher` `my_subjects` | read-only |
| Open a subject's content or question bank | `Link` → `/teacher/content?subject=…` | — |

### My content
| Action | Code path | Data |
| --- | --- | --- |
| Switch subject | `?subject=` search param, options from `my_subjects` | — |
| Add chapter | `TeacherContent.addChapter` | `insert chapters` (`created_by = self`) |
| Rename own chapter | `saveChapterName` | `update chapters.name_fr\|name_en` |
| Delete own empty chapter | `deleteChapter` | `delete chapters` (RLS refuses if it holds non-draft lessons) |
| Add lesson | `addLesson` | `insert lessons` (`author_id = self`, `published = false`, `review_status = 'draft'`) |
| Reorder lessons | `moveLesson` | two `update lessons.position` |
| Delete own draft | `deleteLesson` | `delete lessons` |
| Submit for review | `submitLessonForReview()` → `functions/teacher` `submit_lesson` | `lessons.review_status = 'submitted'`, `submitted_at`, `insert content_approval (kind='lesson')`, `insert admin_logs`, `insert notifications` for every admin |
| Read reviewer feedback | rendered from `lessons.review_feedback` | read-only |

### Lesson editor (shared with the admin panel — `components/content/LessonEditorCore.tsx`)
| Action | Code path | Data |
| --- | --- | --- |
| Edit bilingual title, body, objectives, summary, key points | `LessonEditorCore.save` | `update lessons` (+ `LessonCardsPanel.saveAll`) |
| Insert an image placeholder at the caret | `insertSnippet` / `applyInsert` | text only |
| Upload / replace / remove an illustration per placeholder slot | `uploadForSlot` / `removeSlot` | Storage `lesson-media/<lessonId>/<slot>` + `media_library` upsert on `(lesson_id, image_slot)` |
| Insert maths / chemistry with live preview | `components/FormulaTool.tsx` | text only |
| Preview as a student sees it | `LessonContent` (the real reader renderer) | read-only |
| Edit story cards | `LessonCardsPanel` | `lesson_cards` |
| Edit the quiz | `LessonQuizPanel` | `quizzes` / `questions` / `choices` |
| Submit for review | `TeacherReviewBar` | as above |
| Publish | **not available to teachers** | — |

Every write in the editor uses `.select("id")` and treats a zero-row result as a
permission failure, so the UI never claims a save that RLS silently dropped.

### AI assistant + MCQ review
| Action | Code path | Data |
| --- | --- | --- |
| Pick an editable own lesson, attach a source document, state topic / level / objectives / type / count | `TeacherAiAssist` | Storage `lesson-sources/teacher/<uid>/…` + `media_library` row |
| Generate | `functions/ai-content` `generate` (Claude) | nothing persisted |
| Edit a generated question, both languages, explanation, difficulty | local draft state | — |
| Change the correct option, add / remove options | local draft state | — |
| Accept / reject / restore per item, or accept all | local draft state | — |
| Submit the accepted items | `insert content_approval` (`kind='mcq'`, `status='pending'`) | queue rows only |
| Admin approves | `functions/ai-content` `approve` | `insert questions` + `choices`, `content_approval.status='approved'`, `admin_logs`, notification to the author |

Content types: `mcq`, `true_false`, `short_answer`, `lesson`, `summary`. Generated
material is labelled "AI draft" throughout and is validated (≥2 options, exactly
one correct, non-empty French text) both in the UI before submitting and again on
the server before it becomes a real question.

### Question bank
| Action | Code path | Data |
| --- | --- | --- |
| List own quizzes per subject with question counts | `TeacherQuestionBank` | read-only |
| Edit questions inline | shared `LessonQuizPanel` | `questions` / `choices` |
| Locked bank on submitted/approved lessons | `isTeacherEditable` + RLS | — |

### Performance
`useTeacherPerformance()` → `functions/teacher` `performance_summary`: attempts,
average, best and lowest score per quiz over lessons the caller authored in their
assigned subjects, plus roll-ups. A failed request and an empty result render
differently (`components/StateNotice.tsx`).

### Notifications & account
Notifications read the caller's own `notifications` rows (types
`content_submitted`, `content_approved`, `content_rejected`, `subject_assigned`
were added to the table's CHECK constraint in 0018) and can be marked read.
Account shows profile, read-only subject grants, the FR/EN switch, and sign-out.

### Super-admin teacher management (`/admin/teachers`)
List all teachers/admins with search (name, phone, role), subject filter and
status filter; each row shows assignments with grant dates, revoked history, a
content footprint (lessons, drafts, submitted, approved, published) and pending
MCQ count. Super-admin actions: assign a subject, revoke a subject, promote/demote
the teacher role, suspend/reactivate the account. All via `functions/admin`
(`list_teachers`, `assign_subject`, `revoke_subject`, `set_role`,
`set_student_status`).

## 5. Rich content: markup, maths, chemistry, images

Lesson bodies stay in the project's existing line-based mini-markup
(`src/lib/lessonContent.tsx`) rather than switching to an HTML rich-text editor.
Reasons: two large seed migrations (`0007`, `0012`, `0015`, `0016`) and the story-card
renderer already store and render this format, the student reader and the card
deck share the same parser, and it round-trips through the AI pipeline as plain
text. Swapping in a WYSIWYG document model would have required migrating all
existing content and rewriting the reader.

Supported constructs:

```
## Heading              ### Sub-heading            - bullet
[!PIEGE] exam trap      [!INFO] note               [!APP] prompt ||| answer
**bold** *italic* ==highlight== __underline__
[[IMG: caption]]        [[IMG: caption | w=60 | align=right]]
$\frac{a}{b}$           $$ … $$                    \ce{2H2 + O2 -> 2H2O}
```

**Maths and chemistry** (`src/lib/math.tsx`) render through KaTeX 0.18 with the
mhchem extension:

* inline `$…$`, display `$$…$$` (single line or a `$$` fence over several lines);
* `\ce{…}` / `\pu{…}` for formulas, ionic charges (`\ce{SO4^2-}`), reaction and
  reversible arrows, coefficients, states of matter, units;
* limits, infinity, integrals, sums, fractions, roots, exponents, subscripts,
  derivatives and partials, matrices, vectors, piecewise functions, absolute
  value, Greek letters — the insert palette ships a template for each;
* notation is extracted **before** the bold/italic pass, so `$x_1$` is not eaten
  by the `_italic_` rule;
* rendering is `output: "htmlAndMathml"`, so every expression carries a MathML
  tree for screen readers; `trust: false` is what makes the single
  `dangerouslySetInnerHTML` safe — author text never reaches the DOM as HTML,
  only KaTeX's own generated markup does;
* the insert tool (`components/FormulaTool.tsx`) offers a palette, a LaTeX field,
  a live typeset preview and a validity message, and is wired into the lesson
  body fields, the question/explanation fields and the AI review desk.

**Images** keep the `[[IMG: …]]` placeholder as the storage format — it is a
durable, per-slot reference, not a temporary object URL: the actual file lives in
the public `lesson-media` Storage bucket at `<lessonId>/<slot>` with a
`media_library` row keyed `(lesson_id, image_slot)`, so images persist across
saves and reloads and render for students. The editor adds upload / replace /
remove per placeholder with a thumbnail, a cache-busted URL on replace,
`image/*`-only validation, and optional `w=` / `align=` layout hints.

## 6. Approval and publication workflow

```
draft ──submit──▶ submitted ──▶ under_review ──▶ approved ──publish──▶ published
  ▲                                   │
  └────────── rejected ◀──────────────┘   (with feedback, editable again)
```

* `lessons.review_status` carries the workflow; `lessons.published` stays the
  separate student-visibility switch. A lesson can be approved but held back.
* The only transition a teacher can drive is `draft|rejected → submitted`
  (`functions/teacher` `submit_lesson`, which also validates that the lesson has
  a French title and body).
* Verdicts and publication run through `functions/admin` `review_lesson`, which
  is the only code that sets `published`. It writes `admin_logs` and notifies the
  author.
* AI questions have their own queue (`content_approval`, `kind='mcq'`) and become
  real questions only via `functions/ai-content` `approve`.
* A submitted or approved lesson is read-only to its author — including its story
  cards, quiz and illustrations.

## 7. Security model

Four independent layers, in order of authority:

1. **Database triggers** (column-level rules RLS cannot express):
   `guard_lesson_teacher_fields` pins `published`, `author_id`, reviewer fields
   and legal `review_status` transitions for any non-admin caller;
   `guard_content_approval_fields` stops a teacher rewriting their own verdict;
   `prevent_role_self_escalation` (0003) still guards `profiles.role`. All are
   no-ops when `auth.uid()` is null, so migrations, Studio SQL and service-role
   Edge Functions keep working.
2. **RLS policies**, per command rather than `FOR ALL`, scoped to
   "assigned subject AND my row AND still editable" for `lessons`, `chapters`,
   `quizzes`, `questions`, `choices`, `lesson_cards`, `media_library`,
   `teacher_subjects`, plus path-scoped Storage policies for `lesson-media` and
   `lesson-sources`.
3. **Edge Functions**, which re-read the caller's role *and* grants with the
   service client and never trust the request body (`teacher`, `admin`,
   `ai-content`).
4. **Route guards and disabled UI**, which are convenience only.

Also: drafts are no longer world-readable (`lessons_read` now requires
`published = true`, own authorship, or admin); source documents live in a
**private** bucket readable only by their uploader and admins; teacher actions on
assignments, submissions, verdicts and AI approvals are all written to
`admin_logs`, which teachers cannot read or write.

## 8. Non-functional characteristics

**Performance.** The dashboard, subject list and performance view are each one
server-side aggregate instead of N client round-trips. New indexes:
`teacher_subjects(teacher_id, status)`, `teacher_subjects(subject_id, status)`,
`lessons(review_status)`, `chapters(created_by)`,
`content_approval(status, created_at)`, `content_approval(submitted_by, status)`.
The content tree loads lessons per expanded chapter, not all at once.
Known cost: bundling KaTeX takes the main JS chunk from ~700 kB to ~997 kB
(276 kB gzipped) and adds the KaTeX web fonts; the bundle is not yet code-split.

**Reliability.** Every mutation checks for the zero-row RLS refusal and reports
`admin_saveBlocked` rather than a false success. Loading, empty, error and
"backend not configured" are four distinct states (`StateNotice`). Destructive
actions confirm first. Submitting confirms, because it locks the lesson.

**Accessibility.** Real `<label>` elements on every new field (the old teacher
forms were placeholder-only), `aria-label` on icon-only buttons, `role="status"` /
`aria-live="polite"` on flash messages and the formula preview, `role="alert"` on
errors, `fieldset[disabled]` for read-only states, and MathML for every equation.

**Responsiveness.** Off-canvas sidebar with overlay below `lg`, `flex-wrap` rows
throughout the tree and review cards, `repeat(auto-fit, minmax(...))` stat grids,
horizontally scrollable display equations.

**Internationalisation.** Every new string is an i18n key in both FR and EN
(`teacher_*`, `status_*`, `td_*`, `ts_*`, `tc_*`, `te_*`, `fx_*`, `ta_*`, `tp_*`,
`tn_*`, `at_*`, `ar_*`); the type of `DictKey` is `keyof dict.fr`, so a missing
English key is a compile error. Content itself is authored bilingually with FR
fallback.

**Maintainability.** The lesson editor, story cards, question bank, review status
pill, formula tool and state notice are single shared implementations used by both
the admin and teacher panels — `pages/admin/LessonEditor.tsx` and
`pages/teacher/TeacherLessonEditor.tsx` are thin role-specific wrappers over
`components/content/LessonEditorCore.tsx`. Client data access for the teacher
panel is centralised in `src/lib/teacher.ts`.

## 9. Defects found in the audit and their status

| # | Defect | Status |
| --- | --- | --- |
| 1 | `lesson-sources` Storage bucket referenced by the AI tab but never created — every upload threw and surfaced as a generic banner | **Fixed** — private bucket + owner/admin policies in 0018; upload errors now surface the real message |
| 2 | `lessons_write_teacher_own` was one `FOR ALL` policy on `author_id`, so a teacher could set `published = true` via the API, and could write `questions`/`choices` directly, bypassing approval | **Fixed** — per-command policies + `guard_lesson_teacher_fields`; question-bank writes require an editable own draft |
| 3 | No sign-out anywhere in the teacher shell | **Fixed** — sidebar footer and Account page |
| 4 | `TeacherPerformance` rendered the same i18n key on both ternary branches, so "failed" looked like "empty" | **Fixed** — `StateNotice`, used across the teacher panel |
| 5 | `teacher_reviewQueue` was an orphan i18n string | **Resolved** — the review desk is now real (`ai-assist` for the teacher's own generated MCQs; `/admin/ai-review` for verdicts). The orphan key is still present in `i18n.tsx` and unused |
| — | Any teacher could write any object in `lesson-media` (`is_teacher()` alone) | **Fixed** — path-derived lesson ownership check |
| — | Draft lessons were readable by any authenticated user | **Fixed** — `lessons_read` tightened |
| — | AI `generate` ignored the uploaded file's bytes entirely | **Partly fixed** — text formats are now read and used; PDF/Word/slides are reported honestly instead of silently falling back |

## 10. Gaps and limitations

* **Migration 0018 is unapplied and unexecuted.** No Postgres instance was
  available in this environment, so the SQL has been reviewed but never run. It
  must be applied to a staging project first — see below.
* **No automated tests.** The repo has no test runner or test script, and none
  was added; nothing here is covered by an automated test. The security
  boundaries are enforced by RLS/triggers, which can only be verified against a
  live database.
* **PDF / Word / slides source documents are still not parsed.** `generate` reads
  text formats (`.txt`, `.md`, `.csv`, `.json`, `.html`) and otherwise reports
  `unsupported_source_format` and falls back to the lesson body. A server-side
  parser is the remaining work.
* **Multiple-select questions are not supported.** `choices.is_correct` plus the
  student runner assume exactly one correct answer; adding multi-select means a
  schema and runner change on the student side. `true_false` and `short_answer`
  are generated but stored in the same single-correct shape.
* **Historical performance trends and per-chapter completion are not shown** —
  `quiz_attempts` has no periodisation and there is no aggregate for it yet.
* **`questions` / `choices` / `lesson_cards` remain readable by any authenticated
  user.** Tightening reads would have to special-case past-paper and mock-exam
  quizzes (`lesson_id is null`, see `0017`) and adds a per-row subquery to every
  student read; deliberately left alone. Draft question text never surfaces in
  the student UI, but a crafted API call could read it.
* **Chapter reordering is admin-only for seeded chapters** (a teacher can reorder
  their lessons, and rename/delete only chapters they created).
* **Autosave is not implemented** — saving is explicit, with an unsaved-cards
  warning on navigation.
* **The main JS bundle is ~997 kB** and not code-split.
* **Teacher activity history** on `/admin/teachers` shows counts and grant dates,
  not a per-action timeline; the raw events are in `admin_logs` at `/admin/logs`.

## 11. Coverage against CDC 6.10 / specification v2.0

* CDC 6.10 "Enseignant: dépôt contenu" — chapters, lessons, story cards,
  question banks, images, maths/chemistry, AI assistance. ✅
* CDC 6.10 "suivi performance" — per-quiz attempts and averages over own
  content. ✅ (trends outstanding)
* CDC 6.8 "aucun contenu généré n'est publié sans relecture… puis admin" —
  teacher review desk, then admin approval, as the only path into the live
  question bank. ✅
* FR-10 "Teacher drafts → Admin reviews/approves/rejects with feedback → only
  Admin can publish; teacher can never self-publish" — now enforced by RLS, a
  trigger and the server, not just by the UI. ✅
* CDC 6.9 "journal d'audit" — assignments, submissions, verdicts, publication and
  AI approvals are logged. ✅

## Deployment

1. Review `supabase/migrations/0018_teacher_subjects_and_content_governance.sql`.
2. Apply it to a **staging** project first: `supabase db push` (or paste it into
   the SQL editor). It is idempotent (`if not exists`, `drop policy if exists`,
   guarded `do` blocks) and backfills `review_status = 'approved'` for everything
   already published.
3. Verify the storage buckets exist: `lesson-media` (public) and `lesson-sources`
   (private).
4. Redeploy the Edge Functions whose behaviour changed:
   `supabase functions deploy teacher admin ai-content`.
5. Set `ANTHROPIC_API_KEY` as an Edge Function secret for AI generation.
6. Grant each teacher their subjects at `/admin/teachers` as a `super_admin`
   (until then a teacher sees the "no subject assigned" state and can author
   nothing — this is the intended default).
7. Deploy the frontend (`npm run build`).
