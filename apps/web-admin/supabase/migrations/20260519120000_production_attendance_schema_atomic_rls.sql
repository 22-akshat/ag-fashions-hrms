-- Phase: production punch schema alignment + atomic mark + RLS tightening (additive / rollout-safe).
--
-- DEPLOYMENT:
--   1) Apply migration (staging → prod).
--   2) Deploy updated `mark-attendance` Edge function.
--   3) Ensure secret `ATTENDANCE_EDGE_INVOCATION_KEY` is set; mobile sends `x-attendance-edge-invocation-key`.
--
-- ROLLBACK: see docs/production-stabilization-roadmap.md (Phase 0).

-- ---------------------------------------------------------------------------
-- 1) attendance_logs — columns required by Edge punch path
-- ---------------------------------------------------------------------------
alter table public.attendance_logs
  add column if not exists device_id text null;

alter table public.attendance_logs
  add column if not exists shop_id uuid null references public.shops (id) on delete set null;

alter table public.attendance_logs
  add column if not exists latitude double precision null;

alter table public.attendance_logs
  add column if not exists longitude double precision null;

alter table public.attendance_logs
  add column if not exists face_session_token text null;

alter table public.attendance_logs
  add column if not exists offline_id text null;

create index if not exists attendance_logs_shop_id_idx
  on public.attendance_logs (shop_id)
  where shop_id is not null;

create index if not exists attendance_logs_device_id_idx
  on public.attendance_logs (device_id)
  where device_id is not null;

create unique index if not exists attendance_logs_face_session_token_uidx
  on public.attendance_logs (face_session_token)
  where face_session_token is not null;

-- ---------------------------------------------------------------------------
-- 2) attendance_logs — extended status labels (classification engine prep)
-- ---------------------------------------------------------------------------
alter table public.attendance_logs drop constraint if exists attendance_logs_status_chk;

alter table public.attendance_logs
  add constraint attendance_logs_status_chk check (
    lower(trim(status)) in (
      'present',
      'absent',
      'leave',
      'half_day',
      'half day',
      'p',
      'a',
      'l',
      'h',
      'halfday',
      'late',
      'early_exit',
      'early exit'
    )
  );

-- ---------------------------------------------------------------------------
-- 3) employee_devices — optional bound shop (Edge may also pass shop_id per punch)
-- ---------------------------------------------------------------------------
alter table public.employee_devices
  add column if not exists shop_id uuid null references public.shops (id) on delete set null;

create index if not exists employee_devices_shop_id_idx
  on public.employee_devices (shop_id)
  where shop_id is not null;

-- ---------------------------------------------------------------------------
-- 4) Public audit wrapper (Edge calls this name; delegates to internal fn)
-- ---------------------------------------------------------------------------
create or replace function public.attendance_audit_append(
  p_employee_id uuid,
  p_event_type text,
  p_detail jsonb,
  p_idempotency_key text default null,
  p_attendance_log_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._attendance_audit_append(
    p_employee_id,
    p_event_type,
    p_detail,
    p_idempotency_key,
    p_attendance_log_id
  );
end;
$$;

revoke all on function public.attendance_audit_append(uuid, text, jsonb, text, uuid) from public;
grant execute on function public.attendance_audit_append(uuid, text, jsonb, text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 5) Atomic punch: idempotency + session consume + attendance row + audit (single txn)
-- ---------------------------------------------------------------------------
create or replace function public.mark_attendance_atomic(
  p_employee_id uuid,
  p_device_id text,
  p_face_session_token text,
  p_shop_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_embedding_version integer,
  p_idempotency_key text,
  p_offline_id text,
  p_timestamp timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tid text := nullif(trim(coalesce(p_device_id, '')), '');
  v_token text := nullif(trim(coalesce(p_face_session_token, '')), '');
  v_idem text := nullif(trim(coalesce(p_idempotency_key, '')), '');
  v_existing uuid;
  v_device record;
  v_emp_version integer;
  v_session record;
  v_shop_lat double precision;
  v_shop_lng double precision;
  v_shop_radius_m numeric;
  v_dist double precision;
  v_radius double precision;
  v_now timestamptz := timezone('utc', now());
  v_ts timestamptz := coalesce(p_timestamp, v_now);
  v_ins_id uuid;
  v_lat1 double precision := radians(p_latitude);
  v_lat2 double precision;
  v_lon1 double precision := radians(p_longitude);
  v_lon2 double precision;
  a double precision;
begin
  if p_employee_id is null then
    return jsonb_build_object('ok', false, 'code', 'INVALID_REQUEST', 'message', 'Missing employee_id');
  end if;
  if v_tid is null then
    return jsonb_build_object('ok', false, 'code', 'INVALID_REQUEST', 'message', 'Missing device_id');
  end if;
  if v_token is null then
    return jsonb_build_object('ok', false, 'code', 'FACE_SESSION_MISSING', 'message', 'Missing face session');
  end if;
  if p_shop_id is null then
    return jsonb_build_object('ok', false, 'code', 'SHOP_ID_REQUIRED', 'message', 'Missing shop_id');
  end if;
  if p_latitude is null or p_longitude is null
     or not (p_latitude = p_latitude and p_longitude = p_longitude)
     or abs(p_latitude) > 90::double precision
     or abs(p_longitude) > 180::double precision then
    return jsonb_build_object('ok', false, 'code', 'GEOFENCE_INVALID', 'message', 'GPS coordinates invalid');
  end if;

  if v_idem is not null then
    select l.id into v_existing
    from public.attendance_logs l
    where l.idempotency_key = v_idem
    limit 1;
    if v_existing is not null then
      return jsonb_build_object(
        'ok', true,
        'duplicate', true,
        'attendance_id', v_existing,
        'status', 'accepted'
      );
    end if;
  end if;

  select *
    into v_device
  from public.employee_devices d
  where d.employee_id = p_employee_id
    and d.device_id = v_tid
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'DEVICE_NOT_FOUND', 'message', 'Device not registered');
  end if;

  if v_device.blocked_at is not null or v_device.revoked_at is not null then
    return jsonb_build_object('ok', false, 'code', 'DEVICE_BLOCKED', 'message', 'Device blocked');
  end if;
  if coalesce(v_device.blocked, false) = true or coalesce(v_device.approved, false) <> true then
    return jsonb_build_object('ok', false, 'code', 'DEVICE_BLOCKED', 'message', 'Device not approved');
  end if;
  if v_device.integrity_status is not distinct from 'failed' then
    return jsonb_build_object('ok', false, 'code', 'DEVICE_INTEGRITY_FAILED', 'message', 'Device integrity failed');
  end if;

  select e.face_embedding_version
    into v_emp_version
  from public.employees e
  where e.id = p_employee_id
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'INVALID_REQUEST', 'message', 'Employee not found');
  end if;

  if coalesce(v_emp_version, 1) <> coalesce(p_embedding_version, 1) then
    return jsonb_build_object('ok', false, 'code', 'FACE_EMBEDDING_VERSION_MISMATCH', 'message', 'Embedding version mismatch');
  end if;

  select *
    into v_session
  from public.attendance_face_sessions s
  where s.session_token = v_token
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'FACE_SESSION_INVALID', 'message', 'Invalid session');
  end if;

  if v_session.employee_id <> p_employee_id then
    return jsonb_build_object('ok', false, 'code', 'FACE_SESSION_INVALID', 'message', 'Session employee mismatch');
  end if;
  if v_session.device_id is distinct from v_tid then
    return jsonb_build_object('ok', false, 'code', 'FACE_SESSION_DEVICE_MISMATCH', 'message', 'Device mismatch');
  end if;
  if v_session.used_at is not null then
    return jsonb_build_object('ok', false, 'code', 'FACE_SESSION_USED', 'message', 'Session already used');
  end if;
  if v_session.expires_at < v_now then
    return jsonb_build_object('ok', false, 'code', 'FACE_SESSION_EXPIRED', 'message', 'Session expired');
  end if;

  select s.lat, s.lng, s.radius_meters
    into v_shop_lat, v_shop_lng, v_shop_radius_m
  from public.shops s
  where s.id = p_shop_id
    and s.is_active = true
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'SHOP_COORDINATES_MISSING', 'message', 'Shop not found');
  end if;

  if v_shop_lat is null or v_shop_lng is null
     or not (v_shop_lat = v_shop_lat and v_shop_lng = v_shop_lng) then
    return jsonb_build_object('ok', false, 'code', 'SHOP_GEOFENCE_INVALID', 'message', 'Shop geolocation invalid');
  end if;

  v_lat2 := radians(v_shop_lat);
  v_lon2 := radians(v_shop_lng);

  a := sin((v_lat2 - v_lat1) / 2.0) * sin((v_lat2 - v_lat1) / 2.0)
    + cos(v_lat1) * cos(v_lat2) * sin((v_lon2 - v_lon1) / 2.0) * sin((v_lon2 - v_lon1) / 2.0);
  v_dist := 2.0 * 6371000.0 * asin(least(1.0, sqrt(greatest(a, 0.0))));

  v_radius := greatest(coalesce(v_shop_radius_m::double precision, 150.0), 150.0);
  v_radius := least(v_radius, 500000.0);

  if v_dist > v_radius then
    return jsonb_build_object('ok', false, 'code', 'GEOFENCE_BLOCKED', 'message', 'Outside geofence');
  end if;

  insert into public.attendance_logs (
    employee_id,
    device_id,
    shop_id,
    face_verified,
    face_session_token,
    latitude,
    longitude,
    "timestamp",
    status,
    mark_source,
    idempotency_key,
    offline_id
  ) values (
    p_employee_id,
    v_tid,
    p_shop_id,
    true,
    v_token,
    p_latitude,
    p_longitude,
    v_ts,
    'present',
    'edge',
    v_idem,
    nullif(trim(coalesce(p_offline_id, '')), '')
  )
  returning id into v_ins_id;

  update public.attendance_face_sessions s
    set used_at = v_now
  where s.session_token = v_token
    and s.used_at is null;

  perform public._attendance_audit_append(
    p_employee_id,
    'ATTENDANCE_ACCEPTED_FINAL',
    jsonb_build_object(
      'device_id', v_tid,
      'shop_id', p_shop_id,
      'dist_m', v_dist,
      'idempotency_key', v_idem
    ),
    v_idem,
    v_ins_id
  );

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'attendance_id', v_ins_id,
    'status', 'accepted'
  );
exception
  when unique_violation then
    if v_idem is not null then
      select l.id into v_existing from public.attendance_logs l where l.idempotency_key = v_idem limit 1;
      if v_existing is not null then
        return jsonb_build_object('ok', true, 'duplicate', true, 'attendance_id', v_existing, 'status', 'accepted');
      end if;
    end if;
    return jsonb_build_object('ok', false, 'code', 'ATTENDANCE_INSERT_FAILED', 'message', 'Duplicate or conflict');
end;
$$;

revoke all on function public.mark_attendance_atomic(
  uuid,
  text,
  text,
  uuid,
  double precision,
  double precision,
  integer,
  text,
  text,
  timestamptz
) from public;

grant execute on function public.mark_attendance_atomic(
  uuid,
  text,
  text,
  uuid,
  double precision,
  double precision,
  integer,
  text,
  text,
  timestamptz
) to service_role;

-- ---------------------------------------------------------------------------
-- 6) RLS — remove permissive anon table access (mobile uses RPCs / Edge)
-- ---------------------------------------------------------------------------
drop policy if exists "employee_locations_insert_anon_mobile" on public.employee_locations;
drop policy if exists "employee_locations_update_anon_mobile" on public.employee_locations;
revoke insert, update on table public.employee_locations from anon;

drop policy if exists "attendance_access_requests_insert_anon" on public.attendance_access_requests;
drop policy if exists "attendance_access_requests_select_anon" on public.attendance_access_requests;
revoke insert, select on table public.attendance_access_requests from anon;

-- ---------------------------------------------------------------------------
-- 7) employees — remove broad anon SELECT (use definer RPCs for subsets)
-- ---------------------------------------------------------------------------
drop policy if exists "employees_select_anon_active" on public.employees;
revoke select on table public.employees from anon;

-- ---------------------------------------------------------------------------
-- 8) security policy helper — do not expose policy JSON to anon
-- ---------------------------------------------------------------------------
revoke execute on function public.get_active_security_policy() from anon;
