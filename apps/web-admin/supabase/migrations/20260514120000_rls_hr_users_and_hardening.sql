-- ============================================================================
-- RLS hardening + HR role model (incremental rollout)
--
-- MIGRATION ORDER (apply after Supabase Auth users exist):
--   1) Deploy web-admin with HR users signing in via Supabase Auth (JWT = authenticated).
--   2) Create each HR account in Dashboard → Authentication → Users.
--   3) For EACH HR Auth user UUID, insert into public.hr_users (see bottom template).
--   4) Apply this migration.
--
-- If step 3 is skipped: authenticated HR policies match nothing → empty data / errors.
--
-- ROLLBACK RISKS:
--   - Reverting this migration without restoring old policies leaves tables locked down.
--   - Keep a backup of policy names + definitions before deploy.
--
-- CLIENT IMPACT SUMMARY:
--   - Web HR (logged in): must have row in hr_users; uses authenticated JWT + new policies.
--   - Mobile (anon key): keeps narrow anon policies for punch, access requests, locations,
--     employee lookup, shops read (see comments per table). Legacy attendance_logs INSERT
--     remains for anon until a follow-up migration forces Edge-only inserts.
--   - Edge mark-attendance: unchanged (service_role bypasses RLS).
--   - hr_login_credentials: anon/authenticated revoked — table unused by app after Auth migration.
--
-- POLICIES REMOVED (by name) vs ADDED: see section headers below.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) HR role table + helper (SECURITY DEFINER reads hr_users under owner perms)
-- ---------------------------------------------------------------------------
create table if not exists public.hr_users (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'hr_admin',
  created_at timestamptz not null default timezone ('utc', now ()),
  constraint hr_users_user_id_unique unique (user_id)
);

create index if not exists hr_users_user_id_idx on public.hr_users (user_id);

alter table public.hr_users enable row level security;

grant select on table public.hr_users to authenticated;

drop policy if exists "hr_users_self_select" on public.hr_users;
create policy "hr_users_self_select" on public.hr_users for select to authenticated using (user_id = auth.uid());

comment on table public.hr_users is 'Maps auth.users to HR app access. Seed rows via SQL editor (service role) after creating Auth users.';

create or replace function public.is_hr_user (check_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.hr_users hu
    where hu.user_id = check_uid
  );
$$;

comment on function public.is_hr_user (uuid) is 'True if auth user is registered as HR. SECURITY DEFINER; EXECUTE granted to authenticated only.';

revoke all on function public.is_hr_user (uuid) from PUBLIC;

grant execute on function public.is_hr_user (uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) employees — REMOVED: employees_select_anon, employees_insert_anon,
--    employees_update_anon, employees_delete_anon (all broad anon).
--    ADDED: HR authenticated CRUD via is_hr_user; anon SELECT Active only (mobile lookup).
-- ---------------------------------------------------------------------------
drop policy if exists "employees_select_anon" on public.employees;
drop policy if exists "employees_insert_anon" on public.employees;
drop policy if exists "employees_update_anon" on public.employees;
drop policy if exists "employees_delete_anon" on public.employees;

create policy "employees_select_hr" on public.employees for select to authenticated using (public.is_hr_user (auth.uid()));

create policy "employees_insert_hr" on public.employees for insert to authenticated with check (public.is_hr_user (auth.uid()));

create policy "employees_update_hr" on public.employees for update to authenticated using (public.is_hr_user (auth.uid())) with check (public.is_hr_user (auth.uid()));

create policy "employees_delete_hr" on public.employees for delete to authenticated using (public.is_hr_user (auth.uid()));

create policy "employees_select_anon_active" on public.employees for select to anon using (status = 'Active');

revoke insert, update, delete on table public.employees from anon;

-- ---------------------------------------------------------------------------
-- 3) shops — REMOVED: shops_select_all, shops_write_authenticated, shops_write_anon.
--    ADDED: HR authenticated full CRUD; anon SELECT (mobile geofence + anon clients).
-- ---------------------------------------------------------------------------
drop policy if exists "shops_select_all" on public.shops;
drop policy if exists "shops_write_authenticated" on public.shops;
drop policy if exists "shops_write_anon" on public.shops;

create policy "shops_select_hr" on public.shops for select to authenticated using (public.is_hr_user (auth.uid()));

create policy "shops_insert_hr" on public.shops for insert to authenticated with check (public.is_hr_user (auth.uid()));

create policy "shops_update_hr" on public.shops for update to authenticated using (public.is_hr_user (auth.uid())) with check (public.is_hr_user (auth.uid()));

create policy "shops_delete_hr" on public.shops for delete to authenticated using (public.is_hr_user (auth.uid()));

create policy "shops_select_anon" on public.shops for select to anon using (true);

revoke insert, update, delete on table public.shops from anon;

-- ---------------------------------------------------------------------------
-- 4) attendance_logs — REMOVED: attendance_logs_select_legacy,
--    attendance_logs_insert_legacy, attendance_logs_update_authenticated,
--    attendance_logs_delete_authenticated.
--    ADDED: HR authenticated SELECT/UPDATE/DELETE; anon INSERT TEMPORARY (legacy mobile).
--    Target state: anon INSERT dropped once mobile uses Edge-only path exclusively.
-- ---------------------------------------------------------------------------
drop policy if exists "attendance_logs_select_legacy" on public.attendance_logs;
drop policy if exists "attendance_logs_insert_legacy" on public.attendance_logs;
drop policy if exists "attendance_logs_update_authenticated" on public.attendance_logs;
drop policy if exists "attendance_logs_delete_authenticated" on public.attendance_logs;

create policy "attendance_logs_select_hr" on public.attendance_logs for select to authenticated using (public.is_hr_user (auth.uid()));

create policy "attendance_logs_update_hr" on public.attendance_logs for update to authenticated using (public.is_hr_user (auth.uid())) with check (public.is_hr_user (auth.uid()));

create policy "attendance_logs_delete_hr" on public.attendance_logs for delete to authenticated using (public.is_hr_user (auth.uid()));

create policy "attendance_logs_insert_anon_mobile_legacy" on public.attendance_logs for insert to anon with check (true);

revoke select, update, delete on table public.attendance_logs from anon;

-- ---------------------------------------------------------------------------
-- 5) employee_locations — REMOVED: "Employees can upsert own location" (anon ALL broad).
--    ADDED: HR authenticated SELECT; anon INSERT/UPDATE TEMPORARY (mobile background sync).
--    Note: strict "no anon writes" deferred to follow-up once mobile writes via Edge/auth.
-- ---------------------------------------------------------------------------
drop policy if exists "Employees can upsert own location" on public.employee_locations;

create policy "employee_locations_select_hr" on public.employee_locations for select to authenticated using (public.is_hr_user (auth.uid()));

create policy "employee_locations_insert_anon_mobile" on public.employee_locations for insert to anon with check (true);

create policy "employee_locations_update_anon_mobile" on public.employee_locations for update to anon using (true) with check (true);

revoke delete on table public.employee_locations from anon;

-- ---------------------------------------------------------------------------
-- 6) attendance_access_requests — REMOVED: four broad anon policies.
--    ADDED: HR authenticated SELECT/UPDATE/DELETE; anon INSERT + SELECT (mobile + kiosk flows).
-- ---------------------------------------------------------------------------
drop policy if exists "attendance_access_requests_select_anon" on public.attendance_access_requests;
drop policy if exists "attendance_access_requests_insert_anon" on public.attendance_access_requests;
drop policy if exists "attendance_access_requests_update_anon" on public.attendance_access_requests;
drop policy if exists "attendance_access_requests_delete_anon" on public.attendance_access_requests;

create policy "attendance_access_requests_select_hr" on public.attendance_access_requests for select to authenticated using (public.is_hr_user (auth.uid()));

create policy "attendance_access_requests_update_hr" on public.attendance_access_requests for update to authenticated using (public.is_hr_user (auth.uid())) with check (public.is_hr_user (auth.uid()));

create policy "attendance_access_requests_delete_hr" on public.attendance_access_requests for delete to authenticated using (public.is_hr_user (auth.uid()));

create policy "attendance_access_requests_insert_anon" on public.attendance_access_requests for insert to anon with check (true);

create policy "attendance_access_requests_select_anon" on public.attendance_access_requests for select to anon using (true);

revoke delete on table public.attendance_access_requests from anon;

-- ---------------------------------------------------------------------------
-- 7) hr_login_credentials — REMOVED: all four anon policies; REVOKE app roles.
--    Table retained for future DROP migration; only service_role / superuser usable.
-- ---------------------------------------------------------------------------
drop policy if exists "hr_login_credentials_select_anon" on public.hr_login_credentials;
drop policy if exists "hr_login_credentials_insert_anon" on public.hr_login_credentials;
drop policy if exists "hr_login_credentials_update_anon" on public.hr_login_credentials;
drop policy if exists "hr_login_credentials_delete_anon" on public.hr_login_credentials;

revoke all on table public.hr_login_credentials from anon;

revoke all on table public.hr_login_credentials from authenticated;

grant all on table public.hr_login_credentials to service_role;

-- ---------------------------------------------------------------------------
-- 8) Grants alignment (minimal surface; service_role unchanged by explicit grants)
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

-- hr_users: authenticated read own row only (policy); no anon
revoke all on table public.hr_users from anon;

grant select on table public.hr_users to authenticated;

-- ---------------------------------------------------------------------------
-- SEED TEMPLATE (run manually in SQL editor with service role after migration):
--
-- insert into public.hr_users (user_id, role)
-- values ('<uuid-from-auth.users>', 'hr_admin');
--
-- ============================================================================
