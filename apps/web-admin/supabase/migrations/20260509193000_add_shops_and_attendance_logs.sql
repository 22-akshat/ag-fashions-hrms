-- Shops + attendance_logs (required by web admin Attendance.jsx, mobile attendanceApi / shopGeofence).
-- MUST run before 20260509195500_add_employee_locations_realtime.sql (that migration adds attendance_logs to supabase_realtime).

-- ---------------------------------------------------------------------------
-- 1) shops
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

alter table public.shops add column if not exists lat double precision;
alter table public.shops add column if not exists lng double precision;
alter table public.shops add column if not exists radius_meters numeric(12, 2) default 200;
alter table public.shops add column if not exists is_active boolean default true;
alter table public.shops add column if not exists created_at timestamptz default timezone ('utc', now());
alter table public.shops add column if not exists updated_at timestamptz default timezone ('utc', now());

create index if not exists shops_active_idx on public.shops (is_active) where is_active = true;

drop trigger if exists shops_set_updated_at on public.shops;
create trigger shops_set_updated_at
before update on public.shops
for each row
execute function public.set_employees_updated_at ();

alter table public.shops enable row level security;

grant select on table public.shops to anon, authenticated;
-- Writes: service_role (dashboard / Edge Functions), or authenticated when Supabase Auth is enabled.
grant insert, update, delete on table public.shops to authenticated;
grant all on table public.shops to service_role;

drop policy if exists "shops_select_all" on public.shops;
create policy "shops_select_all"
on public.shops for select
to anon, authenticated
using (true);

drop policy if exists "shops_write_authenticated" on public.shops;
create policy "shops_write_authenticated"
on public.shops for all
to authenticated
using (true)
with check (true);

-- ---------------------------------------------------------------------------
-- 2) attendance_logs (punch records; mobile INSERT, web SELECT + realtime)
-- ---------------------------------------------------------------------------
create table if not exists public.attendance_logs (
  id uuid primary key default gen_random_uuid (),
  employee_id uuid not null references public.employees (id) on delete cascade,
  "timestamp" timestamptz not null default timezone ('utc', now()),
  face_verified boolean not null default false,
  status text not null default 'present',
  created_at timestamptz not null default timezone ('utc', now()),
  updated_at timestamptz not null default timezone ('utc', now()),
  -- Mobile sends 'present'; UI normalizer also maps p/a/l/h and 'half day'.
  constraint attendance_logs_status_chk check (
    lower(trim(status)) in (
      'present','absent','leave','half_day','half day','p','a','l','h','halfday'
    )
  )
);

alter table public.attendance_logs add column if not exists "timestamp" timestamptz default timezone ('utc', now());
alter table public.attendance_logs add column if not exists face_verified boolean default false;
alter table public.attendance_logs add column if not exists status text default 'present';
alter table public.attendance_logs add column if not exists created_at timestamptz default timezone ('utc', now());
alter table public.attendance_logs add column if not exists updated_at timestamptz default timezone ('utc', now());

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

-- Legacy-friendly: current Vite HR + anon mobile clients use the anon key.
-- Replace with auth.uid()-scoped policies once Supabase Auth is wired project-wide (see hrms.mdc).

drop policy if exists "attendance_logs_select_legacy" on public.attendance_logs;
create policy "attendance_logs_select_legacy"
on public.attendance_logs for select
to anon, authenticated
using (true);

drop policy if exists "attendance_logs_insert_legacy" on public.attendance_logs;
create policy "attendance_logs_insert_legacy"
on public.attendance_logs for insert
to anon, authenticated
with check (true);

drop policy if exists "attendance_logs_update_authenticated" on public.attendance_logs;
create policy "attendance_logs_update_authenticated"
on public.attendance_logs for update
to authenticated
using (true)
with check (true);

drop policy if exists "attendance_logs_delete_authenticated" on public.attendance_logs;
create policy "attendance_logs_delete_authenticated"
on public.attendance_logs for delete
to authenticated
using (true);

-- ---------------------------------------------------------------------------
-- 3) FK: attendance_access_requests.requested_shop_id -> shops(id)
--    Safe if legacy rows reference missing shops — null them first.
-- ---------------------------------------------------------------------------
update public.attendance_access_requests r
set requested_shop_id = null
where
  r.requested_shop_id is not null
  and not exists (
    select 1 from public.shops s where s.id = r.requested_shop_id
  );

alter table public.attendance_access_requests
drop constraint if exists attendance_access_requests_requested_shop_id_fkey;

alter table public.attendance_access_requests
add constraint attendance_access_requests_requested_shop_id_fkey
foreign key (requested_shop_id) references public.shops (id)
on delete set null;
