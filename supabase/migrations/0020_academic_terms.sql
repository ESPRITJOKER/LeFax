-- 0020: Academic terms (année académique / périodes)
--
-- Why this table did not exist before: nothing in 0001..0019 models a school
-- year or a term. The admin Settings page was therefore a raw key/value editor
-- over `settings`, and the feedback round asked for real term management
-- ("changing term") — which cannot be expressed as one more `settings` row
-- without inventing a second, untyped configuration system.
--
-- Model:
--   * One row per term, grouped by `academic_year` ("2026-2027").
--   * Exactly one term may be active at a time. That is enforced by a PARTIAL
--     UNIQUE INDEX, not by application code, so two concurrent activations
--     cannot both win.
--   * Terms are archived, never deleted: there is deliberately no delete
--     policy, so administrative history (and anything that later references a
--     term) survives. `archived_at` is the switch.
--   * Every write is mirrored into `admin_logs` by a trigger, the same shape
--     as `teacher_subjects_audit` in 0018, so the audit journal shows term
--     changes without the UI having to remember to log them.

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
create table if not exists public.academic_terms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  academic_year text not null,
  starts_on date not null,
  ends_on date not null,
  is_active boolean not null default false,
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academic_terms_name_not_blank check (btrim(name) <> ''),
  constraint academic_terms_year_not_blank check (btrim(academic_year) <> ''),
  constraint academic_terms_dates check (ends_on > starts_on)
);

comment on table public.academic_terms is
  'Academic years and their terms. Exactly one row may have is_active = true (partial unique index). Terms are archived via archived_at, never deleted.';

-- Same term name cannot be declared twice inside one academic year.
create unique index if not exists academic_terms_year_name_key
  on public.academic_terms (academic_year, lower(btrim(name)));

-- THE single-active rule. A partial unique index over a constant expression
-- allows at most one row where is_active is true, across the whole table.
create unique index if not exists academic_terms_single_active
  on public.academic_terms ((is_active)) where is_active;

create index if not exists academic_terms_year_idx
  on public.academic_terms (academic_year, starts_on);

-- ---------------------------------------------------------------------------
-- 2. Integrity guards
-- ---------------------------------------------------------------------------
-- An archived term must not also be the active one; and `updated_at` is kept
-- honest here rather than trusted from the client.
create or replace function public.guard_academic_term()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if new.archived_at is not null and new.is_active then
    raise exception 'an archived term cannot be the active term';
  end if;
  new.updated_at := now();
  return new;
end;
$fn$;

drop trigger if exists academic_terms_guard on public.academic_terms;
create trigger academic_terms_guard
  before insert or update on public.academic_terms
  for each row execute function public.guard_academic_term();

-- ---------------------------------------------------------------------------
-- 3. Activation, atomically
-- ---------------------------------------------------------------------------
-- Deactivating the previous term and activating the new one must be one
-- statement pair inside one transaction, or the partial unique index above
-- would reject the second half and leave no term active. SECURITY DEFINER so
-- the two writes are not each re-checked against RLS mid-flight; the caller is
-- still authorised explicitly on the first line.
create or replace function public.set_active_academic_term(term_id uuid)
returns public.academic_terms
language plpgsql security definer
set search_path = public
as $fn$
declare
  result public.academic_terms;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (select 1 from public.academic_terms where id = term_id and archived_at is null) then
    raise exception 'term not found or archived';
  end if;

  update public.academic_terms set is_active = false where is_active and id <> term_id;
  update public.academic_terms set is_active = true where id = term_id returning * into result;

  return result;
end;
$fn$;

revoke all on function public.set_active_academic_term(uuid) from public;
grant execute on function public.set_active_academic_term(uuid) to authenticated;

-- Convenience read used by the app shell; no security implication (the term
-- itself is not sensitive) and it keeps callers from re-implementing the
-- "active, not archived" predicate.
create or replace function public.active_academic_term()
returns public.academic_terms
language sql stable
set search_path = public
as $fn$
  select * from public.academic_terms where is_active and archived_at is null limit 1;
$fn$;

-- ---------------------------------------------------------------------------
-- 4. RLS — everyone signed in may read, only admins may write, nobody deletes
-- ---------------------------------------------------------------------------
alter table public.academic_terms enable row level security;

drop policy if exists academic_terms_read on public.academic_terms;
create policy academic_terms_read on public.academic_terms
  for select using (auth.role() = 'authenticated');

drop policy if exists academic_terms_insert on public.academic_terms;
create policy academic_terms_insert on public.academic_terms
  for insert with check (public.is_admin());

drop policy if exists academic_terms_update on public.academic_terms;
create policy academic_terms_update on public.academic_terms
  for update using (public.is_admin()) with check (public.is_admin());

-- No delete policy on purpose: archive instead (see the header).

-- ---------------------------------------------------------------------------
-- 5. Audit trail (CDC 6.9 journal d'audit)
-- ---------------------------------------------------------------------------
create or replace function public.log_academic_term_change()
returns trigger
language plpgsql security definer
set search_path = public
as $fn$
begin
  insert into public.admin_logs (actor_id, action, target_table, target_id, metadata)
  values (
    coalesce(auth.uid(), new.created_by),
    case
      when tg_op = 'INSERT' then 'academic_term_created'
      when new.is_active and not old.is_active then 'academic_term_activated'
      when old.archived_at is null and new.archived_at is not null then 'academic_term_archived'
      when old.archived_at is not null and new.archived_at is null then 'academic_term_restored'
      else 'academic_term_updated'
    end,
    'academic_terms',
    new.id,
    jsonb_build_object(
      'name', new.name,
      'academic_year', new.academic_year,
      'starts_on', new.starts_on,
      'ends_on', new.ends_on,
      'is_active', new.is_active
    )
  );
  return null;
end;
$fn$;

drop trigger if exists academic_terms_audit on public.academic_terms;
create trigger academic_terms_audit
  after insert or update on public.academic_terms
  for each row execute function public.log_academic_term_change();

-- ---------------------------------------------------------------------------
-- 6. Settings the admin General tab edits
-- ---------------------------------------------------------------------------
-- The production `settings` table was populated by hand (no migration seeds
-- it), so the General tab would otherwise have nothing typed to show. These
-- are idempotent: an existing value is never overwritten.
insert into public.settings (key, value)
values
  ('platform_name', '"Lefax Course"'::jsonb),
  ('default_language', '"fr"'::jsonb),
  ('support_phone', '""'::jsonb)
on conflict (key) do nothing;
