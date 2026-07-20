-- Lefax Course — MVP schema (Médecine track)
-- Implements CDC section 9 (data model) with RLS per section 10 / 7 (confidentiality).
-- A few tables are added beyond the CDC's literal list (quiz_attempts, shop_items,
-- shop_unlocks, badges, user_badges, role_permissions) because they're needed to make
-- the listed entities ("quizzes/questions/choices", "faxcoins_transactions",
-- gamification) actually work as a coherent relational model — consistent with
-- section 9 being an "aperçu" (overview), not an exhaustive DDL.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists vector;     -- pgvector, per CDC section 8 (free tier)

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type user_role as enum ('student', 'teacher', 'admin', 'super_admin');
create type account_status as enum ('active', 'suspended');
create type difficulty_level as enum ('easy', 'medium', 'hard');
create type lesson_progress_status as enum ('locked', 'current', 'done');
create type approval_status as enum ('pending', 'approved', 'modified', 'rejected');
create type mock_exam_status as enum ('scheduled', 'open', 'closed');
create type ranking_scope as enum ('regional', 'national', 'weekly');

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  phone text unique not null,
  region text,
  town text,
  role user_role not null default 'student',
  track text default 'medicine',
  level text not null default 'Débutant',
  faxcoins integer not null default 0,
  rank_label text not null default 'Non classé',
  avatar_url text,
  language text not null default 'fr' check (language in ('fr', 'en')),
  dark_mode boolean not null default false,
  notif_prefs jsonb not null default '{"daily_reminder": true, "mock_reminder": true, "rewards": true, "ranking": true}',
  status account_status not null default 'active',
  streak_count integer not null default 0,
  last_active_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'Student/teacher/admin identity. FaxCoins balance and rank live here (denormalized for fast dashboard reads); faxcoins_transactions is the source-of-truth ledger.';

-- ---------------------------------------------------------------------------
-- roles / permissions
-- ---------------------------------------------------------------------------
create table public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role user_role not null,
  permission text not null,
  unique (role, permission)
);

-- ---------------------------------------------------------------------------
-- subjects / chapters / lessons
-- ---------------------------------------------------------------------------
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name_fr text not null,
  name_en text not null,
  track text not null default 'medicine',
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  slug text not null,
  name_fr text not null,
  name_en text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (subject_id, slug)
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  slug text not null,
  title_fr text not null,
  title_en text not null,
  objectives_fr text[] not null default '{}',
  objectives_en text[] not null default '{}',
  content_fr text not null default '',
  content_en text not null default '',
  summary_fr text default '',
  summary_en text default '',
  key_points_fr text[] not null default '{}',
  key_points_en text[] not null default '{}',
  duration_minutes integer not null default 10,
  difficulty difficulty_level not null default 'medium',
  position integer not null default 0,
  is_premium boolean not null default false,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chapter_id, slug)
);

create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  status lesson_progress_status not null default 'locked',
  progress_pct integer not null default 0 check (progress_pct between 0 and 100),
  is_favorite boolean not null default false,
  last_viewed_at timestamptz,
  completed_at timestamptz,
  unique (user_id, lesson_id)
);

-- ---------------------------------------------------------------------------
-- quizzes / questions / choices / attempts / answers
-- ---------------------------------------------------------------------------
create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid references public.lessons (id) on delete cascade,
  mock_exam_id uuid, -- FK added after mock_exams is created below
  title_fr text not null,
  title_en text not null,
  difficulty difficulty_level not null default 'medium',
  passing_score integer not null default 50,
  created_at timestamptz not null default now(),
  constraint quizzes_target_check check (
    (lesson_id is not null and mock_exam_id is null) or
    (lesson_id is null and mock_exam_id is not null)
  )
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  text_fr text not null,
  text_en text not null,
  explanation_fr text default '',
  explanation_en text default '',
  difficulty difficulty_level not null default 'medium',
  position integer not null default 0,
  ai_generated boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.choices (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  text_fr text not null,
  text_en text not null,
  is_correct boolean not null default false,
  position integer not null default 0
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  score integer,
  coins_earned integer not null default 0,
  started_at timestamptz not null default now(),
  submitted_at timestamptz
);

create table public.student_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  choice_id uuid references public.choices (id) on delete set null,
  is_correct boolean not null default false,
  answered_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

-- ---------------------------------------------------------------------------
-- mock_exams / results / rankings
-- ---------------------------------------------------------------------------
create table public.mock_exams (
  id uuid primary key default gen_random_uuid(),
  title_fr text not null,
  title_en text not null,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  duration_minutes integer not null default 180,
  question_count integer not null default 60,
  passing_score integer not null default 50,
  instructions_fr text[] not null default '{}',
  instructions_en text[] not null default '{}',
  status mock_exam_status not null default 'scheduled',
  quiz_id uuid references public.quizzes (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.quizzes
  add constraint quizzes_mock_exam_fk foreign key (mock_exam_id) references public.mock_exams (id) on delete cascade;

create table public.mock_exam_results (
  id uuid primary key default gen_random_uuid(),
  mock_exam_id uuid not null references public.mock_exams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  attempt_id uuid references public.quiz_attempts (id) on delete set null,
  score integer not null,
  national_rank integer,
  regional_rank integer,
  breakdown jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (mock_exam_id, user_id)
);

-- Rankings intentionally denormalize a display name + town at computation
-- time (written only by the `rankings` edge function / admin, via service
-- role). This lets the public leaderboard (CDC 6.11) read purely from
-- `rankings` without ever touching another student's `profiles` row, which
-- stays strictly private per CDC section 7 (RLS confidentiality).
create table public.rankings (
  id uuid primary key default gen_random_uuid(),
  scope ranking_scope not null,
  region text,
  user_id uuid not null references public.profiles (id) on delete cascade,
  display_name text not null,
  town text,
  score integer not null default 0,
  period_start date not null,
  period_end date not null,
  computed_at timestamptz not null default now(),
  unique (scope, region, user_id, period_start)
);

-- ---------------------------------------------------------------------------
-- faxcoins_transactions
-- ---------------------------------------------------------------------------
create table public.faxcoins_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null, -- positive = earned, negative = spent
  reason text not null check (reason in (
    'quiz_success', 'chapter_complete', 'daily_login', 'streak', 'perfect_score',
    'mock_exam_participation', 'shop_unlock', 'task_complete', 'admin_grant'
  )),
  reference_id uuid,
  balance_after integer not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- shop (spends FaxCoins — CDC 6.5)
-- ---------------------------------------------------------------------------
create table public.shop_items (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name_fr text not null,
  name_en text not null,
  price_coins integer not null,
  item_type text not null check (item_type in ('past_paper', 'correction', 'premium_lesson', 'mock_correction', 'exclusive_content')),
  reference_id uuid,
  is_limited boolean not null default true,
  stock_remaining integer,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.shop_unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  shop_item_id uuid not null references public.shop_items (id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  unique (user_id, shop_item_id)
);

-- ---------------------------------------------------------------------------
-- badges / achievements (CDC 6.5)
-- ---------------------------------------------------------------------------
create table public.badges (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name_fr text not null,
  name_en text not null,
  description_fr text default '',
  description_en text default '',
  icon text not null default 'medal',
  criteria jsonb not null default '{}'
);

create table public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  badge_id uuid not null references public.badges (id) on delete cascade,
  earned_at timestamptz not null default now(),
  unique (user_id, badge_id)
);

-- ---------------------------------------------------------------------------
-- daily_tasks / completions (CDC 6.6)
-- ---------------------------------------------------------------------------
create table public.daily_tasks (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  label_fr text not null,
  label_en text not null,
  reward_coins integer not null default 5,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.daily_task_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  task_id uuid not null references public.daily_tasks (id) on delete cascade,
  completed_on date not null default current_date,
  reward_coins integer not null,
  created_at timestamptz not null default now(),
  unique (user_id, task_id, completed_on)
);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('daily_reminder', 'mock_reminder', 'reward', 'ranking_update', 'system')),
  title_fr text not null,
  title_en text not null,
  body_fr text not null default '',
  body_en text not null default '',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- admin_logs (audit journal)
-- ---------------------------------------------------------------------------
create table public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_table text,
  target_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- content_approval (AI-generated QCM review queue — CDC 6.8)
-- ---------------------------------------------------------------------------
create table public.content_approval (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references public.profiles (id) on delete cascade,
  source_media_id uuid,
  lesson_id uuid references public.lessons (id) on delete set null,
  generated_payload jsonb not null default '{}',
  status approval_status not null default 'pending',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- media_library
-- ---------------------------------------------------------------------------
create table public.media_library (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  file_name text not null,
  mime_type text,
  uploaded_by uuid references public.profiles (id) on delete set null,
  lesson_id uuid references public.lessons (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.content_approval
  add constraint content_approval_media_fk foreign key (source_media_id) references public.media_library (id) on delete set null;

-- ---------------------------------------------------------------------------
-- settings (global configurable parameters)
-- ---------------------------------------------------------------------------
create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helper functions for RLS (avoid recursive-policy self-joins)
-- ---------------------------------------------------------------------------
create or replace function public.current_role()
returns user_role
language sql stable security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((select role in ('admin', 'super_admin') from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_teacher()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((select role in ('teacher', 'admin', 'super_admin') from public.profiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_lessons_updated_at before update on public.lessons
  for each row execute function public.set_updated_at();

-- Auto-create a profile row when a new auth.users row appears (post phone-OTP signup).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, first_name, last_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    coalesce(new.phone, new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.subjects enable row level security;
alter table public.chapters enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.quizzes enable row level security;
alter table public.questions enable row level security;
alter table public.choices enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.student_answers enable row level security;
alter table public.mock_exams enable row level security;
alter table public.mock_exam_results enable row level security;
alter table public.rankings enable row level security;
alter table public.faxcoins_transactions enable row level security;
alter table public.shop_items enable row level security;
alter table public.shop_unlocks enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.daily_tasks enable row level security;
alter table public.daily_task_completions enable row level security;
alter table public.notifications enable row level security;
alter table public.admin_logs enable row level security;
alter table public.content_approval enable row level security;
alter table public.media_library enable row level security;
alter table public.settings enable row level security;

-- profiles: a student only ever sees/edits their own row; admins see everyone.
create policy profiles_select_own on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles for update using (id = auth.uid() or public.is_admin());
create policy profiles_insert_self on public.profiles for insert with check (id = auth.uid());

-- role_permissions: readable by any authenticated user (drives client-side UI gating), writable by super_admin only.
create policy role_permissions_read on public.role_permissions for select using (auth.role() = 'authenticated');
create policy role_permissions_write on public.role_permissions for all using (public.current_role() = 'super_admin') with check (public.current_role() = 'super_admin');

-- curriculum tree: readable by all authenticated users; writable by the owning teacher or admin.
create policy subjects_read on public.subjects for select using (auth.role() = 'authenticated');
create policy subjects_write on public.subjects for all using (public.is_admin()) with check (public.is_admin());

create policy chapters_read on public.chapters for select using (auth.role() = 'authenticated');
create policy chapters_write on public.chapters for all using (public.is_admin()) with check (public.is_admin());

create policy lessons_read on public.lessons for select using (auth.role() = 'authenticated');
create policy lessons_write_teacher_own on public.lessons for all
  using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());

-- lesson_progress: strictly own rows.
create policy lesson_progress_own on public.lesson_progress for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- quizzes/questions/choices: readable by authenticated (needed to render), writable by teacher who owns the parent lesson or admin.
create policy quizzes_read on public.quizzes for select using (auth.role() = 'authenticated');
create policy quizzes_write on public.quizzes for all
  using (
    public.is_admin() or exists (
      select 1 from public.lessons l where l.id = quizzes.lesson_id and l.author_id = auth.uid()
    )
  )
  with check (
    public.is_admin() or exists (
      select 1 from public.lessons l where l.id = quizzes.lesson_id and l.author_id = auth.uid()
    )
  );

create policy questions_read on public.questions for select using (auth.role() = 'authenticated');
create policy questions_write on public.questions for all
  using (
    public.is_admin() or exists (
      select 1 from public.quizzes q join public.lessons l on l.id = q.lesson_id
      where q.id = questions.quiz_id and l.author_id = auth.uid()
    )
  )
  with check (
    public.is_admin() or exists (
      select 1 from public.quizzes q join public.lessons l on l.id = q.lesson_id
      where q.id = questions.quiz_id and l.author_id = auth.uid()
    )
  );

create policy choices_read on public.choices for select using (auth.role() = 'authenticated');
create policy choices_write on public.choices for all
  using (
    public.is_admin() or exists (
      select 1 from public.questions qs join public.quizzes q on q.id = qs.quiz_id join public.lessons l on l.id = q.lesson_id
      where qs.id = choices.question_id and l.author_id = auth.uid()
    )
  )
  with check (
    public.is_admin() or exists (
      select 1 from public.questions qs join public.quizzes q on q.id = qs.quiz_id join public.lessons l on l.id = q.lesson_id
      where qs.id = choices.question_id and l.author_id = auth.uid()
    )
  );

-- quiz_attempts / student_answers: strictly the student's own; teachers see attempts on their own content; admins see all.
create policy quiz_attempts_own on public.quiz_attempts for all
  using (
    user_id = auth.uid() or public.is_admin() or exists (
      select 1 from public.quizzes q join public.lessons l on l.id = q.lesson_id
      where q.id = quiz_attempts.quiz_id and l.author_id = auth.uid()
    )
  )
  with check (user_id = auth.uid() or public.is_admin());

create policy student_answers_own on public.student_answers for all
  using (
    exists (select 1 from public.quiz_attempts a where a.id = student_answers.attempt_id and a.user_id = auth.uid())
    or public.is_admin()
    or exists (
      select 1 from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id join public.lessons l on l.id = q.lesson_id
      where a.id = student_answers.attempt_id and l.author_id = auth.uid()
    )
  )
  with check (
    exists (select 1 from public.quiz_attempts a where a.id = student_answers.attempt_id and a.user_id = auth.uid())
    or public.is_admin()
  );

-- mock_exams: readable by all authenticated; writable by admin only.
create policy mock_exams_read on public.mock_exams for select using (auth.role() = 'authenticated');
create policy mock_exams_write on public.mock_exams for all using (public.is_admin()) with check (public.is_admin());

-- mock_exam_results: own rows readable; admins all. Written only via edge functions (service role bypasses RLS).
create policy mock_exam_results_own on public.mock_exam_results for select using (user_id = auth.uid() or public.is_admin());
create policy mock_exam_results_no_client_write on public.mock_exam_results for insert with check (public.is_admin());
create policy mock_exam_results_no_client_update on public.mock_exam_results for update using (public.is_admin());

-- rankings: readable by all authenticated (leaderboards); written only by service role / admin.
create policy rankings_read on public.rankings for select using (auth.role() = 'authenticated');
create policy rankings_write on public.rankings for all using (public.is_admin()) with check (public.is_admin());

-- faxcoins_transactions: strictly own ledger; admins see all; inserts normally come from edge functions (service role).
create policy faxcoins_own on public.faxcoins_transactions for select using (user_id = auth.uid() or public.is_admin());
create policy faxcoins_insert on public.faxcoins_transactions for insert with check (user_id = auth.uid() or public.is_admin());

-- shop: items readable by all authenticated; writable by admin. Unlocks strictly own.
create policy shop_items_read on public.shop_items for select using (auth.role() = 'authenticated');
create policy shop_items_write on public.shop_items for all using (public.is_admin()) with check (public.is_admin());
create policy shop_unlocks_own on public.shop_unlocks for all using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

-- badges: readable by all; writable by admin. user_badges strictly own.
create policy badges_read on public.badges for select using (auth.role() = 'authenticated');
create policy badges_write on public.badges for all using (public.is_admin()) with check (public.is_admin());
create policy user_badges_own on public.user_badges for all using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

-- daily_tasks: readable by all; writable by admin (caps/config per CDC 6.6). Completions strictly own.
create policy daily_tasks_read on public.daily_tasks for select using (auth.role() = 'authenticated');
create policy daily_tasks_write on public.daily_tasks for all using (public.is_admin()) with check (public.is_admin());
create policy daily_task_completions_own on public.daily_task_completions for all using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

-- notifications: strictly own.
create policy notifications_own on public.notifications for all using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

-- admin_logs: admin/super_admin only.
create policy admin_logs_read on public.admin_logs for select using (public.is_admin());
create policy admin_logs_write on public.admin_logs for insert with check (public.is_admin());

-- content_approval: teacher sees/creates own submissions; admin sees/updates all (approval gate — CDC 6.8/6.9).
create policy content_approval_teacher_own on public.content_approval for select using (submitted_by = auth.uid() or public.is_admin());
create policy content_approval_teacher_insert on public.content_approval for insert with check (submitted_by = auth.uid() or public.is_admin());
create policy content_approval_admin_update on public.content_approval for update using (public.is_admin());

-- media_library: owner or admin/teacher-of-lesson can read; owner or admin can write.
create policy media_library_read on public.media_library for select using (uploaded_by = auth.uid() or public.is_admin() or public.is_teacher());
create policy media_library_write on public.media_library for all using (uploaded_by = auth.uid() or public.is_admin()) with check (uploaded_by = auth.uid() or public.is_admin());

-- settings: readable by all authenticated (some drive client UI, e.g. daily task caps); writable by admin only.
create policy settings_read on public.settings for select using (auth.role() = 'authenticated');
create policy settings_write on public.settings for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index idx_chapters_subject on public.chapters (subject_id);
create index idx_lessons_chapter on public.lessons (chapter_id);
create index idx_lessons_author on public.lessons (author_id);
create index idx_lesson_progress_user on public.lesson_progress (user_id);
create index idx_questions_quiz on public.questions (quiz_id);
create index idx_choices_question on public.choices (question_id);
create index idx_quiz_attempts_user on public.quiz_attempts (user_id);
create index idx_student_answers_attempt on public.student_answers (attempt_id);
create index idx_faxcoins_user on public.faxcoins_transactions (user_id);
create index idx_notifications_user on public.notifications (user_id, is_read);
create index idx_rankings_scope on public.rankings (scope, region, period_start);
create index idx_content_approval_status on public.content_approval (status);
