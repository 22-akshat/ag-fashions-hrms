-- Enable Realtime for public.employees so EmployeesContext.jsx postgres_changes fire.
-- Idempotent: skips if the table is already in supabase_realtime (avoids "already a member" errors).

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'employees'
  ) then
    alter publication supabase_realtime add table public.employees;
  end if;
end
$$;
