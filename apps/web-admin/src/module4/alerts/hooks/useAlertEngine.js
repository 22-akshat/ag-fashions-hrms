import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEmployees } from '@/module1/employees/context/EmployeesContext'
import { deriveAllAlerts } from '@/module4/alerts/lib/alertDetection'
import { buildMonitoringRows } from '@/module4/monitoring/lib/buildMonitoringRows'
import { useClockTick } from '@/module4/monitoring/hooks/useClockTick'
import { useMonitoringStream } from '@/module4/monitoring/hooks/useMonitoringStream'

export function useAlertEngine() {
  const { employees } = useEmployees()
  const clock = useClockTick()
  const stream = useMonitoringStream()
  const { remote, loading, error, refresh, locationsByEmployee, shopsList, shopsById, approvedShopByEmployee, realtimeStatus } =
    stream

  const prevCommittedRef = useRef(/** @type {object[] | null} */ (null))

  const activeShops = useMemo(() => shopsList.filter((s) => s.is_active), [shopsList])

  const rows = useMemo(() => {
    void clock.tick
    return buildMonitoringRows({
      employees,
      locationsByEmployee,
      shopsById,
      approvedShopByEmployee,
      activeShops,
      nowMs: clock.nowMs,
    })
  }, [employees, locationsByEmployee, shopsById, approvedShopByEmployee, activeShops, clock.tick, clock.nowMs])

  const [rawAlerts, setRawAlerts] = useState(/** @type {ReturnType<typeof deriveAllAlerts>} */ ([]))

  useEffect(() => {
    const prevSnapshot = prevCommittedRef.current
    setRawAlerts(deriveAllAlerts(rows, prevSnapshot))
    prevCommittedRef.current = rows
  }, [rows, clock.tick, clock.nowMs])

  const [resolved, setResolved] = useState(() => new Set())

  useEffect(() => {
    const activeKeys = new Set(rawAlerts.map((a) => a.dedupeKey))
    // eslint-disable-next-line react-hooks/set-state-in-effect -- prune dismissed keys when firing set changes
    setResolved((prev) => {
      const next = new Set()
      for (const k of prev) {
        if (activeKeys.has(k)) next.add(k)
      }
      return next
    })
  }, [rawAlerts])

  const visibleAlerts = useMemo(
    () => rawAlerts.filter((a) => !resolved.has(a.dedupeKey)),
    [rawAlerts, resolved],
  )

  const resolveOne = useCallback((dedupeKey) => {
    setResolved((prev) => new Set(prev).add(dedupeKey))
  }, [])

  const clearResolvedForActive = useCallback(() => {
    const activeKeys = new Set(rawAlerts.map((a) => a.dedupeKey))
    setResolved((prev) => {
      const next = new Set(prev)
      for (const k of activeKeys) next.delete(k)
      return next
    })
  }, [rawAlerts])

  const counts = useMemo(() => {
    const v = visibleAlerts
    return {
      total: v.length,
      critical: v.filter((a) => a.severity === 'critical').length,
      warning: v.filter((a) => a.severity === 'warning').length,
      info: v.filter((a) => a.severity === 'info').length,
    }
  }, [visibleAlerts])

  return {
    remote,
    loading,
    error,
    refresh,
    realtimeStatus,
    rows,
    rawAlerts,
    visibleAlerts,
    resolveOne,
    clearResolvedForActive,
    counts,
  }
}
