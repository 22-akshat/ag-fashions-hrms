# Production stabilization & completion roadmap

This document is the **master plan** to evolve the repo into the **final enterprise attendance product** described in the product brief. It assumes the prior security audit findings and **does not assume** features work until validated.

---

## Executive summary

| Phase | Theme | Outcome |
|-------|--------|---------|
| **0** | Foundation (this PR batch) | Schema ↔ Edge alignment, invocation secret, geofence hardening, atomic punch RPC, audit wrapper, revoke dangerous anon **table** access, narrow anon `employees` select |
| **1** | Auth & registration UX | Login-first shell, Register CTA, post-approval states, HR provision ordering |
| **2** | Attendance engine | Shift rules storage, IN/OUT, late/early/half-day classification (server-side) |
| **3** | Mobile dashboard | Today status, history, shift indicators |
| **4** | HR dashboard | Face approval queue, device actions, reports, realtime hardening |
| **5** | Security v2 | Pre-auth via Edge (replace anon RPCs), attestation verification server-side, HMAC offline |
| **6** | Offline v2 | Replay table integration in Edge, encrypted queue audit, retry policy |

---

## PHASE 0 — Foundation (implemented in repo: migration + Edge)

### Goals

- `attendance_logs` columns match Edge inserts.
- No **NaN** geofence bypass; finite lat/lng required.
- **Invocation key** enforced on Edge.
- **One transaction**: consume face session + insert log + audit (race-safe).
- **Idempotency** key on insert.
- **Public** `attendance_audit_append` wrapper → `_attendance_audit_append`.
- **RLS**: remove anon direct writes to `employee_locations` / `attendance_access_requests`; remove broad anon `employees` select (lookup remains via definer RPCs where still granted).

### Migration (single file)

**File:** `apps/web-admin/supabase/migrations/20260519120000_production_attendance_schema_atomic_rls.sql`

| Step | Content |
|------|---------|
| 1 | `attendance_logs`: add `device_id`, `shop_id`, `latitude`, `longitude`, `face_session_token`, `offline_id` (all nullable + FK on `shop_id`). |
| 2 | Extend `attendance_logs_status_chk` to allow `late`, `early_exit` (and normalized spellings). |
| 3 | `employee_devices`: add nullable `shop_id` → `shops(id)` (for future binding; Edge uses request `shop_id` until backfilled). |
| 4 | `CREATE OR REPLACE FUNCTION public.attendance_audit_append(...)` → delegates to `_attendance_audit_append`; `GRANT EXECUTE` to `service_role`. |
| 5 | `CREATE OR REPLACE FUNCTION public.mark_attendance_atomic(...)` — `SECURITY DEFINER`, `search_path = public`, `GRANT EXECUTE` to `service_role` only. |
| 6 | RLS: drop anon policies on `employee_locations` + `attendance_access_requests`; revoke matching grants. |
| 7 | `employees`: drop `employees_select_anon_active`; revoke `SELECT` from `anon`. |

### Edge

**File:** `apps/web-admin/supabase/functions/mark-attendance/index.ts`

- Require header `x-attendance-edge-invocation-key` === `Deno.env.get("ATTENDANCE_EDGE_INVOCATION_KEY")`.
- Reject non-finite lat/lng.
- Resolve `face_embedding_version` from **`employees`**, not `employee_devices`.
- Resolve shop by **`shop_id` from JSON body** (already sent by mobile), validate row + haversine vs shop `lat`/`lng` and `radius_meters`.
- Call `supabase.rpc('mark_attendance_atomic', { ... })` for DB work; map errors to existing JSON codes.
- Keep `strictMode` checks in Edge; **Phase 5** moves attestation to verified tokens.

### Risk notes (Phase 0)

| Risk | Mitigation |
|------|------------|
| `employees` revoke anon breaks any raw `from('employees')` anon client | Grep mobile/web; only RPC lookups for employee flows. Fix any stragglers. |
| HR scripts using anon key | Must use **service role** or **HR JWT** only. |
| `mark_attendance_atomic` logic drift vs Edge | Prefer single source of truth: after stabilization, **thin Edge** + fat RPC is OK. |

### Rollback (Phase 0)

1. Re-deploy previous Edge bundle.
2. SQL rollback script (manual): restore `employees` anon select policy + grant; restore anon policies on `employee_locations` / `attendance_access_requests` (copy from `20260514120000`); `DROP FUNCTION public.mark_attendance_atomic`; `DROP FUNCTION public.attendance_audit_append`; optional `ALTER TABLE ... DROP COLUMN` only if no prod data depends on new columns (prefer **forward-only** in prod).

### Deployment order

1. Apply migration `20260519120000_*.sql` to **staging** → run smoke tests.
2. Deploy Edge `mark-attendance`.
3. Set secret `ATTENDANCE_EDGE_INVOCATION_KEY` in Supabase (must match mobile `EXPO_PUBLIC_ATTENDANCE_EDGE_INVOCATION_KEY`).
4. Ship mobile build that already sends `shop_id` + invocation header (already in `attendanceApi.ts`).
5. Production: same order; **no** mobile requirement change if Edge + DB backward compatible.

### Validation checklist (Phase 0)

- [ ] Punch succeeds with valid face session + GPS + shop id.
- [ ] Duplicate `x-idempotency-key` returns same logical result (no duplicate rows).
- [ ] Invalid invocation key → **401**.
- [ ] Missing lat/lng → **400** / geofence error, never silent accept.
- [ ] Parallel double POST same session → only one row (second fails session used / invalid).
- [ ] `employee_locations` anon insert **rejected** (403 / RLS).
- [ ] `attendance_access_requests` anon select/insert **rejected**.
- [ ] Card lookup RPC still works for **authenticated** register flow; face login still uses anon RPCs until Phase 5.

---

## PHASE 1 — Employee app shell & flows

### Files (indicative)

| Area | Files |
|------|--------|
| Navigation | `apps/mobile-attendance/App.tsx`, `src/context/AppContext.tsx` |
| Login / Register entry | `src/screens/EmployeeLoginScreen.tsx`, new `RegisterEntryScreen` or route params |
| Post-HR status | New screen or `SuccessScreen.tsx` extensions polling `attendance_access_requests` via HR-visible RPC or authenticated read |
| Auth | `src/context/EmployeeAuthContext.tsx` — align `signInWithFaceEmployee` with server session policy (documented as dev bridge until Phase 5) |

### Migration plan

- Optional: `employee_registration_state` view or column on `employee_devices` / `employees` for UX (prefer **existing** `attendance_access_requests.status`).

### Risk / rollback

- UX-only rollback by reverting App navigation commits.
- Do not drop RPCs used by login until Phase 5 replaces them.

---

## PHASE 2 — Shift timing & attendance classification

### Schema (additive migrations)

1. `shop_shifts` or `employee_shift_assignments` (shop-level default + override).
2. Columns on `attendance_logs`: `punch_type` (`in` | `out`), `shift_id` nullable, `classification` (`present` | `late` | `early_exit` | `half_day` | `absent`) computed or stored.

### Engine

- **Preferred:** Postgres function `classify_attendance(...)` invoked from `mark_attendance_atomic` extension (single transaction).
- **Alternative:** Shared package `packages/shared` rule module called from Edge (keep one source of truth).

### Files

- New: `apps/web-admin/supabase/migrations/YYYYMMDD_shift_and_classification.sql`
- Edge: extend atomic RPC params with `p_punch_type`.
- Mobile: `ScanScreen.tsx` — IN vs OUT UI.

### Rollback

- Feature flag `strict_attendance_mode` + new flag `shift_engine_enabled` default false until validated.

---

## PHASE 3 — Employee dashboard

### UI

- New `DashboardScreen.tsx`: today’s punches, history list, shift status, late/early badges.
- Data: authenticated `select` policies for **self** on `attendance_logs` (new migration) or RPC `employee_list_my_attendance`.

### Migration

- RLS: `attendance_logs_select_employee_self` using `employee_id = public.employee_id_for_auth_user()`.

### Risk

- Conflicts with HR-only select today — **additive** policy OR use RPC only.

---

## PHASE 4 — HR / Admin dashboard

### Web admin files

| Feature | Files |
|---------|--------|
| Face queue | New page or extend `module1/employees` / `module4` |
| Device revoke | `Employees.jsx` + `employeesApi.js` |
| Reports | New `module2/reports` + CSV export |
| Realtime | `Attendance.jsx` — ensure single channel, HR JWT |

### Migrations

- None mandatory if RLS already HR-scoped; add indexes for report queries `(employee_id, date_trunc('day', timestamp))`.

---

## PHASE 5 — Security v2 (anon elimination for sensitive reads)

### Tasks

1. Edge function `public-lookup-employee-card` with rate limit + optional CAPTCHA secret — replace anon `mobile_lookup_active_employee_by_card` / `mobile_get_registered_face_embedding` for **pre-auth** paths.
2. `validate-device-attestation`: verify token with Google/Apple APIs; stop trusting `body.is_valid`.
3. `mark-attendance`: strict attestation from verified attestation row, not JSON boolean.

### Migrations

- `REVOKE EXECUTE ... FROM anon` on listed RPCs **after** Edge parity shipped.

---

## PHASE 6 — Offline v2

### Tasks

1. Replace `offlinePayloadSigner` with **HMAC-SHA256** using server-known secret (Edge + mobile derive key via secure enrollment).
2. Edge: read `attendance_offline_replays`; on success insert replay row in same transaction as punch.
3. Allow `p_face_session_token` null in atomic RPC when offline branch validated.

### Files

- `apps/mobile-attendance/src/modules/offline/*`
- Edge `mark-attendance/index.ts`
- Migration: extend `mark_attendance_atomic` signature.

---

## Scalability & ops (cross-cutting)

- Scheduled job: `cleanup_attendance_face_sessions`, partition or TTL for `mobile_rate_limit_events`.
- Monitor Edge cold start + DB pooler limits at 10k punches/day.

---

## File index (Phase 0 touch list)

| File | Action |
|------|--------|
| `apps/web-admin/supabase/migrations/20260519120000_production_attendance_schema_atomic_rls.sql` | **Added** |
| `apps/web-admin/supabase/functions/mark-attendance/index.ts` | **Updated** |
| `apps/mobile-attendance/src/lib/attendanceApi.ts` | **Updated** (error classification for new Edge codes) |
| `docs/production-stabilization-roadmap.md` | **Added** (this file) |

---

## SAFE TO GO LIVE?

**After Phase 0 deploy + checklist:** safe for **punch path** stabilization only.

**Full product (Phases 1–6):** **NO** until shift engine, dashboard, HR queues, offline v2, and attestation verification are done and checked.
