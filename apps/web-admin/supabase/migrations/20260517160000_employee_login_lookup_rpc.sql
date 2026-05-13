-- Phase 4: Login helper RPC (card_no → phone) for employee sign-in.
-- Needed because employees table is not readable by authenticated employees (HR only),
-- and sign-in happens before an employee JWT exists.

create or replace function public.mobile_lookup_employee_phone_for_login(p_card_no text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_card text := trim(lower(coalesce(p_card_no, '')));
  v_phone text;
begin
  if v_card = '' then
    return null;
  end if;

  -- rate limit by card string to slow enumeration
  perform public._mobile_rate_limit_guard('login_phone_lookup', null, v_card, 60, 30, null, jsonb_build_object('card_no', v_card));

  select trim(coalesce(e.phone_no_1, ''))
    into v_phone
  from public.employees e
  where e.status = 'Active'
    and trim(lower(e.card_no)) = v_card
  limit 1;

  if v_phone = '' then
    return null;
  end if;
  return v_phone;
end;
$$;

revoke all on function public.mobile_lookup_employee_phone_for_login(text) from public;
grant execute on function public.mobile_lookup_employee_phone_for_login(text) to anon;

