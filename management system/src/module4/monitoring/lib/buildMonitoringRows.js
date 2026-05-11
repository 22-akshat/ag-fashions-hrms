import { gpsFreshness, nearestActiveShop, resolveReferenceShop, shopPresence } from '@/module4/monitoring/lib/statusEngine'

/**
 * @param {object} params
 * @param {object[]} params.employees
 * @param {Record<string, object>} params.locationsByEmployee
 * @param {Map<string, object>} params.shopsById
 * @param {Map<string, string>} params.approvedShopByEmployee
 * @param {object[]} params.activeShops
 * @param {number} [params.nowMs] for tests; defaults to Date.now()
 */
export function buildMonitoringRows({
  employees,
  locationsByEmployee,
  shopsById,
  approvedShopByEmployee,
  activeShops,
  nowMs = Date.now(),
}) {
  const list = Array.isArray(employees) ? employees : []
  return list.map((emp) => {
    const id = String(emp.id ?? '')
    const loc = locationsByEmployee[id] ?? null
    const recordedAt = loc?.recorded_at ?? null
    const freshness = gpsFreshness(recordedAt, nowMs)
    const assignedShopId = approvedShopByEmployee.get(id) ?? null
    const nearestShop = nearestActiveShop(loc, activeShops)
    const refShop = resolveReferenceShop(id, approvedShopByEmployee, shopsById, loc, activeShops)
    const presence = shopPresence(loc, refShop)
    const outsideAlert = presence.known && presence.inside === false && freshness !== 'offline'

    return {
      employee: emp,
      location: loc,
      freshness,
      assignedShopId,
      nearestShop,
      referenceShop: refShop,
      presence,
      outsideAlert,
      distanceMeters: presence.distanceMeters,
    }
  })
}
