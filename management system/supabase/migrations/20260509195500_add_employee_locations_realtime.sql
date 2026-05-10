create table if not exists public.employee_locations (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy double precision null,
  recorded_at timestamptz not null default timezone('utc', now())
);

alter table public.employee_locations enable row level security;

drop policy if exists "Employees can upsert own location" on public.employee_locations;
create policy "Employees can upsert own location"
on public.employee_locations for all
using (true)
with check (true);

grant select, insert, update, delete on public.employee_locations to anon, authenticated;

alter publication supabase_realtime add table public.employee_locations;
alter publication supabase_realtime add table public.attendance_logs;
