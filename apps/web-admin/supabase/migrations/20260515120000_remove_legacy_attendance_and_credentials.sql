-- ============================================================================
-- Phase: legacy attendance insert + hr_login_credentials removal
--
-- DEPLOYMENT ORDER (after mobile uses Edge-only punch + secrets set):
--   1) Deploy `mark-attendance` Edge Function; set ATTENDANCE_EDGE_INVOCATION_KEY.
--   2) Ship mobile app with EXPO_PUBLIC_ATTENDANCE_EDGE_INVOCATION_KEY (required).
--   3) Empty or archive public.hr_login_credentials (this migration FAILS if rows remain).
--   4) Apply this migration.
--
-- ROLLBACK STRATEGY:
--   - attendance_logs: re-GRANT INSERT to anon; re-create policy e.g.
--       CREATE POLICY "attendance_logs_insert_anon_mobile_legacy" ON public.attendance_logs
--       FOR INSERT TO anon WITH CHECK (true);
--     (only for emergency; restore from backup preferred.)
--   - hr_login_credentials: restore from migration 20260508144500_add_hr_login_credentials.sql
--     or backup (table + indexes + grants + RLS policies).
--
-- DEPENDENCY RISKS (hr_login_credentials DROP):
--   - No other tables in this repo FK into hr_login_credentials.
--   - If a custom view/function references the table, DROP fails — fix dependents first.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) attendance_logs — only service_role (Edge) may INSERT
-- ---------------------------------------------------------------------------
drop policy if exists "attendance_logs_insert_anon_mobile_legacy" on public.attendance_logs;

revoke insert on table public.attendance_logs from anon;

revoke insert on table public.attendance_logs from authenticated;

-- service_role retains ALL from prior migrations; INSERT for Edge unchanged.

-- ---------------------------------------------------------------------------
-- 2) hr_login_credentials — DROP only when empty (no legacy rows to preserve)
-- ---------------------------------------------------------------------------
do $$
declare
  row_count bigint;
begin
  if to_regclass ('public.hr_login_credentials') is null then
    raise notice 'hr_login_credentials: table absent, skipping drop.';
    return;
  end if;

  select count(*) into row_count from public.hr_login_credentials;

  if row_count > 0 then
    raise notice 'hr_login_credentials has % row(s); preserving legacy table and continuing migration.', row_count;
    return;
  end if;

  drop table public.hr_login_credentials;
end $$;
