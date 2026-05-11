/** Client-side validation aligned with public.shops check constraints. */

export const RADIUS_MIN = 1
export const RADIUS_MAX = 500_000

export function validateShopName(name) {
  const t = String(name ?? '').trim()
  if (!t) return { ok: false, message: 'Shop name is required.' }
  if (t.length > 200) return { ok: false, message: 'Shop name is too long (max 200 characters).' }
  return { ok: true, value: t }
}

export function validateLatitude(lat) {
  const n = Number(lat)
  if (!Number.isFinite(n)) return { ok: false, message: 'Latitude must be a number.' }
  if (n < -90 || n > 90) return { ok: false, message: 'Latitude must be between -90 and 90.' }
  return { ok: true, value: n }
}

export function validateLongitude(lng) {
  const n = Number(lng)
  if (!Number.isFinite(n)) return { ok: false, message: 'Longitude must be a number.' }
  if (n < -180 || n > 180) return { ok: false, message: 'Longitude must be between -180 and 180.' }
  return { ok: true, value: n }
}

export function validateRadiusMeters(radius) {
  const n = Number(radius)
  if (!Number.isFinite(n)) return { ok: false, message: 'Radius must be a number.' }
  if (n < RADIUS_MIN || n > RADIUS_MAX) {
    return { ok: false, message: `Radius must be between ${RADIUS_MIN} and ${RADIUS_MAX} meters.` }
  }
  return { ok: true, value: n }
}

/**
 * Validates all fields for create/update payloads.
 * @returns {{ ok: true, payload: { name: string, lat: number, lng: number, radius_meters: number, is_active: boolean } } | { ok: false, message: string }}
 */
export function validateShopPayload({ name, lat, lng, radius_meters, is_active }) {
  const n = validateShopName(name)
  if (!n.ok) return n
  const la = validateLatitude(lat)
  if (!la.ok) return la
  const lo = validateLongitude(lng)
  if (!lo.ok) return lo
  const r = validateRadiusMeters(radius_meters)
  if (!r.ok) return r
  return {
    ok: true,
    payload: {
      name: n.value,
      lat: la.value,
      lng: lo.value,
      radius_meters: r.value,
      is_active: Boolean(is_active),
    },
  }
}
