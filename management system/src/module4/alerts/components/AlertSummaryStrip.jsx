import { Bell, Radio } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export function AlertSummaryStrip({ counts, realtimeLabel }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#d2e4eb] bg-white/90 px-3 py-2 text-xs text-[#4a6b82]">
      <span className="inline-flex items-center gap-1 font-medium text-[#193250]">
        <Bell className="h-3.5 w-3.5" />
        {counts.total} open
      </span>
      <Badge className="bg-[#ffe2df] text-[#b91c1c]">Critical {counts.critical}</Badge>
      <Badge className="bg-[#fff2d9] text-[#b07621]">Warning {counts.warning}</Badge>
      <Badge className="bg-[#e0efff] text-[#3967b4]">Info {counts.info}</Badge>
      <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[#67839a]">
        <Radio className="h-3 w-3" />
        {realtimeLabel}
      </span>
    </div>
  )
}
