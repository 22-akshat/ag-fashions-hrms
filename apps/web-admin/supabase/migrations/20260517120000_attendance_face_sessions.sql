-- Phase 2: server-authoritative face verification sessions for attendance.
-- Replaces insecure client-trusted `face_verified` booleans with short-lived one-time session tokens.

-- ---------------------------------------------------------------------------
-- 1) attendance_face_sessions (no anon direct writes; Edge uses service_role)
-- ---------------------------------------------------------------------------
create table if not exists public.attendance_face_sessions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  device_id text not null,
  session_token text not null unique,
  verification_score numeric null,
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null,
  used_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists attendance_face_sessions_employee_id_idx
  on public.attendance_face_sessions (employee_id);

create index if not exists attendance_face_sessions_session_token_idx
  on public.attendance_face_sessions (session_token);

create index if not exists attendance_face_sessions_expires_at_idx
  on public.attendance_face_sessions (expires_at);

-- Cleanup-friendly: quickly find expired & unused sessions.
create index if not exists attendance_face_sessions_unused_expires_at_idx
  on public.attendance_face_sessions (expires_at)
  where used_at is null;

grant select, insert, update, delete on table public.attendance_face_sessions to authenticated;
grant all on table public.attendance_face_sessions to service_role;

alter table public.attendance_face_sessions enable row level security;

drop policy if exists "attendance_face_sessions_select_hr" on public.attendance_face_sessions;
create policy "attendance_face_sessions_select_hr"
  on public.attendance_face_sessions
  for select
  to authenticated
  using (public.is_hr_user(auth.uid()));

drop policy if exists "attendance_face_sessions_insert_hr" on public.attendance_face_sessions;
create policy "attendance_face_sessions_insert_hr"
  on public.attendance_face_sessions
  for insert
  to authenticated
  with check (public.is_hr_user(auth.uid()));

drop policy if exists "attendance_face_sessions_update_hr" on public.attendance_face_sessions;
create policy "attendance_face_sessions_update_hr"
  on public.attendance_face_sessions
  for update
  to authenticated
  using (public.is_hr_user(auth.uid()))
  with check (public.is_hr_user(auth.uid()));

drop policy if exists "attendance_face_sessions_delete_hr" on public.attendance_face_sessions;
create policy "attendance_face_sessions_delete_hr"
  on public.attendance_face_sessions
  for delete
  to authenticated
  using (public.is_hr_user(auth.uid()));

-- Never allow direct anon table writes/reads.
revoke all on public.attendance_face_sessions from anon;

-- ---------------------------------------------------------------------------
-- 2) RPC — mobile creates short-lived one-time verification session
-- ---------------------------------------------------------------------------
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
declare
  v_now timestamptz := timezone('utc', now());
  v_expires timestamptz;
  v_token text;
  v_has_face boolean;
  v_device_ok boolean;
begin
  if p_employee_id is null then
    raise exception 'EMPLOYEE_ID_REQUIRED' using message = 'employee_id is required';
  end if;
  if coalesce(trim(p_device_id), '') = '' then
    raise exception 'DEVICE_ID_REQUIRED' using message = 'device_id is required';
  end if;

  select (e.face_embedding is not null) into v_has_face
  from public.employees e
  where e.id = p_employee_id
  limit 1;

  if v_has_face is distinct from true then
    raise exception 'FACE_NOT_REGISTERED' using message = 'Employee has no registered face template';
  end if;

  select exists (
    select 1
    from public.employee_devices d
    where d.employee_id = p_employee_id
      and d.device_id = p_device_id
      and d.approved = true
      and d.blocked = false
  ) into v_device_ok;

  if v_device_ok is distinct from true then
    raise exception 'DEVICE_NOT_APPROVED'
      using message = 'Device not bound/approved for this employee';
  end if;

  v_expires := v_now + make_interval(secs => greatest(10, least(coalesce(p_expires_in_seconds, 120), 600)));

  -- 256-bit token, hex encoded (needs pgcrypto).
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
    p_device_id,
    v_token,
    p_verification_score,
    v_now,
    v_expires,
    null,
    coalesce(p_metadata, '{}'::jsonb)
  );

  return query select v_token, v_expires;
end;
$$;

revoke all on function public.mobile_create_face_verification_session(uuid, text, numeric, integer, jsonb) from public;
grant execute on function public.mobile_create_face_verification_session(uuid, text, numeric, integer, jsonb) to anon;
grant execute on function public.mobile_create_face_verification_session(uuid, text, numeric, integer, jsonb) to authenticated;

