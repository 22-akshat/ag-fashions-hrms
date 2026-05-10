# Attendance Android App

Same flow as the web attendance kiosk: splash → register → scan → success.
**Register:** card no. → Employees DB name → GPS nearest `shops` name → face capture → continue. Then scan uses geofence + face match, plus periodic GPS sync into `employee_locations`.

## Face recognition

- Uses [`expo-face-detection`](https://www.npmjs.com/package/expo-face-detection): MTCNN + **MobileFaceNet** (192‑dim embeddings), matching on-device.
- **Android only.** Requires **Expo SDK 54+** and a **custom dev client** (not plain Expo Go). After adding the native module:

```bash
npx expo prebuild
npx expo run:android
```

- For quick UI testing **without** a dev build, set in `.env`:

  `EXPO_PUBLIC_DEV_SKIP_FACE_MATCH=true`

  Then registration skips embeddings and scanned attendance is saved with `face_verified: false`.

## Store geofence (Supabase)

- **Source of truth:** `shops` table (`lat`, `lng`, `radius_meters`) — same as the management system (`findShopById` / access requests).
- On each attendance scan the app **refetches** the shop row so changes in the dashboard apply without rebuilding the app.
- **`EXPO_PUBLIC_DEFAULT_SHOP_ID`:** optional UUID — pick one row when you have multiple shops. If empty, the app uses **first row** returned by `shops` (`limit 1`).
- **`EXPO_PUBLIC_OFFICE_*`:** optional **fallback** only if the `shops` query fails (e.g. offline). If both DB and fallback are missing, **no geofence** is enforced (attendance allowed everywhere).

## Env (`.env`)

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `EXPO_PUBLIC_DEFAULT_SHOP_ID` | Which `shops.id` to use (optional) |
| `EXPO_PUBLIC_OFFICE_LAT` / `EXPO_PUBLIC_OFFICE_LNG` | Fallback circle if `shops` cannot be loaded |
| `EXPO_PUBLIC_ALLOWED_RADIUS_METERS` | Fallback radius (metres) |
| `EXPO_PUBLIC_DEV_SKIP_FACE_MATCH` | Skip native face libs (testing) |
| `EXPO_PUBLIC_ENABLE_LIVENESS` | Run anti‑spoof liveness before match |
| `EXPO_PUBLIC_FACE_MATCH_THRESHOLD` | Optional L2 match threshold override |
| `EXPO_PUBLIC_LIVENESS_THRESHOLD` | Optional liveness threshold |
| `EXPO_PUBLIC_SHARPNESS_THRESHOLD` | Optional blur / sharpness threshold |

Note: face-related flags are **app-side** for now. If you later add columns (e.g. on `shops` or a settings table), we can wire those the same way.

## Expo Go vs dev build

- **Error `Cannot find native module 'ExpoFaceDetection'`** means you are running in **Expo Go** or a binary that did not compile `expo-face-detection`. That is normal for Expo Go.
- **Quick fix:** in `.env` set `EXPO_PUBLIC_DEV_SKIP_FACE_MATCH=true`, stop Metro, run `npm start` again → app works without native face libs (`face_verified` will be `false`).
- **Real face match:** `npx expo prebuild && npx expo run:android` (custom dev client on device/emulator).

## Run

```bash
npm install
cp .env.example .env   # then edit
npx expo run:android    # preferred for face + background location
# or: npm start         # Expo Go — set DEV_SKIP_FACE_MATCH=true OR expect native module error without it
```

## Employee id (`employee_locations` / `attendance_logs`)

PostgreSQL FK columns expect **`employees.id` (UUID)**. You can enter **Card No.** (`employees.card_no`) in the app; it is resolved to UUID before inserts. Paste a full UUID directly if needed.

If resolution fails (wrong card spelling, inactive row, RLS blocking `select`), location sync stops with a console message — fix the identifier or grants.

## Supabase tables

- **`attendance_logs`**: aligns with management dashboard selects — at least:

  `employee_id`, `timestamp`, `face_verified`, `status`

  This app inserts `status: 'present'` and timestamps with `timestamp` set to ISO time.

- **`employee_locations`**: upsert keyed on `employee_id` (same shape as earlier web tracker: `lat`, `lng`, `accuracy`, `recorded_at`).

## Behaviour summary

| Step | Behaviour |
|------|-----------|
| Register | Saves employee ID + face photo URI + embedding (unless dev skip). |
| Scan | Requires geofence pass, then compares face to embedding (unless dev skip). |
| Logs | Writes `face_verified: true` only when native match succeeds. |
| GPS | Starts background foreground-service updates ~every 5 minutes after successful scan. Success screen includes **Stop location tracking**. |
