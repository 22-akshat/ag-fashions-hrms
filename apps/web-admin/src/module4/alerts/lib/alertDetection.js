import { haversineMeters } from '@ag-fashions/shared/geo'
import { RAPID_MOVEMENT_MAX_DELTA_MS, RAPID_MOVEMENT_MIN_METERS } from '@/module4/alerts/lib/alertConstants'

/** @typedef {'critical'|'warning'|'info'} AlertSeverity */
/** @typedef {'outside_geofence'|'gps_stale'|'device_offline'|'rapid_movement'|'missing_gps'|'shop_mismatch'} AlertType */

/**
 * @param {object} row from buildMonitoringRows
 * @param {object | null} prevRow same employee from previous rows snapshot (if any)
 * @param {number} nowMs
 */
export function deriveAlertsForRow(row, prevRow) {
  /** @type {{ dedupeKey: string, type: AlertType, severity: AlertSeverity, title: string, detail: string, employeeId: string, employeeName: string, recordedAt: string | null }[]} */
  const alerts = []
  const emp = row.employee
  const employeeId = String(emp.id ?? '')
  const employeeName = String(emp.full_name ?? '').trim() || 'Unnamed employee'
  const loc = row.location
  const recordedAt = loc?.recorded_at ?? null
  const { freshness, presence, assignedShopId, nearestShop } = row

  const isActive = String(emp.status ?? 'Active') === 'Active'

  if (isActive && !loc) {
    alerts.push({
      dedupeKey: `missing_gps:${employeeId}`,
      type: 'missing_gps',
      severity: 'warning',
      title: 'Missing GPS updates',
      detail: 'No location row in employee_locations yet (or cleared).',
      employeeId,
      employeeName,
      recordedAt: null,
    })
  }

  if (loc && freshness === 'offline') {
    alerts.push({
      dedupeKey: `device_offline:${employeeId}`,
      type: 'device_offline',
      severity: 'warning',
      title: 'Device offline',
      detail: 'Last GPS fix is older than 30 minutes.',
      employeeId,
      employeeName,
      recordedAt,
    })
  }

  if (loc && freshness === 'stale') {
    alerts.push({
      dedupeKey: `gps_stale:${employeeId}`,
      type: 'gps_stale',
      severity: 'info',
      title: 'GPS stale',
      detail: 'Last fix between 10 and 30 minutes ago.',
      employeeId,
      employeeName,
      recordedAt,
    })
  }

  if (presence.known && presence.inside === false && freshness !== 'offline') {
    const sev = freshness === 'online' ? 'critical' : 'warning'
    alerts.push({
      dedupeKey: `outside_geofence:${employeeId}`,
      type: 'outside_geofence',
      severity: sev,
      title: 'Outside geofence',
      detail: `Outside reference shop radius (~${Math.round(presence.distanceMeters ?? 0)} m).`,
      employeeId,
      employeeName,
      recordedAt,
    })
  }

  if (
    assignedShopId &&
    nearestShop?.id &&
    assignedShopId !== nearestShop.id &&
    loc &&
    Number.isFinite(Number(loc.lat)) &&
    Number.isFinite(Number(loc.lng))
  ) {
    alerts.push({
      dedupeKey: `shop_mismatch:${employeeId}`,
      type: 'shop_mismatch',
      severity: 'info',
      title: 'Shop mismatch',
      detail: 'Nearest active shop differs from approved access-request shop for this employee.',
      employeeId,
      employeeName,
      recordedAt,
    })
  }

  const prevLoc = prevRow?.location
  if (
    loc &&
    prevLoc &&
    loc.recorded_at &&
    prevLoc.recorded_at &&
    String(loc.recorded_at) !== String(prevLoc.recorded_at)
  ) {
    const t0 = new Date(prevLoc.recorded_at).getTime()
    const t1 = new Date(loc.recorded_at).getTime()
    const dt = t1 - t0
    if (dt > 0 && dt <= RAPID_MOVEMENT_MAX_DELTA_MS) {
      const d = haversineMeters(Number(prevLoc.lat), Number(prevLoc.lng), Number(loc.lat), Number(loc.lng))
      if (d >= RAPID_MOVEMENT_MIN_METERS) {
        alerts.push({
          dedupeKey: `rapid_movement:${employeeId}`,
          type: 'rapid_movement',
          severity: 'critical',
          title: 'Rapid movement',
          detail: `~${Math.round(d / 1000)} km in ${Math.round(dt / 1000)}s between consecutive fixes.`,
          employeeId,
          employeeName,
          recordedAt,
        })
      }
    }
  }

  return alerts
}

/**
 * @param {object[]} rows current monitoring rows
 * @param {object[] | null} prevRows previous render snapshot (same shape as rows)
 */
export function deriveAllAlerts(rows, prevRows) {
  const prevMap = new Map()
  if (Array.isArray(prevRows)) {
    for (const r of prevRows) {
      const id = String(r.employee?.id ?? '')
      if (id) prevMap.set(id, r)
    }
  }
  const list = []
  for (const row of rows) {
    const id = String(row.employee?.id ?? '')
    const prev = prevMap.get(id) ?? null
    list.push(...deriveAlertsForRow(row, prev))
  }
  return list
}
