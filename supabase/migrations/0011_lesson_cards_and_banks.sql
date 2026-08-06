-- 0011: Lesson story-cards + question banks (no-repeat shuffle).
--
-- Three additions, all backward-compatible (legacy lessons with no cards keep
-- rendering their content_fr/_en document body):
--
--   1. lesson_cards — the new per-card content model behind the story-card
--      lesson viewer. One row per card, ordered by `position`. Holds the front
--      face (headline point + one-liner + a SEPARATE image per language, per
--      the FR/EN image requirement) and the back face's four distinct blocks
--      (explanation, a structural free-response question + its expected answer,
--      study tips, and common traps/pièges).
--
--   2. question_exposure — per-(user, item) "recently seen" ledger that powers
--      no-repeat shuffling for both MCQ practice (public.questions) and
--      structural practice (lesson_cards). item_kind distinguishes the two
--      pools; topic_id (= lesson id) scopes a pool.
--
--   3. quizzes.session_size — how many MCQs to draw into one practice session,
--      so a quiz can hold a bank LARGER than a single session. NULL = client
--      default.

-- ---------------------------------------------------------------------------
-- 1. lesson_cards
-- ---------------------------------------------------------------------------
create table if not exists public.lesson_cards (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  position integer not null default 0,

  -- Front face
  point_fr text not null default '',
  point_en text not null default '',
  sub_fr text not null default '',
  sub_en text not null default '',
  image_fr text,               -- storage URL shown to FR students (nullable)
  image_en text,               -- storage URL shown to EN students (nullable)

  -- Back face (revealed by "Voir plus")
  explanation_fr text not null default '',
  explanation_en text not null default '',
  structural_question_fr text not null default '',
  structural_question_en text not null default '',
  structural_answer_fr text not null default '',
  structural_answer_en text not null default '',
  tips_fr text not null default '',
  tips_en text not null default '',
  traps_fr text not null default '',
  traps_en text not null default '',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, position)
);

create index if not exists idx_lesson_cards_lesson on public.lesson_cards (lesson_id, position);

alter table public.lesson_cards enable row level security;

-- Readable by any authenticated user (the published-lesson gate is applied in
-- the student query, mirroring lessons_read); writable by the lesson's author
-- (teacher) or an admin — same shape as questions_write in 0001_init.sql.
drop policy if exists lesson_cards_read on public.lesson_cards;
create policy lesson_cards_read on public.lesson_cards for select using (auth.role() = 'authenticated');

drop policy if exists lesson_cards_write on public.lesson_cards;
create policy lesson_cards_write on public.lesson_cards for all
  using (
    public.is_admin() or exists (
      select 1 from public.lessons l where l.id = lesson_cards.lesson_id and l.author_id = auth.uid()
    )
  )
  with check (
    public.is_admin() or exists (
      select 1 from public.lessons l where l.id = lesson_cards.lesson_id and l.author_id = auth.uid()
    )
  );

-- keep updated_at fresh (reuses the trigger fn from 0001_init.sql)
drop trigger if exists set_lesson_cards_updated_at on public.lesson_cards;
create trigger set_lesson_cards_updated_at before update on public.lesson_cards
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. question_exposure — no-repeat ledger
-- ---------------------------------------------------------------------------
create table if not exists public.question_exposure (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_kind text not null check (item_kind in ('mcq', 'structural')),
  item_id uuid not null,                 -- questions.id (mcq) or lesson_cards.id (structural)
  topic_id uuid not null,                -- the lesson the pool belongs to
  last_seen_at timestamptz not null default now(),
  seen_count integer not null default 0,
  unique (user_id, item_kind, item_id)
);

create index if not exists idx_question_exposure_lookup
  on public.question_exposure (user_id, item_kind, topic_id, last_seen_at);

alter table public.question_exposure enable row level security;

-- Strictly the student's own rows (mirror quiz_attempts_own).
drop policy if exists question_exposure_own on public.question_exposure;
create policy question_exposure_own on public.question_exposure for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- 3. quizzes.session_size
-- ---------------------------------------------------------------------------
alter table public.quizzes
  add column if not exists session_size integer;
