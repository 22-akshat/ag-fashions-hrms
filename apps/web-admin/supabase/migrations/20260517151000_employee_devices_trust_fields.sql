-- Phase 4: trusted device ecosystem fields (additive).

alter table public.employee_devices
  add column if not exists trust_level text not null default 'standard',
  add column if not exists last_ip inet null,
  add column if not exists last_login_at timestamptz null,
  add column if not exists revoked_at timestamptz null,
  add column if not exists revoke_reason text null,
  add column if not exists app_version text null,
  add column if not exists platform text null,
  add column if not exists integrity_status text null;

alter table public.employee_devices drop constraint if exists employee_devices_trust_level_chk;
alter table public.employee_devices
  add constraint employee_devices_trust_level_chk
  check (trust_level in ('standard', 'trusted', 'high_risk'));

