import { useCallback, useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '@/module1/employees/lib/supabase/client'
import {
  fetchApprovedShopByEmployee,
  fetchEmployeeLocationsSnapshot,
  fetchShopsSnapshot,
  mapLocationRow,
  mapShopRow,
} from '@/module4/monitoring/lib/monitoringApi'

const CHANNEL = 'live-monitoring-unified'

/**
 * Single realtime channel for employee_locations + shops.
 * Reused by Live Monitoring and Realtime Alerts (one subscriber per mounted consumer).
 */
export function useMonitoringStream() {
  const remote = isSupabaseConfigured()
  const [locationsByEmployee, setLocationsByEmployee] = useState(() => ({}))
  const [shopsList, setShopsList] = useState([])
  const [shopsById, setShopsById] = useState(() => new Map())
  const [approvedShopByEmployee, setApprovedShopByEmployee] = useState(() => new Map())
  const [loading, setLoading] = useState(remote)
  const [error, setError] = useState(/** @type {string | null} */ (null))
  const [realtimeStatus, setRealtimeStatus] = useState(/** @type {'idle'|'subscribed'|'error'|'closed'} */ ('idle'))

  const refresh = useCallback(async () => {
    if (!remote) {
      setLocationsByEmployee({})
      setShopsList([])
      setShopsById(new Map())
      setApprovedShopByEmployee(new Map())
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [locMap, shopsData, assignMap] = await Promise.all([
        fetchEmployeeLocationsSnapshot(),
        fetchShopsSnapshot(),
        fetchApprovedShopByEmployee(),
      ])
      setLocationsByEmployee(locMap)
      setShopsList(shopsData.list)
      setShopsById(shopsData.byId)
      setApprovedShopByEmployee(assignMap)
    } catch (e) {
      setError(String(e?.message ?? e))
    } finally {
      setLoading(false)
    }
  }, [remote])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async bootstrap
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!remote || !supabase) return undefined

    const applyLocationPayload = (row) => {
      const m = mapLocationRow(row)
      if (!m?.employee_id) return
      setLocationsByEmployee((prev) => ({ ...prev, [m.employee_id]: m }))
    }

    const removeLocation = (employeeId) => {
      if (!employeeId) return
      setLocationsByEmployee((prev) => {
        const next = { ...prev }
        delete next[String(employeeId)]
        return next
      })
    }

    const applyShopPayload = (row) => {
      const s = mapShopRow(row)
      if (!s?.id) return
      setShopsById((prev) => {
        const next = new Map(prev)
        next.set(s.id, s)
        return next
      })
      setShopsList((prev) => {
        const others = prev.filter((x) => x.id !== s.id)
        return [...others, s].sort((a, b) =>
          String(a.name ?? '')
            .toLowerCase()
            .localeCompare(String(b.name ?? '').toLowerCase(), undefined, { sensitivity: 'base' }),
        )
      })
    }

    const removeShop = (id) => {
      if (!id) return
      setShopsById((prev) => {
        const next = new Map(prev)
        next.delete(String(id))
        return next
      })
      setShopsList((prev) => prev.filter((s) => s.id !== String(id)))
    }

    const channel = supabase
      .channel(CHANNEL)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_locations' }, (payload) => {
        const type = payload?.eventType
        if (type === 'INSERT' || type === 'UPDATE') {
          applyLocationPayload(payload.new ?? {})
          return
        }
        if (type === 'DELETE') {
          const id = payload?.old?.employee_id
          removeLocation(id)
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shops' }, (payload) => {
        const type = payload?.eventType
        if (type === 'INSERT' || type === 'UPDATE') {
          applyShopPayload(payload.new ?? {})
          return
        }
        if (type === 'DELETE') {
          removeShop(payload?.old?.id)
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('subscribed')
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setRealtimeStatus('error')
        else if (status === 'CLOSED') setRealtimeStatus('closed')
      })

    return () => {
      setRealtimeStatus('closed')
      void supabase.removeChannel(channel)
    }
  }, [remote])

  return {
    remote,
    loading,
    error,
    refresh,
    locationsByEmployee,
    shopsList,
    shopsById,
    approvedShopByEmployee,
    realtimeStatus,
  }
}
