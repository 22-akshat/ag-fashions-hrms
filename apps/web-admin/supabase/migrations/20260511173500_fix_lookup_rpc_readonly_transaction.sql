-- Fix: mobile_lookup_active_employee_by_card writes via rate-limit guard,
-- so it cannot remain STABLE. Mark as VOLATILE to allow INSERT side-effects.
alter function public.mobile_lookup_active_employee_by_card(text) volatile;

