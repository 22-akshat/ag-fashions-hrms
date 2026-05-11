-- HR web admin uses Supabase anon key (legacy). Allow shop CRUD for anon + RLS policy.
-- Mobile attendance continues to SELECT shops only (unchanged).
-- Realtime: idempotent add public.shops to supabase_realtime.

grant insert, update, delete on table public.shops to anon;

drop policy if exists "shops_write_anon" on public.shops;
create policy "shops_write_anon"
on public.shops for all
to anon
using (true)
with check (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'shops'
  ) then
    alter publication supabase_realtime add table public.shops;
  end if;
end
$$;
