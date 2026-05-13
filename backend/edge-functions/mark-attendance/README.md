# `mark-attendance` Edge Function

**Source file:** `apps/web-admin/supabase/functions/mark-attendance/index.ts`

## Authentication (Phase 1)

- `verify_jwt = false` for this function (see `apps/web-admin/supabase/config.toml`).
- Caller must send header `x-attendance-edge-invocation-key` equal to the Supabase secret `ATTENDANCE_EDGE_INVOCATION_KEY`.
- Mobile passes the same value via `EXPO_PUBLIC_ATTENDANCE_EDGE_INVOCATION_KEY` (**required** — rotate on leak; follow-up should replace with user JWT / device-bound tokens).

## Request

`POST` JSON body:

| Field | Required | Description |
|-------|----------|-------------|
| `employee_id` | yes | UUID of employee |
| `shop_id` | yes | UUID of `shops` row used for server geofence |
| `latitude` | yes | Device-reported latitude (re-validated server-side) |
| `longitude` | yes | Device-reported longitude |
| `face_verified` | yes | boolean (trusted from client for this phase; server does not re-run face) |
| `status` | no | defaults to `present` |
| `idempotency_key` | no | Duplicate-safe retries; also accepted as header `x-idempotency-key` |

## Responses

- `200` `{ ok: true, attendance_log_id, timestamp }` — inserted or idempotent hit (`duplicate: true`).
- `400` — bad input, geofence outside radius.
- `401` — bad invocation key.
- `403` — inactive employee or inactive shop.
- `404` — employee or shop not found.
- `409` — duplicate present punch inside configured window (`DUPLICATE_WINDOW_HOURS`).
- `5xx` — misconfiguration or DB errors.

## Server rules

1. **Geofence:** Haversine distance from `(latitude, longitude)` to shop `(lat, lng)` must be ≤ `radius_meters`.
2. **Duplicate window:** No new `present` punch if one already exists for this employee in the last `DUPLICATE_WINDOW_HOURS` (default 12), evaluated on `attendance_logs.timestamp`.
3. **Employee:** `employees.status` must be `Active`.
4. **Timestamp:** `attendance_logs.timestamp` is set from the Edge runtime clock (UTC ISO), not the client body.
5. **Idempotency:** Same `idempotency_key` returns the same `attendance_log_id` without a second insert.
6. **Audit:** Every attempt writes to `attendance_audit_events` (received, rejected, success, idempotent hit).

## Legacy compatibility

Historical rows may have `mark_source` **NULL** or **`edge`**; direct anon **INSERT** is removed after migration `20260515120000_remove_legacy_attendance_and_credentials.sql`. Edge inserts set `mark_source = 'edge'`.
