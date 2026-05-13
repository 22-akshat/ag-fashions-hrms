-- ---------------------------------------------------------------------------
-- Edge Function `mark-attendance` support: audit trail + optional columns
-- on attendance_logs. Legacy direct anon INSERTs remain unchanged (NULL new columns).
--
-- Schema changes (backward compatible):
-- 1) public.attendance_logs.idempotency_key (text, nullable)
--    - Set only for Edge-issued marks. UNIQUE where not null so retries de-dupe.
-- 2) public.attendance_logs.mark_source (text, nullable)
--    - 'edge' | 'client_direct' | NULL (NULL treated as legacy unknown).
-- 3) public.attendance_audit_events
--    - Append-only audit for Edge attempts (success + structured rejections).
--    - No grants to anon; service_role only (Edge uses service_role client).
-- RLS: not tightened on existing tables per rollout plan.
-- ---------------------------------------------------------------------------

alter table public.attendance_logs
  add column if not exists idempotency_key text null;

alter table public.attendance_logs
  add column if not exists mark_source text null;

alter table public.attendance_logs drop constraint if exists attendance_logs_mark_source_chk;

alter table public.attendance_logs
  add constraint attendance_logs_mark_source_chk check (
    mark_source is null
    or mark_source in ('edge', 'client_direct')
  );

create unique index if not exists attendance_logs_idempotency_key_uidx
on public.attendance_logs (idempotency_key)
where idempotency_key is not null;

create table if not exists public.attendance_audit_events (
  id uuid primary key default gen_random_uuid (),
  created_at timestamptz not null default timezone ('utc', now ()),
  employee_id uuid null references public.employees (id) on delete set null,
  attendance_log_id uuid null references public.attendance_logs (id) on delete set null,
  event_type text not null,
  idempotency_key text null,
  detail jsonb not null default '{}'::jsonb
);

create index if not exists attendance_audit_events_employee_created_idx
on public.attendance_audit_events (employee_id, created_at desc);

create index if not exists attendance_audit_events_created_idx
on public.attendance_audit_events (created_at desc);

alter table public.attendance_audit_events enable row level security;

revoke all on table public.attendance_audit_events from public;

grant all on table public.attendance_audit_events to service_role;

-- HR dashboards can be granted later; keep locked down by default.
revoke all on table public.attendance_audit_events from anon;

revoke all on table public.attendance_audit_events from authenticated;
