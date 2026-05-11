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
  employee_id uuid null references public.employees (id) on delete set null,
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

create index if not exists attendance_access_requests_employee_id_idx
  on public.attendance_access_requests (employee_id)
  where employee_id is not null;

create unique index if not exists attendance_access_requests_one_pending_per_employee_idx
  on public.attendance_access_requests (employee_id)
  where status = 'pending' and employee_id is not null;

create unique index if not exists attendance_access_requests_one_pending_per_card_idx
  on public.attendance_access_requests (card_no)
  where status = 'pending' and trim(card_no) <> '';

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

-- ---------------------------------------------------------------------------
-- shops + attendance_logs (see migration 20260509193000_add_shops_and_attendance_logs.sql)
-- ---------------------------------------------------------------------------
create table if not exists public.shops (
  id uuid primary key default gen_random_uuid (),
  name text not null default '',
  lat double precision not null,
  lng double precision not null,
  radius_meters numeric(12, 2) not null default 200,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone ('utc', now()),
  updated_at timestamptz not null default timezone ('utc', now()),
  constraint shops_lat_chk check (lat >= -90::double precision and lat <= 90::double precision),
  constraint shops_lng_chk check (lng >= -180::double precision and lng <= 180::double precision),
  constraint shops_radius_meters_chk check (radius_meters > 0 and radius_meters <= 500000::numeric)
);

create index if not exists shops_active_idx on public.shops (is_active) where is_active = true;

drop trigger if exists shops_set_updated_at on public.shops;
create trigger shops_set_updated_at
before update on public.shops
for each row
execute function public.set_employees_updated_at ();

alter table public.shops enable row level security;

grant select on table public.shops to anon, authenticated;
grant insert, update, delete on table public.shops to anon, authenticated;
grant all on table public.shops to service_role;

drop policy if exists "shops_select_all" on public.shops;
create policy "shops_select_all"
on public.shops for select to anon, authenticated using (true);

drop policy if exists "shops_write_authenticated" on public.shops;
create policy "shops_write_authenticated"
on public.shops for all to authenticated using (true) with check (true);

drop policy if exists "shops_write_anon" on public.shops;
create policy "shops_write_anon"
on public.shops for all to anon using (true) with check (true);

create table if not exists public.attendance_logs (
  id uuid primary key default gen_random_uuid (),
  employee_id uuid not null references public.employees (id) on delete cascade,
  "timestamp" timestamptz not null default timezone ('utc', now()),
  face_verified boolean not null default false,
  status text not null default 'present',
  created_at timestamptz not null default timezone ('utc', now()),
  updated_at timestamptz not null default timezone ('utc', now()),
  constraint attendance_logs_status_chk check (
    lower(trim(status)) in (
      'present','absent','leave','half_day','half day','p','a','l','h','halfday'
    )
  )
);

drop trigger if exists attendance_logs_set_updated_at on public.attendance_logs;
create trigger attendance_logs_set_updated_at
before update on public.attendance_logs
for each row
execute function public.set_employees_updated_at ();

create index if not exists attendance_logs_employee_timestamp_desc_idx
on public.attendance_logs (employee_id, "timestamp" desc);

create index if not exists attendance_logs_timestamp_desc_idx
on public.attendance_logs ("timestamp" desc);

create index if not exists attendance_logs_created_at_desc_idx
on public.attendance_logs (created_at desc);

alter table public.attendance_logs enable row level security;

grant select, insert on table public.attendance_logs to anon, authenticated;
grant update, delete on table public.attendance_logs to authenticated;
grant all on table public.attendance_logs to service_role;

drop policy if exists "attendance_logs_select_legacy" on public.attendance_logs;
create policy "attendance_logs_select_legacy"
on public.attendance_logs for select to anon, authenticated using (true);

drop policy if exists "attendance_logs_insert_legacy" on public.attendance_logs;
create policy "attendance_logs_insert_legacy"
on public.attendance_logs for insert to anon, authenticated with check (true);

drop policy if exists "attendance_logs_update_authenticated" on public.attendance_logs;
create policy "attendance_logs_update_authenticated"
on public.attendance_logs for update to authenticated using (true) with check (true);

drop policy if exists "attendance_logs_delete_authenticated" on public.attendance_logs;
create policy "attendance_logs_delete_authenticated"
on public.attendance_logs for delete to authenticated using (true);

update public.attendance_access_requests r
set requested_shop_id = null
where r.requested_shop_id is not null and not exists (select 1 from public.shops s where s.id = r.requested_shop_id);

alter table public.attendance_access_requests drop constraint if exists attendance_access_requests_requested_shop_id_fkey;

alter table public.attendance_access_requests add constraint attendance_access_requests_requested_shop_id_fkey foreign key (requested_shop_id) references public.shops (id) on delete set null;
