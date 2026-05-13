create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  flag_name text unique not null,
  enabled boolean default false,
  created_at timestamptz default timezone('utc', now())
);

alter table public.feature_flags enable row level security;
revoke all on table public.feature_flags from public;
revoke all on table public.feature_flags from anon;
grant all on table public.feature_flags to service_role;
grant select on public.feature_flags to service_role;

insert into public.feature_flags (flag_name, enabled)
values ('strict_attendance_mode', false)
on conflict (flag_name) do nothing;

