/**
 * @param {object[]} alerts
 * @param {{ severity: string, type: string, search: string }} filters
 */
export function filterAlerts(alerts, { severity, type, search }) {
  const q = String(search ?? '').trim().toLowerCase()
  return alerts.filter((a) => {
    if (severity !== 'all' && a.severity !== severity) return false
    if (type !== 'all' && a.type !== type) return false
    if (!q) return true
    const pool = [a.employeeName, a.title, a.detail, a.type].join(' ').toLowerCase()
    return pool.includes(q) || pool.split(/\s+/).some((w) => w.includes(q))
  })
}
