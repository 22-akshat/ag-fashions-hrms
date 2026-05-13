create table if not exists public.attendance_access_requests (
  id uuid primary key default gen_random_uuid (),
  requester_name text not null default '',
  card_no text not null default '',
  requested_shop_id uuid null,
  device_id text not null default '',
  status text not null default 'pending',
  request_lat double precision null,
  request_lng double precision null,
  request_accuracy_m double precision null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default timezone ('utc', now ()),
  constraint attendance_access_requests_status_chk
    check (status in ('pending', 'approved', 'rejected'))
);

create index if not exists attendance_access_requests_status_idx
  on public.attendance_access_requests (status, created_at desc);

create index if not exists attendance_access_requests_card_idx
  on public.attendance_access_requests (card_no, created_at desc);

grant select, insert, update, delete
  on public.attendance_access_requests
  to anon, authenticated;

alter table public.attendance_access_requests enable row level security;

drop policy if exists "attendance_access_requests_select_anon" on public.attendance_access_requests;
drop policy if exists "attendance_access_requests_insert_anon" on public.attendance_access_requests;
drop policy if exists "attendance_access_requests_update_anon" on public.attendance_access_requests;
drop policy if exists "attendance_access_requests_delete_anon" on public.attendance_access_requests;

create policy "attendance_access_requests_select_anon"
on public.attendance_access_requests for select to anon using (true);

create policy "attendance_access_requests_insert_anon"
on public.attendance_access_requests for insert to anon with check (true);

create policy "attendance_access_requests_update_anon"
on public.attendance_access_requests for update to anon using (true) with check (true);

create policy "attendance_access_requests_delete_anon"
on public.attendance_access_requests for delete to anon using (true);
