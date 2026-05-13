import { useCallback, useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured, supabase } from '@/module1/employees/lib/supabase/client'
import { mapShopRow, listShops } from '@/module3/shops/lib/shopsApi'

const CHANNEL = 'shops-admin-realtime'

function sortShops(a, b) {
  const an = String(a.name ?? '').toLowerCase()
  const bn = String(b.name ?? '').toLowerCase()
  return an.localeCompare(bn, undefined, { sensitivity: 'base' })
}

export function useShops() {
  const remote = isSupabaseConfigured()
  const [shops, setShops] = useState([])
  const [loading, setLoading] = useState(remote)
  const [error, setError] = useState(/** @type {string | null} */ (null))
  const [realtimeStatus, setRealtimeStatus] = useState(/** @type {'idle'|'subscribed'|'error'|'closed'} */ ('idle'))

  const refresh = useCallback(async () => {
    if (!remote) {
      setShops([])
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const rows = await listShops()
      setShops(rows)
    } catch (e) {
      setError(String(e?.message ?? e))
      setShops([])
    } finally {
      setLoading(false)
    }
  }, [remote])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async Supabase bootstrap (same pattern as EmployeesContext)
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!remote || !supabase) return undefined

    const channel = supabase
      .channel(CHANNEL)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shops' }, (payload) => {
        const type = payload?.eventType
        if (type === 'INSERT') {
          const next = mapShopRow(payload.new ?? {})
          if (!next?.id) return
          setShops((prev) => [...prev.filter((s) => s.id !== next.id), next].sort(sortShops))
          return
        }
        if (type === 'UPDATE') {
          const next = mapShopRow(payload.new ?? {})
          if (!next?.id) return
          setShops((prev) => prev.map((s) => (s.id === next.id ? next : s)).sort(sortShops))
          return
        }
        if (type === 'DELETE') {
          const id = payload?.old?.id != null ? String(payload.old.id) : ''
          if (!id) return
          setShops((prev) => prev.filter((s) => s.id !== id))
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('subscribed')
        else if (status === 'CHANNEL_ERROR') setRealtimeStatus('error')
        else if (status === 'CLOSED') setRealtimeStatus('closed')
        else if (status === 'TIMED_OUT') setRealtimeStatus('error')
      })

    return () => {
      setRealtimeStatus('closed')
      void supabase.removeChannel(channel)
    }
  }, [remote])

  const value = useMemo(
    () => ({
      shops,
      loading,
      error,
      refresh,
      remote,
      realtimeStatus,
    }),
    [shops, loading, error, refresh, remote, realtimeStatus],
  )

  return value
}
