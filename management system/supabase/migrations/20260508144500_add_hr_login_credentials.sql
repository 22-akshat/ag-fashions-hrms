create table if not exists public.hr_login_credentials (
  id uuid primary key default gen_random_uuid (),
  username text not null unique,
  password text not null,
  full_name text not null default '',
  role text not null default 'admin',
  created_at timestamptz not null default timezone ('utc', now ())
);

create index if not exists hr_login_credentials_username_idx
  on public.hr_login_credentials (username);

grant select, insert, update, delete on public.hr_login_credentials to anon, authenticated;

alter table public.hr_login_credentials enable row level security;

drop policy if exists "hr_login_credentials_select_anon" on public.hr_login_credentials;
drop policy if exists "hr_login_credentials_insert_anon" on public.hr_login_credentials;
drop policy if exists "hr_login_credentials_update_anon" on public.hr_login_credentials;
drop policy if exists "hr_login_credentials_delete_anon" on public.hr_login_credentials;

create policy "hr_login_credentials_select_anon"
on public.hr_login_credentials for select to anon using (true);

create policy "hr_login_credentials_insert_anon"
on public.hr_login_credentials for insert to anon with check (true);

create policy "hr_login_credentials_update_anon"
on public.hr_login_credentials for update to anon using (true)
with check (true);

create policy "hr_login_credentials_delete_anon"
on public.hr_login_credentials for delete to anon using (true);
