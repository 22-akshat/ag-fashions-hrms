import { supabase } from '../supabase';

/** Circle used for attendance geofence (matches management app `shops` row). */
export type GeofenceCircle = {
  lat: number;
  lng: number;
  radiusMeters: number;
};

export type ShopGeofence = GeofenceCircle & {
  id: string;
  name: string | null;
};

type ShopRow = {
  id: string;
  name: string | null;
  lat: unknown;
  lng: unknown;
  radius_meters?: unknown;
};

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
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

export type NearestShopMatch = {
  shop: ShopGeofence;
  distanceMeters: number;
  insideRadius: boolean;
};

/** Nearest shop from Supabase vs current GPS — used on Register to show DB store name. */
export async function fetchNearestShopForGps(
  lat: number,
  lng: number,
): Promise<NearestShopMatch | null> {
  const sb = supabase;
  if (!sb) return null;

  const { data: rows, error } = await sb.from('shops').select('id,name,lat,lng,radius_meters');
  if (error) throw new Error(error.message);

  let best: ShopGeofence | null = null;
  let bestD = Infinity;

  for (const row of rows ?? []) {
    const s = normalizeShopRow(row as ShopRow);
    if (!s) continue;
    const d = haversineMeters(lat, lng, s.lat, s.lng);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }

  if (!best) return null;

  return {
    shop: best,
    distanceMeters: bestD,
    insideRadius: bestD <= best.radiusMeters,
  };
}

function normalizeShopRow(data: ShopRow | null): ShopGeofence | null {
  if (!data) return null;
  const lat = Number(data.lat);
  const lng = Number(data.lng);
  const radiusRaw = data.radius_meters;
  const radiusMeters =
    radiusRaw !== undefined && radiusRaw !== null && String(radiusRaw).trim() !== ''
      ? Number(radiusRaw)
      : Number.NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    id: String(data.id),
    name: data.name ?? null,
    lat,
    lng,
    radiusMeters: Number.isFinite(radiusMeters) ? radiusMeters : 200,
  };
}

/**
 * Load store location from Supabase `shops` (same as management system).
 * If `EXPO_PUBLIC_DEFAULT_SHOP_ID` is set, that row is used; otherwise first row (`limit 1`).
 */
export async function fetchShopGeofenceFromSupabase(): Promise<ShopGeofence | null> {
  const sb = supabase;
  if (!sb) return null;

  const shopId = process.env.EXPO_PUBLIC_DEFAULT_SHOP_ID?.trim();
  const baseSelect = () => sb.from('shops').select('id,name,lat,lng,radius_meters');

  const { data, error } = shopId
    ? await baseSelect().eq('id', shopId).maybeSingle()
    : await baseSelect().limit(1).maybeSingle();

  if (error) throw new Error(error.message);
  return normalizeShopRow(data as ShopRow | null);
}

/** Optional offline / backup when no shop row loads (omit in prod if DB is canonical). */
export function getGeofenceFromEnv(): GeofenceCircle | null {
  const lat = Number(process.env.EXPO_PUBLIC_OFFICE_LAT ?? 0);
  const lng = Number(process.env.EXPO_PUBLIC_OFFICE_LNG ?? 0);
  const radiusMeters = Number(process.env.EXPO_PUBLIC_ALLOWED_RADIUS_METERS ?? 200);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) return null;
  return {
    lat,
    lng,
    radiusMeters: Number.isFinite(radiusMeters) ? radiusMeters : 200,
  };
}

export function resolveActiveGeofence(shopFence: ShopGeofence | null): GeofenceCircle | null {
  if (shopFence) {
    return {
      lat: shopFence.lat,
      lng: shopFence.lng,
      radiusMeters: shopFence.radiusMeters,
    };
  }
  return getGeofenceFromEnv();
}
