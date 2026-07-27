-- 0005: Profile picture upload + nickname
--
-- avatar_url already existed on profiles but had no upload path (Storage
-- bucket/RLS) and nothing writing it. Adds:
--   1. profiles.nickname — shown just under the name on the Profile screen.
--   2. rankings.avatar_url — the leaderboard reads from `rankings`, not
--      `profiles` directly (profiles_select_own on 0001_init.sql restricts
--      reads to your own row; rankings intentionally denormalizes what the
--      public leaderboard needs so it never touches another student's
--      profile row). Avatar has to be denormalized the same way as
--      display_name/town or it can never show up there.
--   3. an `avatars` Storage bucket + RLS so each student can only write to
--      their own `{user_id}/...` folder, with public read so the URL
--      persisted to profiles.avatar_url / rankings.avatar_url just works
--      as a plain <img src>.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nickname text;

ALTER TABLE public.rankings
  ADD COLUMN IF NOT EXISTS avatar_url text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists avatars_own_write on storage.objects;
create policy avatars_own_write on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_own_update on storage.objects;
create policy avatars_own_update on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_own_delete on storage.objects;
create policy avatars_own_delete on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
