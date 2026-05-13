import { haversineMeters } from '@ag-fashions/shared/geo';

import type { GeofenceCircle } from './shopGeofence';
import { ensureForegroundLocationPermission, getCurrentPositionHighAccuracy } from './geoLocation';

type LocationCheckResult = {
  inside: boolean;
  distanceMeters: number;
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

function hasFence(fence: GeofenceCircle | null): fence is GeofenceCircle {
  return (
    fence !== null &&
    Number.isFinite(fence.lat) &&
    Number.isFinite(fence.lng) &&
    Number.isFinite(fence.radiusMeters) &&
    fence.radiusMeters > 0
  );
}

/**
 * Uses current GPS vs given geofence. If fence is null, location is treated as allowed (inside).
 */
export async function verifyGeofence(fence: GeofenceCircle | null): Promise<LocationCheckResult> {
  const permissionOk = await ensureForegroundLocationPermission();
  if (!permissionOk) {
    throw new Error('Location permission is required to mark attendance.');
  }

  const pos = await getCurrentPositionHighAccuracy();

  const latitude = pos.latitude;
  const longitude = pos.longitude;
  const accuracy = pos.accuracy;

  if (!hasFence(fence)) {
    return {
      inside: true,
      distanceMeters: 0,
      latitude,
      longitude,
      accuracy,
    };
  }

  const distanceMeters = haversineMeters(latitude, longitude, fence.lat, fence.lng);

  return {
    inside: distanceMeters <= fence.radiusMeters,
    distanceMeters,
    latitude,
    longitude,
    accuracy,
  };
}
