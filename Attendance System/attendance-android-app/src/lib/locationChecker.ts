import * as Location from 'expo-location';

import type { GeofenceCircle } from './shopGeofence';

type LocationCheckResult = {
  inside: boolean;
  distanceMeters: number;
  latitude: number;
  longitude: number;
};

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function calculateDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) {
  const earthRadiusMeters = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
}

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
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    throw new Error('Location permission is required to mark attendance.');
  }

  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  const latitude = pos.coords.latitude;
  const longitude = pos.coords.longitude;

  if (!hasFence(fence)) {
    return {
      inside: true,
      distanceMeters: 0,
      latitude,
      longitude,
    };
  }

  const distanceMeters = calculateDistanceMeters(
    latitude,
    longitude,
    fence.lat,
    fence.lng,
  );

  return {
    inside: distanceMeters <= fence.radiusMeters,
    distanceMeters,
    latitude,
    longitude,
  };
}
