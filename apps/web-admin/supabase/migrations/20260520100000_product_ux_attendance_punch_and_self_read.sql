-- Product UX: punch IN/OUT, employee self-read attendance, dashboard snapshot RPC.
-- Additive only; replaces mark_attendance_atomic with extended signature (deploy Edge same release).

-- ---------------------------------------------------------------------------
-- 1) attendance_logs — punch direction (IN / OUT)
-- ---------------------------------------------------------------------------
alter table public.attendance_logs
  add column if not exists punch_type text not null default 'in';

alter table public.attendance_logs drop constraint if exists attendance_logs_punch_type_chk;

alter table public.attendance_logs
  add constraint attendance_logs_punch_type_chk
  check (punch_type in ('in', 'out'));

create index if not exists attendance_logs_employee_ts_desc_idx2
  on public.attendance_logs (employee_id, "timestamp" desc, punch_type);

-- ---------------------------------------------------------------------------
-- 2) RLS — employees may read own attendance rows (additive)
-- ---------------------------------------------------------------------------
drop policy if exists "attendance_logs_select_employee_self" on public.attendance_logs;

create policy "attendance_logs_select_employee_self"
  on public.attendance_logs
  for select
  to authenticated
  using (employee_id = public.employee_id_for_auth_user());

grant select on table public.attendance_logs to authenticated;

-- ---------------------------------------------------------------------------
-- 3) RPC — list own punches (pagination cursor = timestamp strictly before)
-- ---------------------------------------------------------------------------
create or replace function public.employee_list_my_attendance(
  p_limit integer default 40,
  p_before timestamptz default null
)
returns table (
  id uuid,
  ts timestamptz,
  punch_type text,
  status text,
  face_verified boolean,
  shop_id uuid,
  latitude double precision,
  longitude double precision
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_emp uuid;
  v_lim integer;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;
  v_emp := public.employee_id_for_auth_user();
  if v_emp is null then
    raise exception 'EMPLOYEE_PROFILE_MISSING';
  end if;
  v_lim := greatest(1, least(coalesce(p_limit, 40), 100));

  return query
  select
    l.id,
    l."timestamp" as ts,
    l.punch_type,
    l.status,
    l.face_verified,
    l.shop_id,
    l.latitude,
    l.longitude
  from public.attendance_logs l
  where l.employee_id = v_emp
    and (p_before is null or l."timestamp" < p_before)
  order by l."timestamp" desc
  limit v_lim;
end;
$$;

revoke all on function public.employee_list_my_attendance(integer, timestamptz) from public;
grant execute on function public.employee_list_my_attendance(integer, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) RPC — dashboard header snapshot (name, shift, shop, latest access request)
-- ---------------------------------------------------------------------------
create or replace function public.employee_dashboard_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_emp uuid;
  v_full text;
  v_intime text;
  v_outtime text;
  v_shop_name text := '';
  v_shop_id uuid;
  v_req_status text := null;
  v_req_shop uuid := null;
  v_req_created timestamptz := null;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;
  v_emp := public.employee_id_for_auth_user();
  if v_emp is null then
    raise exception 'EMPLOYEE_PROFILE_MISSING';
  end if;

  select e.id, e.full_name, e.intime, e.outtime
    into v_emp, v_full, v_intime, v_outtime
  from public.employees e
  where e.id = v_emp
  limit 1;

  if not found then
    return '{}'::jsonb;
  end if;

  select d.shop_id
    into v_shop_id
  from public.employee_devices d
  where d.employee_id = v_emp
    and d.approved = true
    and coalesce(d.blocked, false) = false
    and d.revoked_at is null
  order by d.last_seen_at desc nulls last
  limit 1;

  if v_shop_id is not null then
    select s.name into v_shop_name from public.shops s where s.id = v_shop_id limit 1;
  end if;

  select r.status, r.requested_shop_id, r.created_at
    into v_req_status, v_req_shop, v_req_created
  from public.attendance_access_requests r
  where r.employee_id = v_emp
  order by r.created_at desc
  limit 1;

  return jsonb_build_object(
    'employee_id', v_emp,
    'full_name', coalesce(v_full, ''),
    'intime', coalesce(v_intime, ''),
    'outtime', coalesce(v_outtime, ''),
    'shop_id', v_shop_id,
    'shop_name', coalesce(v_shop_name, ''),
    'latest_access_request', case
      when v_req_status is null then null
      else jsonb_build_object(
        'status', v_req_status,
        'requested_shop_id', v_req_shop,
        'created_at', v_req_created
      )
    end
  );
end;
$$;

revoke all on function public.employee_dashboard_snapshot() from public;
grant execute on function public.employee_dashboard_snapshot() to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Replace mark_attendance_atomic — add punch_type + duplicate guards + shift status
-- ---------------------------------------------------------------------------
drop function if exists public.mark_attendance_atomic(
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
);

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
  p_timestamp timestamptz,
  p_punch_type text default 'in'
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
  v_punch text := lower(trim(coalesce(p_punch_type, 'in')));
  v_day date := (timezone('Asia/Kolkata', v_ts))::date;
  v_in_cnt integer;
  v_out_cnt integer;
  v_intime text;
  v_outtime text;
  v_start_m int;
  v_end_m int;
  v_punch_m int;
  v_grace int := 15;
  v_status text := 'present';
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

  if v_punch not in ('in', 'out') then
    return jsonb_build_object('ok', false, 'code', 'INVALID_REQUEST', 'message', 'Invalid punch_type');
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

  select count(*)::integer into v_in_cnt
  from public.attendance_logs l
  where l.employee_id = p_employee_id
    and l.punch_type = 'in'
    and (timezone('Asia/Kolkata', l."timestamp"))::date = v_day;

  select count(*)::integer into v_out_cnt
  from public.attendance_logs l
  where l.employee_id = p_employee_id
    and l.punch_type = 'out'
    and (timezone('Asia/Kolkata', l."timestamp"))::date = v_day;

  if v_punch = 'in' and v_in_cnt > 0 then
    return jsonb_build_object('ok', false, 'code', 'DUPLICATE_PUNCH_IN', 'message', 'Mark-in already recorded today');
  end if;
  if v_punch = 'out' and v_in_cnt < 1 then
    return jsonb_build_object('ok', false, 'code', 'NO_OPEN_IN_PUNCH', 'message', 'Mark-in required before mark-out');
  end if;
  if v_punch = 'out' and v_out_cnt > 0 then
    return jsonb_build_object('ok', false, 'code', 'DUPLICATE_PUNCH_OUT', 'message', 'Mark-out already recorded today');
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

  select e.face_embedding_version, e.intime, e.outtime
    into v_emp_version, v_intime, v_outtime
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

  -- Shift wall-clock (Asia/Kolkata same calendar day as punch)
  v_punch_m := (
    extract(hour from timezone('Asia/Kolkata', v_ts))::int * 60
    + extract(minute from timezone('Asia/Kolkata', v_ts))::int
  );
  begin
    v_start_m :=
      coalesce(nullif(trim(split_part(trim(coalesce(v_intime, '')), ':', 1)), '')::int, 9) * 60
      + coalesce(nullif(trim(split_part(trim(coalesce(v_intime, '')), ':', 2)), '')::int, 30);
  exception when others then
    v_start_m := 9 * 60 + 30;
  end;
  begin
    v_end_m :=
      coalesce(nullif(trim(split_part(trim(coalesce(v_outtime, '')), ':', 1)), '')::int, 18) * 60
      + coalesce(nullif(trim(split_part(trim(coalesce(v_outtime, '')), ':', 2)), '')::int, 0);
  exception when others then
    v_end_m := 18 * 60;
  end;

  if v_punch = 'in' then
    if v_punch_m > v_start_m + v_grace then
      v_status := 'late';
    else
      v_status := 'present';
    end if;
  else
    if v_punch_m < v_end_m - v_grace then
      v_status := 'early_exit';
    else
      v_status := 'present';
    end if;
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
    punch_type,
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
    v_status,
    v_punch,
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
      'idempotency_key', v_idem,
      'punch_type', v_punch,
      'status', v_status
    ),
    v_idem,
    v_ins_id
  );

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'attendance_id', v_ins_id,
    'status', 'accepted',
    'punch_type', v_punch,
    'attendance_status', v_status
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
  timestamptz,
  text
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
  timestamptz,
  text
) to service_role;
