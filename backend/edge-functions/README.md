# Edge Functions (HRMS)

Server-side entry points that use the **service role** and enforce rules that must not rely on the client alone.

## Layout

| Path | Purpose |
|------|---------|
| `../../apps/web-admin/supabase/functions/mark-attendance/` | **Deployable** Supabase Edge Function source (`supabase functions deploy` from `apps/web-admin`). |
| `./mark-attendance/README.md` | Contract, env secrets, rollout phases. |

Supabase CLI expects functions under `apps/web-admin/supabase/functions/`. This `backend/edge-functions` folder is the **logical** backend home and documentation anchor; it does not replace the CLI path.

## Deploy (after DB migration)

From `apps/web-admin` (linked project):

```bash
supabase secrets set ATTENDANCE_EDGE_INVOCATION_KEY="your-long-random-secret"
# optional — default 12
supabase secrets set DUPLICATE_WINDOW_HOURS="12"
supabase functions deploy mark-attendance
```

Apply migration `20260513140000_edge_mark_attendance_audit.sql` before first deploy so `attendance_logs` extra columns and `attendance_audit_events` exist.

## Phased migration

1. ~~**Legacy:** anon `INSERT` into `attendance_logs`~~ Removed by migration `20260515120000_remove_legacy_attendance_and_credentials.sql` after deploying Edge + mobile env `EXPO_PUBLIC_ATTENDANCE_EDGE_INVOCATION_KEY`.
2. **Current:** Mobile calls Edge `mark-attendance` only; DB allows `INSERT` via **service_role** (Edge runtime).
3. **Future:** Tighten `employee_locations` (move off anon upsert).

See `mark-attendance/README.md` for request/response shape.
