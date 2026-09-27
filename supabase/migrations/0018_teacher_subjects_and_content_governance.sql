-- 0018: Subject-based teacher access control + content governance
--
-- Problem this fixes (audited 2026-09-26):
--   1. `lessons_write_teacher_own` (0001_init.sql:504) is a single FOR ALL
--      policy keyed on `author_id = auth.uid()`. Row-level security is not
--      column-level, so a teacher could `update lessons set published = true`
--      on their own row straight from the client — FR-10 ("Teacher can never
--      self-publish") was enforced only by the absence of a button.
--   2. The same shape on quizzes/questions/choices/lesson_cards let a teacher
--      write question banks directly, bypassing `content_approval` entirely.
--   3. Holding the `teacher` role granted write access to EVERY subject. There
--      was no notion of "this teacher teaches Biologie and Chimie".
--
-- Model introduced here:
--   * teacher_subjects — an explicit, audited grant (super_admin only).
--   * lessons.review_status — draft -> submitted -> under_review -> approved /
--     rejected, alongside the existing `published` flag which stays the
--     student-visibility switch and remains admin-only.
--   * Per-command RLS policies (no more FOR ALL on content) scoped to
--     "assigned subject AND my own row AND still editable".
--   * BEFORE INSERT/UPDATE triggers for the column-level rules RLS cannot
--     express, following the `prevent_role_self_escalation` precedent in
--     0003_guard_role_column.sql: with no JWT context (migrations, Studio SQL,
--     service-role Edge Functions) the guards are a no-op, so trusted paths
--     keep working.
--
-- Admin and super_admin keep unrestricted content access everywhere
-- (`public.is_admin()`), across every subject.

-- ---------------------------------------------------------------------------
-- 1. teacher_subjects — the assignment grant
-- ---------------------------------------------------------------------------
create table if not exists public.teacher_subjects (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null,
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (teacher_id, subject_id)
);

comment on table public.teacher_subjects is
  'Which subjects a teacher may author content in. Granted/revoked by super_admin only; re-granting flips status back to active (hence unique(teacher_id, subject_id) rather than a new row per grant).';

create index if not exists idx_teacher_subjects_teacher on public.teacher_subjects (teacher_id, status);
create index if not exists idx_teacher_subjects_subject on public.teacher_subjects (subject_id, status);

drop trigger if exists set_teacher_subjects_updated_at on public.teacher_subjects;
create trigger set_teacher_subjects_updated_at before update on public.teacher_subjects
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Authorization helpers
-- ---------------------------------------------------------------------------
-- All security definer + stable so they can be called from RLS policies
-- without recursing through the policies of the tables they read.

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer
set search_path = public
as $fn$
  select coalesce((select role = 'super_admin' from public.profiles where id = auth.uid()), false);
$fn$;

-- True when the caller may author content in `p_subject`: admins anywhere,
-- teachers only where they hold an active grant.
create or replace function public.teaches_subject(p_subject uuid)
returns boolean
language sql stable security definer
set search_path = public
as $fn$
  select p_subject is not null and (
    public.is_admin()
    or exists (
      select 1 from public.teacher_subjects ts
      where ts.teacher_id = auth.uid()
        and ts.subject_id = p_subject
        and ts.status = 'active'
    )
  );
$fn$;

create or replace function public.subject_of_chapter(p_chapter uuid)
returns uuid
language sql stable security definer
set search_path = public
as $fn$
  select subject_id from public.chapters where id = p_chapter;
$fn$;

create or replace function public.subject_of_lesson(p_lesson uuid)
returns uuid
language sql stable security definer
set search_path = public
as $fn$
  select c.subject_id from public.lessons l join public.chapters c on c.id = l.chapter_id where l.id = p_lesson;
$fn$;

-- A lesson is teacher-editable only while it is a draft (or was sent back for
-- corrections) and not published. Admins are never blocked.
create or replace function public.lesson_is_teacher_editable(p_lesson uuid)
returns boolean
language sql stable security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.lessons l
    where l.id = p_lesson
      and l.author_id = auth.uid()
      and l.published = false
      and l.review_status in ('draft', 'rejected')
      and public.teaches_subject(public.subject_of_lesson(l.id))
  );
$fn$;

-- ---------------------------------------------------------------------------
-- 3. Review workflow columns
-- ---------------------------------------------------------------------------
alter table public.lessons
  add column if not exists review_status text not null default 'draft',
  add column if not exists review_feedback text,
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles (id) on delete set null,
  add column if not exists reviewed_at timestamptz;

-- `conname` is unique per table, not globally, so scope the lookup to the table.
do $mig$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'lessons_review_status_check' and conrelid = 'public.lessons'::regclass
  ) then
    alter table public.lessons
      add constraint lessons_review_status_check
      check (review_status in ('draft', 'submitted', 'under_review', 'approved', 'rejected'));
  end if;
end $mig$;

-- Everything already live for students was approved by an admin by definition.
update public.lessons set review_status = 'approved' where published = true and review_status = 'draft';

create index if not exists idx_lessons_review_status on public.lessons (review_status);

-- Chapter authorship, so a teacher can manage the chapters they created
-- without being able to touch the seeded curriculum tree.
alter table public.chapters
  add column if not exists created_by uuid references public.profiles (id) on delete set null;

create index if not exists idx_chapters_created_by on public.chapters (created_by);

-- content_approval: what kind of submission, which subject, reviewer feedback.
alter table public.content_approval
  add column if not exists kind text not null default 'mcq',
  add column if not exists subject_id uuid references public.subjects (id) on delete set null,
  add column if not exists feedback text;

do $mig$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'content_approval_kind_check' and conrelid = 'public.content_approval'::regclass
  ) then
    alter table public.content_approval
      add constraint content_approval_kind_check check (kind in ('mcq', 'lesson'));
  end if;
end $mig$;

create index if not exists idx_content_approval_status on public.content_approval (status, created_at);
create index if not exists idx_content_approval_submitter on public.content_approval (submitted_by, status);

-- Notification types for the content workflow (CDC 6.8/6.9 feedback loop).
-- 0001 declared the CHECK inline, so its name is whatever Postgres generated.
-- Drop whichever check on the table constrains `type` rather than trusting a
-- name: if the guess were wrong the old, narrower constraint would survive and
-- every workflow notification insert would fail.
do $mig$
declare
  v_name text;
begin
  for v_name in
    select conname from pg_constraint
    where conrelid = 'public.notifications'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%daily_reminder%'
  loop
    execute format('alter table public.notifications drop constraint %I', v_name);
  end loop;
end $mig$;

alter table public.notifications
  add constraint notifications_type_check
  check (type in ('daily_reminder', 'mock_reminder', 'reward', 'ranking_update', 'system',
                  'content_submitted', 'content_approved', 'content_rejected', 'subject_assigned'));

-- ---------------------------------------------------------------------------
-- 4. Column-level guards (what RLS cannot express)
-- ---------------------------------------------------------------------------
create or replace function public.guard_lesson_teacher_fields()
returns trigger
language plpgsql security definer
set search_path = public
as $fn$
begin
  -- No JWT context = trusted path (migration, Studio SQL, service-role Edge
  -- Function). Same reasoning as prevent_role_self_escalation in 0003.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- A teacher always creates a draft they own, never a published lesson.
    new.author_id := auth.uid();
    new.published := false;
    new.review_status := 'draft';
    new.review_feedback := null;
    new.submitted_at := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    return new;
  end if;

  -- UPDATE: publication and review bookkeeping are not the teacher's to set.
  new.published := old.published;
  new.author_id := old.author_id;
  new.reviewed_by := old.reviewed_by;
  new.reviewed_at := old.reviewed_at;
  new.review_feedback := old.review_feedback;

  -- Moving a lesson is allowed only into another chapter of an assigned subject.
  if new.chapter_id is distinct from old.chapter_id
     and not public.teaches_subject(public.subject_of_chapter(new.chapter_id)) then
    new.chapter_id := old.chapter_id;
  end if;

  -- The only transition a teacher may drive is submitting for review.
  if new.review_status is distinct from old.review_status then
    if new.review_status = 'submitted' and old.review_status in ('draft', 'rejected') then
      new.submitted_at := now();
    else
      new.review_status := old.review_status;
      new.submitted_at := old.submitted_at;
    end if;
  else
    new.submitted_at := old.submitted_at;
  end if;

  return new;
end;
$fn$;

drop trigger if exists lessons_guard_teacher_fields on public.lessons;
create trigger lessons_guard_teacher_fields
  before insert or update on public.lessons
  for each row execute function public.guard_lesson_teacher_fields();

-- A teacher may not rewrite their own submission's verdict.
create or replace function public.guard_content_approval_fields()
returns trigger
language plpgsql security definer
set search_path = public
as $fn$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.submitted_by := auth.uid();
    new.status := 'pending';
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.feedback := null;
    return new;
  end if;

  new.status := old.status;
  new.reviewed_by := old.reviewed_by;
  new.reviewed_at := old.reviewed_at;
  new.feedback := old.feedback;
  new.submitted_by := old.submitted_by;
  return new;
end;
$fn$;

drop trigger if exists content_approval_guard_fields on public.content_approval;
create trigger content_approval_guard_fields
  before insert or update on public.content_approval
  for each row execute function public.guard_content_approval_fields();

-- ---------------------------------------------------------------------------
-- 5. RLS — teacher_subjects
-- ---------------------------------------------------------------------------
alter table public.teacher_subjects enable row level security;

drop policy if exists teacher_subjects_read on public.teacher_subjects;
create policy teacher_subjects_read on public.teacher_subjects for select
  using (teacher_id = auth.uid() or public.is_admin());

-- Only a super_admin may grant, change or revoke an assignment — and only
-- ever from the server in practice, but the policy is the real boundary.
drop policy if exists teacher_subjects_write on public.teacher_subjects;
create policy teacher_subjects_write on public.teacher_subjects for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- 6. RLS — lessons (replaces the FOR ALL hole)
-- ---------------------------------------------------------------------------
drop policy if exists lessons_write_teacher_own on public.lessons;

-- Drafts stop being world-readable: students only ever need published rows
-- (every student query already filters `published = true`), authors need their
-- own, admins need everything.
drop policy if exists lessons_read on public.lessons;
create policy lessons_read on public.lessons for select
  using (published = true or author_id = auth.uid() or public.is_admin());

drop policy if exists lessons_insert_staff on public.lessons;
create policy lessons_insert_staff on public.lessons for insert
  with check (
    public.is_admin()
    or (
      public.is_teacher()
      and author_id = auth.uid()
      and public.teaches_subject(public.subject_of_chapter(chapter_id))
    )
  );

drop policy if exists lessons_update_staff on public.lessons;
create policy lessons_update_staff on public.lessons for update
  using (
    public.is_admin()
    or (
      author_id = auth.uid()
      and published = false
      and review_status in ('draft', 'rejected')
      and public.teaches_subject(public.subject_of_chapter(chapter_id))
    )
  )
  with check (
    public.is_admin()
    or (
      author_id = auth.uid()
      and public.teaches_subject(public.subject_of_chapter(chapter_id))
    )
  );

drop policy if exists lessons_delete_staff on public.lessons;
create policy lessons_delete_staff on public.lessons for delete
  using (
    public.is_admin()
    or (
      author_id = auth.uid()
      and published = false
      and review_status in ('draft', 'rejected')
      and public.teaches_subject(public.subject_of_chapter(chapter_id))
    )
  );

-- ---------------------------------------------------------------------------
-- 7. RLS — chapters (teachers may build the tree inside their subjects)
-- ---------------------------------------------------------------------------
drop policy if exists chapters_insert_teacher on public.chapters;
create policy chapters_insert_teacher on public.chapters for insert
  with check (public.is_teacher() and public.teaches_subject(subject_id) and created_by = auth.uid());

drop policy if exists chapters_update_teacher on public.chapters;
create policy chapters_update_teacher on public.chapters for update
  using (created_by = auth.uid() and public.teaches_subject(subject_id))
  with check (created_by = auth.uid() and public.teaches_subject(subject_id));

-- Deleting a chapter cascades its lessons, so a teacher may only remove one
-- they created that still holds nothing but their own untouched drafts.
drop policy if exists chapters_delete_teacher on public.chapters;
create policy chapters_delete_teacher on public.chapters for delete
  using (
    created_by = auth.uid()
    and public.teaches_subject(subject_id)
    and not exists (
      select 1 from public.lessons l
      where l.chapter_id = chapters.id
        and (l.published = true or l.review_status <> 'draft')
    )
  );

-- ---------------------------------------------------------------------------
-- 8. RLS — quiz/question bank and story cards
-- ---------------------------------------------------------------------------
-- Same rule everywhere: admins unrestricted; a teacher only inside their own
-- still-editable draft lesson in an assigned subject. This is what closes the
-- "insert questions directly and skip content_approval" bypass.
drop policy if exists quizzes_write on public.quizzes;
create policy quizzes_write on public.quizzes for all
  using (public.is_admin() or public.lesson_is_teacher_editable(quizzes.lesson_id))
  with check (public.is_admin() or public.lesson_is_teacher_editable(quizzes.lesson_id));

drop policy if exists questions_write on public.questions;
create policy questions_write on public.questions for all
  using (
    public.is_admin()
    or exists (select 1 from public.quizzes q where q.id = questions.quiz_id and public.lesson_is_teacher_editable(q.lesson_id))
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.quizzes q where q.id = questions.quiz_id and public.lesson_is_teacher_editable(q.lesson_id))
  );

drop policy if exists choices_write on public.choices;
create policy choices_write on public.choices for all
  using (
    public.is_admin()
    or exists (
      select 1 from public.questions qs join public.quizzes q on q.id = qs.quiz_id
      where qs.id = choices.question_id and public.lesson_is_teacher_editable(q.lesson_id)
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.questions qs join public.quizzes q on q.id = qs.quiz_id
      where qs.id = choices.question_id and public.lesson_is_teacher_editable(q.lesson_id)
    )
  );

drop policy if exists lesson_cards_write on public.lesson_cards;
create policy lesson_cards_write on public.lesson_cards for all
  using (public.is_admin() or public.lesson_is_teacher_editable(lesson_cards.lesson_id))
  with check (public.is_admin() or public.lesson_is_teacher_editable(lesson_cards.lesson_id));

-- media_library: scope teacher writes to their own subjects too (previously any
-- uploader could attach media to any lesson).
drop policy if exists media_library_write on public.media_library;
create policy media_library_write on public.media_library for all
  using (
    public.is_admin()
    or (uploaded_by = auth.uid() and (lesson_id is null or public.teaches_subject(public.subject_of_lesson(lesson_id))))
  )
  with check (
    public.is_admin()
    or (uploaded_by = auth.uid() and (lesson_id is null or public.teaches_subject(public.subject_of_lesson(lesson_id))))
  );

-- ---------------------------------------------------------------------------
-- 8b. Storage — lesson illustrations, scoped to the teacher's own lessons
-- ---------------------------------------------------------------------------
-- 0008 allowed ANY teacher to write ANY object in `lesson-media`
-- (`public.is_teacher()` alone). Objects are keyed `<lesson_id>/<slot>`, so the
-- lesson is recoverable from the path and the grant can be checked properly.
-- Public read is unchanged — students must be able to load the images.
create or replace function public.lesson_media_object_allowed(p_name text)
returns boolean
language plpgsql stable security definer
set search_path = public
as $fn$
declare
  v_lesson uuid;
begin
  if public.is_admin() then
    return true;
  end if;
  begin
    v_lesson := ((storage.foldername(p_name))[1])::uuid;
  exception when others then
    -- Not a `<uuid>/<slot>` key: only admins may write outside the convention.
    return false;
  end;
  return public.lesson_is_teacher_editable(v_lesson);
end;
$fn$;

drop policy if exists lesson_media_staff_write on storage.objects;
create policy lesson_media_staff_write on storage.objects for insert
  with check (bucket_id = 'lesson-media' and public.lesson_media_object_allowed(name));

drop policy if exists lesson_media_staff_update on storage.objects;
create policy lesson_media_staff_update on storage.objects for update
  using (bucket_id = 'lesson-media' and public.lesson_media_object_allowed(name));

drop policy if exists lesson_media_staff_delete on storage.objects;
create policy lesson_media_staff_delete on storage.objects for delete
  using (bucket_id = 'lesson-media' and public.lesson_media_object_allowed(name));

-- ---------------------------------------------------------------------------
-- 9. Storage — private `lesson-sources` bucket (Defect 1)
-- ---------------------------------------------------------------------------
-- TeacherAiAssist uploads its source documents to `teacher/<uid>/<file>` in
-- this bucket; no migration ever created it, so every upload threw and the AI
-- tab reported the generic "backend not configured" banner.
insert into storage.buckets (id, name, public)
values ('lesson-sources', 'lesson-sources', false)
on conflict (id) do nothing;

drop policy if exists lesson_sources_staff_read on storage.objects;
create policy lesson_sources_staff_read on storage.objects for select
  using (
    bucket_id = 'lesson-sources'
    and (public.is_admin() or (storage.foldername(name))[2] = auth.uid()::text)
  );

drop policy if exists lesson_sources_owner_insert on storage.objects;
create policy lesson_sources_owner_insert on storage.objects for insert
  with check (
    bucket_id = 'lesson-sources'
    and public.is_teacher()
    and (storage.foldername(name))[1] = 'teacher'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists lesson_sources_owner_update on storage.objects;
create policy lesson_sources_owner_update on storage.objects for update
  using (
    bucket_id = 'lesson-sources'
    and (public.is_admin() or (storage.foldername(name))[2] = auth.uid()::text)
  );

drop policy if exists lesson_sources_owner_delete on storage.objects;
create policy lesson_sources_owner_delete on storage.objects for delete
  using (
    bucket_id = 'lesson-sources'
    and (public.is_admin() or (storage.foldername(name))[2] = auth.uid()::text)
  );

-- ---------------------------------------------------------------------------
-- 10. Audit trail for assignment changes (CDC 6.9 journal d'audit)
-- ---------------------------------------------------------------------------
create or replace function public.log_teacher_subject_change()
returns trigger
language plpgsql security definer
set search_path = public
as $fn$
begin
  insert into public.admin_logs (actor_id, action, target_table, target_id, metadata)
  values (
    coalesce(auth.uid(), case when tg_op = 'DELETE' then old.assigned_by else new.assigned_by end),
    case
      when tg_op = 'DELETE' then 'teacher_subject_deleted'
      when tg_op = 'INSERT' then 'teacher_subject_assigned'
      when new.status = 'revoked' and old.status = 'active' then 'teacher_subject_revoked'
      when new.status = 'active' and old.status = 'revoked' then 'teacher_subject_restored'
      else 'teacher_subject_updated'
    end,
    'teacher_subjects',
    case when tg_op = 'DELETE' then old.id else new.id end,
    jsonb_build_object(
      'teacher_id', case when tg_op = 'DELETE' then old.teacher_id else new.teacher_id end,
      'subject_id', case when tg_op = 'DELETE' then old.subject_id else new.subject_id end,
      'status', case when tg_op = 'DELETE' then 'deleted' else new.status end
    )
  );
  return null;
end;
$fn$;

drop trigger if exists teacher_subjects_audit on public.teacher_subjects;
create trigger teacher_subjects_audit
  after insert or update or delete on public.teacher_subjects
  for each row execute function public.log_teacher_subject_change();

-- Publication / approval events are logged by the `admin` Edge Function, which
-- owns those transitions.
