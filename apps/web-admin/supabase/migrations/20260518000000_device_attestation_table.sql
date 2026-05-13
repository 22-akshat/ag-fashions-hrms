-- Phase 6: device attestation source-of-truth table.

create table if not exists public.device_attestation (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  device_id text not null,
  attestation_token text not null default '',
  is_valid boolean not null default false,
  platform text not null default 'unknown',
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists device_attestation_employee_created_idx
  on public.device_attestation (employee_id, created_at desc);

create index if not exists device_attestation_device_created_idx
  on public.device_attestation (device_id, created_at desc);

alter table public.device_attestation enable row level security;
revoke all on table public.device_attestation from public;
revoke all on table public.device_attestation from anon;
grant all on table public.device_attestation to service_role;

drop policy if exists "device_attestation_select_hr" on public.device_attestation;
create policy "device_attestation_select_hr"
  on public.device_attestation
  for select
  to authenticated
  using (public.is_hr_user(auth.uid()));

