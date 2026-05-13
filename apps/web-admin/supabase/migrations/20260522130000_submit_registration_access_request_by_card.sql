-- Registration flow without SMS OTP: anon/authenticated clients submit HR access request using card + GPS + device_id.
-- Same insert shape as employee_create_access_request; skips auth-linked employee lookup (no OTP session required).
-- Anyone who knows an active card number can queue a pending request — mitigate via HR review + optional rate limits server-side.

create or replace function public.submit_registration_access_request_by_card(
  p_card_no text,
  p_requested_shop_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_accuracy_m double precision,
  p_device_id text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp uuid;
  v_tid text := trim(coalesce(p_device_id, ''));
  v_card text;
  v_name text;
  v_card_in text := trim(lower(coalesce(p_card_no, '')));
begin
  if v_card_in = '' then
    raise exception 'CARD_REQUIRED';
  end if;
  if v_tid = '' then
    raise exception 'DEVICE_ID_REQUIRED';
  end if;

  select e.id, e.card_no, e.full_name
    into v_emp, v_card, v_name
  from public.employees e
  where e.status = 'Active'
    and trim(lower(e.card_no)) = v_card_in
  limit 1;

  if v_emp is null then
    raise exception 'EMPLOYEE_NOT_FOUND';
  end if;

  insert into public.attendance_access_requests (
    employee_id,
    requester_name,
    card_no,
    requested_shop_id,
    device_id,
    status,
    request_lat,
    request_lng,
    request_accuracy_m
  ) values (
    v_emp,
    coalesce(v_name, ''),
    coalesce(v_card, ''),
    p_requested_shop_id,
    v_tid,
    'pending',
    p_lat,
    p_lng,
    p_accuracy_m
  )
  on conflict do nothing;

  return 'ok';
end;
$$;

revoke all on function public.submit_registration_access_request_by_card(
  text,
  uuid,
  double precision,
  double precision,
  double precision,
  text
) from public;

grant execute on function public.submit_registration_access_request_by_card(
  text,
  uuid,
  double precision,
  double precision,
  double precision,
  text
) to anon, authenticated;
