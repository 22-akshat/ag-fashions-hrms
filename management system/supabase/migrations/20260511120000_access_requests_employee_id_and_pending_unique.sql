-- Correlate access requests with employees; enforce at most one pending row per employee (and per card).

alter table public.attendance_access_requests
  add column if not exists employee_id uuid references public.employees (id) on delete set null;

create index if not exists attendance_access_requests_employee_id_idx
  on public.attendance_access_requests (employee_id)
  where employee_id is not null;

create unique index if not exists attendance_access_requests_one_pending_per_employee_idx
  on public.attendance_access_requests (employee_id)
  where status = 'pending' and employee_id is not null;

create unique index if not exists attendance_access_requests_one_pending_per_card_idx
  on public.attendance_access_requests (card_no)
  where status = 'pending' and trim(card_no) <> '';
