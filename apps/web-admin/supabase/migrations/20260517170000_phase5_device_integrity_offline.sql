-- Phase 5A/5B: device integrity + offline replay protection (additive).

alter table public.employee_devices
  add column if not exists integrity_status text null,
  add column if not exists integrity_reason text null,
  add column if not exists last_integrity_check_at timestamptz null,
  add column if not exists last_integrity_payload jsonb not null default '{}'::jsonb,
  add column if not exists risk_score integer null,
  add column if not exists risk_level text null;

alter table public.employee_devices drop constraint if exists employee_devices_risk_level_chk;
alter table public.employee_devices
  add constraint employee_devices_risk_level_chk
  check (risk_level is null or risk_level in ('low', 'medium', 'high', 'critical'));

create index if not exists employee_devices_integrity_status_idx
  on public.employee_devices (integrity_status)
  where integrity_status is not null;

create index if not exists employee_devices_risk_level_idx
  on public.employee_devices (risk_level)
  where risk_level is not null;

-- Replay guard for delayed/offline attendance submissions.
create table if not exists public.attendance_offline_replays (
  offline_id text primary key,
  employee_id uuid not null references public.employees(id) on delete cascade,
  device_id text not null,
  captured_at timestamptz not null,
  received_at timestamptz not null default timezone('utc', now()),
  payload_hash text not null default ''
);

create index if not exists attendance_offline_replays_employee_received_idx
  on public.attendance_offline_replays (employee_id, received_at desc);

alter table public.attendance_offline_replays enable row level security;
revoke all on table public.attendance_offline_replays from public;
revoke all on table public.attendance_offline_replays from anon;
revoke all on table public.attendance_offline_replays from authenticated;
grant all on table public.attendance_offline_replays to service_role;

