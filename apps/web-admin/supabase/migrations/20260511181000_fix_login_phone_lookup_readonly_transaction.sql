-- Fix: login phone lookup uses rate-limit guard (INSERT side-effect),
-- so this function cannot be STABLE.
alter function public.mobile_lookup_employee_phone_for_login(text) volatile;

