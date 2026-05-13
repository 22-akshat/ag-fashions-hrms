-- Phase 6: anomaly scoring storage and helper profiles.

create table if not exists public.anomaly_detection_events (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  device_id text not null,
  attendance_log_id uuid null references public.attendance_logs(id) on delete set null,
  risk_score integer not null default 0,
  risk_level text not null default 'low',
  reasons jsonb not null default '[]'::jsonb,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint anomaly_detection_events_risk_level_chk check (risk_level in ('low', 'medium', 'high', 'critical'))
);

create index if not exists anomaly_detection_events_employee_created_idx
  on public.anomaly_detection_events (employee_id, created_at desc);

create index if not exists anomaly_detection_events_risk_created_idx
  on public.anomaly_detection_events (risk_level, created_at desc);

create table if not exists public.employee_risk_profiles (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  last_risk_score integer not null default 0,
  last_risk_level text not null default 'low',
  reasons jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint employee_risk_profiles_risk_level_chk check (last_risk_level in ('low', 'medium', 'high', 'critical'))
);

alter table public.anomaly_detection_events enable row level security;
alter table public.employee_risk_profiles enable row level security;
revoke all on table public.anomaly_detection_events from public;
revoke all on table public.employee_risk_profiles from public;
revoke all on table public.anomaly_detection_events from anon;
revoke all on table public.employee_risk_profiles from anon;
grant all on table public.anomaly_detection_events to service_role;
grant all on table public.employee_risk_profiles to service_role;

drop policy if exists "anomaly_detection_events_select_hr" on public.anomaly_detection_events;
create policy "anomaly_detection_events_select_hr"
  on public.anomaly_detection_events
  for select
  to authenticated
  using (public.is_hr_user(auth.uid()));

drop policy if exists "employee_risk_profiles_select_hr" on public.employee_risk_profiles;
create policy "employee_risk_profiles_select_hr"
  on public.employee_risk_profiles
  for select
  to authenticated
  using (public.is_hr_user(auth.uid()));

