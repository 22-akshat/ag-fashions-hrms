import { useMemo } from 'react'
import { buildMonitoringRows } from '@/module4/monitoring/lib/buildMonitoringRows'
import { useClockTick } from '@/module4/monitoring/hooks/useClockTick'
import { useMonitoringStream } from '@/module4/monitoring/hooks/useMonitoringStream'

export function useLiveMonitoring(employees) {
  const clock = useClockTick()
  const stream = useMonitoringStream()
  const { remote, locationsByEmployee, shopsList, shopsById, approvedShopByEmployee, loading, error, refresh, realtimeStatus } =
    stream

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

  return {
    remote,
    loading,
    error,
    refresh,
    rows,
    shopsCount: shopsList.length,
    realtimeStatus,
  }
}
