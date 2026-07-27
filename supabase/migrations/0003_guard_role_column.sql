-- profiles_update_own (0001_init.sql) has no WITH CHECK, so Postgres reuses
-- its USING clause (id = auth.uid() or is_admin()) as the check too. That
-- only constrains which row can be touched, not which columns — so any
-- logged-in student can currently self-promote via
-- supabase.from('profiles').update({ role: 'admin' }) from the client.
--
-- RLS is row-level, not column-level, so fix it with a trigger instead of
-- trying to bend WITH CHECK into a column-level rule. auth.uid() is only
-- set inside an authenticated PostgREST/Supabase request; direct SQL run as
-- the Postgres superuser (Studio SQL editor, migrations, service-role calls)
-- has no JWT context, so auth.uid() is null there and this guard is a no-op
-- for that trusted path — manual promotion from Studio keeps working.

create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role <> old.role
     and auth.uid() is not null
     and not public.is_admin()
  then
    new.role := old.role;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_role on public.profiles;

create trigger profiles_guard_role
before update on public.profiles
for each row
execute function public.prevent_role_self_escalation();