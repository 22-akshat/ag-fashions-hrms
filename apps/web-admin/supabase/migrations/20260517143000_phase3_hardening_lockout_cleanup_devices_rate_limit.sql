-- Phase 3 hardening / stabilization:
-- 1) Failed-attempt lockout for face verification session creation
-- 2) Session cleanup function (manual invocation; no pg_cron assumed)
-- 3) Device replacement / revocation fields + enforcement compatibility
-- 4) Lightweight server rate limiting for mobile RPCs
-- 5) Expand audit coverage using existing attendance_audit_events patterns

-- ---------------------------------------------------------------------------
-- 0) employee_devices extra fields (revocation/replacement support)
-- ---------------------------------------------------------------------------
alter table public.employee_devices
  add column if not exists blocked_at timestamptz null,
  add column if not exists blocked_reason text null,
  add column if not exists revoked_by uuid null references auth.users (id) on delete set null,
  add column if not exists approved_by uuid null references auth.users (id) on delete set null;

-- ---------------------------------------------------------------------------
-- 1) face_verification_attempts (lockout)
-- ---------------------------------------------------------------------------
create table if not exists public.face_verification_attempts (
  employee_id uuid not null references public.employees (id) on delete cascade,
  device_id text not null,
  failed_count integer not null default 0,
  locked_until timestamptz null,
  updated_at timestamptz not null default timezone('utc', now()),
  metadata jsonb not null default '{}'::jsonb,
  primary key (employee_id, device_id)
);

create index if not exists face_verification_attempts_locked_until_idx
  on public.face_verification_attempts (locked_until)
  where locked_until is not null;

alter table public.face_verification_attempts enable row level security;
revoke all on table public.face_verification_attempts from public;
grant all on table public.face_verification_attempts to service_role;
revoke all on table public.face_verification_attempts from anon;
revoke all on table public.face_verification_attempts from authenticated;

-- ---------------------------------------------------------------------------
-- 2) DB-backed lightweight rate limiting
-- ---------------------------------------------------------------------------
create table if not exists public.mobile_rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  action text not null,
  employee_id uuid null references public.employees (id) on delete set null,
  device_id text null,
  ip inet null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists mobile_rate_limit_events_action_created_idx
  on public.mobile_rate_limit_events (action, created_at desc);

create index if not exists mobile_rate_limit_events_employee_created_idx
  on public.mobile_rate_limit_events (employee_id, created_at desc)
  where employee_id is not null;

create index if not exists mobile_rate_limit_events_device_created_idx
  on public.mobile_rate_limit_events (device_id, created_at desc)
  where device_id is not null;

alter table public.mobile_rate_limit_events enable row level security;
revoke all on table public.mobile_rate_limit_events from public;
grant all on table public.mobile_rate_limit_events to service_role;
revoke all on table public.mobile_rate_limit_events from anon;
revoke all on table public.mobile_rate_limit_events from authenticated;

-- Helper: record and enforce simple windowed limits. SECURITY DEFINER, callable by other definer RPCs.
create or replace function public._mobile_rate_limit_guard(
  p_action text,
  p_employee_id uuid,
  p_device_id text,
  p_window_seconds integer,
  p_max_events integer,
  p_ip inet default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_since timestamptz := timezone('utc', now()) - make_interval(secs => greatest(1, coalesce(p_window_seconds, 60)));
  v_count integer;
begin
  insert into public.mobile_rate_limit_events (action, employee_id, device_id, ip, metadata)
  values (coalesce(p_action, ''), p_employee_id, nullif(trim(coalesce(p_device_id, '')), ''), p_ip, coalesce(p_metadata, '{}'::jsonb));

  select count(*)::integer
    into v_count
  from public.mobile_rate_limit_events e
  where e.action = coalesce(p_action, '')
    and e.created_at >= v_since
    and (
      (p_employee_id is not null and e.employee_id = p_employee_id)
      or (nullif(trim(coalesce(p_device_id, '')), '') is not null and e.device_id = nullif(trim(coalesce(p_device_id, '')), ''))
    );

  if v_count > greatest(1, coalesce(p_max_events, 30)) then
    raise exception 'RATE_LIMITED'
      using message = 'Too many requests. Please wait and try again.';
  end if;
end;
$$;

revoke all on function public._mobile_rate_limit_guard(text, uuid, text, integer, integer, inet, jsonb) from public;
grant execute on function public._mobile_rate_limit_guard(text, uuid, text, integer, integer, inet, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 3) Cleanup function for attendance_face_sessions (manual invocation)
-- ---------------------------------------------------------------------------
create or replace function public.cleanup_attendance_face_sessions(
  p_delete_expired_before timestamptz default timezone('utc', now()),
  p_used_retention_hours integer default 24
)
returns table (
  deleted_expired integer,
  deleted_used integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  n1 integer := 0;
  n2 integer := 0;
  v_used_cutoff timestamptz := timezone('utc', now()) - make_interval(hours => greatest(1, coalesce(p_used_retention_hours, 24)));
begin
  delete from public.attendance_face_sessions s
  where s.used_at is null
    and s.expires_at < p_delete_expired_before;
  get diagnostics n1 = row_count;

  delete from public.attendance_face_sessions s
  where s.used_at is not null
    and s.used_at < v_used_cutoff;
  get diagnostics n2 = row_count;

  return query select n1, n2;
end;
$$;

revoke all on function public.cleanup_attendance_face_sessions(timestamptz, integer) from public;
grant execute on function public.cleanup_attendance_face_sessions(timestamptz, integer) to service_role;

-- ---------------------------------------------------------------------------
-- 4) Update mobile RPCs with: lockout + rate limit + embedding version check + stronger audit
-- ---------------------------------------------------------------------------

-- Helper: write audit using existing attendance_audit_events table.
create or replace function public._attendance_audit_append(
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
  insert into public.attendance_audit_events (
    employee_id,
    attendance_log_id,
    event_type,
    idempotency_key,
    detail
  ) values (
    p_employee_id,
    p_attendance_log_id,
    coalesce(p_event_type, 'unknown'),
    nullif(trim(coalesce(p_idempotency_key, '')), ''),
    coalesce(p_detail, '{}'::jsonb)
  );
exception when others then
  -- Audit must never block main flows.
  null;
end;
$$;

revoke all on function public._attendance_audit_append(uuid, text, jsonb, text, uuid) from public;
grant execute on function public._attendance_audit_append(uuid, text, jsonb, text, uuid) to service_role;

-- Update: employee lookup RPC (rate limit + audit on failures)
create or replace function public.mobile_lookup_active_employee_by_card (p_card_no text)
returns table (
  id uuid,
  card_no text,
  full_name text,
  status text,
  has_registered_face boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  n_match integer;
  v_card text := trim(lower(coalesce(p_card_no, '')));
begin
  perform public._mobile_rate_limit_guard('lookup_employee', null, v_card, 60, 60, null, jsonb_build_object('card_no', v_card));

  select count(*)::integer
    into n_match
  from public.employees e
  where e.status = 'Active'
    and trim(lower(e.card_no)) = v_card;

  if n_match = 0 then
    return;
  end if;

  if n_match > 1 then
    raise exception 'AMBIGUOUS_CARD_NO'
      using message = 'Multiple active employees share this card number; fix master data.';
  end if;

  return query
  select
    e.id,
    e.card_no,
    e.full_name,
    e.status,
    (e.face_embedding is not null)::boolean as has_registered_face
  from public.employees e
  where e.status = 'Active'
    and trim(lower(e.card_no)) = v_card
  limit 1;
end;
$$;

-- Update: face registration RPC (rate limit + audit events; preserve existing behavior)
create or replace function public.mobile_register_employee_face_and_device (
  p_employee_id uuid,
  p_face_embedding jsonb,
  p_device_id text,
  p_embedding_version integer default 1,
  p_allow_replace boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_face boolean;
  v_tid text := trim(coalesce(p_device_id, ''));
begin
  if v_tid = '' then
    raise exception 'DEVICE_ID_REQUIRED';
  end if;

  perform public._mobile_rate_limit_guard('face_register', p_employee_id, v_tid, 60, 10, null, jsonb_build_object('employee_id', p_employee_id, 'device_id', v_tid));

  if not exists (select 1 from public.employees ex where ex.id = p_employee_id) then
    perform public._attendance_audit_append(p_employee_id, 'face_registration_failed', jsonb_build_object('reason','EMPLOYEE_NOT_FOUND'), null, null);
    raise exception 'EMPLOYEE_NOT_FOUND';
  end if;

  select (e.face_embedding is not null)
    into v_has_face
  from public.employees e
  where e.id = p_employee_id;

  if not exists (
    select 1
    from public.employees ex
    where ex.id = p_employee_id
      and ex.status = 'Active'
  ) then
    perform public._attendance_audit_append(p_employee_id, 'face_registration_failed', jsonb_build_object('reason','EMPLOYEE_INACTIVE'), null, null);
    raise exception 'EMPLOYEE_INACTIVE';
  end if;

  if v_has_face and not coalesce(p_allow_replace, false) then
    perform public._attendance_audit_append(p_employee_id, 'face_registration_failed', jsonb_build_object('reason','FACE_ALREADY_REGISTERED'), null, null);
    raise exception 'FACE_ALREADY_REGISTERED'
      using hint = 'Set p_allow_replace true after user confirms replace (UI warning).';
  end if;

  update public.employees ex
    set face_embedding = p_face_embedding,
        face_registered_at = timezone ('utc', now ()),
        face_embedding_version = coalesce(nullif(p_embedding_version, 0), ex.face_embedding_version, 1)
  where ex.id = p_employee_id
    and ex.status = 'Active';

  insert into public.employee_devices as ed (
      employee_id,
      device_id,
      approved,
      blocked,
      blocked_at,
      blocked_reason,
      last_seen_at,
      created_at
    )
    values (
      p_employee_id,
      v_tid,
      true,
      false,
      null,
      null,
      timezone ('utc', now ()),
      timezone ('utc', now ())
    )
  on conflict (employee_id, device_id) do update
    set last_seen_at = timezone ('utc', now ()),
        blocked = false,
        blocked_at = null,
        blocked_reason = null;

  perform public._attendance_audit_append(p_employee_id, 'face_registration_success', jsonb_build_object('device_id', v_tid, 'embedding_version', p_embedding_version), null, null);
end;
$$;

-- Update: create face verification session RPC (lockout + reset on success + rate limiting + version check)
create or replace function public.mobile_create_face_verification_session(
  p_employee_id uuid,
  p_device_id text,
  p_verification_score numeric default null,
  p_expires_in_seconds integer default 120,
  p_metadata jsonb default '{}'::jsonb,
  p_embedding_version integer default 1
)
returns table (
  session_token text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_expires timestamptz;
  v_token text;
  v_tid text := trim(coalesce(p_device_id, ''));
  v_has_face boolean;
  v_device_ok boolean;
  v_employee_version integer;
  v_failed integer := 0;
  v_locked_until timestamptz;
begin
  if p_employee_id is null then
    raise exception 'EMPLOYEE_ID_REQUIRED' using message = 'employee_id is required';
  end if;
  if v_tid = '' then
    raise exception 'DEVICE_ID_REQUIRED' using message = 'device_id is required';
  end if;

  -- Lightweight rate limiting (defaults: 20/min per employee or device).
  perform public._mobile_rate_limit_guard('create_face_session', p_employee_id, v_tid, 60, 20, null, jsonb_build_object('employee_id', p_employee_id, 'device_id', v_tid));

  -- Lockout check: ignore expired locks.
  select a.failed_count, a.locked_until
    into v_failed, v_locked_until
  from public.face_verification_attempts a
  where a.employee_id = p_employee_id
    and a.device_id = v_tid;

  if v_locked_until is not null and v_locked_until > v_now then
    perform public._attendance_audit_append(p_employee_id, 'face_verification_failed', jsonb_build_object('reason','FACE_VERIFICATION_LOCKED','locked_until',v_locked_until,'device_id',v_tid), null, null);
    raise exception 'FACE_VERIFICATION_LOCKED' using message = 'Too many failed attempts. Try later.';
  end if;

  select (e.face_embedding is not null), e.face_embedding_version
    into v_has_face, v_employee_version
  from public.employees e
  where e.id = p_employee_id
  limit 1;

  if v_has_face is distinct from true then
    perform public._attendance_audit_append(p_employee_id, 'face_verification_failed', jsonb_build_object('reason','FACE_NOT_REGISTERED','device_id',v_tid), null, null);
    raise exception 'FACE_NOT_REGISTERED' using message = 'Employee has no registered face template';
  end if;

  if coalesce(nullif(p_embedding_version, 0), 1) <> coalesce(v_employee_version, 1) then
    perform public._attendance_audit_append(p_employee_id, 'face_verification_failed', jsonb_build_object('reason','FACE_EMBEDDING_VERSION_MISMATCH','expected',v_employee_version,'got',p_embedding_version,'device_id',v_tid), null, null);
    raise exception 'FACE_EMBEDDING_VERSION_MISMATCH'
      using message = 'Face template version mismatch. Re-enroll face on this device.';
  end if;

  select exists (
    select 1
    from public.employee_devices d
    where d.employee_id = p_employee_id
      and d.device_id = v_tid
      and d.approved = true
      and d.blocked = false
  ) into v_device_ok;

  if v_device_ok is distinct from true then
    perform public._attendance_audit_append(p_employee_id, 'face_verification_failed', jsonb_build_object('reason','DEVICE_NOT_APPROVED','device_id',v_tid), null, null);
    raise exception 'DEVICE_NOT_APPROVED'
      using message = 'Device not bound/approved for this employee';
  end if;

  v_expires := v_now + make_interval(secs => greatest(10, least(coalesce(p_expires_in_seconds, 120), 600)));
  v_token := encode(gen_random_bytes(32), 'hex');

  insert into public.attendance_face_sessions (
    employee_id,
    device_id,
    session_token,
    verification_score,
    created_at,
    expires_at,
    used_at,
    metadata
  ) values (
    p_employee_id,
    v_tid,
    v_token,
    p_verification_score,
    v_now,
    v_expires,
    null,
    coalesce(p_metadata, '{}'::jsonb)
  );

  -- Success resets lockout counter for this employee+device.
  insert into public.face_verification_attempts as a (employee_id, device_id, failed_count, locked_until, updated_at, metadata)
  values (p_employee_id, v_tid, 0, null, v_now, '{}'::jsonb)
  on conflict (employee_id, device_id) do update
    set failed_count = 0,
        locked_until = null,
        updated_at = v_now;

  perform public._attendance_audit_append(p_employee_id, 'face_verification_success', jsonb_build_object('device_id',v_tid,'score',p_verification_score,'expires_at',v_expires), null, null);
  return query select v_token, v_expires;
end;
$$;

-- Helper RPC to record failed verification attempt (called by mobile on verification failure).
create or replace function public.mobile_record_face_verification_failure(
  p_employee_id uuid,
  p_device_id text,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  failed_count integer,
  locked_until timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_tid text := trim(coalesce(p_device_id, ''));
  v_failed integer := 0;
  v_locked timestamptz;
begin
  if p_employee_id is null then
    raise exception 'EMPLOYEE_ID_REQUIRED';
  end if;
  if v_tid = '' then
    raise exception 'DEVICE_ID_REQUIRED';
  end if;

  perform public._mobile_rate_limit_guard('record_face_failure', p_employee_id, v_tid, 60, 30, null, jsonb_build_object('reason', p_reason));

  insert into public.face_verification_attempts as a (
    employee_id,
    device_id,
    failed_count,
    locked_until,
    updated_at,
    metadata
  ) values (
    p_employee_id,
    v_tid,
    1,
    null,
    v_now,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (employee_id, device_id) do update
    set failed_count = case
        when a.locked_until is not null and a.locked_until > v_now then a.failed_count
        when a.failed_count >= 5 then a.failed_count
        else a.failed_count + 1
      end,
      locked_until = case
        when a.locked_until is not null and a.locked_until > v_now then a.locked_until
        when a.failed_count + 1 >= 5 then v_now + make_interval(mins => 30)
        else null
      end,
      updated_at = v_now,
      metadata = coalesce(a.metadata, '{}'::jsonb) || jsonb_build_object(
        'last_reason', p_reason,
        'last_at', v_now
      ) || coalesce(p_metadata, '{}'::jsonb);

  select a.failed_count, a.locked_until
    into v_failed, v_locked
  from public.face_verification_attempts a
  where a.employee_id = p_employee_id
    and a.device_id = v_tid;

  perform public._attendance_audit_append(p_employee_id, 'face_verification_failed', jsonb_build_object('device_id',v_tid,'reason',coalesce(p_reason,'unknown'),'failed_count',v_failed,'locked_until',v_locked), null, null);

  return query select v_failed, v_locked;
end;
$$;

revoke all on function public.mobile_create_face_verification_session(uuid, text, numeric, integer, jsonb, integer) from public;
grant execute on function public.mobile_create_face_verification_session(uuid, text, numeric, integer, jsonb, integer) to anon, authenticated;

revoke all on function public.mobile_record_face_verification_failure(uuid, text, text, jsonb) from public;
grant execute on function public.mobile_record_face_verification_failure(uuid, text, text, jsonb) to anon, authenticated;

revoke all on function public.mobile_lookup_active_employee_by_card(text) from public;
grant execute on function public.mobile_lookup_active_employee_by_card(text) to anon, authenticated;

revoke all on function public.mobile_register_employee_face_and_device(uuid, jsonb, text, integer, boolean) from public;
grant execute on function public.mobile_register_employee_face_and_device(uuid, jsonb, text, integer, boolean) to anon;

-- Backward compatibility: older mobile builds call the 5-arg session RPC signature.
create or replace function public.mobile_create_face_verification_session(
  p_employee_id uuid,
  p_device_id text,
  p_verification_score numeric default null,
  p_expires_in_seconds integer default 120,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  session_token text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select s.session_token, s.expires_at
    from public.mobile_create_face_verification_session(
      p_employee_id,
      p_device_id,
      p_verification_score,
      p_expires_in_seconds,
      p_metadata,
      1
    ) as s;
end;
$$;

revoke all on function public.mobile_create_face_verification_session(uuid, text, numeric, integer, jsonb) from public;
grant execute on function public.mobile_create_face_verification_session(uuid, text, numeric, integer, jsonb) to anon, authenticated;

