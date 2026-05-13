import { memo } from 'react'
import { Check, User } from 'lucide-react'
import { AlertSeverityBadge } from '@/module4/alerts/components/AlertSeverityBadge'
import { Button } from '@/components/ui/button'

function formatWhen(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return '—'
  }
}

function AlertFeedRowInner({ alert, onResolve }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[#d2e4eb] bg-white p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <AlertSeverityBadge severity={alert.severity} />
          <span className="rounded bg-[#edf6fb] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#607b94]">
            {String(alert.type).replace(/_/g, ' ')}
          </span>
        </div>
        <p className="font-semibold text-[#193250]">{alert.title}</p>
        <p className="text-sm text-[#627f97]">{alert.detail}</p>
        <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <User className="h-3.5 w-3.5" />
          {alert.employeeName}
          <span className="text-[10px]">·</span>
          Last fix: {formatWhen(alert.recordedAt)}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0 border-[#c4dae2]"
        onClick={() => onResolve?.(alert.dedupeKey)}
      >
        <Check className="mr-1 h-3.5 w-3.5" />
        Resolve
      </Button>
    </div>
  )
}

function propsEqual(p, n) {
  return (
    p.alert.dedupeKey === n.alert.dedupeKey &&
    p.alert.severity === n.alert.severity &&
    p.alert.recordedAt === n.alert.recordedAt &&
    p.alert.detail === n.alert.detail
  )
}

export const AlertFeedRow = memo(AlertFeedRowInner, propsEqual)
