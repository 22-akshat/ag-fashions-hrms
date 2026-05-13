-- Phase 6: policy-driven enforcement table + fetch helper.

create table if not exists public.security_policies (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'default',
  emulator text not null default 'block',
  vpn text not null default 'warn',
  root text not null default 'warn',
  mock_gps text not null default 'block',
  attestation_failure text not null default 'block',
  anomaly_score_threshold integer not null default 70,
  enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint security_policies_name_unique unique (name),
  constraint security_policies_action_chk check (
    emulator in ('allow', 'warn', 'block')
    and vpn in ('allow', 'warn', 'block')
    and root in ('allow', 'warn', 'block')
    and mock_gps in ('allow', 'warn', 'block')
    and attestation_failure in ('allow', 'warn', 'block')
  )
);

create index if not exists security_policies_enabled_idx
  on public.security_policies (enabled, updated_at desc);

alter table public.security_policies enable row level security;
revoke all on table public.security_policies from public;
revoke all on table public.security_policies from anon;
grant all on table public.security_policies to service_role;

drop policy if exists "security_policies_select_hr" on public.security_policies;
create policy "security_policies_select_hr"
  on public.security_policies
  for select
  to authenticated
  using (public.is_hr_user(auth.uid()));

drop policy if exists "security_policies_write_hr" on public.security_policies;
create policy "security_policies_write_hr"
  on public.security_policies
  for all
  to authenticated
  using (public.is_hr_user(auth.uid()))
  with check (public.is_hr_user(auth.uid()));

create or replace function public.get_active_security_policy()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'id', sp.id,
        'name', sp.name,
        'emulator', sp.emulator,
        'vpn', sp.vpn,
        'root', sp.root,
        'mock_gps', sp.mock_gps,
        'attestation_failure', sp.attestation_failure,
        'anomaly_score_threshold', sp.anomaly_score_threshold
      )
      from public.security_policies sp
      where sp.enabled = true
      order by sp.updated_at desc
      limit 1
    ),
    jsonb_build_object(
      'name', 'default',
      'emulator', 'block',
      'vpn', 'warn',
      'root', 'warn',
      'mock_gps', 'block',
      'attestation_failure', 'block',
      'anomaly_score_threshold', 70
    )
  );
$$;

revoke all on function public.get_active_security_policy() from public;
grant execute on function public.get_active_security_policy() to authenticated, anon;

insert into public.security_policies (name, enabled)
values ('default', true)
on conflict (name) do nothing;

