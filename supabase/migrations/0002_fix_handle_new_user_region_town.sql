-- 0001_init.sql's handle_new_user() trigger dropped region/town from the
-- signup metadata even though CDC 6.1 requires capturing them at
-- registration ("Prénom, Nom, Numéro de téléphone, Région, Ville, ...").
-- Found while verifying the auth-otp no-SMS signup bypass end-to-end.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, first_name, last_name, phone, region, town)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    coalesce(new.phone, new.raw_user_meta_data ->> 'phone', ''),
    new.raw_user_meta_data ->> 'region',
    new.raw_user_meta_data ->> 'town'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
