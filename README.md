# Lefax Course

Bilingual (FR/EN) exam-prep platform for Cameroonian grande-école entrance
exams. This repository is the **MVP scaffold** for the Médecine track, built
from the "Cahier des Charges — MVP" (v1.0, 2026-07-20).

This is a **Sprint-0-style foundation scaffold**: the structure, schema, RLS,
UI, client-side logic and Edge Function code are real and reviewed against
the CDC. It is **not yet wired to live infrastructure** — no Supabase
project, SMS provider, or Anthropic key is configured. See
["What's next"](#whats-next-before-this-is-end-to-end-functional) below.

## Stack (per CDC section 8)

- **Frontend**: React + Vite + TypeScript + Tailwind CSS, React Router
- **Backend/API**: Supabase Edge Functions (Deno) — no custom Node/Fastify server
- **Database**: Supabase PostgreSQL + pgvector, Row Level Security
- **Auth**: Supabase Auth (phone + OTP)
- **Storage**: Supabase Storage
- **AI (QCM generation)**: Anthropic Claude API — paid, not connected yet
- **SMS OTP**: a commercial provider (Twilio shown as reference) — paid, not connected yet

Out of scope for this pass (explicitly, per the CDC and the scaffolding
brief): GitHub Actions/CI, Vercel/Netlify deploy config, Sentry,
UptimeRobot, Web Push VAPID delivery, native mobile app, payments.

## Project layout

```
src/
  lib/            supabaseClient, auth context, i18n (FR/EN), icons, regions, database types
  components/     shared UI primitives (PhoneFrame, BottomTabs, Card/Button/ProgressBar, etc.)
  pages/student/  the mobile-first student app (17 screens)
  pages/admin/    admin back-office (CDC 6.9)
  pages/teacher/  teacher panel (CDC 6.10)
supabase/
  migrations/0001_init.sql   full schema + RLS for every entity in CDC section 9
  seed.sql                   reference seed data (6 Medicine subjects, sample chapters/lessons/quiz)
  functions/<domain>/        one Edge Function per CDC section 10 API domain
  config.toml                Supabase CLI project config
.env.example      every required env var, documented
```

## What's fully scaffolded

- **Data model (CDC section 9)** — every listed entity plus a few
  well-justified additions to make the model coherent (`quiz_attempts` to
  group `student_answers` into a scored sitting, `shop_items`/`shop_unlocks`
  for the FaxCoins shop, `badges`/`user_badges`, `role_permissions`). RLS
  policies enforce: students only ever see their own `profiles`,
  `lesson_progress`, `student_answers`, `faxcoins_transactions`,
  `notifications`; teachers can manage/see performance on lessons they
  authored; admins/super-admins have broad access; a `rankings` table is
  **intentionally denormalized** (display name + town) so the public
  leaderboard never has to read another student's private `profiles` row.
- **Every route in the spec** (`/`, `/login`, `/register`, `/track`,
  `/dashboard`, `/subjects/:id`, `/lessons/:id`, `/lesson/:id`, `/quiz/:id`
  (+`/result`, `/correction`), `/mock-exam` (+`/:id/result`), `/shop`,
  `/tasks`, `/leaderboard`, `/profile`, `/notifications`, `/search`,
  `/admin/*`, `/teacher/*`) with real React Router URLs, guarded by role.
- **Visual/UX system**, ported 1:1 from the Claude Design reference
  (`Lefax Course.dc.html` / `Lefax Course Admin.dc.html`): oklch color
  tokens (deep ink blue dominant, chalkboard green for success, ochre for
  merit/FaxCoins, red reserved for errors), Newsreader/Public Sans fonts,
  hand-ported SVG icon set (no emoji), phone-frame mobile presentation for
  the student app, full-width sidebar shell for admin/teacher. The 3
  CDC-required subjects the design didn't mock (Mathématiques, Français,
  Culture générale) use the same visual language, not a bolted-on one.
- **12 Edge Functions**, one per CDC section 10 API domain
  (`auth-otp`, `courses`, `quiz-submit`, `faxcoins`, `mock-exams`,
  `daily-tasks`, `ai-content`, `admin`, `teacher`, `notifications`,
  `search`, `rankings`, `profile`). Business logic that needs no external
  secret is **fully implemented**: quiz scoring, FaxCoins ledger math
  (earn/spend/balance), chapter-completion bonuses, daily-task reward caps,
  mock-exam national/regional rank computation, weekly ranking aggregation,
  CSV export, audit logging. The two genuinely paid/external integrations
  (SMS send/verify in `auth-otp`, the Anthropic call in `ai-content`) have
  the real request shape written but will return a clear error/fallback
  until real credentials are supplied.
- **Bilingual FR/EN** throughout (`src/lib/i18n.tsx`), dark mode toggle
  (`prefers-color-scheme` + manual override), phone/region/town data for
  Cameroon.

## What's stubbed / needs your input

- **No live Supabase project is linked.** `src/lib/supabaseClient.ts` reads
  `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` from the environment; until
  those are set, every Supabase call fails over the network. The UI handles
  this gracefully — a small banner ("Backend not configured yet") appears
  instead of crashing, and screens show empty/error states rather than fake
  data. **This means no real data flow could be verified in this pass.**
- **SMS OTP delivery** — `SMS_PROVIDER` / `SMS_PROVIDER_API_KEY` are unset.
  Registration currently calls Supabase Auth's native phone+OTP flow
  directly (works out of the box once a provider is configured in the
  Supabase dashboard's Auth settings); `auth-otp`'s Twilio Verify code path
  is a reference implementation for if/when you move off Supabase's
  built-in provider.
- **AI QCM generation** — `ANTHROPIC_API_KEY` is unset. `ai-content`'s
  `generate` action returns a clear 503 until a key is provided; `approve`
  (the human-gate publish step) works once there's data in
  `content_approval` to approve.
- **Document text extraction** (PDF/Word/slides → text) for the AI pipeline
  is a TODO in `ai-content` — it currently falls back to the lesson's own
  stored text.
- **Web Push (VAPID)** — notifications are in-app only for now; push
  delivery is a documented TODO in the `notifications` function.

## What's next (before this is end-to-end functional)

1. **Create a Supabase project** at supabase.com, then:
   ```
   supabase link --project-ref <your-project-ref>
   supabase db push          # applies supabase/migrations/0001_init.sql
   supabase db execute -f supabase/seed.sql   # optional reference seed data
   ```
2. Copy `.env.example` to `.env.local`, fill in `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY` from the project's API settings.
3. Set Edge Function secrets (never in a frontend `.env`):
   ```
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... ANTHROPIC_API_KEY=... \
     SMS_PROVIDER=twilio SMS_PROVIDER_API_KEY=... TWILIO_ACCOUNT_SID=... TWILIO_VERIFY_SERVICE_SID=...
   supabase functions deploy
   ```
4. **Choose and configure an SMS/OTP provider** in the Supabase dashboard's
   Auth → Phone settings (or wire up the Twilio path in `auth-otp` if going
   custom).
5. **Get an Anthropic API key** (console.anthropic.com) for AI QCM
   generation.
6. Only after the above: the 4 founding hypotheses (micro-learning
   engagement, FaxCoins gamification, weekly mock exams, engagement-for-
   premium-access trade) become testable with real users, and the
   remaining 10-sprint feature set (full push notifications, real AI
   content pipeline, CI/CD, monitoring — see CDC sections 12-19) is
   follow-on work.

## Local development

```
npm install
npm run dev        # Vite dev server on http://localhost:5173
npx tsc --noEmit    # typecheck the frontend (Edge Functions are Deno —
                    # typecheck those separately with `deno check` once the
                    # Deno CLI is available; not installed in this environment)
```

Without a linked Supabase project, the app still boots and every route
renders (guards fall through to "scaffold mode" instead of an unreachable
login wall) — you'll see the "Backend not configured" banner and empty
states instead of real data.
