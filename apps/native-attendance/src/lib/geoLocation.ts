import Geolocation from 'react-native-geolocation-service';
import { Platform } from 'react-native';
import {
  check,
  request,
  PERMISSIONS,
  RESULTS,
  type Permission,
} from 'react-native-permissions';

function foregroundPermission(): Permission {
  return Platform.select({
    ios: PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
    android: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
    default: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
  })!;
}

function isAndroidActivityNotReadyError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /not attached to an Activity/i.test(msg);
}

/** RN Android: first permission calls can run before MainActivity is attached (early mount / effects). */
async function runWhenPermissionsApiReady<T>(fn: () => Promise<T>): Promise<T> {
  const maxAttempts = Platform.OS === 'android' ? 5 : 1;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (attempt < maxAttempts - 1 && isAndroidActivityNotReadyError(e)) {
        await new Promise<void>((resolve) => setTimeout(resolve, 80 * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
  throw lastError;
}

export async function ensureForegroundLocationPermission(): Promise<boolean> {
  const perm = foregroundPermission();
  return runWhenPermissionsApiReady(async () => {
    const current = await check(perm);
    if (current === RESULTS.GRANTED || current === RESULTS.LIMITED) return true;
    const next = await request(perm);
    return next === RESULTS.GRANTED || next === RESULTS.LIMITED;
  });
}

function cameraPermission(): Permission {
  return Platform.select({
    ios: PERMISSIONS.IOS.CAMERA,
    android: PERMISSIONS.ANDROID.CAMERA,
    default: PERMISSIONS.ANDROID.CAMERA,
  })!;
}

/** Used by image-picker fallback and any non–Vision-Camera capture flows. */
export async function ensureCameraPermission(): Promise<boolean> {
  const perm = cameraPermission();
  return runWhenPermissionsApiReady(async () => {
    const current = await check(perm);
    if (current === RESULTS.GRANTED || current === RESULTS.LIMITED) return true;
    const next = await request(perm);
    return next === RESULTS.GRANTED || next === RESULTS.LIMITED;
  });
}

export type CurrentPosition = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

export async function getCurrentPositionHighAccuracy(): Promise<CurrentPosition> {
  const ok = await ensureForegroundLocationPermission();
  if (!ok) throw new Error('Location permission denied.');
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy:
            pos.coords.accuracy != null && Number.isFinite(pos.coords.accuracy)
              ? pos.coords.accuracy
              : null,
        }),
      (err) => reject(err instanceof Error ? err : new Error(String(err))),
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 10000,
        forceRequestLocation: true,
        showLocationDialog: true,
      },
    );
  });
}
