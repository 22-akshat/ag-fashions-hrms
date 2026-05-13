# Security audit — HRMS codebase (evidence-based)

**Scope:** Implemented code and SQL under this repository only (`apps/web-admin`, `apps/mobile-attendance`, `apps/web-admin/supabase/schema.sql`, `apps/web-admin/supabase/migrations/`).  
**Included in-repo:** Edge Function `mark-attendance` (`apps/web-admin/supabase/functions/mark-attendance/`).  
**Not in scope:** Supabase project dashboard settings, hosting secrets, network controls outside this repo.

---

## 1. Current authentication risks

**Web admin:** `supabase.auth.signInWithPassword` via `apps/web-admin/src/core/auth/authApi.js`, `AuthProvider`, JWT session.

| Risk | Evidence / note |
|--------|------------------|
| **`hr_login_credentials` removed post-migration** | Migration `20260515120000_remove_legacy_attendance_and_credentials.sql` drops the table after it is emptied. Historical definition: `20260508144500_add_hr_login_credentials.sql`. |
| **JWT + HR allow-list** | RLS migrations (`20260514120000_rls_hr_users_and_hardening.sql`) require `public.hr_users` + `is_hr_user(auth.uid())` for HR reads/writes on several tables (see migrate file). Mis-seeded allow-list ⇒ broken admin UI. |
| **Mobile anon key** | Attendance/register flows still rely on anon for some APIs; punching uses Edge + **`EXPO_PUBLIC_ATTENDANCE_EDGE_INVOCATION_KEY`** (high sensitivity — treat like a bearer secret until device auth arrives). |

---

## 2. Current RLS / grants (incremental tightening)

Treat **`schema.sql` as illustrative** — authoritative behavior is **`supabase/migrations/*.sql`** applied in chronological order (`20260514120000…`, then `20260515120000…`).

**Post–`20260515120000`:**

| Surface | Behaviour |
|---------|-----------|
| `attendance_logs` | **`INSERT`** via **service_role** only (Edge). Anon/`authenticated` **INSERT** revoked. HR reads/updates/deletes via `is_hr_user` policies (`20260514120000`). |
| `employees` | HR CRUD authenticated + `is_hr_user`; anon **SELECT Active** rows only (mobile resolve). |
| `shops` | HR CRUD + `is_hr_user`; anon **SELECT** read-only. |
| `employee_locations` | HR **SELECT**; anon **INSERT/UPDATE** retained temporarily (spoof risk — below). See `locationTask.ts` header comment + TODO(authed-device). |
| `attendance_access_requests` | HR authenticated read/update/delete; anon insert/select narrowed vs historical “everything” (`202605141…`). |

**Eliminated:**

- **`hr_login_credentials`** table (once migration succeeds with empty table).
- **Anon `INSERT` into `attendance_logs`** (`attendance_logs_insert_anon_mobile_legacy` dropped).

---

## 3. Client-side trust issues

| Area | What still depends on trust |
|--------|------------------------------|
| **HR session (web)** | Supabase Auth JWT + seeded `hr_users`. |
| **Face verification** | Client sends `face_verified` into Edge payload; Edge does **not** re-verify biometrics server-side. |
| **Pre-check geofence (mobile)** | Client-side `verifyGeofence` before invoking Edge — UX only; authoritative check is Edge `mark-attendance`. |
| **Edge invocation key** | Shared secret embedded in mobile build — anyone with APK + reverse engineering can replay invocations knowing another employee UUID + GPS spoofing caveats |

---

## 4. Location spoofing risks (`employee_locations`)

| Risk | Evidence |
|--------|-----------|
| Still **anonymous upsert path** via anon key | `apps/mobile-attendance/src/locationTask.ts` — documented temporary risk pending authenticated device strategy |
| GPS attacker-controlled | No attestation in repo |

---

## 5. Attendance forgeability (Edge phase)

**Reduced versus legacy:**

- Rows require Edge insert with server timestamp, duplicate window, HR Active employee checks, Supabase-shop geofence (server recomputes from lat/lng + `shops`).
- **`EXPO_PUBLIC_ATTENDANCE_EDGE_INVOCATION_KEY`** + deployed function required.

**Remaining:**

- Bearer secret in mobile bundle; spoofed coords can still satisfy geofence if attacker knows coords inside radius..
- **`face_verified`** still originates from client.

---

## 6. Anon key exposure

**Residual anon surface:** active employee read, shops read, access_request insert/read patterns, **`employee_locations` upsert**. HR web uses **authenticated** JWT for guarded tables after migrations.

---

## 7. Mitigation backlog (incremental — not exhaustive)

Implemented in-repo relative to earliest audits:

- **Supabase Auth** for HR UI; **JWT** + **`hr_users`** for admin RLS.
- **Edge `mark-attendance`** with audit table `attendance_audit_events` (`20260513140000…`).
- **Legacy `INSERT` punches** removed (**`20260515120000…`**).

Still open / backlog:

- **Authenticated device writes** on `employee_locations` (eliminate anon upsert path).
- Tighter anon on `attendance_access_requests`.
- Rotate / replace mobile Edge invocation bearer with **JWT or per-device**.
- Operational rate limits / abuse dashboards (hosting/API layer).

---

## 8. Production readiness notes

Historical “blockers” list is **narrowed**. Remaining systemic concerns:

1. **`EXPO_PUBLIC_ATTENDANCE_EDGE_INVOCATION_KEY` exposure** — treat key as confidential; rotate on leak.
2. **`employee_locations` anon writes** until device-auth rollout.
3. **GPS + face assertions** trusted from client payloads at Edge without hardware attestation

---

## 9. Recommended hardening phases (remainder)

Incremental state: **Phase A/B/C partly done** via Supabase Auth + `hr_users` RLS migrations; **attendance punches** Edge-only (**`mark-attendance`** + migration `20260515120000`); **`hr_login_credentials`** dropped once empty.

| Phase | Recommended next steps |
|-------|-------------------------|
| **A–B remainder** | Tighten remaining anon paths (`attendance_access_requests`, `employee_locations`). |
| **C remainder** | **Authenticated device / Edge** writes for locations; optional server geo heuristics. |
| **D** | Rotate Edge invocation bearer; shorten secret lifetime; migrate employees to JWT where feasible. |
| **E** | Operational runbooks, staging/prod split, backups. |

---

## Document map (source files)

| Topic | Primary sources |
|--------|------------------|
| Schema, grants, RLS | `apps/web-admin/supabase/migrations/` (prefer over static `schema.sql` for drift) |
| HR login | `apps/web-admin/src/core/auth/` |
| Web Supabase client | `apps/web-admin/src/module1/employees/lib/supabase/client.js` |
| Edge mark-attendance | `apps/web-admin/supabase/functions/mark-attendance/index.ts`; `backend/edge-functions/mark-attendance/README.md` |
| Mobile punch + location | `apps/mobile-attendance/src/lib/attendanceApi.ts`, `src/locationTask.ts`, related screens/libs |

---

*This document describes risks as of the repository state at authoring time. Re-run the audit after substantive schema or auth changes.*
