import { haversineMeters } from '@ag-fashions/shared/geo'
import { OFFLINE_THRESHOLD_MS, ONLINE_THRESHOLD_MS } from '@/module4/monitoring/lib/constants'

/**
 * @param {string | null | undefined} recordedAt ISO timestamp from employee_locations.recorded_at
 * @param {number} [nowMs]
 * @returns {'online' | 'stale' | 'offline'}
 */
export function gpsFreshness(recordedAt, nowMs = Date.now()) {
  if (!recordedAt) return 'offline'
  const t = new Date(recordedAt).getTime()
  if (Number.isNaN(t)) return 'offline'
  const age = nowMs - t
  if (age < ONLINE_THRESHOLD_MS) return 'online'
  if (age < OFFLINE_THRESHOLD_MS) return 'stale'
  return 'offline'
}

/**
 * @param {{ lat: number, lng: number } | null | undefined} loc
 * @param {{ lat: number, lng: number, radius_meters: number } | null | undefined} shop
 * @returns {{ known: boolean, inside: boolean | null, distanceMeters: number | null }}
 */
export function shopPresence(loc, shop) {
  if (!loc || !shop) return { known: false, inside: null, distanceMeters: null }
  const lat = Number(loc.lat)
  const lng = Number(loc.lng)
  const slat = Number(shop.lat)
  const slng = Number(shop.lng)
  const radius = Number(shop.radius_meters)
  if (![lat, lng, slat, slng, radius].every((n) => Number.isFinite(n))) {
    return { known: false, inside: null, distanceMeters: null }
  }
  const d = haversineMeters(lat, lng, slat, slng)
  return {
    known: true,
    inside: d <= radius,
    distanceMeters: d,
  }
}

/**
 * Pick reference shop: latest approved access request shop for employee, else nearest active shop to location.
 * @param {string} employeeId
 * @param {Map<string, string>} employeeIdToShopId
 * @param {Map<string, object>} shopsById
 * @param {{ lat: number, lng: number } | null} loc
 * @param {object[]} activeShops shops with is_active true
 */
/** Nearest active shop by straight-line distance (no access-request preference). */
export function nearestActiveShop(loc, activeShops) {
  if (!loc || !activeShops?.length) return null
  const lat = Number(loc.lat)
  const lng = Number(loc.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  let best = null
  let bestD = Infinity
  for (const s of activeShops) {
    const d = haversineMeters(lat, lng, Number(s.lat), Number(s.lng))
    if (d < bestD) {
      bestD = d
      best = s
    }
  }
  return best
}

export function resolveReferenceShop(employeeId, employeeIdToShopId, shopsById, loc, activeShops) {
  const fromRequest = employeeIdToShopId.get(employeeId)
  if (fromRequest) {
    const s = shopsById.get(fromRequest)
    if (s) return s
  }
  return nearestActiveShop(loc, activeShops)
}
