-- Phase 1: employee face embedding columns + employee_devices + HR RLS + mobile registration RPCs.
-- Mobile writes use SECURITY DEFINER functions so anon cannot bulk-update arbitrary employee rows
-- or insert arbitrary employee_devices without Active-employee validation.
-- Anon EXECUTE on RPCs substitutes for permissive anon INSERT policies on employee_devices.

-- ---------------------------------------------------------------------------
-- 1) employees — face columns
-- ---------------------------------------------------------------------------
alter table public.employees add column if not exists face_embedding jsonb null;

alter table public.employees add column if not exists face_registered_at timestamptz null;

alter table public.employees add column if not exists face_embedding_version integer not null default 1;

comment on column public.employees.face_embedding is 'Serialized face embedding (JSON array); set only via mobile_register_employee_face_and_device or HR apps.';

-- ---------------------------------------------------------------------------
-- 2) employee_devices
-- ---------------------------------------------------------------------------
create table if not exists public.employee_devices (
  id uuid primary key default gen_random_uuid (),
  employee_id uuid not null references public.employees (id) on delete cascade,
  device_id text not null,
  approved boolean not null default true,
  blocked boolean not null default false,
  created_at timestamptz not null default timezone ('utc', now ()),
  last_seen_at timestamptz not null default timezone ('utc', now ()),
  constraint employee_devices_employee_device_unique unique (employee_id, device_id)
);

create index if not exists employee_devices_employee_id_idx on public.employee_devices (employee_id);

create index if not exists employee_devices_device_id_idx on public.employee_devices (device_id);

grant select, insert, update, delete on table public.employee_devices to authenticated;

grant all on table public.employee_devices to service_role;

alter table public.employee_devices enable row level security;

drop policy if exists "employee_devices_select_hr" on public.employee_devices;
create policy "employee_devices_select_hr" on public.employee_devices for select to authenticated using (public.is_hr_user (auth.uid()));

drop policy if exists "employee_devices_insert_hr" on public.employee_devices;
create policy "employee_devices_insert_hr" on public.employee_devices for insert to authenticated with check (public.is_hr_user (auth.uid()));

drop policy if exists "employee_devices_update_hr" on public.employee_devices;
create policy "employee_devices_update_hr" on public.employee_devices for update to authenticated using (public.is_hr_user (auth.uid())) with check (public.is_hr_user (auth.uid()));

drop policy if exists "employee_devices_delete_hr" on public.employee_devices;
create policy "employee_devices_delete_hr" on public.employee_devices for delete to authenticated using (public.is_hr_user (auth.uid()));

-- No anon SELECT / UPDATE / direct INSERT — mobile uses RPC below.

revoke insert, update, delete, references, trigger on public.employee_devices from anon;

-- ---------------------------------------------------------------------------
-- 3) RPC — lookup (subset; no embedding)
-- ---------------------------------------------------------------------------
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
begin
  select count(*)::integer
    into n_match
  from public.employees e
  where e.status = 'Active'
    and trim(lower(e.card_no)) = trim(lower(coalesce(p_card_no, '')));

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
    and trim(lower(e.card_no)) = trim(lower(coalesce(p_card_no, '')))
  limit 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) RPC — register face + bind device (audit: clears prior embedding only when replace allowed)
-- ---------------------------------------------------------------------------
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

  if not exists (select 1 from public.employees ex where ex.id = p_employee_id) then
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
    raise exception 'EMPLOYEE_INACTIVE';
  end if;

  if v_has_face and not coalesce(p_allow_replace, false) then
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
      last_seen_at,
      created_at
    )
    values (
      p_employee_id,
      v_tid,
      true,
      false,
      timezone ('utc', now ()),
      timezone ('utc', now ())
    )
  on conflict (employee_id, device_id) do update
    set last_seen_at = timezone ('utc', now ()),
        blocked = false;
end;
$$;

create or replace function public.mobile_touch_employee_device (
  p_employee_id uuid,
  p_device_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tid text := trim(coalesce(p_device_id, ''));
  n_updated integer;
begin
  if v_tid = '' then
    raise exception 'DEVICE_ID_REQUIRED';
  end if;

  update public.employee_devices ed
    set last_seen_at = timezone ('utc', now ())
  where ed.employee_id = p_employee_id
    and ed.device_id = v_tid;

  get diagnostics n_updated = row_count;

  if n_updated = 0 then
    raise exception 'DEVICE_ROW_NOT_FOUND';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) RPC — fetch embedding for verify (requires matching active card_no)
-- ---------------------------------------------------------------------------
create or replace function public.mobile_get_registered_face_embedding (
  p_employee_id uuid,
  p_card_no text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_emb jsonb;
begin
  select e.face_embedding
    into v_emb
  from public.employees e
  where e.id = p_employee_id
    and e.status = 'Active'
    and trim(lower(e.card_no)) = trim(lower(coalesce(p_card_no, '')));

  return v_emb;
end;
$$;

revoke all on function public.mobile_lookup_active_employee_by_card (text) from public;
revoke all on function public.mobile_register_employee_face_and_device (
  uuid,
  jsonb,
  text,
  integer,
  boolean
) from public;
revoke all on function public.mobile_touch_employee_device (uuid, text) from public;
revoke all on function public.mobile_get_registered_face_embedding (uuid, text) from public;

grant execute on function public.mobile_lookup_active_employee_by_card (text) to anon, authenticated;

grant execute on function public.mobile_register_employee_face_and_device (
  uuid,
  jsonb,
  text,
  integer,
  boolean
) to anon;

grant execute on function public.mobile_touch_employee_device (uuid, text) to anon;

grant execute on function public.mobile_get_registered_face_embedding (uuid, text) to anon;
