import { useMemo, useState } from 'react'
import { Loader2, ShieldAlert } from 'lucide-react'
import { AlertFeedRow } from '@/module4/alerts/components/AlertFeedRow'
import { AlertFiltersToolbar } from '@/module4/alerts/components/AlertFiltersToolbar'
import { AlertSummaryStrip } from '@/module4/alerts/components/AlertSummaryStrip'
import { useAlertEngine } from '@/module4/alerts/hooks/useAlertEngine'
import { filterAlerts } from '@/module4/alerts/lib/alertFilters'
import { Button } from '@/components/ui/button'

export function RealtimeAlertsPage() {
  const {
    remote,
    loading,
    error,
    refresh,
    realtimeStatus,
    visibleAlerts,
    resolveOne,
    clearResolvedForActive,
    counts,
  } = useAlertEngine()

  const [search, setSearch] = useState('')
  const [severity, setSeverity] = useState('all')
  const [type, setType] = useState('all')

  const filtered = useMemo(() => {
    const list = filterAlerts(visibleAlerts, { severity, type, search })
    const rank = { critical: 0, warning: 1, info: 2 }
    return [...list].sort((a, b) => {
      const dr = (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3)
      if (dr !== 0) return dr
      return String(b.recordedAt ?? '').localeCompare(String(a.recordedAt ?? ''))
    })
  }, [visibleAlerts, severity, type, search])

  const liveLabel =
    realtimeStatus === 'subscribed'
      ? 'Stream live'
      : realtimeStatus === 'error'
        ? 'Stream error'
        : 'Stream idle'

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      {remote ? (
        <p className="text-xs font-medium uppercase tracking-wide text-accent">Derived alerts · in-memory only</p>
      ) : null}

      <div className="rounded-3xl border border-[#d2e4eb] bg-white/95 px-5 py-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#193250] md:text-3xl">Realtime alerts</h1>
            <p className="mt-1 max-w-2xl text-sm text-[#667f97]">
              Alerts are computed from the same live stream as <strong>Live monitoring</strong> (no extra
              subscriptions). Resolve hides an alert while the condition still matches; it reappears if the issue
              clears then returns.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>
              Refresh
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={clearResolvedForActive}>
              Un-dismiss current alerts
            </Button>
          </div>
        </div>
      </div>

      <AlertSummaryStrip counts={counts} realtimeLabel={liveLabel} />

      {error ? (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="rounded-3xl border border-[#d2e4eb] bg-white/95 p-4 shadow-sm">
        <AlertFiltersToolbar
          search={search}
          onSearchChange={setSearch}
          severity={severity}
          onSeverityChange={setSeverity}
          type={type}
          onTypeChange={setType}
          disabled={!remote || loading}
        />
      </div>

      {loading && remote ? (
        <div className="flex items-center justify-center gap-2 rounded-3xl border border-dashed border-[#d2e4eb] bg-white/80 py-14 text-[#627f97]">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading stream…
        </div>
      ) : !remote ? (
        <div className="rounded-3xl border border-dashed border-[#d2e4eb] bg-white/80 px-6 py-14 text-center text-sm text-[#627f97]">
          <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-[#8ab8c7]" />
          <p className="font-medium text-[#193250]">Supabase not configured</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#d2e4eb] bg-white/80 px-6 py-14 text-center text-sm text-[#627f97]">
          <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-[#8ab8c7]" />
          <p className="font-medium text-[#193250]">No alerts to show</p>
          <p className="mt-1">Adjust filters or resolve items. When everything looks healthy, this feed stays empty.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((alert) => (
            <AlertFeedRow key={alert.dedupeKey} alert={alert} onResolve={resolveOne} />
          ))}
        </div>
      )}
    </div>
  )
}
