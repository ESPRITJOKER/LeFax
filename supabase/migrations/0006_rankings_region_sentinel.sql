-- 0006: make rankings de-duplicate correctly on recompute.
--
-- rankings has `unique (scope, region, user_id, period_start)` and the write
-- path upserts with `onConflict` on those columns. But `region` was NULL for
-- non-regional scopes (weekly/national), and Postgres treats NULLs as DISTINCT
-- in unique constraints — so ON CONFLICT never matched and every recompute
-- inserted a *new* duplicate row instead of updating the existing one, growing
-- the leaderboard unbounded.
--
-- Fix: use '' (empty string) as the sentinel for "no region" so the conflict
-- target always matches. Backfill existing NULLs, default new rows to '', and
-- forbid NULL going forward. The edge functions (rankings, mock-exams) now
-- write '' for weekly/national and coalesce regional region to ''.

update public.rankings set region = '' where region is null;

alter table public.rankings alter column region set default '';
alter table public.rankings alter column region set not null;
