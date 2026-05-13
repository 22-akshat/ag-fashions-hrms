-- Phase 4: authenticated employee RPCs + RLS tightening (rollout-safe).
-- NOTE: existing anon policies remain temporarily; new mobile builds should use these RPCs.

-- ---------------------------------------------------------------------------
-- 1) Helper: resolve employee_id for current auth user
-- ---------------------------------------------------------------------------
create or replace function public.employee_id_for_auth_user()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select eap.employee_id
  from public.employee_auth_profiles eap
  where eap.auth_user_id = auth.uid()
    and eap.status = 'active'
  limit 1;
$$;

revoke all on function public.employee_id_for_auth_user() from public;
grant execute on function public.employee_id_for_auth_user() to authenticated;

-- ---------------------------------------------------------------------------
-- 2) employee_devices: employee self SELECT (own devices) + no anon
-- ---------------------------------------------------------------------------
drop policy if exists "employee_devices_select_employee_self" on public.employee_devices;
create policy "employee_devices_select_employee_self"
  on public.employee_devices
  for select
  to authenticated
  using (
    employee_id = public.employee_id_for_auth_user()
  );

-- ---------------------------------------------------------------------------
-- 3) employee_locations: add authenticated write policies (own row only)
-- ---------------------------------------------------------------------------
drop policy if exists "employee_locations_insert_employee_self" on public.employee_locations;
create policy "employee_locations_insert_employee_self"
  on public.employee_locations
  for insert
  to authenticated
  with check (employee_id = public.employee_id_for_auth_user());

drop policy if exists "employee_locations_update_employee_self" on public.employee_locations;
create policy "employee_locations_update_employee_self"
  on public.employee_locations
  for update
  to authenticated
  using (employee_id = public.employee_id_for_auth_user())
  with check (employee_id = public.employee_id_for_auth_user());

-- ---------------------------------------------------------------------------
-- 4) attendance_access_requests: employee self SELECT/INSERT (own only)
-- ---------------------------------------------------------------------------
drop policy if exists "attendance_access_requests_select_employee_self" on public.attendance_access_requests;
create policy "attendance_access_requests_select_employee_self"
  on public.attendance_access_requests
  for select
  to authenticated
  using (employee_id = public.employee_id_for_auth_user());

drop policy if exists "attendance_access_requests_insert_employee_self" on public.attendance_access_requests;
create policy "attendance_access_requests_insert_employee_self"
  on public.attendance_access_requests
  for insert
  to authenticated
  with check (employee_id = public.employee_id_for_auth_user());

-- ---------------------------------------------------------------------------
-- 5) Authenticated RPC: upsert location (device-validated)
-- ---------------------------------------------------------------------------
create or replace function public.employee_upsert_location(
  p_lat double precision,
  p_lng double precision,
  p_accuracy double precision,
  p_recorded_at timestamptz,
  p_device_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp uuid;
  v_tid text := trim(coalesce(p_device_id, ''));
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED' using message = 'Login required';
  end if;
  v_emp := public.employee_id_for_auth_user();
  if v_emp is null then
    raise exception 'EMPLOYEE_PROFILE_MISSING' using message = 'Employee profile mapping missing';
  end if;
  if v_tid = '' then
    raise exception 'DEVICE_ID_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.employee_devices d
    where d.employee_id = v_emp
      and d.device_id = v_tid
      and d.approved = true
      and d.blocked = false
      and d.revoked_at is null
  ) then
    raise exception 'DEVICE_BLOCKED' using message = 'Device revoked/blocked';
  end if;

  insert into public.employee_locations (employee_id, lat, lng, accuracy, recorded_at)
  values (v_emp, p_lat, p_lng, p_accuracy, coalesce(p_recorded_at, timezone('utc', now())))
  on conflict (employee_id) do update
    set lat = excluded.lat,
        lng = excluded.lng,
        accuracy = excluded.accuracy,
        recorded_at = excluded.recorded_at;
end;
$$;

revoke all on function public.employee_upsert_location(double precision, double precision, double precision, timestamptz, text, jsonb) from public;
grant execute on function public.employee_upsert_location(double precision, double precision, double precision, timestamptz, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 6) Authenticated RPC: create access request (device-validated)
-- ---------------------------------------------------------------------------
create or replace function public.employee_create_access_request(
  p_requested_shop_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_accuracy_m double precision,
  p_device_id text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp uuid;
  v_tid text := trim(coalesce(p_device_id, ''));
  v_card text;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED' using message = 'Login required';
  end if;
  v_emp := public.employee_id_for_auth_user();
  if v_emp is null then
    raise exception 'EMPLOYEE_PROFILE_MISSING';
  end if;
  if v_tid = '' then
    raise exception 'DEVICE_ID_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.employee_devices d
    where d.employee_id = v_emp
      and d.device_id = v_tid
      and d.approved = true
      and d.blocked = false
      and d.revoked_at is null
  ) then
    raise exception 'DEVICE_BLOCKED';
  end if;

  select e.card_no, e.full_name
    into v_card, v_name
  from public.employees e
  where e.id = v_emp
  limit 1;

  -- Idempotent pending-per-employee unique index already exists.
  insert into public.attendance_access_requests (
    employee_id,
    requester_name,
    card_no,
    requested_shop_id,
    device_id,
    status,
    request_lat,
    request_lng,
    request_accuracy_m
  ) values (
    v_emp,
    coalesce(v_name, ''),
    coalesce(v_card, ''),
    p_requested_shop_id,
    v_tid,
    'pending',
    p_lat,
    p_lng,
    p_accuracy_m
  )
  on conflict do nothing;

  return 'ok';
end;
$$;

revoke all on function public.employee_create_access_request(uuid, double precision, double precision, double precision, text) from public;
grant execute on function public.employee_create_access_request(uuid, double precision, double precision, double precision, text) to authenticated;

