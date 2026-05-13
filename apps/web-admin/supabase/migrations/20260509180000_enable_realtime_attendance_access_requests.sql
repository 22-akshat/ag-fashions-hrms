-- Optional but recommended: lets Supabase Realtime emit postgres_changes for this table.
-- Safe on reruns: only add table when not already in publication.
do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication p
    join pg_catalog.pg_publication_rel pr on pr.prpubid = p.oid
    join pg_catalog.pg_class c on c.oid = pr.prrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where p.pubname = 'supabase_realtime'
      and n.nspname = 'public'
      and c.relname = 'attendance_access_requests'
  ) then
    alter publication supabase_realtime add table public.attendance_access_requests;
  end if;
end
$$;
