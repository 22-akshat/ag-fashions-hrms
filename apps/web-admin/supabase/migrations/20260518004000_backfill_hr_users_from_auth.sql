-- Backfill HR mappings so authenticated HR users can pass RLS checks.
-- Safe on reruns (ON CONFLICT DO NOTHING) and safe if legacy table is absent.

do $$
begin
  if to_regclass('public.hr_login_credentials') is null then
    insert into public.hr_users (user_id, role)
    select
      au.id as user_id,
      case
        when lower(coalesce(au.raw_user_meta_data ->> 'role', '')) in ('hr', 'hr_manager') then 'hr_manager'
        else 'hr_admin'
      end as role
    from auth.users au
    where lower(coalesce(au.raw_user_meta_data ->> 'role', '')) in ('hr_admin', 'admin', 'hr_manager', 'hr')
    on conflict (user_id) do nothing;
  else
    insert into public.hr_users (user_id, role)
    select
      au.id as user_id,
      coalesce(
        nullif(lower(au.raw_user_meta_data ->> 'role'), ''),
        case
          when lower(hlc.role) in ('hr_admin', 'admin') then 'hr_admin'
          when lower(hlc.role) in ('hr', 'manager') then 'hr_manager'
          else 'hr_admin'
        end
      ) as role
    from auth.users au
    left join public.hr_login_credentials hlc
      on lower(hlc.username) = lower(au.email)
    where
      (
        lower(coalesce(au.raw_user_meta_data ->> 'role', '')) in ('hr_admin', 'admin', 'hr_manager', 'hr')
        or hlc.id is not null
      )
    on conflict (user_id) do nothing;
  end if;
end
$$;

