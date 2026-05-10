-- Final schema as of 2026-05-06. For incremental changes, use migrations under supabase/migrations/.

create extension if not exists "pgcrypto";

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid (),
  card_no text not null default '',
  full_name text not null default '',
  father_husband_name text not null default '',
  status text not null default 'Active',
  date_of_interview date,
  last_interview_date date,
  date_of_birth date,
  gender text not null default 'Male',
  marital_status text not null default 'Single',
  job_location text not null default '',
  department text not null default '',
  designation text not null default '',
  adhar_card text not null default '',
  pan_card text not null default '',
  account_no text not null default '',
  ifsc_code text not null default '',
  salary numeric(12,2) not null default 0,
  esic_no text not null default '',
  uan_no text not null default '',
  phone_no_1 text not null default '',
  phone_no_2 text not null default '',
  personal_email text not null default '',
  local_address text not null default '',
  permanent_address text not null default '',
  created_date date not null default ((timezone ('utc', now()))::date),
  intime text not null default '',
  outtime text not null default '',
  weekly_off text not null default '',
  personel_image text not null default '',
  updated_at timestamptz not null default timezone ('utc', now()),
  constraint employees_status_chk check (status in ('Active', 'Inactive')),
  constraint employees_gender_chk check (gender in ('Male', 'Female', 'Other')),
  constraint employees_marital_status_chk check (
    marital_status in ('Single', 'Married', 'Divorced', 'Widowed')
  )
);

create index if not exists employees_department_idx on public.employees (department);
create index if not exists employees_status_idx on public.employees (status);
create index if not exists employees_created_date_idx on public.employees (created_date desc);

grant select, insert, update, delete on public.employees to anon, authenticated;

create or replace function public.set_employees_updated_at ()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone ('utc', now ());
  return new;
end;
$$;

drop trigger if exists employees_set_updated_at on public.employees;
create trigger employees_set_updated_at
before update on public.employees
for each row
execute function public.set_employees_updated_at ();

alter table public.employees enable row level security;

drop policy if exists "employees_select_anon" on public.employees;
drop policy if exists "employees_insert_anon" on public.employees;
drop policy if exists "employees_update_anon" on public.employees;
drop policy if exists "employees_delete_anon" on public.employees;

create policy "employees_select_anon"
on public.employees for select to anon using (true);
create policy "employees_insert_anon"
on public.employees for insert to anon with check (true);
create policy "employees_update_anon"
on public.employees for update to anon using (true)
with check (true);
create policy "employees_delete_anon"
on public.employees for delete to anon using (true);

create table if not exists public.attendance_access_requests (
  id uuid primary key default gen_random_uuid (),
  requester_name text not null default '',
  card_no text not null default '',
  requested_shop_id uuid null,
  device_id text not null default '',
  status text not null default 'pending',
  request_lat double precision null,
  request_lng double precision null,
  request_accuracy_m double precision null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default timezone ('utc', now ()),
  constraint attendance_access_requests_status_chk
    check (status in ('pending', 'approved', 'rejected'))
);

create index if not exists attendance_access_requests_status_idx
  on public.attendance_access_requests (status, created_at desc);

create index if not exists attendance_access_requests_card_idx
  on public.attendance_access_requests (card_no, created_at desc);

grant select, insert, update, delete on public.attendance_access_requests to anon, authenticated;

alter table public.attendance_access_requests enable row level security;

drop policy if exists "attendance_access_requests_select_anon" on public.attendance_access_requests;
drop policy if exists "attendance_access_requests_insert_anon" on public.attendance_access_requests;
drop policy if exists "attendance_access_requests_update_anon" on public.attendance_access_requests;
drop policy if exists "attendance_access_requests_delete_anon" on public.attendance_access_requests;

create policy "attendance_access_requests_select_anon"
on public.attendance_access_requests for select to anon using (true);

create policy "attendance_access_requests_insert_anon"
on public.attendance_access_requests for insert to anon with check (true);

create policy "attendance_access_requests_update_anon"
on public.attendance_access_requests for update to anon using (true)
with check (true);

create policy "attendance_access_requests_delete_anon"
on public.attendance_access_requests for delete to anon using (true);

create table if not exists public.hr_login_credentials (
  id uuid primary key default gen_random_uuid (),
  username text not null unique,
  password text not null,
  full_name text not null default '',
  role text not null default 'admin',
  created_at timestamptz not null default timezone ('utc', now ())
);

create index if not exists hr_login_credentials_username_idx
  on public.hr_login_credentials (username);

grant select, insert, update, delete on public.hr_login_credentials to anon, authenticated;

alter table public.hr_login_credentials enable row level security;

drop policy if exists "hr_login_credentials_select_anon" on public.hr_login_credentials;
drop policy if exists "hr_login_credentials_insert_anon" on public.hr_login_credentials;
drop policy if exists "hr_login_credentials_update_anon" on public.hr_login_credentials;
drop policy if exists "hr_login_credentials_delete_anon" on public.hr_login_credentials;

create policy "hr_login_credentials_select_anon"
on public.hr_login_credentials for select to anon using (true);

create policy "hr_login_credentials_insert_anon"
on public.hr_login_credentials for insert to anon with check (true);

create policy "hr_login_credentials_update_anon"
on public.hr_login_credentials for update to anon using (true)
with check (true);

create policy "hr_login_credentials_delete_anon"
on public.hr_login_credentials for delete to anon using (true);
