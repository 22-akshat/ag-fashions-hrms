# AG Fashions — Native Attendance (React Native CLI)

Pure **React Native CLI** Android app (`com.agfashions.attendance`). No Expo runtime. Backend remains **Supabase** (same project, Edge functions, RPCs, RLS) plus existing **HR web-admin** dashboard.

Full migration audit, Expo dependency map, and phased port list: **[MIGRATION_AUDIT.md](./MIGRATION_AUDIT.md)**.

## Troubleshooting: “Unable to load script”

Debug builds load JavaScript from **Metro** (default **http://localhost:8081**). That error means the device/emulator cannot reach the bundler.

**Logcat smoking gun:** `Failed to connect to localhost/127.0.0.1:8081` and `isMetroRunning(): Async result = false` — the app probed **packager status on the device’s loopback**. That only reaches your PC if Metro is up **and** you use **`adb reverse`** (USB) **or** set **Debug server host** to your PC IP (Wi‑Fi).

1. **Start Metro** from `apps/native-attendance` (must be this folder — not the monorepo root):

   ```sh
   npm start
   ```

   **Wi‑Fi / physical device (same LAN):** Metro must listen on all interfaces, or the phone cannot reach your PC:

   ```sh
   npm run start:lan
   ```

   Leave it running. In another terminal: `npm run android`, or run the app from Android Studio.

   **Sanity check on your PC:** open `http://localhost:8081/status` — you should see JSON from the packager. **On the phone’s browser:** open `http://YOUR_PC_IP:8081/status` — if this fails, fix Wi‑Fi/firewall before reopening the app.

2. **USB + physical phone:** reverse the dev server port so “localhost” on the phone hits your PC:

   ```sh
   adb reverse tcp:8081 tcp:8081
   ```

3. **Wi‑Fi device:** phone and PC must be on the **same network**. Shake device → **Dev Settings** → **Debug server host & port for device** → set to `YOUR_PC_LAN_IP:8081` (e.g. `192.168.1.10:8081`). Windows Firewall must allow **inbound TCP 8081** (or temporarily allow Node.js).

4. **Android Emulator:** usually `adb reverse` is not needed; ensure Metro is running. If it still fails, try Dev Settings → same host as `10.0.2.2:8081` is special on emulator (often default works).

5. **Release APK:** must embed the bundle (`index.android.bundle`); `assembleRelease` does that. Do not expect Metro for release installs.

## Prerequisites

- Node ≥ 22 (see `package.json` `engines`)
- Android Studio + Android SDK (see [React Native environment setup](https://reactnative.dev/docs/set-up-your-environment))
- JDK bundled with Android Studio

## Configure environment

Copy `.env.example` to `.env` at this app root and fill values (after wiring `react-native-config` or equivalent in JS).

## Run from CLI

```sh
cd apps/native-attendance
npm install
npm start
```

In another terminal:

```sh
cd apps/native-attendance
npm run android
```

## Run from Android Studio

1. Open **`apps/native-attendance/android`** in Android Studio.
2. Wait for Gradle sync.
3. Select a device or emulator.
4. Run the **app** configuration.

Metro must be running (`npm start`) unless you use a pre-bundled release build.

## Release APK

1. Configure a release keystore and signing in `android/app/build.gradle` (replace debug signing for `release`).
2. Build:

```sh
cd apps/native-attendance/android
./gradlew assembleRelease
```

APK path: `app/build/outputs/apk/release/app-release.apk`

(On Windows: `gradlew.bat assembleRelease`.)

## iOS

The template includes an `ios/` tree for parity; this product scope is **Android-first**. CocoaPods setup is unchanged from upstream RN template if you need it later.
