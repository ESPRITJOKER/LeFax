-- Lefax Course — initial schema
-- Covers CDC-WEB-2026-001 §7.2 (25 tables) plus agreed Phase-0 additions:
--   target_schools, otp_codes, diagnostic_*, ai_chat_*, admin_action_logs.
--
-- Auth model: the browser never talks to Supabase directly (except future
-- Realtime subscriptions). The Fastify API holds the service-role key and
-- is the real authorization boundary — RLS below is defense-in-depth and
-- forward-compatible with Supabase's third-party-JWT feature (sharing the
-- Fastify JWT secret with this project so auth.uid()/auth.jwt() resolve
-- against our custom access tokens). Until that's configured in the
-- Supabase dashboard, auth.uid() is null for any non-service-role caller,
-- so these policies simply deny — which is the safe default.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type role_enum as enum ('student', 'teacher', 'admin');

create type branch_slug_enum as enum (
  'medecine', 'ingenierie', 'agronomie', 'management', 'infirmerie', 'enseignement'
);

create type card_type_enum as enum ('text', 'image', 'text_image', 'table', 'svg');
create type difficulty_enum as enum ('easy', 'intermediate', 'hard');
create type content_status_enum as enum ('draft', 'in_review', 'approved', 'rejected');
create type content_type_enum as enum ('lesson_card', 'qcm', 'past_paper');
create type paper_access_enum as enum ('free', 'premium', 'unlockable');
create type paper_attempt_mode_enum as enum ('timed', 'review');
create type exam_status_enum as enum ('scheduled', 'open', 'closed', 'scored');
create type subscription_tier_enum as enum ('free', 'standard', 'bundle', 'school');
create type subscription_status_enum as enum ('active', 'expired', 'cancelled');
create type payment_status_enum as enum ('pending', 'confirmed', 'failed');
create type diagnostic_status_enum as enum ('in_progress', 'completed', 'abandoned');
create type ai_chat_role_enum as enum ('user', 'assistant');

-- ---------------------------------------------------------------------
-- Helper: role claim from our custom JWT (see auth model note above)
-- ---------------------------------------------------------------------
create schema if not exists app;

create or replace function app.current_role() returns text
language sql stable
as $$
  select coalesce(auth.jwt() ->> 'role', 'anon');
$$;

-- ---------------------------------------------------------------------
-- Core identity & content hierarchy
-- ---------------------------------------------------------------------
create table profiles (
  id uuid primary key default gen_random_uuid(),
  role role_enum not null,
  phone text unique,
  email text unique,
  password_hash text,
  first_name text,
  last_name text,
  avatar_url text,
  branch_preferences branch_slug_enum[] not null default '{}',
  onboarding_completed boolean not null default false,
  fcm_token text,
  expo_push_token text,
  web_push_subscription jsonb,
  -- Single active refresh token per profile. Verified against the presented
  -- refresh JWT's `jti` claim on every /auth/refresh call and rotated each
  -- time; cleared on /auth/logout so a stolen refresh token stops working
  -- immediately rather than merely expiring (NFR-05, S-01/S-02).
  current_refresh_jti text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_phone_or_email check (phone is not null or email is not null)
);

create or replace function app.set_updated_at() returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function app.set_updated_at();

create table branches (
  id uuid primary key default gen_random_uuid(),
  slug branch_slug_enum unique not null,
  name text not null,
  description text,
  is_active boolean not null default false,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create table target_schools (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id) on delete cascade,
  name text not null,
  subtitle text,
  icon text,
  order_index int not null default 0,
  is_active boolean not null default true
);

create table subjects (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id) on delete cascade,
  name text not null,
  order_index int not null default 0
);

create table chapters (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects(id) on delete cascade,
  name text not null,
  order_index int not null default 0
);

create table lessons (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references chapters(id) on delete cascade,
  title text not null,
  is_published boolean not null default false,
  order_index int not null default 0,
  estimated_minutes int,
  created_at timestamptz not null default now()
);

create table lesson_cards (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  card_type card_type_enum not null,
  text_content text,
  image_url text,
  image_alt text,
  table_data jsonb,
  svg_content text,
  order_index int not null default 0,
  is_published boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table qcms (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  question text not null,
  options jsonb not null,
  correct_option_id text not null,
  explanation text not null,
  difficulty difficulty_enum not null,
  is_published boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table past_papers (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id) on delete cascade,
  subject_id uuid references subjects(id) on delete set null,
  title text not null,
  school_name text not null,
  year int not null,
  paper_url text not null,
  correction_text text,
  correction_url text,
  access_tier paper_access_enum not null default 'premium',
  unlock_price_coins int not null default 20,
  is_published boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Student activity & progress
-- ---------------------------------------------------------------------
create table student_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  cards_seen int not null default 0,
  cards_total int not null default 0,
  completed boolean not null default false,
  completed_at timestamptz,
  unique (student_id, lesson_id)
);

create table qcm_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  qcm_id uuid not null references qcms(id) on delete cascade,
  selected_option_id text not null,
  is_correct boolean not null,
  attempted_at timestamptz not null default now()
);

create table paper_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  paper_id uuid not null references past_papers(id) on delete cascade,
  mode paper_attempt_mode_enum not null,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score numeric
);

create table bookmarks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  qcm_id uuid not null references qcms(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (student_id, qcm_id)
);

-- ---------------------------------------------------------------------
-- Mock exams
-- ---------------------------------------------------------------------
create table mock_exams (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id) on delete cascade,
  title text not null,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  duration_seconds int not null check (duration_seconds > 0),
  questions jsonb not null default '[]',
  status exam_status_enum not null default 'scheduled',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  check (closes_at > opens_at)
);

create table exam_submissions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references mock_exams(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  answers jsonb not null default '{}',
  submitted_at timestamptz,
  score numeric,
  rank int,
  is_late boolean not null default false,
  unique (exam_id, student_id)
);

create table exam_device_logs (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references mock_exams(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  device_fingerprint text not null,
  ip_address inet,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- FaxCoins, subscriptions, payments
-- ---------------------------------------------------------------------
create table coin_ledger (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  amount int not null,
  reason text not null,
  reference_id uuid,
  created_at timestamptz not null default now()
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  branch_id uuid references branches(id) on delete set null,
  tier subscription_tier_enum not null,
  status subscription_status_enum not null default 'active',
  started_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  subscription_id uuid references subscriptions(id) on delete set null,
  cinetpay_transaction_id text unique not null,
  amount_xaf int not null,
  coins_applied int not null default 0,
  status payment_status_enum not null default 'pending',
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create table payment_webhooks_raw (
  id uuid primary key default gen_random_uuid(),
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed boolean not null default false,
  error text
);

-- ---------------------------------------------------------------------
-- B2B schools
-- ---------------------------------------------------------------------
create table schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  branch_id uuid not null references branches(id) on delete cascade,
  access_code text unique not null,
  seat_quota int not null,
  seats_used int not null default 0,
  contract_expires_at timestamptz not null,
  director_email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table school_students (
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (school_id, student_id)
);

-- ---------------------------------------------------------------------
-- Content review workflow
-- ---------------------------------------------------------------------
create table content_reviews (
  id uuid primary key default gen_random_uuid(),
  content_type content_type_enum not null,
  content_id uuid not null,
  submitted_by uuid not null references profiles(id) on delete cascade,
  reviewed_by uuid references profiles(id),
  status content_status_enum not null default 'draft',
  feedback text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Q&A forum
-- ---------------------------------------------------------------------
create table qa_questions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  lesson_id uuid references lessons(id) on delete set null,
  branch_id uuid not null references branches(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table qa_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references qa_questions(id) on delete cascade,
  teacher_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  published_at timestamptz not null default now(),
  edited_at timestamptz
);

-- ---------------------------------------------------------------------
-- Auth & audit
-- ---------------------------------------------------------------------
create table otp_codes (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index otp_codes_phone_idx on otp_codes (phone, created_at desc);

create table auth_events (
  id uuid primary key default gen_random_uuid(),
  phone text,
  event_type text not null,
  ip_address inet,
  success boolean not null,
  created_at timestamptz not null default now()
);

create table admin_action_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references profiles(id) on delete cascade,
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Diagnostic test (new module, added to CDC scope)
-- ---------------------------------------------------------------------
create table diagnostic_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  status diagnostic_status_enum not null default 'in_progress',
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table diagnostic_questions (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id) on delete cascade,
  subject_id uuid references subjects(id) on delete set null,
  question text not null,
  options jsonb not null,
  correct_option_id text not null,
  order_index int not null default 0
);

create table diagnostic_responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references diagnostic_sessions(id) on delete cascade,
  question_id uuid not null references diagnostic_questions(id) on delete cascade,
  selected_option_id text not null,
  is_correct boolean not null,
  answered_at timestamptz not null default now()
);

create table mastery_profiles (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  mastery_score numeric not null check (mastery_score >= 0 and mastery_score <= 100),
  is_weak_zone boolean not null default false,
  computed_at timestamptz not null default now(),
  unique (student_id, subject_id)
);

-- ---------------------------------------------------------------------
-- AI study assistant (new module, added to CDC scope)
-- ---------------------------------------------------------------------
create table ai_chat_conversations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  branch_id uuid references branches(id) on delete set null,
  title text,
  created_at timestamptz not null default now()
);

create table ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references ai_chat_conversations(id) on delete cascade,
  role ai_chat_role_enum not null,
  content text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table profiles enable row level security;
alter table branches enable row level security;
alter table target_schools enable row level security;
alter table subjects enable row level security;
alter table chapters enable row level security;
alter table lessons enable row level security;
alter table lesson_cards enable row level security;
alter table qcms enable row level security;
alter table past_papers enable row level security;
alter table student_progress enable row level security;
alter table qcm_attempts enable row level security;
alter table paper_attempts enable row level security;
alter table bookmarks enable row level security;
alter table mock_exams enable row level security;
alter table exam_submissions enable row level security;
alter table exam_device_logs enable row level security;
alter table coin_ledger enable row level security;
alter table subscriptions enable row level security;
alter table payments enable row level security;
alter table payment_webhooks_raw enable row level security;
alter table schools enable row level security;
alter table school_students enable row level security;
alter table content_reviews enable row level security;
alter table qa_questions enable row level security;
alter table qa_answers enable row level security;
alter table otp_codes enable row level security;
alter table auth_events enable row level security;
alter table admin_action_logs enable row level security;
alter table diagnostic_sessions enable row level security;
alter table diagnostic_questions enable row level security;
alter table diagnostic_responses enable row level security;
alter table mastery_profiles enable row level security;
alter table ai_chat_conversations enable row level security;
alter table ai_chat_messages enable row level security;

-- profiles: read/update own row only
create policy profiles_select_own on profiles for select using (id = auth.uid());
create policy profiles_update_own on profiles for update using (id = auth.uid());

-- public reference data: readable by any authenticated principal
create policy branches_select_all on branches for select using (auth.uid() is not null);
create policy target_schools_select_all on target_schools for select using (auth.uid() is not null);
create policy subjects_select_all on subjects for select using (auth.uid() is not null);
create policy chapters_select_all on chapters for select using (auth.uid() is not null);

-- published content: readable by any authenticated principal
create policy lessons_select_published on lessons for select using (is_published and auth.uid() is not null);
create policy lesson_cards_select_published on lesson_cards for select using (is_published and auth.uid() is not null);
create policy qcms_select_published on qcms for select using (is_published and auth.uid() is not null);
create policy past_papers_select_published on past_papers for select using (is_published and auth.uid() is not null);

-- student-owned rows: full read/write on their own data
create policy student_progress_own on student_progress for select using (student_id = auth.uid());
create policy student_progress_own_write on student_progress for insert with check (student_id = auth.uid());
create policy student_progress_own_update on student_progress for update using (student_id = auth.uid());

create policy qcm_attempts_own on qcm_attempts for select using (student_id = auth.uid());
create policy qcm_attempts_own_write on qcm_attempts for insert with check (student_id = auth.uid());

create policy paper_attempts_own on paper_attempts for select using (student_id = auth.uid());
create policy paper_attempts_own_write on paper_attempts for insert with check (student_id = auth.uid());
create policy paper_attempts_own_update on paper_attempts for update using (student_id = auth.uid());

create policy bookmarks_own on bookmarks for select using (student_id = auth.uid());
create policy bookmarks_own_write on bookmarks for insert with check (student_id = auth.uid());
create policy bookmarks_own_delete on bookmarks for delete using (student_id = auth.uid());

-- mock exams: readable by all authenticated; writes are service-role only (admin via API)
create policy mock_exams_select_all on mock_exams for select using (auth.uid() is not null);

create policy exam_submissions_own on exam_submissions for select using (student_id = auth.uid());
create policy exam_submissions_own_write on exam_submissions for insert with check (student_id = auth.uid());
create policy exam_submissions_own_update on exam_submissions for update using (student_id = auth.uid());

-- coin_ledger: append-only. Read own rows; no insert/update/delete policy for
-- any non-service-role principal at all (S-09) — service role bypasses RLS.
create policy coin_ledger_select_own on coin_ledger for select using (student_id = auth.uid());

create policy subscriptions_select_own on subscriptions for select using (student_id = auth.uid());
create policy payments_select_own on payments for select using (student_id = auth.uid());

-- school_students: student can read their own membership row
create policy school_students_select_own on school_students for select using (student_id = auth.uid());

-- content_reviews: teacher sees their own submissions, admin sees all
create policy content_reviews_select on content_reviews for select
  using (submitted_by = auth.uid() or app.current_role() = 'admin');
create policy content_reviews_insert on content_reviews for insert
  with check (submitted_by = auth.uid() and app.current_role() = 'teacher');
create policy content_reviews_update on content_reviews for update
  using (app.current_role() = 'admin');

-- Q&A: readable by all authenticated; students author questions, teachers/admins author answers
create policy qa_questions_select_all on qa_questions for select using (auth.uid() is not null);
create policy qa_questions_insert_own on qa_questions for insert
  with check (student_id = auth.uid() and app.current_role() = 'student');
create policy qa_answers_select_all on qa_answers for select using (auth.uid() is not null);
create policy qa_answers_insert_staff on qa_answers for insert
  with check (teacher_id = auth.uid() and app.current_role() in ('teacher', 'admin'));
create policy qa_answers_update_own on qa_answers for update using (teacher_id = auth.uid());

-- diagnostic test: student owns their sessions/responses; questions are readable (see note)
create policy diagnostic_sessions_own on diagnostic_sessions for select using (student_id = auth.uid());
create policy diagnostic_sessions_own_write on diagnostic_sessions for insert with check (student_id = auth.uid());
create policy diagnostic_sessions_own_update on diagnostic_sessions for update using (student_id = auth.uid());
-- Column-level leakage (correct_option_id) is an API response-shaping concern, same as qcms.
create policy diagnostic_questions_select_all on diagnostic_questions for select using (auth.uid() is not null);
create policy diagnostic_responses_own on diagnostic_responses for select
  using (exists (select 1 from diagnostic_sessions s where s.id = session_id and s.student_id = auth.uid()));
create policy diagnostic_responses_own_write on diagnostic_responses for insert
  with check (exists (select 1 from diagnostic_sessions s where s.id = session_id and s.student_id = auth.uid()));

create policy mastery_profiles_select_own on mastery_profiles for select using (student_id = auth.uid());

-- AI chat: student owns their conversations and the messages within them
create policy ai_chat_conversations_own on ai_chat_conversations for select using (student_id = auth.uid());
create policy ai_chat_conversations_own_write on ai_chat_conversations for insert with check (student_id = auth.uid());
create policy ai_chat_messages_own on ai_chat_messages for select
  using (exists (select 1 from ai_chat_conversations c where c.id = conversation_id and c.student_id = auth.uid()));
create policy ai_chat_messages_own_write on ai_chat_messages for insert
  with check (exists (select 1 from ai_chat_conversations c where c.id = conversation_id and c.student_id = auth.uid()));

-- No policies at all (service-role only) for: payment_webhooks_raw, otp_codes,
-- auth_events, admin_action_logs, exam_device_logs, schools — RLS enabled
-- above with zero policies means every non-service-role request is denied.
