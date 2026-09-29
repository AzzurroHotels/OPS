-- OPS CONTROL V9 - Supabase repair/migration
begin;
create extension if not exists pgcrypto;

create table if not exists public.profiles(
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '',
 email text,
 role text not null default 'team_member' check(role in('admin','manager','team_member')),
 department text,
 is_active boolean not null default true,
 created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists is_active boolean not null default true;

create table if not exists public.tasks(
 id uuid primary key default gen_random_uuid(), title text not null, property text,
 department text not null check(department in('Bathroom Cleaning','Room Deep Cleaning','Maintenance','Developer Pipeline','Reception','Other')),
 assignee_id uuid references public.profiles(id) on delete set null,
 priority text not null default 'Medium' check(priority in('High','Medium','Low')),
 status text not null default 'New Task' check(status in('New Task','In Progress','Final Confirmation','Finished')),
 description text, deadline timestamptz, actual_start timestamptz, completed_at timestamptz,
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.task_updates(
 id uuid primary key default gen_random_uuid(), task_id uuid not null references public.tasks(id) on delete cascade,
 body text not null, update_type text not null default 'Update', created_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create index if not exists tasks_status_idx on public.tasks(status);
create index if not exists tasks_department_idx on public.tasks(department);
create index if not exists tasks_deadline_idx on public.tasks(deadline);
create index if not exists task_updates_task_idx on public.task_updates(task_id,created_at desc);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.profiles(id,display_name,email,role,is_active)
 values(new.id,coalesce(new.raw_user_meta_data->>'display_name',split_part(coalesce(new.email,''),'@',1)),new.email,'team_member',true)
 on conflict(id) do update set email=excluded.email;
 return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

insert into public.profiles(id,display_name,email,role,is_active)
select u.id,coalesce(u.raw_user_meta_data->>'display_name',split_part(coalesce(u.email,''),'@',1)),u.email,'team_member',true
from auth.users u on conflict(id) do update set email=excluded.email;

update public.profiles set display_name='Alvin Rustia',role='admin',is_active=true
where lower(email)=lower('alvinrustia@azzurrohotels.com');

create or replace function public.is_active_user() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where id=auth.uid() and is_active=true) $$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active=true) $$;
create or replace function public.is_manager_or_admin() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role in('admin','manager') and is_active=true) $$;
create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now();return new;end $$;
drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at before update on public.tasks for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security; alter table public.tasks enable row level security; alter table public.task_updates enable row level security;
do $$ declare r record; begin for r in select policyname,tablename from pg_policies where schemaname='public' and tablename in('profiles','tasks','task_updates') loop execute format('drop policy if exists %I on public.%I',r.policyname,r.tablename); end loop; end $$;
create policy "active read profiles" on public.profiles for select to authenticated using(public.is_active_user());
create policy "admin update profiles" on public.profiles for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "active read tasks" on public.tasks for select to authenticated using(public.is_active_user());
create policy "active insert tasks" on public.tasks for insert to authenticated with check(public.is_active_user() and created_by=auth.uid());
create policy "active update tasks" on public.tasks for update to authenticated using(public.is_active_user()) with check(public.is_active_user());
create policy "manager delete tasks" on public.tasks for delete to authenticated using(public.is_manager_or_admin());
create policy "active read updates" on public.task_updates for select to authenticated using(public.is_active_user());
create policy "active insert updates" on public.task_updates for insert to authenticated with check(public.is_active_user() and created_by=auth.uid());

do $$ begin
 begin alter publication supabase_realtime add table public.tasks; exception when duplicate_object then null; end;
 begin alter publication supabase_realtime add table public.task_updates; exception when duplicate_object then null; end;
 begin alter publication supabase_realtime add table public.profiles; exception when duplicate_object then null; end;
end $$;
commit;
select display_name,email,role,department,is_active,id from public.profiles order by display_name;
