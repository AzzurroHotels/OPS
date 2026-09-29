-- Run AFTER schema.sql
alter table public.profiles add column if not exists is_active boolean not null default true;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public
as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active=true);
$$;

-- Profiles: only admin may manage other profiles. Users can still read the shared team directory.
drop policy if exists "own profile editable" on public.profiles;
create policy "admins manage profiles" on public.profiles for update to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Block task/update access for deactivated users even if an old session exists.
drop policy if exists "tasks readable by authenticated" on public.tasks;
create policy "active users read tasks" on public.tasks for select to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active=true));

drop policy if exists "tasks creatable by authenticated" on public.tasks;
create policy "active users create tasks" on public.tasks for insert to authenticated
with check (created_by=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active=true));

drop policy if exists "tasks editable by authenticated" on public.tasks;
create policy "active users edit tasks" on public.tasks for update to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active=true))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active=true));

drop policy if exists "updates readable by authenticated" on public.task_updates;
create policy "active users read updates" on public.task_updates for select to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active=true));

drop policy if exists "updates creatable by authenticated" on public.task_updates;
create policy "active users create updates" on public.task_updates for insert to authenticated
with check (created_by=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active=true));
