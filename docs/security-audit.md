# Security audit — HRMS codebase (evidence-based)

**Scope:** Implemented code and SQL under this repository only (`management system`, `Attendance System/attendance-android-app`, `management system/supabase/schema.sql`, `management system/supabase/migrations/`).  
**Not in scope:** Supabase project dashboard settings, hosting secrets, network controls, or features not present in the repo (e.g. no Edge Functions, no `service_role` usage in app code).

---

## 1. Current authentication risks

| Risk | Evidence |
|--------|-----------|
| **Plaintext password verification** | `hr_login_credentials.password` is matched with `.eq('password', normalizedPassword)` in `management system/src/module0/auth/lib/login.js`. Passwords are stored and compared as plaintext at the database layer (column `password text not null` in `management system/supabase/schema.sql`). |
| **Credential table readable/writable by anon** | RLS policies `hr_login_credentials_*_anon` use `using (true)` / `with check (true)` in `schema.sql`; `grant ... to anon, authenticated` on the same table. Anyone with the anon key can **SELECT** rows (including password column if selected), **INSERT/UPDATE/DELETE** per grants + policies. |
| **No Supabase Auth for HR** | Web client is `createClient(url, anonKey)` in `management system/src/module1/employees/lib/supabase/client.js` — no `signInWithPassword`, no JWT session for data access. |
| **Session is browser-only** | `management system/src/App.jsx` sets `localStorage` keys `hrms-authenticated` and `hrms-auth-user` after `verifyLoginCredentials` succeeds. This does **not** bind Postgres/RLS to an authenticated Supabase user; it only gates the React router UI. |
| **Login copy vs implementation** | `LoginPage.jsx` text references “Supabase username/password”; actual implementation queries `hr_login_credentials` via anon client (`login.js`), not Supabase Auth. |

---

## 2. Current RLS risks

RLS is **enabled** on sensitive tables but policies are **permissive** for the `anon` role where the app uses the anon key.

| Table | Issue | Evidence |
|--------|--------|-----------|
| `public.employees` | Full CRUD for anon: `employees_*_anon` all use `(true)`. | `schema.sql` |
| `public.hr_login_credentials` | Full CRUD + select for anon with `(true)`. | `schema.sql` |
| `public.attendance_access_requests` | Full CRUD + select for anon with `(true)`. | `schema.sql`, migration `20260508105500_add_attendance_access_requests.sql` |
| `public.attendance_logs` | **Select and insert** for anon with `(true)` (“legacy” policies). **Update/delete** for `authenticated` with `(true)` (still no row ownership). | `schema.sql`, `20260509193000_add_shops_and_attendance_logs.sql` |
| `public.shops` | Select for anon/authenticated with `(true)`; write for `authenticated` with `(true)`. Web HR client uses **anon** only — writes not available from that client without a different role. | `schema.sql` |
| `public.employee_locations` | Policy `"Employees can upsert own location"` uses `using (true)` and `with check (true)` with grants to anon. **No** tie to `auth.uid()` or device identity. | `20260509195500_add_employee_locations_realtime.sql` |

**Conclusion:** RLS exists in name only for anon-driven clients; it does not enforce least privilege or identity.

---

## 3. Client-side trust issues

| Area | What the code trusts | Evidence |
|--------|----------------------|-----------|
| **HR “logged in” state** | Browser `localStorage` flags only. | `App.jsx` |
| **Face verification flag** | Mobile sets `face_verified` on insert; dev path can skip face match and insert with `face_verified: false`. | `attendance-android-app/src/lib/attendanceApi.ts`, `ScanScreen.tsx` (referenced pattern: `markAttendance` + `devSkipFaceMatch` in same app) |
| **Geofence** | Mobile decides inside/outside using device GPS vs fence from DB or env; if no fence, **treated as inside**. | `attendance-android-app/src/lib/locationChecker.ts` (`hasFence` false ⇒ `inside: true`) |
| **Employee identity for punches** | Card number or UUID resolved client-side then used in insert. | `employeeIdResolve.ts`, `attendanceApi.ts` |
| **Live distance UI (web)** | HR “Live Attendance” uses request GPS + shop coords and **client-side** haversine in `Attendance.jsx` — informational, not an enforcement boundary. | `Attendance.jsx` (`haversineKm`, `LIVE_DISTANCE_LIMIT_METERS`) |

There is **no** server-side validation path in this repository for attendance, geofence, or face outcomes.

---

## 4. Location spoofing risks

| Risk | Evidence |
|--------|-----------|
| **GPS is attacker-controlled on device** | Expo `Location.getCurrentPositionAsync` / background updates supply coordinates consumed by the app. No attestation or server-side verification in repo. |
| **`employee_locations` accepts arbitrary coordinates** | Background task upserts `lat`, `lng`, `accuracy` from the device into Supabase. | `attendance-android-app/src/locationTask.ts` |
| **DB does not validate plausibility** | Columns are `double precision`; RLS does not restrict which `employee_id` may be written beyond “anon can do everything” on that table. | `20260509195500_add_employee_locations_realtime.sql`, `schema.sql` grants/policies |
| **Access request GPS** | Mobile submits `request_lat`, `request_lng`, `request_accuracy_m` via `submitRegistrationAccessRequest` in `attendance-android-app/src/lib/accessRequestsApi.ts`; insert allowed for anon per `schema.sql`. |

---

## 5. Attendance forgery risks

| Risk | Evidence |
|--------|-----------|
| **Anyone with anon key can insert `attendance_logs`** | Policy `attendance_logs_insert_legacy` allows insert to anon with `with check (true)`. | `schema.sql` |
| **No server binding of punch to caller** | Insert only requires a valid `employee_id` FK to `employees`. No `auth.uid()`, no signed device token, no rate limit in SQL/app. | `attendanceApi.ts`, `schema.sql` |
| **Forged `face_verified` and `status`** | Mobile defaults `status: 'present'`; `face_verified` is a boolean from client logic. A custom HTTP client using the same anon key could insert arbitrary allowed `status` values per check constraint. | `attendanceApi.ts`, `attendance_logs_status_chk` in `schema.sql` |
| **Custom client bypasses app geofence/face** | Geofence and face checks run only in the mobile app before insert; Postgres does not re-validate. | `locationChecker.ts`, `attendanceApi.ts`, RLS policies |

---

## 6. Anon key exposure risks

| Risk | Evidence |
|--------|-----------|
| **Anon key bundled in web build** | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in `client.js` — typical Vite pattern exposes these to any user who opens devtools or the built JS. |
| **Anon key in mobile** | `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `attendance-android-app/src/supabase.ts` — public env prefix implies embeddable keys. |
| **Broad data exfiltration** | With anon key + current RLS, clients can read **employees** (PII), **hr_login_credentials**, **attendance_logs**, **employee_locations**, **attendance_access_requests**, **shops** per policies and grants. | `schema.sql` |
| **Data destruction / tampering** | Same policies allow anon **UPDATE/DELETE** on several tables where granted (e.g. employees, hr_login_credentials, attendance_access_requests). | `schema.sql` |

---

## 7. Current mitigation gaps (what is **not** implemented here)

The following are **not** present in this repo as implemented controls:

- Supabase Auth (email/phone/OAuth) for HR or employees with JWT-backed RLS.
- Password hashing (bcrypt/Argon2) for `hr_login_credentials`; passwords are plaintext in DB and query.
- Row-level policies keyed on `auth.uid()` or custom claims.
- Edge Functions, RPCs, or triggers that validate attendance, geofence, or face server-side.
- Rate limiting, audit logging, or IP/device binding for sensitive writes.
- Separation of **read** vs **write** roles (e.g. HR UI using user JWT vs service role only on server).
- Certificate pinning / app attestation for mobile.
- Encryption of PII at rest beyond whatever the host provides (not configured in repo).

**Partial integrity controls (not security boundaries):** e.g. unique partial indexes on `attendance_access_requests` for one pending row per employee/card (`schema.sql`, migration `20260511120000_access_requests_employee_id_and_pending_unique.sql`) — reduce duplicates, **not** authorization.

---

## 8. Production blockers

These block responsible public production deployment **as implemented**:

1. **Anon + open RLS** on HR PII, credentials, attendance, and locations (`schema.sql`).
2. **Plaintext HR passwords** queried from the client (`login.js`, `hr_login_credentials` schema).
3. **No real authentication** tying the web app to Postgres; `App.jsx` localStorage gate only.
4. **Attendance and location integrity** entirely client-side; anon insert/upsert allows forgery and mass abuse.
5. **Single anon key** grants excessive read/write surface to any possessor of the key or compromised front-end.

---

## 9. Recommended hardening phases

Phases are **sequential recommendations** aligned with typical migration cost; none of these exist in the repo today unless explicitly added later.

### Phase A — Stop the bleeding (credentials & anon surface)

- Move HR authentication to **Supabase Auth** (or another IdP) and **remove** `hr_login_credentials` from client-readable paths, or restrict that table to `service_role` only and delete anon policies.
- **Hash** passwords if any custom credential table must remain (not implemented now).
- Revoke anon **DELETE/UPDATE** on tables that do not require public writes; narrow `GRANT` to minimum.

### Phase B — RLS tied to identity

- Replace `using (true)` policies with policies based on **`auth.uid()`** and role tables (e.g. `is_hr(auth.uid())`), or use **service_role** only from a trusted backend for admin operations.
- Employees: decide whether mobile needs read-only subset vs full HR CRUD.

### Phase C — Server-side attendance & location

- Insert `attendance_logs` only via **Edge Function / backend** using `service_role`, validating punch window, optional device id, and **server-side** geofence (understanding GPS can still be spoofed — this raises bar).
- Restrict `employee_locations` writes similarly; optionally validate speed/distance between updates (heuristic only).

### Phase D — Mobile and key hygiene

- Prefer **authenticated** Supabase users for employees where feasible; short-lived tokens; minimal `EXPO_PUBLIC_*` secrets.
- Operational: key rotation, monitoring on `auth.audit_log` / API logs, abuse detection.

### Phase E — Defense in depth

- Separate environments (staging/prod), backup/restore testing, incident runbooks — outside code but required for production.

---

## Document map (source files)

| Topic | Primary sources |
|--------|------------------|
| Schema, grants, RLS | `management system/supabase/schema.sql`, migrations under `management system/supabase/migrations/` |
| HR login | `management system/src/module0/auth/lib/login.js`, `App.jsx`, `LoginPage.jsx` |
| Web Supabase client | `management system/src/module1/employees/lib/supabase/client.js` |
| Mobile client, punch, access requests, location sync | `Attendance System/attendance-android-app/src/supabase.ts`, `src/lib/attendanceApi.ts`, `src/lib/locationChecker.ts`, `src/lib/accessRequestsApi.ts`, `src/locationTask.ts`, `src/screens/ScanScreen.tsx` |

---

*This document describes risks as of the repository state at authoring time. Re-run the audit after substantive schema or auth changes.*
