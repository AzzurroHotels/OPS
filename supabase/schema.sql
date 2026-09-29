-- Operations Dashboard schema
-- Run in Supabase SQL Editor before enabling cloud sync.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'team_member' check (role in ('admin','manager','team_member')),
  department text,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  property text,
  department text not null check (department in ('Bathroom Cleaning','Room Deep Cleaning','Maintenance','Developer Pipeline','Reception','Other')),
  assignee_id uuid references public.profiles(id) on delete set null,
  priority text not null default 'Medium' check (priority in ('High','Medium','Low')),
  status text not null default 'New Task' check (status in ('New Task','In Progress','Final Confirmation','Finished')),
  description text,
  deadline timestamptz,
  actual_start timestamptz,
  completed_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_updates (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  body text not null,
  update_type text not null default 'Update',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists tasks_status_idx on public.tasks(status);
create index if not exists tasks_department_idx on public.tasks(department);
create index if not exists tasks_deadline_idx on public.tasks(deadline);
create index if not exists task_updates_task_idx on public.task_updates(task_id, created_at desc);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, display_name)
  values(new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email,''),'@',1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at before update on public.tasks
for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.task_updates enable row level security;

-- Internal operations app: every authenticated team member can read the shared workspace.
drop policy if exists "profiles readable by authenticated" on public.profiles;
create policy "profiles readable by authenticated" on public.profiles for select to authenticated using (true);

drop policy if exists "own profile editable" on public.profiles;
create policy "own profile editable" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "tasks readable by authenticated" on public.tasks;
create policy "tasks readable by authenticated" on public.tasks for select to authenticated using (true);

drop policy if exists "tasks creatable by authenticated" on public.tasks;
create policy "tasks creatable by authenticated" on public.tasks for insert to authenticated
with check (created_by = auth.uid());

drop policy if exists "tasks editable by authenticated" on public.tasks;
create policy "tasks editable by authenticated" on public.tasks for update to authenticated using (true) with check (true);

drop policy if exists "tasks deletable by managers" on public.tasks;
create policy "tasks deletable by managers" on public.tasks for delete to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','manager')));

drop policy if exists "updates readable by authenticated" on public.task_updates;
create policy "updates readable by authenticated" on public.task_updates for select to authenticated using (true);

drop policy if exists "updates creatable by authenticated" on public.task_updates;
create policy "updates creatable by authenticated" on public.task_updates for insert to authenticated
with check (created_by = auth.uid());

-- Updates are intentionally immutable: no update/delete policies.
