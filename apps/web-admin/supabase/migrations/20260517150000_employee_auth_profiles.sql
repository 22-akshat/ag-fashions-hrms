-- Phase 4: Employee Auth mapping (employees ↔ auth.users).
-- This is separate from HR RBAC (hr_users).

create table if not exists public.employee_auth_profiles (
  auth_user_id uuid primary key references auth.users (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  status text not null default 'active',
  created_at timestamptz not null default timezone ('utc', now ()),
  phone text not null default '',
  constraint employee_auth_profiles_employee_id_unique unique (employee_id),
  constraint employee_auth_profiles_status_chk check (status in ('active', 'disabled'))
);

create index if not exists employee_auth_profiles_employee_id_idx
  on public.employee_auth_profiles (employee_id);

create index if not exists employee_auth_profiles_status_idx
  on public.employee_auth_profiles (status);

alter table public.employee_auth_profiles enable row level security;

-- No anon access.
revoke all on table public.employee_auth_profiles from anon;

-- Authenticated employees can read own mapping row only.
drop policy if exists "employee_auth_profiles_select_self" on public.employee_auth_profiles;
create policy "employee_auth_profiles_select_self"
  on public.employee_auth_profiles
  for select
  to authenticated
  using (auth_user_id = auth.uid());

-- HR full CRUD.
drop policy if exists "employee_auth_profiles_select_hr" on public.employee_auth_profiles;
create policy "employee_auth_profiles_select_hr"
  on public.employee_auth_profiles
  for select
  to authenticated
  using (public.is_hr_user(auth.uid()));

drop policy if exists "employee_auth_profiles_insert_hr" on public.employee_auth_profiles;
create policy "employee_auth_profiles_insert_hr"
  on public.employee_auth_profiles
  for insert
  to authenticated
  with check (public.is_hr_user(auth.uid()));

drop policy if exists "employee_auth_profiles_update_hr" on public.employee_auth_profiles;
create policy "employee_auth_profiles_update_hr"
  on public.employee_auth_profiles
  for update
  to authenticated
  using (public.is_hr_user(auth.uid()))
  with check (public.is_hr_user(auth.uid()));

drop policy if exists "employee_auth_profiles_delete_hr" on public.employee_auth_profiles;
create policy "employee_auth_profiles_delete_hr"
  on public.employee_auth_profiles
  for delete
  to authenticated
  using (public.is_hr_user(auth.uid()));

-- Explicit grants: keep narrow.
grant select on table public.employee_auth_profiles to authenticated;
grant all on table public.employee_auth_profiles to service_role;

