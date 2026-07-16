-- Migration 0004: AI infrastructure — pgvector + new tables
-- Requires: supabase/extensions/pgvector (Supabase has native support)

-- 1. Enable pgvector
create extension if not exists vector
  with schema extensions;

-- 2. Learning events (append-only ledger)
create table learning_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  event_type text not null,
  subject_id uuid references subjects(id),
  topic_id text,
  content_id uuid,
  is_correct boolean,
  difficulty difficulty_enum,
  response_time_ms int,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

alter table learning_events enable row level security;

create policy learning_events_select_own
  on learning_events for select
  using (auth.uid() = student_id);

-- No update/delete policies — append-only by design

-- 3. Mastery scores (real-time, per topic — separate from existing mastery_profiles which is per-subject)
create table mastery_scores (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  subject_id uuid not null references subjects(id),
  topic_id text not null,
  score numeric not null default 50 check (score >= 0 and score <= 100),
  attempts int not null default 0,
  last_correct boolean,
  updated_at timestamptz not null default now(),
  unique (student_id, subject_id, topic_id)
);

alter table mastery_scores enable row level security;

create policy mastery_scores_select_own
  on mastery_scores for select
  using (auth.uid() = student_id);

-- 4. Content drafts (AI-generated)
create table content_drafts (
  id uuid primary key default gen_random_uuid(),
  draft_type text not null,
  subject_id uuid not null references subjects(id),
  chapter_id uuid references chapters(id),
  title text not null,
  body jsonb not null,
  source_chunks uuid[] not null default '{}',
  generation_prompt text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table content_drafts enable row level security;

-- Admins and teachers can read drafts
create policy content_drafts_select_staff
  on content_drafts for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role in ('admin', 'teacher')
    )
  );

-- 5. Content validations (teacher review of AI drafts)
create table content_validations (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references content_drafts(id) on delete cascade,
  reviewer_id uuid not null references profiles(id),
  decision text not null check (decision in ('approved', 'rejected')),
  feedback text,
  decided_at timestamptz not null default now()
);

alter table content_validations enable row level security;

create policy content_validations_select_staff
  on content_validations for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role in ('admin', 'teacher')
    )
  );

-- 6. Tutor sessions
create table tutor_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  branch_id uuid references branches(id),
  title text,
  created_at timestamptz not null default now()
);

alter table tutor_sessions enable row level security;

create policy tutor_sessions_own
  on tutor_sessions for all
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

-- 7. Tutor messages (extends existing ai_chat_messages pattern)
create table tutor_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references tutor_sessions(id) on delete cascade,
  role ai_chat_role_enum not null,
  content text not null,
  confidence_score numeric,
  grounding_chunks uuid[] default '{}',
  tokens_used int,
  created_at timestamptz not null default now()
);

alter table tutor_messages enable row level security;

create policy tutor_messages_own
  on tutor_messages for all
  using (
    exists (
      select 1 from tutor_sessions
      where tutor_sessions.id = tutor_messages.session_id
      and tutor_sessions.student_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from tutor_sessions
      where tutor_sessions.id = tutor_messages.session_id
      and tutor_sessions.student_id = auth.uid()
    )
  );

-- 8. RAG chunks with pgvector
create table rag_chunks (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_id uuid not null,
  content text not null,
  embedding vector(1024) not null,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

create index rag_chunks_embedding_idx
  on rag_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index rag_chunks_source_idx
  on rag_chunks (source_type, source_id);

-- RLS: service-role only (no student/teacher direct access to chunks)
alter table rag_chunks enable row level security;

-- 9. Inference usage log
create table inference_usage_log (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  provider text not null,
  model text not null,
  prompt_tokens int not null,
  completion_tokens int not null,
  total_tokens int not null,
  cost_usd numeric(10,6),
  endpoint text,
  created_at timestamptz not null default now()
);

alter table inference_usage_log enable row level security;

create policy inference_usage_log_own
  on inference_usage_log for select
  using (auth.uid() = student_id);

-- 10. Confidence flags
create table confidence_flags (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references tutor_messages(id) on delete cascade,
  confidence_score numeric not null,
  reason text,
  reviewed boolean default false,
  reviewer_id uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table confidence_flags enable row level security;

-- Staff can read all flags; students cannot
create policy confidence_flags_select_staff
  on confidence_flags for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role in ('admin', 'teacher')
    )
  );

-- 11. Helper function for RAG similarity search
create or replace function match_rag_chunks(
  query_embedding vector(1024),
  match_count int default 5,
  match_threshold float default 0.5,
  filter_clause text default ''
)
returns table (
  id uuid,
  content text,
  source_type text,
  source_id uuid,
  similarity float
)
language plpgsql
stable
as $$
begin
  return query
  select
    rc.id,
    rc.content,
    rc.source_type,
    rc.source_id,
    1 - (rc.embedding <=> query_embedding) as similarity
  from rag_chunks rc
  where 1 - (rc.embedding <=> query_embedding) > match_threshold
    and (filter_clause = '' or filter_clause is null or execute(filter_clause))
  order by rc.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- 12. Indexes for frequently queried new tables
create index idx_learning_events_student on learning_events (student_id, created_at desc);
create index idx_learning_events_subject on learning_events (subject_id, topic_id);
create index idx_mastery_scores_student_subject on mastery_scores (student_id, subject_id);
create index idx_content_drafts_status on content_drafts (status);
create index idx_tutor_sessions_student on tutor_sessions (student_id, created_at desc);
create index idx_tutor_messages_session on tutor_messages (session_id, created_at);
create index idx_inference_usage_student_date on inference_usage_log (student_id, created_at);
create index idx_confidence_flags_unreviewed on confidence_flags (reviewed, created_at) where reviewed = false;
