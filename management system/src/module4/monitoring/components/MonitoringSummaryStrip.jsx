import { AlertTriangle, Radio, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export function MonitoringSummaryStrip({ counts, realtimeLabel }) {
  const { total, online, stale, offline, outsideAlerts } = counts
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#d2e4eb] bg-white/90 px-3 py-2 text-xs text-[#4a6b82]">
      <span className="inline-flex items-center gap-1 font-medium text-[#193250]">
        <Users className="h-3.5 w-3.5" />
        {total} employees
      </span>
      <Badge className="bg-[#dcf5e6] text-[#2d8a58]">Online {online}</Badge>
      <Badge className="bg-[#fff2d9] text-[#b07621]">Stale {stale}</Badge>
      <Badge variant="secondary">Offline {offline}</Badge>
      {outsideAlerts > 0 ? (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Outside {outsideAlerts}
        </Badge>
      ) : null}
      <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[#67839a]">
        <Radio className="h-3 w-3" />
        {realtimeLabel}
      </span>
    </div>
  )
}
