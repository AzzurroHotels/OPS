-- V8 real team migration
alter table public.profiles add column if not exists email text;

-- Backfill existing users.
update public.profiles p
set email = u.email
from auth.users u
where p.id=u.id and (p.email is null or p.email<>u.email);

-- Keep email in sync when Auth creates a user.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  insert into public.profiles(id,display_name,email,role,is_active)
  values(
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name',split_part(coalesce(new.email,''),'@',1)),
    new.email,
    'team_member',
    true
  )
  on conflict(id) do update set email=excluded.email;
  return new;
end $$;

-- Profiles remain the single source for assignment labels.
-- Active authenticated users may read active team profiles under the existing SELECT policy.
