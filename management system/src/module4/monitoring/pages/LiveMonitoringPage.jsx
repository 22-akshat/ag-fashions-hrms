import { useMemo, useState } from 'react'
import { Loader2, MapPin } from 'lucide-react'
import { useEmployees } from '@/module1/employees/context/EmployeesContext'
import { EmployeeMonitorTable } from '@/module4/monitoring/components/EmployeeMonitorTable'
import { MonitoringSummaryStrip } from '@/module4/monitoring/components/MonitoringSummaryStrip'
import { MonitoringToolbar } from '@/module4/monitoring/components/MonitoringToolbar'
import { useLiveMonitoring } from '@/module4/monitoring/hooks/useLiveMonitoring'
import { Button } from '@/components/ui/button'

function matchesSearch(employee, q) {
  if (!q.trim()) return true
  const s = q.toLowerCase().trim()
  const pool = [employee.card_no, employee.full_name].filter(Boolean).join(' ').toLowerCase()
  return pool.includes(s) || pool.split(/\s+/).some((w) => w.includes(s))
}

export function LiveMonitoringPage() {
  const { employees, loading: employeesLoading, loadError, refresh: refreshEmployees, remote } = useEmployees()
  const { loading, error, refresh, rows, shopsCount, realtimeStatus } = useLiveMonitoring(employees)

  const [search, setSearch] = useState('')
  const [freshnessFilter, setFreshnessFilter] = useState('all')
  const [presenceFilter, setPresenceFilter] = useState('all')

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (!matchesSearch(r.employee, search)) return false
      if (freshnessFilter !== 'all' && r.freshness !== freshnessFilter) return false
      if (presenceFilter === 'inside') {
        if (!r.presence.known || r.presence.inside !== true) return false
      } else if (presenceFilter === 'outside') {
        if (!r.presence.known || r.presence.inside !== false) return false
      } else if (presenceFilter === 'unknown') {
        if (r.presence.known) return false
      }
      return true
    })
  }, [rows, search, freshnessFilter, presenceFilter])

  const counts = useMemo(() => {
    const total = employees.length
    let online = 0
    let stale = 0
    let offline = 0
    let outsideAlerts = 0
    for (const r of rows) {
      if (r.freshness === 'online') online += 1
      else if (r.freshness === 'stale') stale += 1
      else offline += 1
      if (r.outsideAlert) outsideAlerts += 1
    }
    return { total, online, stale, offline, outsideAlerts }
  }, [rows, employees.length])

  const liveLabel =
    realtimeStatus === 'subscribed'
      ? 'Realtime live'
      : realtimeStatus === 'error'
        ? 'Realtime error'
        : 'Realtime idle'

  const busy = employeesLoading || (remote && loading)

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      {remote ? (
        <p className="text-xs font-medium uppercase tracking-wide text-accent">Live data: locations + shops</p>
      ) : null}

      <div className="rounded-3xl border border-[#d2e4eb] bg-white/95 px-5 py-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#193250] md:text-3xl">Live monitoring</h1>
            <p className="mt-1 max-w-2xl text-sm text-[#667f97]">
              GPS freshness: <strong>Online</strong> if last fix under 10 minutes, <strong>Stale</strong> between 10
              and 30 minutes, <strong>Offline</strong> if no fix for over 30 minutes or never reported. Shop presence
              uses the latest <em>approved</em> access-request store when available; otherwise the nearest{' '}
              <strong>active</strong> shop to the last position.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => void refresh()}>
            Refresh data
          </Button>
        </div>
      </div>

      <MonitoringSummaryStrip counts={counts} realtimeLabel={liveLabel} />

      {loadError ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-destructive">{loadError}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void refreshEmployees()}>
            Retry employees
          </Button>
        </div>
      ) : null}

      {error ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-destructive">{error}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>
            Retry
          </Button>
        </div>
      ) : null}

      <div className="rounded-3xl border border-[#d2e4eb] bg-white/95 p-4 shadow-sm">
        <MonitoringToolbar
          search={search}
          onSearchChange={setSearch}
          freshnessFilter={freshnessFilter}
          onFreshnessFilterChange={setFreshnessFilter}
          presenceFilter={presenceFilter}
          onPresenceFilterChange={setPresenceFilter}
          disabled={!remote || busy}
        />
        {remote ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {shopsCount} shop{shopsCount === 1 ? '' : 's'} loaded for geofence reference.
          </p>
        ) : null}
      </div>

      {busy ? (
        <div className="flex items-center justify-center gap-2 rounded-3xl border border-dashed border-[#d2e4eb] bg-white/80 py-16 text-[#627f97]">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading live data…
        </div>
      ) : !remote ? (
        <div className="rounded-3xl border border-dashed border-[#d2e4eb] bg-white/80 px-6 py-14 text-center text-sm text-[#627f97]">
          <MapPin className="mx-auto mb-3 h-10 w-10 text-[#8ab8c7]" />
          <p className="font-medium text-[#193250]">Supabase not configured</p>
          <p className="mt-1">Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable live monitoring.</p>
        </div>
      ) : employees.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#d2e4eb] bg-white/80 px-6 py-14 text-center text-sm text-[#627f97]">
          <MapPin className="mx-auto mb-3 h-10 w-10 text-[#8ab8c7]" />
          <p className="font-medium text-[#193250]">No employees</p>
          <p className="mt-1">Add employees first; location rows appear after mobile attendance tracking syncs.</p>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#d2e4eb] bg-white/80 px-6 py-14 text-center text-sm text-[#627f97]">
          <MapPin className="mx-auto mb-3 h-10 w-10 text-[#8ab8c7]" />
          <p className="font-medium text-[#193250]">No rows match</p>
          <p className="mt-1">Adjust search or filters, or ensure employees have location updates from the mobile app.</p>
        </div>
      ) : (
        <EmployeeMonitorTable rows={filteredRows} />
      )}
    </div>
  )
}
