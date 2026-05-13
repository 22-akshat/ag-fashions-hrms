# Native Android migration — repo audit & strategy

This document captures the **first-task audit** of `apps/mobile-attendance` (Expo) and the plan for **pure React Native CLI** in `apps/native-attendance`. Backend (Supabase schema, Edge functions, RPCs, RLS, HR dashboard) stays unchanged.

---

## 1. Current Expo footprint

### 1.1 `package.json` dependencies (Expo-specific)

| Package | Role in app |
|--------|-------------|
| `expo` | Root runtime, `registerRootComponent`, Metro (`expo/metro-config`) |
| `expo-application` | App identity / build info (`deviceId`, `appIntegrity`) |
| `expo-background-fetch` | **Declared only — no imports under `src/`** (safe to drop) |
| `expo-camera` | `FaceCamera.tsx` — `CameraView`, permissions |
| `expo-constants` | `faceEnv.ts` — detect Expo Go vs dev client |
| `expo-device` | Physical device / model (`deviceId`, `integrityChecks`, `emulatorDetection`) |
| `expo-face-detection` | `faceRecognition.ts` — `extractEmbedding` for templates & verify |
| `expo-file-system` | Read photo URIs as base64 (`faceRecognition`, `livenessValidator`) |
| `expo-location` | GPS, background updates, geofence flows (`RegisterScreen`, `locationService`, `locationChecker`) |
| `expo-network` | VPN heuristic (`vpnDetection.ts`) |
| `expo-secure-store` | Supabase auth storage, device keypair, offline crypto keys |
| `expo-status-bar` | `App.tsx` status bar |
| `expo-system-ui` | Expo config plugin only |
| `expo-task-manager` | `locationTask.ts` — background location task definition |

**Not used:** Expo Router, Expo Go-specific routing — navigation is **manual stage state** in `AppContext` + `App.tsx` (no `expo-router`).

### 1.2 Entry & bundling

- `index.ts` → `registerRootComponent` from `expo` (replace with `AppRegistry.registerComponent` from `react-native`).
- `metro.config.js` → `getDefaultConfig` from `expo/metro-config` (replace with `@react-native/metro-config` default).

### 1.3 Files that import Expo modules (rewrite touchpoints)

| File | Expo APIs |
|------|-----------|
| `App.tsx` | `expo-status-bar` |
| `index.ts` | `expo` bootstrap |
| `src/supabase.ts` | `expo-secure-store` for auth persistence |
| `src/components/FaceCamera.tsx` | `expo-camera` |
| `src/lib/deviceId.ts` | `expo-application`, `expo-device` |
| `src/lib/faceEnv.ts` | `expo-constants` (Expo Go detection) |
| `src/lib/faceRecognition.ts` | `expo-file-system`, `expo-face-detection` |
| `src/lib/locationChecker.ts` | `expo-location` |
| `src/locationService.ts` | `expo-location` (foreground service config) |
| `src/locationTask.ts` | `expo-task-manager`, `expo-location` types |
| `src/modules/enterprise-security/device-identity/deviceFingerprint.ts` | `expo-device`, `expo-application` |
| `src/modules/enterprise-security/device-identity/secureStorage.ts` | `expo-secure-store` |
| `src/modules/offline/lib/offlineEncryption.ts` | `expo-secure-store` |
| `src/modules/face/lib/livenessValidator.ts` | `expo-file-system` |
| `src/modules/security/lib/appIntegrity.ts` | `expo-application` |
| `src/modules/security/lib/emulatorDetection.ts` | `expo-device` |
| `src/modules/security/lib/integrityChecks.ts` | `expo-device` |
| `src/modules/security/lib/vpnDetection.ts` | `expo-network` |
| `src/screens/RegisterScreen.tsx` | `expo-location` |

UI copy in `EmployeeLoginScreen.tsx` / `ScanScreen.tsx` references Expo Go — remove when migrating.

---

## 2. Reusable business logic (portable TypeScript)

These layers are **mostly** portable by swapping native I/O:

- **Supabase client & RPCs:** `supabase.ts`, `attendanceApi.ts`, `accessRequestsApi.ts`, `employeeDashboardApi.ts`, `employeeLookup.ts`, `employeeIdResolve.ts`, `shopGeofence.ts`.
- **Edge invocation:** `markAttendance` → `functions.invoke('mark-attendance', …)` + `x-attendance-edge-invocation-key` (env rename only).
- **Offline pipeline:** `modules/offline/*`, `offlineSigner` / `offlineVerifier`, queue/retry/replay guard — swap `SecureStore` + file paths.
- **Security policy / anomaly hooks:** `modules/enterprise-security/policy-engine`, `anomaly/*`, `riskSignalCollector` — mostly pure TS after device context adapters.
- **Face matching math:** `faceMatcher.ts`, `faceEmbedding.ts`, `embeddingVersion.ts`, `livenessChallenge.ts` — **embedding extraction** must be reimplemented (see §4).
- **Theme:** `theme/hrTheme.ts`.
- **Contexts:** `AppContext.tsx`, `EmployeeAuthContext.tsx` — reuse after env + storage adapters.
- **Shared package:** `@ag-fashions/shared` — add as `file:../../packages/shared` (ensure Metro resolves workspace package).

**Env:** Today everything uses `process.env.EXPO_PUBLIC_*`. Bare RN needs **`react-native-config`** or **Babel inline env**; standardize names (e.g. `PUBLIC_SUPABASE_URL`) and update call sites once.

---

## 3. Backend-only (do not reimplement on device)

- All **RLS**, **RPC** definitions, **`mark-attendance`** Edge function logic, **strict mode**, **face session** validation, **atomic attendance** behavior live in Supabase — **unchanged**.
- HR dashboard (`apps/web-admin`) — **no rewrite**.

---

## 4. Must rewrite or replace (native boundaries)

| Area | Current | Target (recommended) |
|------|---------|----------------------|
| Bootstrap | Expo `registerRootComponent` | `AppRegistry.registerComponent('NativeAttendance', …)` |
| Secure storage | `expo-secure-store` | `react-native-keychain` + optional **MMKV** for non-secret prefs |
| Camera & preview | `expo-camera` | **`react-native-vision-camera`** |
| Face embeddings | `expo-face-detection` (`extractEmbedding`) | **ML Kit Face Detection** + custom embedding pipeline **or** native module wrapping same model server expects — **must match server/HRV embedding dimension & normalization** |
| Photo → buffer | `expo-file-system` `readAsStringAsync` | Vision Camera frame processor / `react-native-fs` or URI handling from Vision Camera |
| GPS foreground/background | `expo-location` + task manager | **`react-native-geolocation-service`** + **`@react-native-community/geolocation`** or Play Services Fused; background: **Headless JS** + foreground service (Android 10+) — align with existing `LOCATION_TASK_NAME` RPC contract |
| Background task registration | `expo-task-manager` | Native **`HeadlessJsTaskService`** or dedicated location library service pattern |
| Device / app info | `expo-device`, `expo-application` | **`react-native-device-info`** |
| Network / VPN hint | `expo-network` | **`@react-native-community/netinfo`** (+ heuristics) |
| Status bar | `expo-status-bar` | **`react-native`** `StatusBar` or `react-native-safe-area-context` |
| Constants / “Expo Go” | `expo-constants` | Remove; use **build flavor** or `__DEV__` + `react-native-config` |

---

## 5. Kotlin vs React Native CLI

| Criteria | RN CLI + TS reuse | Kotlin native |
|----------|-------------------|---------------|
| Reuse of existing TS modules | **High** — most APIs and flows copy over | **Low** — rewrite UI + networking |
| Face + GPS + offline parity | Third-party RN libs well documented | Full Jetpack + Play Services |
| Team velocity for this repo | **Faster** given existing `src/` | Slower unless Android-only team |

**Recommendation:** **React Native CLI** (already scaffolded under `apps/native-attendance`) to maximize reuse of `attendanceApi`, offline crypto, and contexts.

---

## 6. Android project notes (`apps/native-attendance`)

- **Application ID:** `com.agfashions.attendance`
- **JS component name:** `NativeAttendance` (see `MainActivity.getMainComponentName()`)
- **Kotlin sources** live under `java/com/agfashions/attendance/` (standard package layout).
- **Manifest:** Enterprise permissions added (camera, location incl. background, FGS location, notifications, biometric, etc.). When implementing background location, declare the **foreground service** (`foregroundServiceType="location"`) and matching `<service>` entries per chosen library.

---

## 7. Migration phases (safe order)

1. **Env + Supabase** — `react-native-config`, secure auth storage, smoke-test RPC read.
2. **Auth flows** — port `EmployeeAuthContext` + login/register navigation.
3. **Dashboard + Realtime** — port `employeeDashboardApi`, Supabase channels for approval status.
4. **Attendance punch** — port `markAttendance` path end-to-end with geofence + shop id.
5. **Face** — Vision Camera + new embedding path; keep server contract unchanged.
6. **Offline queue** — MMKV/AsyncStorage + signing path; replay to Edge unchanged.
7. **Location tracking** — replace `locationTask` + `locationService` with native background pattern; keep `employee_upsert_location` RPC.
8. **Integrity / attestation** — wire Play Integrity (existing stubs in repo) to native APIs.

---

## 8. Risks

- **Embedding mismatch** if new face pipeline differs from `expo-face-detection` — requires coordinated test vectors vs HR-stored templates.
- **Background location** policy and Play Store declarations (foreground service type, user disclosure).
- **RN 0.85** vs old app **RN 0.81** — minor API drift when copying screens; align TypeScript and peer deps.
- **Monorepo Metro** — may need `watchFolders` / `resolver.extraNodeModules` if hoisting `packages/shared`.

---

## 9. Deliverables checklist (implementation status)

| Item | Status |
|------|--------|
| New folder `apps/native-attendance/` | Done — RN CLI 0.85.3 |
| Gradle / Android Studio runnable | Run `npm run android` from app dir |
| Expo removed from new app | No Expo deps in `native-attendance` |
| Full feature parity | **Pending** — scaffold + audit only |
| APK / release signing | Use RN [signed APK docs](https://reactnative.dev/docs/signed-apk-android); release still uses debug keystore in template |

---

## 10. Commands reference

```bash
cd "d:\A G Fashions\apps\native-attendance"
npm start
# other terminal:
npm run android
```

Release APK (after configuring signing):

```bash
cd android
.\gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`
