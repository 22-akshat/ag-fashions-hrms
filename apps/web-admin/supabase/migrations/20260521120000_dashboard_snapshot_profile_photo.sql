-- Additive: include employee profile photo URL in dashboard snapshot (employees.personel_image).

create or replace function public.employee_dashboard_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_emp uuid;
  v_full text;
  v_intime text;
  v_outtime text;
  v_photo text;
  v_shop_name text := '';
  v_shop_id uuid;
  v_req_status text := null;
  v_req_shop uuid := null;
  v_req_created timestamptz := null;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;
  v_emp := public.employee_id_for_auth_user();
  if v_emp is null then
    raise exception 'EMPLOYEE_PROFILE_MISSING';
  end if;

  select e.id, e.full_name, e.intime, e.outtime, e.personel_image
    into v_emp, v_full, v_intime, v_outtime, v_photo
  from public.employees e
  where e.id = v_emp
  limit 1;

  if not found then
    return '{}'::jsonb;
  end if;

  select d.shop_id
    into v_shop_id
  from public.employee_devices d
  where d.employee_id = v_emp
    and d.approved = true
    and coalesce(d.blocked, false) = false
    and d.revoked_at is null
  order by d.last_seen_at desc nulls last
  limit 1;

  if v_shop_id is not null then
    select s.name into v_shop_name from public.shops s where s.id = v_shop_id limit 1;
  end if;

  select r.status, r.requested_shop_id, r.created_at
    into v_req_status, v_req_shop, v_req_created
  from public.attendance_access_requests r
  where r.employee_id = v_emp
  order by r.created_at desc
  limit 1;

  return jsonb_build_object(
    'employee_id', v_emp,
    'full_name', coalesce(v_full, ''),
    'intime', coalesce(v_intime, ''),
    'outtime', coalesce(v_outtime, ''),
    'shop_id', v_shop_id,
    'shop_name', coalesce(v_shop_name, ''),
    'profile_photo_url', coalesce(nullif(trim(coalesce(v_photo, '')), ''), ''),
    'latest_access_request', case
      when v_req_status is null then null
      else jsonb_build_object(
        'status', v_req_status,
        'requested_shop_id', v_req_shop,
        'created_at', v_req_created
      )
    end
  );
end;
$$;

revoke all on function public.employee_dashboard_snapshot() from public;
grant execute on function public.employee_dashboard_snapshot() to authenticated;
